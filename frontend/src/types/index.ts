export interface DialectInfo {
  total_lines?: number;
  function_count?: number;
  vector_operations?: number;
  memory_accesses?: number;
  detected_loops?: number;
  dialects_detected?: string[];
  operation_breakdown?: Record<string, number>;
  error?: string | boolean;
}

export interface CompileResponse {
  mlir: string;
  dialect_info: DialectInfo;
  compiler_diagnostics: string;
  duration_ms: number;
  success: boolean;
}

export interface ExecuteResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
  runtime: string;
}

export interface MetricSet {
  latency_ms: number;
  peak_memory_mb: number;
  cpu_utilization_pct: number;
  stdout?: string;
  exit_code?: number;
}

export interface BenchmarkResponse {
  python: MetricSet;
  mojo: MetricSet;
  speedup_factor: number;
  memory_delta_mb: number;
  cpu_delta_pct: number;
}

export interface ModelLayerInfo {
  name: string;
  op_type: string;
  inputs: string[];
  outputs: string[];
  shape?: number[];
}

export interface ModelIngestResponse {
  filename: string;
  format: string;
  layer_count: number;
  layers: ModelLayerInfo[];
  input_shape: number[];
  output_shape: number[];
  mlir: string;
  success: boolean;
}

export interface SystemHealth {
  status: string;
  mojo_version: string;
  max_version: string;
  python_version: string;
  cpu_count: number;
  total_ram_gb: number;
  available_ram_gb: number;
}

export interface PresetKernel {
  name: string;
  description: string;
  mojo: string;
  python: string;
  stdin: string;
}

export interface CompilerFlags {
  unroll: boolean;
  vectorize: boolean;
  tiling: boolean;
  optLevel: string;
}

export interface MaxInferenceResponse {
  engine: string;
  device: string;
  input_shape: number[];
  input_sample: number[];
  output_shape: number[];
  output_values: number[];
  output_mean: number;
  output_std: number;
  inference_latency_ms: number;
  success: boolean;
}

export type TerminalStatus =
  | 'ready'
  | 'compiling'
  | 'running'
  | 'waiting_for_input'
  | 'completed'
  | 'error'
  | 'stopped';

export interface TerminalOutputChunk {
  id: string;
  stream: 'stdout' | 'stderr' | 'compiler' | 'system' | 'stdin';
  data: string;
}

export interface TerminalState {
  status: TerminalStatus;
  exitCode: number | null;
  durationMs: number;
  runtime: string;
}
