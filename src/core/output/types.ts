export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type OutputMode = 'human' | 'json';

export interface CodiError {
  code: string;
  message: string;
  hint: string;
  severity: 'warn' | 'error' | 'fatal';
  context: Record<string, unknown>;
  cause?: Error;
}

export interface TraceEvent {
  operation: string;
  step: string;
  data: Record<string, unknown>;
  timestamp: number;
  durationMs?: number;
}

export interface TraceSpan {
  operation: string;
  events: TraceEvent[];
  startTime: number;
  endTime?: number;
  totalMs?: number;
}

export interface CommandResult<T> {
  success: boolean;
  command: string;
  data: T;
  errors: CodiError[];
  warnings: CodiError[];
  traces?: TraceSpan[];
  exitCode: number;
  timestamp: string;
  version: string;
}
