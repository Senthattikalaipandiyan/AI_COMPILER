import React, { useState, useRef } from 'react';
import { UploadCloud, FileCheck, AlertCircle, Loader2, Box } from 'lucide-react';
import { ingestModel } from '../../services/api';
import type { ModelIngestResponse } from '../../types';

interface ModelDropzoneProps {
  onModelIngested: (res: ModelIngestResponse) => void;
  isIngesting: boolean;
  setIsIngesting: (val: boolean) => void;
  lastIngestedModel: ModelIngestResponse | null;
}

export const ModelDropzone: React.FC<ModelDropzoneProps> = ({
  onModelIngested,
  isIngesting,
  setIsIngesting,
  lastIngestedModel,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    setError(null);
    const validExtensions = ['.onnx', '.pth', '.pt', '.bin'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setError('Please upload a valid .onnx or .pth neural network file.');
      return;
    }

    try {
      setIsIngesting(true);
      const res = await ingestModel(file);
      onModelIngested(res);
    } catch (err: any) {
      setError(err.message || 'Failed to ingest model');
    } finally {
      setIsIngesting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col bg-white p-3 border border-slate-200">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-2 select-none">
        <div className="flex items-center gap-2">
          <Box className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-slate-800">Model Ingestion Dropzone</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">
          MAX Engine Compiler (.onnx, .pth)
        </span>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        accept=".onnx,.pth,.pt"
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-3.5 flex flex-col items-center justify-center cursor-pointer transition-all select-none ${
          isDragging
            ? 'border-cyan-500 bg-cyan-50/70 shadow-xs'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-100/70'
        }`}
      >
        {isIngesting ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
            <span className="text-xs text-slate-700 font-medium">
              Compiling Graph via MAX Engine...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1 text-center">
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs">
              <UploadCloud className="w-4 h-4 text-cyan-600" />
            </div>
            <p className="text-xs font-medium text-slate-800">
              Drop small <span className="text-cyan-700 font-semibold">.onnx</span> or{' '}
              <span className="text-purple-700 font-semibold">.pth</span> model here, or{' '}
              <span className="text-blue-600 underline underline-offset-2 font-semibold">browse</span>
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              Builds computational graph and emits structural MLIR (MAX Engine)
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {lastIngestedModel && (
        <div className="mt-2 p-2 rounded bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="font-semibold text-slate-800">{lastIngestedModel.filename}</span>
              <span className="text-slate-500 font-mono text-[10px] ml-2">
                ({lastIngestedModel.format.toUpperCase()} • {lastIngestedModel.layer_count} nodes)
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
            MLIR Ready
          </span>
        </div>
      )}
    </div>
  );
};
