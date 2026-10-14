import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { KernelEditor } from './components/LeftPane/KernelEditor';
import { CompilerConfig } from './components/LeftPane/CompilerConfig';
import { ModelDropzone } from './components/LeftPane/ModelDropzone';
import { ConsoleTab } from './components/RightPane/ConsoleTab';
import { MLIRInspectorTab } from './components/RightPane/MLIRInspectorTab';
import { GraphInspectorTab } from './components/RightPane/GraphInspectorTab';
import { BenchmarkCharts } from './components/BottomPanel/BenchmarkCharts';
import {
  Terminal,
  Binary,
  GitBranch,
  Sliders,
  UploadCloud,
  ChevronDown,
} from 'lucide-react';
import {
  fetchHealth,
  fetchPresets,
  compileCode,
  runBenchmark,
} from './services/api';
import type {
  SystemHealth,
  PresetKernel,
  CompilerFlags,
  CompileResponse,
  BenchmarkResponse,
  ModelIngestResponse,
  TerminalStatus,
} from './types';

const INITIAL_CODE = `// Workspace initialized.
// Write custom Mojo/Python code below, or load a preset kernel from the header.`;

export function App() {
  // Core application state
  const [code, setCode] = useState<string>(INITIAL_CODE);
  const [runtime, setRuntime] = useState<'mojo' | 'python'>('mojo');
  const [flags, setFlags] = useState<CompilerFlags>({
    unroll: true,
    vectorize: true,
    tiling: false,
    optLevel: '-O3',
  });

  // Active right pane tab: 'console' | 'mlir' | 'graph' (default to console for interactive workflow)
  const [activeTab, setActiveTab] = useState<'console' | 'mlir' | 'graph'>('console');

  // Collapsible drawers for advanced left-pane tools
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showDropzone, setShowDropzone] = useState<boolean>(false);

  // Operation results
  const [compileResult, setCompileResult] = useState<CompileResponse | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResponse | null>(null);
  const [modelResult, setModelResult] = useState<ModelIngestResponse | null>(null);

  // Loading states
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);

  // Interactive Terminal state
  const [pendingRun, setPendingRun] = useState<{
    code: string;
    runtime: 'mojo' | 'python';
    id: number;
  } | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>('ready');

  // Metadata
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [presets, setPresets] = useState<Record<string, PresetKernel>>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('blank');

  // Initial data loading from backend API
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => console.warn('Health check warning:', err));

    fetchPresets()
      .then((data) => setPresets(data))
      .catch((err) => console.warn('Presets load warning:', err));
  }, []);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        handleCompile();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'B' || e.key === 'b')) {
        e.preventDefault();
        handleBenchmark();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Preset selection handler
  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    const p = presets[key];
    if (p) {
      setCode(runtime === 'mojo' ? p.mojo : p.python);
    }
  };

  const handleResetBlank = () => {
    setSelectedPreset('blank');
    setCode(INITIAL_CODE);
    setCompileResult(null);
  };

  const handleRuntimeChange = (newRuntime: 'mojo' | 'python') => {
    setRuntime(newRuntime);
    if (selectedPreset && presets[selectedPreset]) {
      const p = presets[selectedPreset];
      setCode(newRuntime === 'mojo' ? p.mojo : p.python);
    }
  };

  const handleTerminalStatusChange = useCallback((newStatus: TerminalStatus, running: boolean) => {
    setTerminalStatus(newStatus);
    setIsExecuting(running);
  }, []);

  // Live Interactive Execute Handler
  const handleExecute = () => {
    setActiveTab('console');
    setPendingRun({
      code,
      runtime,
      id: Date.now(),
    });
  };

  // Live Compile MLIR Handler
  const handleCompile = async () => {
    if (!code.trim() || code === INITIAL_CODE) {
      setActiveTab('mlir');
      setCompileResult({
        mlir: '// Error: Please enter code before compiling MLIR representation.',
        dialect_info: { error: 'Empty code' },
        compiler_diagnostics: 'No code provided',
        duration_ms: 0,
        success: false,
      });
      return;
    }

    const flagsList = [
      flags.unroll ? '--unroll' : null,
      flags.vectorize ? '--vectorize' : null,
      flags.tiling ? '--tiling' : null,
    ].filter(Boolean) as string[];

    try {
      setIsCompiling(true);
      setActiveTab('mlir');
      const res = await compileCode(code, flagsList, flags.optLevel);
      setCompileResult(res);
    } catch (err: any) {
      setCompileResult({
        mlir: `// Compilation error: ${err.message}`,
        dialect_info: { error: err.message },
        compiler_diagnostics: err.message,
        duration_ms: 0,
        success: false,
      });
    } finally {
      setIsCompiling(false);
    }
  };

  // Live Benchmark Handler
  const handleBenchmark = async () => {
    let pyCode = '';
    let mojoCode = '';

    if (selectedPreset && presets[selectedPreset]) {
      pyCode = presets[selectedPreset].python;
      mojoCode = presets[selectedPreset].mojo;
    } else if (runtime === 'mojo') {
      mojoCode = code;
      pyCode = presets['gemm']?.python || code;
    } else {
      pyCode = code;
      mojoCode = presets['gemm']?.mojo || code;
    }

    try {
      setIsBenchmarking(true);
      const res = await runBenchmark(pyCode, mojoCode, '', 2);
      setBenchmarkResult(res);
    } catch (err: any) {
      console.warn('Benchmark call failed:', err);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Model Ingestion Handler
  const handleModelIngested = (res: ModelIngestResponse) => {
    setModelResult(res);
    setCompileResult({
      mlir: res.mlir,
      dialect_info: {
        total_lines: res.mlir.split('\n').length,
        dialects_detected: ['mo.graph', 'rmo', 'max.mo'],
        function_count: 1,
      },
      compiler_diagnostics: `MAX Engine compiled ${res.filename} (${res.layer_count} nodes)`,
      duration_ms: 42.0,
      success: true,
    });
    setActiveTab('graph');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* 1. Top Navigation Bar */}
      <Header
        health={health}
        runtime={runtime}
        onRuntimeChange={handleRuntimeChange}
        onExecute={handleExecute}
        onCompile={handleCompile}
        onBenchmark={handleBenchmark}
        isExecuting={isExecuting}
        isCompiling={isCompiling}
        isBenchmarking={isBenchmarking}
        presets={presets}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
        onResetBlank={handleResetBlank}
      />

      {/* 2. Main Middle Viewport */}
      <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden bg-slate-100/60">
        <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
          {/* Left Column: Kernel Editor & Config Drawers (RuntimeInput removed for direct terminal stdin) */}
          <div className="w-full lg:w-1/2 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
            {/* Kernel Monaco Editor */}
            <div className="flex-1 min-h-[300px]">
              <KernelEditor
                code={code}
                onChange={setCode}
                runtime={runtime}
              />
            </div>

            {/* Expandable Compiler Configuration & Model Ingest */}
            <div className="flex items-center gap-2 pt-1 text-xs shrink-0">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                  showConfig
                    ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                }`}
              >
                <Sliders className="w-3 h-3 text-purple-600" />
                <span>Compiler Flags</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showConfig ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={() => setShowDropzone(!showDropzone)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                  showDropzone
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-xs'
                }`}
              >
                <UploadCloud className="w-3 h-3 text-cyan-600" />
                <span>Upload Model (.onnx, .pth)</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showDropzone ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Conditionally Expanded Compiler Config */}
            {showConfig && (
              <div className="shrink-0 rounded-lg border border-slate-200 bg-white max-h-[320px] overflow-y-auto shadow-xs">
                <CompilerConfig
                  flags={flags}
                  onChange={setFlags}
                  runtime={runtime}
                />
              </div>
            )}

            {/* Conditionally Expanded Model Dropzone */}
            {showDropzone && (
              <div className="shrink-0 rounded-lg border border-slate-200 bg-white max-h-[320px] overflow-y-auto shadow-xs">
                <ModelDropzone
                  onModelIngested={handleModelIngested}
                  isIngesting={isIngesting}
                  setIsIngesting={setIsIngesting}
                  lastIngestedModel={modelResult}
                />
              </div>
            )}
          </div>

          {/* Right Column: Inspector Tabs */}
          <div className="w-full lg:w-1/2 flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
            {/* Inspector Tab Bar */}
            <div className="h-10 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs select-none shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('console')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                    activeTab === 'console'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Terminal</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isExecuting
                        ? 'bg-emerald-500 animate-ping'
                        : terminalStatus === 'error'
                        ? 'bg-rose-500'
                        : terminalStatus === 'completed'
                        ? 'bg-emerald-500'
                        : 'bg-slate-400'
                    }`}
                  />
                </button>

                <button
                  onClick={() => setActiveTab('mlir')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                    activeTab === 'mlir'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <Binary className="w-3.5 h-3.5 text-slate-500" />
                  <span>MLIR Inspector</span>
                  {compileResult && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('graph')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded transition-colors ${
                    activeTab === 'graph'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                  <span>Model Graph</span>
                  {modelResult && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-700 font-mono">
                      {modelResult.layer_count}
                    </span>
                  )}
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                Interactive Session
              </span>
            </div>

            {/* Tab Viewport - persistent DOM to maintain terminal session */}
            <div className="flex-1 min-h-0 bg-white relative overflow-hidden">
              <div className={activeTab === 'console' ? 'h-full flex flex-col' : 'hidden'}>
                <ConsoleTab
                  pendingRun={pendingRun}
                  onStatusChange={handleTerminalStatusChange}
                  isExecuting={isExecuting}
                />
              </div>

              <div className={activeTab === 'graph' ? 'h-full overflow-y-auto' : 'hidden'}>
                <GraphInspectorTab model={modelResult} />
              </div>

              <div className={activeTab === 'mlir' ? 'h-full overflow-y-auto' : 'hidden'}>
                <MLIRInspectorTab
                  compileResult={compileResult}
                  isCompiling={isCompiling}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Panel: Live Benchmarking & Resource Profiler */}
        <div className="h-44 shrink-0">
          <BenchmarkCharts
            benchmark={benchmarkResult}
            isBenchmarking={isBenchmarking}
            onRerunBenchmark={handleBenchmark}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
