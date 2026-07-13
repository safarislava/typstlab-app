import { linter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { autocompletion } from '@codemirror/autocomplete';
import type { CompletionResult } from '@codemirror/autocomplete';

// A lightweight, fully featured client for communicating with remote LSP via WebSockets
export class WebSocketLspClient {
  private socket: WebSocket | null = null;
  private wsUrl: string;
  private id: string;
  private onDiagnostics: (diagnostics: any[]) => void = () => {};
  private completionResolver: ((results: any) => void) | null = null;
  private isConnected = false;

  constructor(wsUrl: string, id: string, onStateChange?: (connected: boolean) => void) {
    this.wsUrl = wsUrl;
    this.id = id;
    
    try {
      this.socket = new WebSocket(this.wsUrl);
      
      this.socket.onopen = () => {
        this.isConnected = true;
        if (onStateChange) onStateChange(true);
        console.log(`LSP WebSocket connected for cell ${id}`);
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'diagnostics') {
            this.onDiagnostics(msg.data);
          } else if (msg.type === 'completionResponse') {
            if (this.completionResolver) {
              this.completionResolver(msg.data);
              this.completionResolver = null;
            }
          }
        } catch (err) {
          console.error("Error parsing LSP response payload:", err);
        }
      };

      this.socket.onerror = (err) => {
        console.error(`LSP WebSocket error on cell ${id}:`, err);
        this.isConnected = false;
        if (onStateChange) onStateChange(false);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        if (onStateChange) onStateChange(false);
        console.log(`LSP WebSocket connection closed for cell ${id}`);
      };
    } catch (e) {
      console.error("Failed to establish WebSocket LSP connection", e);
      if (onStateChange) onStateChange(false);
    }
  }

  public registerDiagnosticsHandler(handler: (diagnostics: any[]) => void) {
    this.onDiagnostics = handler;
  }

  public sendUpdate(content: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({
        type: 'update',
        cellId: this.id,
        content: content
      }));
    }
  }

  public requestCompletion(pos: number, word: string): Promise<any> {
    return new Promise((resolve) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      this.completionResolver = resolve;
      this.socket.send(JSON.stringify({
        type: 'completion',
        cellId: this.id,
        pos: pos,
        word: word
      }));
    });
  }

  public getIsConnected() {
    return this.isConnected;
  }

  public close() {
    if (this.socket) {
      this.socket.close();
    }
  }
}

// Return LSP client stub extensions
export function getOnlineLspExtensions(id: string, wsUrl: string, content: string) {
  const client = new WebSocketLspClient(wsUrl, id);

  // Send initial content
  client.sendUpdate(content);

  const onlineLinter = linter((_view) => {
    const diagnostics: Diagnostic[] = [];

    client.registerDiagnosticsHandler((serverDiagnostics) => {
      console.log("Mock LSP Server Diagnostics callback:", serverDiagnostics);
      // Under a real connection, you map server diagnostics to view ranges here
    });

    return diagnostics;
  });

  const onlineAutocomplete = autocompletion({
    override: [
      async (context): Promise<CompletionResult | null> => {
        const word = context.matchBefore(/\w+/);
        if (!word) return null;

        console.log(`Mock LSP Autocomplete requested at pos: ${context.pos} for word: ${word.text}`);
        const response = await client.requestCompletion(context.pos, word.text);
        if (!response) return null;

        return {
          from: word.from,
          options: response.options || []
        };
      }
    ]
  });

  return [onlineLinter, onlineAutocomplete];
}
export type { Diagnostic, CompletionResult };
