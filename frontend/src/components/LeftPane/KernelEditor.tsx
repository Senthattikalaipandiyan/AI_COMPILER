import React from 'react';
import Editor from '@monaco-editor/react';
import { Code, Copy, Trash2, Check } from 'lucide-react';

interface KernelEditorProps {
  code: string;
  onChange: (value: string) => void;
  runtime: 'mojo' | 'python';
}

export const KernelEditor: React.FC<KernelEditorProps> = ({
  code,
  onChange,
  runtime,
}) => {
  const [copied, setCopied] = React.useState(false);
  const lineCount = code ? code.split('\n').length : 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
      {/* Editor Header Bar */}
      <div className="h-9 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-700 select-none">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-semibold text-slate-900">Kernel Editor</span>
          <span className="text-[11px] text-slate-500 font-mono">
            ({runtime === 'mojo' ? 'Mojo 🔥' : 'Python 🐍'} • {lineCount} {lineCount === 1 ? 'line' : 'lines'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-2 py-0.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Copy code to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={() => onChange('')}
            className="px-2 py-0.5 text-slate-600 hover:text-rose-600 hover:bg-slate-200/60 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Clear editor canvas"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Canvas */}
      <div className="flex-1 w-full relative min-h-[220px] bg-white">
        <Editor
          height="100%"
          language="python"
          theme="vs"
          value={code}
          onChange={(val) => onChange(val || '')}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            padding: { top: 10, bottom: 10 },
            overviewRulerBorder: false,
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            contextmenu: true,
          }}
        />
      </div>
    </div>
  );
};
