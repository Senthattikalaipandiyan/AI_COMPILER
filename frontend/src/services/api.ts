import type {
  CompileResponse,
  ExecuteResponse,
  BenchmarkResponse,
  ModelIngestResponse,
  SystemHealth,
  PresetKernel,
  MaxInferenceResponse,
} from '../types';

const API_BASE = 'http://localhost:8000/api';

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchPresets(): Promise<Record<string, PresetKernel>> {
  const res = await fetch(`${API_BASE}/presets`);
  if (!res.ok) throw new Error('Failed to load kernel presets');
  return res.json();
}

export async function compileCode(
  code: string,
  flags: string[] = [],
  optLevel: string = '-O3'
): Promise<CompileResponse> {
  const res = await fetch(`${API_BASE}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, flags, opt_level: optLevel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Compilation request failed' }));
    throw new Error(err.detail || 'Compilation failed');
  }
  return res.json();
}

export async function executeCode(
  code: string,
  runtime: 'mojo' | 'python' = 'mojo',
  stdin: string = ''
): Promise<ExecuteResponse> {
  const res = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, runtime, stdin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Execution request failed' }));
    throw new Error(err.detail || 'Execution failed');
  }
  return res.json();
}

export async function runBenchmark(
  pythonCode: string,
  mojoCode: string,
  stdin: string = '',
  runs: number = 3
): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/benchmark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      python_code: pythonCode,
      mojo_code: mojoCode,
      stdin,
      runs,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Benchmark failed' }));
    throw new Error(err.detail || 'Benchmark failed');
  }
  return res.json();
}

export async function ingestModel(file: File): Promise<ModelIngestResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ingest-model`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Model ingestion failed' }));
    throw new Error(err.detail || 'Model ingestion failed');
  }
  return res.json();
}

export async function runMaxInference(
  shape: number[] = [1, 16],
  layerOps: string[] = ['relu', 'tanh']
): Promise<MaxInferenceResponse> {
  const res = await fetch(`${API_BASE}/max-inference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shape, layer_ops: layerOps }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'MAX inference failed' }));
    throw new Error(err.detail || 'MAX inference failed');
  }
  return res.json();
}
