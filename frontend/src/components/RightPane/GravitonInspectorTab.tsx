import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface GravitonInspectorTabProps {
  onExecuteInversion?: () => void;
  isExecuting?: boolean;
}

export const GravitonInspectorTab: React.FC<GravitonInspectorTabProps> = ({
  onExecuteInversion,
  isExecuting = false,
}) => {
  const [latency, setLatency] = useState<number>(0.229);
  const [localRunning, setLocalRunning] = useState<boolean>(false);

  const handleInversion = () => {
    if (onExecuteInversion) {
      onExecuteInversion();
    }
    setLocalRunning(true);
    setTimeout(() => {
      setLocalRunning(false);
      setLatency(Number((0.215 + Math.random() * 0.03).toFixed(3)));
    }, 280);
  };

  const isBusy = isExecuting || localRunning;

  return (
    <div className="flex flex-col h-full bg-slate-50 p-3 gap-3 overflow-y-auto font-mono text-xs select-text">
      {/* 1. Core Card: levitation_matrix.core */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-2">
        <h3 className="font-semibold text-slate-900 text-sm font-sans tracking-normal">
          levitation_matrix.core
        </h3>
        <div className="text-slate-600 font-mono text-xs space-y-1">
          <div>
            <span className="text-slate-500">Input vector: </span>
            <span className="text-slate-800 font-semibold">[[-0, 0, 1]]</span>
          </div>
          <div>
            <span className="text-slate-500">Output vector: </span>
            <span className="text-slate-800 font-semibold">[[12, 10, 1]]</span>
          </div>
        </div>
      </div>

      {/* 2. Gravimetric Engine Pipeline */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs space-y-2.5">
        <h3 className="font-semibold text-slate-900 text-sm font-sans tracking-normal">
          Gravimetric Engine Pipeline
        </h3>

        {/* Execute Field Inversion Button */}
        <button
          onClick={handleInversion}
          disabled={isBusy}
          className="w-full py-2 px-4 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors font-sans text-xs flex items-center justify-center gap-2 font-medium shadow-xs"
        >
          {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" />}
          <span>Execute Field Inversion</span>
        </button>

        {/* Green Success Message */}
        <div className="flex items-center gap-1.5 text-emerald-700 font-sans text-xs font-medium pt-0.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Emitter:0 (Native)</span>
        </div>

        {/* Input/Output Vector Samples */}
        <div className="space-y-1 font-mono text-xs text-slate-600 leading-relaxed">
          <div>
            <span className="text-slate-500">Input vector: </span>
            <span className="text-slate-800 font-semibold">[[11, -0, -1], [-11, -0, -8]]</span>
          </div>
          <div>
            <span className="text-slate-500">Output vector: </span>
            <span className="text-slate-800 font-semibold">[-1, -11, -10], [-0, -10, 0]]</span>
          </div>
        </div>

        {/* Latency text */}
        <div className="text-xs text-slate-700 font-sans pt-1 font-semibold">
          Latency: {latency} ms
        </div>
      </div>

      {/* 3. Quantum Node Sequence */}
      <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-xs flex flex-col flex-1 space-y-2">
        <h3 className="font-semibold text-slate-900 text-sm font-sans tracking-normal">
          Quantum Node Sequence
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200 pb-1">
                <th className="py-1 font-normal">Operation</th>
                <th className="py-1 font-normal">Stats</th>
                <th className="py-1 font-normal">Comp.</th>
                <th className="py-1 font-normal text-right">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2 text-slate-800 font-medium">grav.weight</td>
                <td className="py-2 text-emerald-700 font-semibold">active</td>
                <td className="py-2">0.229</td>
                <td className="py-2 text-right">100%</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-800 font-medium">phase.bias</td>
                <td className="py-2 text-emerald-700 font-semibold">active</td>
                <td className="py-2">0.229</td>
                <td className="py-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
