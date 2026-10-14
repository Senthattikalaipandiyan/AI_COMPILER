import React from 'react';
import Editor from '@monaco-editor/react';
import {
  Binary,
  Copy,
  Check,
  Download,
  Clock,
  Layers,
  Zap,
  Repeat,
  HardDrive,
} from 'lucide-react';
import type { CompileResponse } from '../../types';

interface MLIRInspectorTabProps {
  compileResult: CompileResponse | null;
  isCompiling: boolean;
}

export const MLIRInspectorTab: React.FC<MLIRInspectorTabProps> = ({
  compileResult,
  isCompiling,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!compileResult?.mlir) return;
    navigator.clipboard.writeText(compileResult.mlir);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!compileResult?.mlir) return;
    const blob = new Blob([compileResult.mlir], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kernel.mlir';
    link.click();
    URL.revokeObjectURL(url);
  };

  const dialects = compileResult?.dialect_info?.dialects_detected || [];
  const info = compileResult?.dialect_info || {};

  return (
    <div className="flex flex-col h-full bg-white font-mono text-xs select-text">
      {/* Subheader with Metrics and Dialect Chips */}
      <div className="h-9 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-slate-600 select-none">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Binary className="w-3.5 h-3.5 text-cyan-600" />
          <span className="text-slate-800 font-medium">MLIR Inspector</span>

          {compileResult && (
            <div className="flex items-center gap-1.5 text-[11px] ml-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-xs">
                <Clock className="w-3 h-3 text-cyan-600" />
                <span>{compileResult.duration_ms} ms</span>
              </span>

              {info.total_lines && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                  {info.total_lines} lines
                </span>
              )}

              {dialects.length > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-slate-500 text-[10px]">Dialects:</span>
                  {dialects.slice(0, 4).map((d) => (
                    <span
                      key={d}
                      className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-semibold"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {compileResult?.mlir && (
            <>
              <button
                onClick={handleCopy}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
                title="Copy MLIR"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownload}
                className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
                title="Download .mlir file"
              >
                <Download className="w-3 h-3" />
                <span>Export</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Compiler Diagnostics Metric Bar (if available) */}
      {compileResult && info && !info.error && (
        <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-4 text-[11px] text-slate-600 select-none overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-emerald-600" />
            <span>Vector Ops:</span>
            <span className="font-semibold text-slate-900">{info.vector_operations || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3 h-3 text-blue-600" />
            <span>Memory Accesses:</span>
            <span className="font-semibold text-slate-900">{info.memory_accesses || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Repeat className="w-3 h-3 text-purple-600" />
            <span>Loop Nests:</span>
            <span className="font-semibold text-slate-900">{info.detected_loops || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-amber-600" />
            <span>Function Count:</span>
            <span className="font-semibold text-slate-900">{info.function_count || 1}</span>
          </div>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 relative w-full h-full bg-white">
        {isCompiling ? (
          <div className="h-full flex flex-col items-center justify-center text-cyan-700 gap-2 animate-pulse">
            <span className="w-3 h-3 rounded-full bg-cyan-600" />
            <span>[Mojo SDK Compiler lower passes in progress...]</span>
          </div>
        ) : compileResult ? (
          <Editor
            height="100%"
            language="llvm"
            theme="vs"
            value={compileResult.mlir}
            options={{
              readOnly: true,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: 'on',
              padding: { top: 10, bottom: 10 },
              overviewRulerBorder: false,
              wordWrap: 'on',
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono select-none">
            <Binary className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-slate-700 font-medium">No MLIR generated yet.</p>
            <p className="text-slate-500">Click &quot;Compile MLIR&quot; or upload an ONNX/PyTorch model to inspect intermediate representation.</p>
          </div>
        )}
      </div>
    </div>
  );
};
