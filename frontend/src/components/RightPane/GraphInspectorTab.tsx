import React, { useState } from 'react';
import { Box, ArrowRight, Play, Loader2, CheckCircle2, Cpu, GitBranch } from 'lucide-react';
import type { ModelIngestResponse, MaxInferenceResponse } from '../../types';
import { runMaxInference } from '../../services/api';

interface GraphInspectorTabProps {
  model?: ModelIngestResponse | null;
}

export const GraphInspectorTab: React.FC<GraphInspectorTabProps> = ({ model }) => {
  const [isRunningInference, setIsRunningInference] = useState(false);
  const [inferenceResult, setInferenceResult] = useState<MaxInferenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If no model has been ingested yet, render empty state
  if (!model) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs font-mono select-none bg-slate-50 p-6">
        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
          <GitBranch className="w-6 h-6 text-slate-400" />
        </div>
        <p className="text-slate-800 font-semibold text-sm font-sans">
          No computational graph ingested
        </p>
        <p className="text-slate-600 mt-1.5 text-center max-w-sm font-sans leading-relaxed">
          Upload an <span className="text-cyan-700 font-mono font-semibold">.onnx</span> or{' '}
          <span className="text-purple-700 font-mono font-semibold">.pth</span> neural network in the left panel to compile and inspect its computational DAG and execute MAX Engine inference.
        </p>
      </div>
    );
  }

  // Derive model metadata from ingested model
  const filename = model.filename;
  const format = (model.format || 'ONNX').toUpperCase();
  const inputShape = model.input_shape?.length ? model.input_shape : [1, 16];
  const outputShape = model.output_shape?.length ? model.output_shape : [1, 16];
  const layerCount = model.layer_count;

  const displayOperations = model.layers?.length
    ? model.layers.map((l, idx) => ({
        id: idx + 1,
        op: l.op_type,
        name: l.name,
        inputs: l.inputs?.length ? l.inputs.join(', ') : 'None',
        outputs: l.outputs?.length ? l.outputs.join(', ') : 'tensor.out',
      }))
    : [];

  const handleRunInference = async () => {
    try {
      setIsRunningInference(true);
      setError(null);
      const layerOps = model.layers?.map((l) => l.op_type) || ['relu', 'tanh'];
      const res = await runMaxInference(inputShape, layerOps);
      setInferenceResult(res);
    } catch (err: any) {
      setError(err.message || 'Inference execution failed');
    } finally {
      setIsRunningInference(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-3 gap-3 overflow-y-auto font-mono text-xs select-text">
      {/* 1. Model Info Card */}
      <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Box className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm font-sans tracking-wide">
              {filename}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Format: <span className="text-slate-700 font-medium">{format}</span> • Nodes:{' '}
              <span className="text-slate-700 font-medium">{layerCount}</span>
            </div>
          </div>
        </div>

        {/* Input/Output Shapes */}
        <div className="flex items-center gap-2 text-[11px] bg-slate-50 px-3 py-1 rounded border border-slate-200 text-slate-700 font-mono shadow-xs">
          <span>Input: [{inputShape.join(', ')}]</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span>Output: [{outputShape.join(', ')}]</span>
        </div>
      </div>

      {/* 2. MAX Engine Inference Pipeline Card */}
      <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-600" />
            <span className="font-semibold text-slate-900 font-sans text-xs">
              MAX Engine Inference Pipeline
            </span>
            <span className="text-[10px] text-slate-600 font-mono px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
              from max import engine
            </span>
          </div>

          <button
            onClick={handleRunInference}
            disabled={isRunningInference}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-sans font-medium transition-colors cursor-pointer active:scale-[0.98] shadow-xs"
          >
            {isRunningInference ? (
              <Loader2 className="w-3 h-3 animate-spin text-cyan-600" />
            ) : (
              <Play className="w-3 h-3 fill-current text-slate-700" />
            )}
            <span>Execute Graph Inference</span>
          </button>
        </div>

        {error && (
          <div className="text-rose-700 text-[11px] bg-rose-50 p-2 rounded border border-rose-200">
            {error}
          </div>
        )}

        {/* Execution Result Banner */}
        {inferenceResult && (
          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-slate-600 border-b border-slate-200 pb-1.5 font-sans">
              <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Execution Complete on {inferenceResult.device}</span>
              </div>
              <div className="font-mono text-slate-700 text-xs font-semibold">
                Latency: {inferenceResult.inference_latency_ms} ms
              </div>
            </div>

            {/* Tensor Samples */}
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono pt-0.5">
              <div>
                <span className="text-slate-500 block mb-0.5 text-[10px]">Input Tensor Sample:</span>
                <div className="text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 truncate font-mono shadow-xs">
                  [{inferenceResult.input_sample.map((x) => x.toFixed(2)).join(', ')}]
                </div>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5 text-[10px]">MAX Engine Output:</span>
                <div className="text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 truncate font-mono shadow-xs">
                  [{inferenceResult.output_values.map((x) => x.toFixed(4)).join(', ')}]
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Computational Node Sequence Table */}
      {displayOperations.length > 0 && (
        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 shadow-xs flex-1 flex flex-col">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900 font-sans">
              Computational Node Sequence
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {displayOperations.length} operations compiled to MAX Engine
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200 pb-1 text-[10px]">
                  <th className="py-1.5 w-8 font-normal">#</th>
                  <th className="py-1.5 font-normal">Operation</th>
                  <th className="py-1.5 font-normal">Node Name</th>
                  <th className="py-1.5 font-normal">Inputs</th>
                  <th className="py-1.5 font-normal text-right">Outputs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayOperations.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-1.5 text-slate-400">{op.id}</td>
                    <td className="py-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] text-slate-700 font-semibold">
                        {op.op}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-800 font-medium">{op.name}</td>
                    <td className="py-1.5 text-slate-600">{op.inputs}</td>
                    <td className="py-1.5 text-slate-800 font-medium text-right">{op.outputs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
