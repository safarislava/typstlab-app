import { getOfflineLinter, getOfflineAutocomplete } from './offlineLsp';
import { getOnlineLspExtensions } from './onlineLsp';
import { useAppSelector } from '../store/hooks';

// Server URL for remote/local WebSocket LSP connection
const WEBSOCKET_LSP_URL = 'ws://localhost:8080/lsp';

// React hook to retrieve appropriate LSP extensions for the editor
export function useLspExtensions(
  id: string,
  cells: any[],
  compilerError: string | null,
  content: string
) {
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);
  const isOnline = connectionStatus === 'connected';

  if (isOnline) {
    // Implicit swap: Use real LSP server connection
    return getOnlineLspExtensions(id, WEBSOCKET_LSP_URL, content);
  } else {
    // Implicit swap: Fallback to simplified offline local autocompletion and compiler linting
    return [
      getOfflineLinter(id, cells, compilerError),
      getOfflineAutocomplete(cells)
    ];
  }
}
export type { Diagnostic, CompletionResult } from './onlineLsp';
