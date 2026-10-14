import React from 'react';
import { BarChart3, Info, HardDrive, Cpu, Loader2 } from 'lucide-react';
import type { BenchmarkResponse } from '../../types';

interface BenchmarkChartsProps {
  benchmark?: BenchmarkResponse | null;
  isBenchmarking?: boolean;
  onRerunBenchmark?: () => void;
}

export const BenchmarkCharts: React.FC<BenchmarkChartsProps> = ({
  benchmark,
  isBenchmarking = false,
  onRerunBenchmark,
}) => {
  // Latency metrics (ms)
  const pyLatency = benchmark?.python?.latency_ms ?? 88.5;
  const mojoLatency = benchmark?.mojo?.latency_ms ?? 24.2;
  const maxLatency = Math.max(pyLatency, mojoLatency, 100);
  const pyLatencyWidth = Math.min(Math.max((pyLatency / maxLatency) * 100, 5), 100);
  const mojoLatencyWidth = Math.min(Math.max((mojoLatency / maxLatency) * 100, 5), 100);

  // Peak memory metrics (MB)
  const pyMemory = benchmark?.python?.peak_memory_mb ?? 10.8;
  const mojoMemory = benchmark?.mojo?.peak_memory_mb ?? 22.4;
  const maxMemory = Math.max(pyMemory, mojoMemory, 24);
  const pyMemoryWidth = Math.min(Math.max((pyMemory / maxMemory) * 100, 5), 100);
  const mojoMemoryWidth = Math.min(Math.max((mojoMemory / maxMemory) * 100, 5), 100);

  // CPU utilization metrics (%)
  const pyCpu = benchmark?.python?.cpu_utilization_pct ?? 450;
  const mojoCpu = benchmark?.mojo?.cpu_utilization_pct ?? 445;
  const maxCpu = Math.max(pyCpu, mojoCpu, 600);
  const pyCpuWidth = Math.min(Math.max((pyCpu / maxCpu) * 100, 5), 100);
  const mojoCpuWidth = Math.min(Math.max((mojoCpu / maxCpu) * 100, 5), 100);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs select-none">
      {/* Top Header Bar */}
      <div className="h-8 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs select-none">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-900">
            Live Benchmarking &amp; Resource Profiler
          </span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            (psutil RSS memory sampling • nanosecond clock resolution)
          </span>
        </div>

        <button
          onClick={onRerunBenchmark}
          disabled={isBenchmarking}
          className="px-2.5 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-sans font-medium transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] shadow-xs"
        >
          {isBenchmarking ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              <span>Running Passes...</span>
            </>
          ) : (
            <span>Re-run Benchmark</span>
          )}
        </button>
      </div>

      {/* 3 Horizontal Bar Charts Side-by-Side */}
      <div className="flex-1 p-3 grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/60">
        {/* Chart 1: Execution Latency */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Info className="w-3 h-3 text-slate-500" />
              <span>Execution Latency</span>
            </div>
            <span className="text-[10px] font-mono">
              {benchmark ? (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {benchmark.speedup_factor.toFixed(1)}x speedup
                </span>
              ) : (
                <span className="text-slate-500">(lower is better)</span>
              )}
            </span>
          </div>

          <div className="space-y-2 py-2">
            {/* Python Bar */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-14 text-right text-slate-600 text-[11px] shrink-0 font-medium">Python 🐍</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden border border-slate-200/80 relative">
                <div
                  className="h-full bg-blue-600 rounded-sm transition-all duration-700 flex items-center justify-end pr-1 text-[9px] text-white font-bold shadow-xs"
                  style={{ width: `${pyLatencyWidth}%` }}
                >
                  {pyLatencyWidth > 20 && `${pyLatency.toFixed(1)}ms`}
                </div>
              </div>
            </div>

            {/* Mojo Bar */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-14 text-right text-slate-600 text-[11px] shrink-0 font-medium">Mojo 🔥</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden border border-slate-200/80 relative">
                <div
                  className="h-full bg-orange-600 rounded-sm transition-all duration-700 flex items-center justify-end pr-1 text-[9px] text-white font-bold shadow-xs"
                  style={{ width: `${mojoLatencyWidth}%` }}
                >
                  {mojoLatencyWidth > 20 && `${mojoLatency.toFixed(1)}ms`}
                </div>
              </div>
            </div>
          </div>

          {/* Scale Axis */}
          <div className="flex justify-between text-[9px] font-mono text-slate-400 pl-16 pt-1 border-t border-slate-100">
            <span>0ms</span>
            <span>{Math.round(maxLatency * 0.25)}ms</span>
            <span>{Math.round(maxLatency * 0.5)}ms</span>
            <span>{Math.round(maxLatency * 0.75)}ms</span>
            <span>{Math.round(maxLatency)}ms</span>
          </div>
        </div>

        {/* Chart 2: Peak Memory Usage */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <HardDrive className="w-3 h-3 text-slate-500" />
              <span>Peak Memory Usage</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">(RSS MB, lower is better)</span>
          </div>

          <div className="space-y-2 py-2">
            {/* Python Bar */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-14 text-right text-slate-600 text-[11px] shrink-0 font-medium">Python 🐍</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden border border-slate-200/80 relative">
                <div
                  className="h-full bg-blue-600 rounded-sm transition-all duration-700 flex items-center justify-end pr-1 text-[9px] text-white font-bold shadow-xs"
                  style={{ width: `${pyMemoryWidth}%` }}
                >
                  {pyMemoryWidth > 20 && `${pyMemory.toFixed(1)}MB`}
                </div>
              </div>
            </div>

            {/* Mojo Bar */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-14 text-right text-slate-600 text-[11px] shrink-0 font-medium">Mojo 🔥</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden border border-slate-200/80 relative">
                <div
                  className="h-full bg-orange-600 rounded-sm transition-all duration-700 flex items-center justify-end pr-1 text-[9px] text-white font-bold shadow-xs"
                  style={{ width: `${mojoMemoryWidth}%` }}
                >
                  {mojoMemoryWidth > 20 && `${mojoMemory.toFixed(1)}MB`}
                </div>
              </div>
            </div>
          </div>

          {/* Scale Axis */}
          <div className="flex justify-between text-[9px] font-mono text-slate-400 pl-16 pt-1 border-t border-slate-100">
            <span>0MB</span>
            <span>{Math.round(maxMemory * 0.25)}MB</span>
            <span>{Math.round(maxMemory * 0.5)}MB</span>
            <span>{Math.round(maxMemory * 0.75)}MB</span>
            <span>{Math.round(maxMemory)}MB</span>
          </div>
        </div>

        {/* Chart 3: CPU Utilization */}
        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Cpu className="w-3 h-3 text-slate-500" />
              <span>CPU Utilization</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">(8 core usage)</span>
          </div>

          <div className="space-y-2 py-2">
            {/* Python Bar */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-14 text-right text-slate-600 text-[11px] shrink-0 font-medium">Python 🐍</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden border border-slate-200/80 relative">
                <div
                  className="h-full bg-blue-600 rounded-sm transition-all duration-700 flex items-center justify-end pr-1 text-[9px] text-white font-bold shadow-xs"
                  style={{ width: `${pyCpuWidth}%` }}
                >
                  {pyCpuWidth > 20 && `${Math.round(pyCpu)}%`}
                </div>
              </div>
            </div>

            {/* Mojo Bar */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="w-14 text-right text-slate-600 text-[11px] shrink-0 font-medium">Mojo 🔥</span>
              <div className="flex-1 h-5 bg-slate-100 rounded-sm overflow-hidden border border-slate-200/80 relative">
                <div
                  className="h-full bg-orange-600 rounded-sm transition-all duration-700 flex items-center justify-end pr-1 text-[9px] text-white font-bold shadow-xs"
                  style={{ width: `${mojoCpuWidth}%` }}
                >
                  {mojoCpuWidth > 20 && `${Math.round(mojoCpu)}%`}
                </div>
              </div>
            </div>
          </div>

          {/* Scale Axis */}
          <div className="flex justify-between text-[9px] font-mono text-slate-400 pl-16 pt-1 border-t border-slate-100">
            <span>0%</span>
            <span>150%</span>
            <span>300%</span>
            <span>450%</span>
            <span>600%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
