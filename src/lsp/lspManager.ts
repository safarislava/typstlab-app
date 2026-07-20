import { getOfflineLinter, getOfflineAutocomplete } from './offlineLsp';

// React hook to retrieve appropriate LSP extensions for the editor
export function useLspExtensions(
  id: string,
  cells: any[],
  compilerError: string | null,
  _content: string
) {
  // Always return offline local autocompletion and compiler linting for now
  return [
    getOfflineLinter(id, cells, compilerError),
    getOfflineAutocomplete(cells)
  ];
}
export type { Diagnostic, CompletionResult } from './onlineLsp';
