import { useState, useEffect } from 'react';
import { getOfflineLinter, getOfflineAutocomplete } from './offlineLsp';
import { getOnlineLspExtensions } from './onlineLsp';

// Server URL for remote/local WebSocket LSP connection
const WEBSOCKET_LSP_URL = 'ws://localhost:8080/lsp';

let globalIsOnline = false;
let globalCheckDone = false;
const listeners = new Set<(online: boolean) => void>();

function checkLspAvailability() {
  if (globalCheckDone) return;

  try {
    const checkSocket = new WebSocket(WEBSOCKET_LSP_URL);

    checkSocket.onopen = () => {
      globalIsOnline = true;
      globalCheckDone = true;
      listeners.forEach((l) => l(true));
      checkSocket.close();
    };

    checkSocket.onerror = () => {
      globalIsOnline = false;
      globalCheckDone = true;
      listeners.forEach((l) => l(false));
    };
  } catch {
    globalIsOnline = false;
    globalCheckDone = true;
    listeners.forEach((l) => l(false));
  }
}

// React hook to retrieve appropriate LSP extensions for the editor
export function useLspExtensions(
  id: string,
  cells: any[],
  compilerError: string | null,
  content: string
) {
  const [isOnline, setIsOnline] = useState(globalIsOnline);

  useEffect(() => {
    const listener = (online: boolean) => setIsOnline(online);
    listeners.add(listener);

    if (!globalCheckDone) {
      checkLspAvailability();
    } else {
      setIsOnline(globalIsOnline);
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

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
