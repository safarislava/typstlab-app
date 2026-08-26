export interface CompilerDiagnostic {
  from: number;
  to: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
}

export interface CompilerCompletionOption {
  label: string;
  type?: string;
  detail?: string;
  info?: string;
  apply?: string;
}

export interface CompilerCompletionResult {
  from: number;
  to?: number;
  options: CompilerCompletionOption[];
}
