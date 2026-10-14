import React from 'react';
import {
  Cpu,
  Layers,
  RotateCcw,
  Binary,
  Play,
  BarChart2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import type { SystemHealth, PresetKernel } from '../types';

interface HeaderProps {
  health: SystemHealth | null;
  runtime: 'mojo' | 'python';
  onRuntimeChange: (rt: 'mojo' | 'python') => void;
  onExecute: () => void;
  onCompile: () => void;
  onBenchmark: () => void;
  isExecuting: boolean;
  isCompiling: boolean;
  isBenchmarking: boolean;
  presets: Record<string, PresetKernel>;
  selectedPreset: string;
  onSelectPreset: (key: string) => void;
  onResetBlank: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  runtime,
  onRuntimeChange,
  onExecute,
  onCompile,
  onBenchmark,
  isExecuting,
  isCompiling,
  isBenchmarking,
  presets,
  selectedPreset,
  onSelectPreset,
  onResetBlank,
}) => {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 flex items-center justify-between z-30 select-none shadow-xs">
      {/* Brand & System Versions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs">
            <Cpu className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-slate-900">
              NeuralCompile
            </h1>
            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono mt-0.5">
              <span className="flex items-center gap-1.5" title={health?.mojo_version || 'Mojo 1.0.0b2'}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Mojo 1.0.0b2
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5" title={health?.max_version || 'MAX 26.4.0'}>
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                MAX 26.4.0
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5" title={`Python ${health?.python_version || '3.12.3'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Python 3.12.3
              </span>
            </div>
          </div>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="hidden lg:flex items-center gap-2 pl-3 ml-2 border-l border-slate-200">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <div className="relative">
            <select
              value={selectedPreset}
              onChange={(e) => {
                if (e.target.value === 'blank') {
                  onResetBlank();
                } else {
                  onSelectPreset(e.target.value);
                }
              }}
              className="bg-slate-50 text-xs text-slate-800 border border-slate-200 rounded-md px-3 py-1.5 pr-7 focus:outline-none focus:ring-1 focus:ring-slate-300 cursor-pointer appearance-none hover:bg-slate-100/70 shadow-xs font-medium"
            >
              <option value="blank">Blank Editor (Default)</option>
              {Object.entries(presets).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Center/Right Action Controls */}
      <div className="flex items-center gap-2">
        {/* Runtime Switcher Pill (Mojo / Python) */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs mr-1 shadow-xs">
          <button
            onClick={() => onRuntimeChange('mojo')}
            className={`px-3 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
              runtime === 'mojo'
                ? 'bg-white text-orange-600 font-semibold border border-orange-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🔥</span> Mojo
          </button>
          <button
            onClick={() => onRuntimeChange('python')}
            className={`px-3 py-1 rounded font-medium transition-all flex items-center gap-1.5 ${
              runtime === 'python'
                ? 'bg-white text-blue-600 font-semibold border border-blue-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🐍</span> Python
          </button>
        </div>

        {/* Reset Button */}
        <button
          onClick={onResetBlank}
          className="px-3 py-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-md border border-slate-200 shadow-xs transition-colors text-xs flex items-center gap-1.5 font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset</span>
        </button>

        {/* Compile MLIR Button */}
        <button
          onClick={onCompile}
          disabled={isCompiling}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-300 shadow-xs transition-all active:scale-[0.98]"
        >
          {isCompiling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Binary className="w-3.5 h-3.5 text-cyan-700" />
          )}
          <span>Compile MLIR</span>
        </button>

        {/* Execute Button */}
        <button
          onClick={onExecute}
          disabled={isExecuting}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-[0.98]"
        >
          {isExecuting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current text-white" />
          )}
          <span>Execute</span>
        </button>

        {/* Benchmark Button */}
        <button
          onClick={onBenchmark}
          disabled={isBenchmarking}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-300 shadow-xs transition-all active:scale-[0.98]"
        >
          {isBenchmarking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <BarChart2 className="w-3.5 h-3.5 text-purple-700" />
          )}
          <span>Benchmark</span>
        </button>
      </div>
    </header>
  );
};
