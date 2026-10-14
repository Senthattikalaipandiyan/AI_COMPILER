import React from 'react';
import { Sliders, Zap, Grid, Repeat, Cpu } from 'lucide-react';
import type { CompilerFlags } from '../../types';

interface CompilerConfigProps {
  flags: CompilerFlags;
  onChange: (flags: CompilerFlags) => void;
  runtime: 'mojo' | 'python';
}

export const CompilerConfig: React.FC<CompilerConfigProps> = ({
  flags,
  onChange,
  runtime,
}) => {
  const toggleFlag = (key: keyof Omit<CompilerFlags, 'optLevel'>) => {
    onChange({
      ...flags,
      [key]: !flags[key],
    });
  };

  const setOptLevel = (level: string) => {
    onChange({
      ...flags,
      optLevel: level,
    });
  };

  const activeFlagsList = [
    flags.optLevel,
    flags.unroll ? '--unroll' : null,
    flags.vectorize ? '--vectorize' : null,
    flags.tiling ? '--tiling' : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col bg-white border border-slate-200">
      {/* Header */}
      <div className="h-8 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 select-none">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-purple-600" />
          <span className="font-semibold text-slate-800">Compiler Configuration</span>
          {runtime === 'python' && (
            <span className="text-[10px] text-amber-700 font-mono bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              Mojo compiler passes active for Mojo runtime
            </span>
          )}
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          Active: <span className="text-cyan-700 font-semibold">{activeFlagsList.join(' ')}</span>
        </div>
      </div>

      {/* Toggles & Opt Levels */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Optimization Passes Checkboxes */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Optimization Passes
          </span>

          {/* Loop Unrolling */}
          <label className="flex items-start gap-2.5 p-2 rounded-md bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60 cursor-pointer transition-colors group">
            <input
              type="checkbox"
              checked={flags.unroll}
              onChange={() => toggleFlag('unroll')}
              className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500/30 bg-white"
            />
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 group-hover:text-cyan-700 transition-colors">
                <Repeat className="w-3 h-3 text-cyan-600" />
                <span>Loop Unrolling</span>
                <code className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.5 rounded font-mono border border-slate-200/80">--unroll</code>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Expands loop iterations into parallel sequences to reduce branch overhead.
              </p>
            </div>
          </label>

          {/* Memory Tiling */}
          <label className="flex items-start gap-2.5 p-2 rounded-md bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60 cursor-pointer transition-colors group">
            <input
              type="checkbox"
              checked={flags.tiling}
              onChange={() => toggleFlag('tiling')}
              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500/30 bg-white"
            />
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 group-hover:text-purple-700 transition-colors">
                <Grid className="w-3 h-3 text-purple-600" />
                <span>Memory Tiling</span>
                <code className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.5 rounded font-mono border border-slate-200/80">--tiling</code>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Partitions loops into cache-friendly chunks for optimal L1/L2 data locality.
              </p>
            </div>
          </label>

          {/* Vectorization */}
          <label className="flex items-start gap-2.5 p-2 rounded-md bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-slate-100/60 cursor-pointer transition-colors group">
            <input
              type="checkbox"
              checked={flags.vectorize}
              onChange={() => toggleFlag('vectorize')}
              className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 bg-white"
            />
            <div className="flex-1 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-800 group-hover:text-emerald-700 transition-colors">
                <Zap className="w-3 h-3 text-emerald-600" />
                <span>Vectorization</span>
                <code className="text-[10px] text-slate-600 bg-slate-100 px-1 py-0.5 rounded font-mono border border-slate-200/80">--vectorize</code>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Generates SIMD/AVX vector register instructions for parallel numeric throughput.
              </p>
            </div>
          </label>
        </div>

        {/* Optimization Level (-O0 to -O3) */}
        <div className="flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              Optimization Level
            </span>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {['-O0', '-O1', '-O2', '-O3'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setOptLevel(lvl)}
                  className={`py-1.5 text-xs font-mono font-semibold rounded transition-all ${
                    flags.optLevel === lvl
                      ? 'bg-white text-cyan-700 border border-cyan-300 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2 font-mono">
              {flags.optLevel === '-O0' && 'No optimizations; quickest compilation, full debug symbols.'}
              {flags.optLevel === '-O1' && 'Basic optimization pass; simple constant folding.'}
              {flags.optLevel === '-O2' && 'Moderate optimization; dead code elimination and inlining.'}
              {flags.optLevel === '-O3' && 'Aggressive optimization (Default); loop unrolling, vectorization passes.'}
            </p>
          </div>

          <div className="mt-3 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span>Targeting native host CPU with direct MLIR emission.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
