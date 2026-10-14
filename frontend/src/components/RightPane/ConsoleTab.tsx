import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  Copy,
  Check,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Square,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { TerminalStatus, TerminalOutputChunk } from '../../types';

interface ConsoleTabProps {
  pendingRun: { code: string; runtime: 'mojo' | 'python'; id: number } | null;
  onStatusChange: (status: TerminalStatus, isRunning: boolean) => void;
  isExecuting: boolean;
}

const WS_URL =
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
  (window.location.hostname || 'localhost') +
  ':8000/api/ws/terminal';

export const ConsoleTab: React.FC<ConsoleTabProps> = ({
  pendingRun,
  onStatusChange,
  isExecuting,
}) => {
  const [chunks, setChunks] = useState<TerminalOutputChunk[]>([]);
  const [status, setStatus] = useState<TerminalStatus>('ready');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [activeRuntime, setActiveRuntime] = useState<string>('python');
  const [inputVal, setInputVal] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Command & Stdin History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  // Stable reference for onStatusChange to prevent render loops
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  // Track the ID of the last executed run to strictly prevent duplicate runs
  const lastExecutedIdRef = useRef<number>(-1);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Auto-scroll on new chunks or input
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks, inputVal]);

  // Connect WebSocket (isolated: never tears down due to prop changes)
  const connectWs = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'status') {
            const newStatus = msg.status as TerminalStatus;
            setStatus(newStatus);
            const isRun =
              newStatus === 'running' ||
              newStatus === 'compiling' ||
              newStatus === 'waiting_for_input';
            onStatusChangeRef.current(newStatus, isRun);
            if (msg.runtime) {
              setActiveRuntime(msg.runtime);
            }
          } else if (msg.type === 'output') {
            setChunks((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                stream: msg.stream,
                data: msg.data,
              },
            ]);

            // Heuristic to detect waiting for input
            if (msg.stream === 'stdout') {
              const trimmed = (msg.data || '').trimEnd();
              if (
                trimmed.endsWith(':') ||
                trimmed.endsWith('?') ||
                trimmed.endsWith('>') ||
                trimmed.includes('Enter') ||
                trimmed.includes('input')
              ) {
                setStatus('waiting_for_input');
                onStatusChangeRef.current('waiting_for_input', true);
              }
            }
          } else if (msg.type === 'exit') {
            setExitCode(msg.exit_code);
            setDurationMs(msg.execution_time_ms || 0);
            if (msg.runtime) {
              setActiveRuntime(msg.runtime);
            }
            const isSuccess = msg.exit_code === 0;
            const finalStatus = isSuccess ? 'completed' : 'error';
            setStatus(finalStatus);
            onStatusChangeRef.current(finalStatus, false);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWs();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.warn('Terminal WebSocket error:', err);
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
    }
  }, []);

  // Connect once on component mount
  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  // Execute requested program from Header/App ONLY ONCE per pendingRun.id
  useEffect(() => {
    if (!pendingRun || pendingRun.id === lastExecutedIdRef.current) {
      return;
    }

    lastExecutedIdRef.current = pendingRun.id;

    const runNow = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setTimeout(runNow, 100);
        return;
      }

      setExitCode(null);
      setDurationMs(0);
      setActiveRuntime(pendingRun.runtime);
      const initialStatus = pendingRun.runtime === 'mojo' ? 'compiling' : 'running';
      setStatus(initialStatus);
      onStatusChangeRef.current(initialStatus, true);

      // Start with clean slate for the new explicit run
      setChunks([
        {
          id: Math.random().toString(36).substring(2, 9),
          stream: 'system',
          data: `[--- Executing ${pendingRun.runtime.toUpperCase()} session ---]\n`,
        },
      ]);

      wsRef.current.send(
        JSON.stringify({
          type: 'start',
          runtime: pendingRun.runtime,
          code: pendingRun.code,
        })
      );
      inputRef.current?.focus();
    };

    runNow();
  }, [pendingRun?.id]);

  // Send stdin to running process
  const sendStdin = (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Echo input locally so user sees what was typed
    setChunks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        stream: 'stdin',
        data: text + (text.endsWith('\n') ? '' : '\n'),
      },
    ]);

    wsRef.current.send(
      JSON.stringify({
        type: 'stdin',
        data: text,
      })
    );

    // Save to history
    if (text.trim()) {
      setHistory((prev) => [...prev, text.trim()]);
      setHistoryIdx(-1);
    }
  };

  // Run idle shell command (e.g., pip install numpy)
  const runCommand = (cmd: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    setExitCode(null);
    setDurationMs(0);
    setActiveRuntime('shell');
    setStatus('running');
    onStatusChangeRef.current('running', true);

    setChunks((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        stream: 'system',
        data: `\n$ ${cmd}\n`,
      },
    ]);

    wsRef.current.send(
      JSON.stringify({
        type: 'start',
        runtime: 'shell',
        command: cmd,
      })
    );

    if (cmd.trim()) {
      setHistory((prev) => [...prev, cmd.trim()]);
      setHistoryIdx(-1);
    }
  };

  // Interrupt running process (Ctrl+C)
  const handleInterrupt = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    setStatus('stopped');
    onStatusChangeRef.current('stopped', false);
  };

  // Keyboard navigation & Enter submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputVal;
      setInputVal('');

      const isProcessRunning =
        status === 'running' ||
        status === 'compiling' ||
        status === 'waiting_for_input';

      if (isProcessRunning) {
        sendStdin(val);
      } else {
        if (val.trim()) {
          runCommand(val);
        }
      }
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInterrupt();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx =
        historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx === -1) return;
      const nextIdx = historyIdx + 1;
      if (nextIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal('');
      } else {
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx] || '');
      }
    }
  };

  // Handle multi-line matrix pastes
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasteData = e.clipboardData.getData('text');
    const isProcessRunning =
      status === 'running' ||
      status === 'compiling' ||
      status === 'waiting_for_input';

    if (isProcessRunning && pasteData.includes('\n')) {
      e.preventDefault();
      sendStdin(pasteData);
      setInputVal('');
    }
  };

  // Copy full console output
  const handleCopy = () => {
    const text = chunks.map((c) => c.data).join('');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Clear console
  const handleClear = () => {
    setChunks([]);
    setExitCode(null);
    setDurationMs(0);
  };

  const isRunning =
    isExecuting ||
    status === 'running' ||
    status === 'compiling' ||
    status === 'waiting_for_input';

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex flex-col h-full bg-slate-50 font-mono text-xs select-text cursor-text"
    >
      {/* 1. Terminal Subheader */}
      <div className="h-9 px-3 bg-white border-b border-slate-200 flex items-center justify-between text-slate-600 select-none shrink-0">
        <div className="flex items-center gap-3">
          {/* Traffic light dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          </div>

          <span className="text-slate-900 font-semibold flex items-center gap-1.5">
            <TerminalIcon className="w-3.5 h-3.5 text-cyan-600" />
            <span>Interactive Terminal</span>
          </span>

          {/* Dynamic Status Badges */}
          <div className="flex items-center gap-2 text-[11px]">
            {status === 'ready' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Ready</span>
              </span>
            )}

            {status === 'compiling' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 animate-pulse font-medium">
                <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                <span>Compiling (AOT)</span>
              </span>
            )}

            {status === 'running' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 animate-pulse font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>Running</span>
              </span>
            )}

            {status === 'waiting_for_input' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-300 animate-pulse font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-bounce" />
                <span>Waiting for Input</span>
              </span>
            )}

            {status === 'completed' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Completed (Exit {exitCode ?? 0})</span>
              </span>
            )}

            {status === 'error' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                <XCircle className="w-3 h-3 text-rose-600" />
                <span>Exit {exitCode ?? 1}</span>
              </span>
            )}

            {status === 'stopped' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Stopped</span>
              </span>
            )}

            {durationMs > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium">
                <Clock className="w-3 h-3 text-cyan-600" />
                <span>{durationMs} ms</span>
              </span>
            )}

            {activeRuntime && (
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold font-mono">
                {activeRuntime}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInterrupt();
              }}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded flex items-center gap-1 text-[11px] font-medium transition-colors"
              title="Interrupt running process (Ctrl+C)"
            >
              <Square className="w-3 h-3 fill-current text-rose-600" />
              <span>Stop (^C)</span>
            </button>
          )}

          {chunks.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Copy output"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Clear console"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Terminal Body */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-1 font-mono text-xs leading-relaxed select-text bg-white">
        {/* Streamed Output Segments */}
        {chunks.map((c) => {
          if (c.stream === 'stdout') {
            return (
              <span
                key={c.id}
                className="text-slate-800 whitespace-pre-wrap break-words"
              >
                {c.data}
              </span>
            );
          }
          if (c.stream === 'stderr') {
            return (
              <span
                key={c.id}
                className="text-rose-700 font-medium whitespace-pre-wrap break-words"
              >
                {c.data}
              </span>
            );
          }
          if (c.stream === 'compiler') {
            return (
              <span
                key={c.id}
                className="text-amber-800 whitespace-pre-wrap break-words font-medium"
              >
                {c.data}
              </span>
            );
          }
          if (c.stream === 'stdin') {
            return (
              <span
                key={c.id}
                className="text-blue-700 font-semibold whitespace-pre-wrap break-words"
              >
                {c.data}
              </span>
            );
          }
          return (
            <span
              key={c.id}
              className="text-slate-500 italic whitespace-pre-wrap break-words"
            >
              {c.data}
            </span>
          );
        })}

        {/* 3. Direct Input Line with Clean Terminal Arrow Mark */}
        <div className="flex items-center gap-2 pt-1 text-slate-800">
          <span className="text-emerald-600 select-none font-bold text-sm leading-none">
            ❯
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className="flex-1 bg-transparent text-slate-900 focus:outline-none font-mono text-xs caret-emerald-600"
            autoFocus
          />
        </div>

        <div ref={consoleEndRef} />
      </div>
    </div>
  );
};
