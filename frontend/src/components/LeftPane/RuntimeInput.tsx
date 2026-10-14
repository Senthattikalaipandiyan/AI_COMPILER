import React from 'react';
import { Terminal } from 'lucide-react';

interface RuntimeInputProps {
  value: string;
  onChange: (val: string) => void;
}

export const RuntimeInput: React.FC<RuntimeInputProps> = ({ value, onChange }) => {
  const chars = value.length;
  const lines = value ? value.split('\n').length : 0;

  return (
    <div className="flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
      {/* Header Bar */}
      <div className="h-9 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-900">Runtime Input (stdin)</span>
          <span className="text-[11px] text-slate-500 font-mono">
            {chars} chars • {lines} lines
          </span>
        </div>

        {/* Quick inputs */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 hidden sm:inline">Quick inputs:</span>
          <button
            onClick={() => onChange('42')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[11px] font-medium transition-colors"
          >
            42
          </button>
          <button
            onClick={() => onChange('dim=128')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[11px] font-medium transition-colors"
          >
            dim=128
          </button>
        </div>
      </div>

      {/* Input Box */}
      <div className="p-3 bg-white">
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-mono">
          <span className="text-slate-400 select-none mr-2 font-semibold">&gt;</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter standard input (stdin) or runtime arguments for the execution stream..."
            className="w-full bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none font-mono text-xs"
          />
        </div>
      </div>
    </div>
  );
};
