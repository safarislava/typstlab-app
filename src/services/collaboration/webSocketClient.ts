import { httpClient } from '../api/httpClient';
import { config } from '../../config/env';
import type { 
  WSMessageType, 
  WSMessageEnvelope 
} from '../../core/types';

export type WSMessageHandler<T = any> = (payload: T) => void;
export type WSStatusChangeHandler = (status: 'connecting' | 'connected' | 'disconnected') => void;

export class WebSocketCollaborationClient {
  private ws: WebSocket | null = null;
  private currentProjectId: string | null = null;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: string[] = [];
  private listeners: Map<WSMessageType | 'open' | 'close' | 'error', Set<WSMessageHandler>> = new Map();
  private statusListeners: Set<WSStatusChangeHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private isExplicitlyClosed = false;
  private readonly pingIntervalMs = 20000;

  public getProjectId(): string | null {
    return this.currentProjectId;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public connect(projectId: string): void {
    if (this.currentProjectId === projectId && this.isConnected()) {
      return;
    }

    // If switching projects or reconnecting, close previous connection cleanly
    if (this.ws) {
      this.disconnect();
    }

    this.isExplicitlyClosed = false;
    this.currentProjectId = projectId;
    this.initiateConnection();
  }

  private getUrl(projectId: string): string {
    let base = '';
    if (config.wsBaseUrl) {
      base = config.wsBaseUrl.replace(/\/+$/, '');
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      base = `${protocol}//${window.location.host}`;
    } else {
      base = 'ws://localhost:8080';
    }

    const url = new URL(`${base}/ws/projects/${projectId}`);
    const token = httpClient.getToken();
    if (token) {
      url.searchParams.set('token', token);
      url.searchParams.set('access_token', token);
    }
    return url.toString();
  }

  private initiateConnection(): void {
    if (!this.currentProjectId || this.isExplicitlyClosed) return;

    this.notifyStatus('connecting');
    const url = this.getUrl(this.currentProjectId);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('connected');
        this.startHeartbeat();
        this.flushQueue();
        this.emit('open', undefined);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const rawData = typeof event.data === 'string' ? event.data : '';
          if (!rawData) return;

          const envelope = JSON.parse(rawData) as WSMessageEnvelope;
          if (!envelope || !envelope.type) return;

          // Handle protocol heartbeat
          if (envelope.type === 'ping') {
            this.send('pong', undefined);
            return;
          }

          if (envelope.type === 'pong') {
            return;
          }

          this.emit(envelope.type, envelope.payload);
        } catch (err) {
          console.error('[WebSocketCollaborationClient] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopHeartbeat();
        this.notifyStatus('disconnected');
        this.emit('close', event);

        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error: Event) => {
        this.emit('error', error);
      };
    } catch (err) {
      console.error('[WebSocketCollaborationClient] Connection initiation failed:', err);
      this.notifyStatus('disconnected');
      if (!this.isExplicitlyClosed) {
        this.scheduleReconnect();
      }
    }
  }

  public send<T = unknown>(type: WSMessageType, payload: T): void {
    const envelope: WSMessageEnvelope<T> = { type, payload };
    const serialized = JSON.stringify(envelope);

    if (this.isConnected()) {
      try {
        this.ws!.send(serialized);
      } catch (err) {
        console.warn('[WebSocketCollaborationClient] Failed to send frame, queueing:', err);
        this.messageQueue.push(serialized);
      }
    } else {
      this.messageQueue.push(serialized);
    }
  }

  private flushQueue(): void {
    if (!this.isConnected()) return;

    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        try {
          this.ws!.send(msg);
        } catch (err) {
          console.warn('[WebSocketCollaborationClient] Failed to send queued message:', err);
          this.messageQueue.unshift(msg);
          break;
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping', undefined);
      }
    }, this.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WebSocketCollaborationClient] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts),
      20000
    );
    this.reconnectAttempts++;

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.isExplicitlyClosed) {
        this.initiateConnection();
      }
    }, delay);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      // 1000 indicates normal closure
      try {
        this.ws.close(1000, 'Normal Closure');
      } catch {
        // Ignore errors during close
      }
      this.ws = null;
    }

    this.currentProjectId = null;
    this.messageQueue = [];
    this.notifyStatus('disconnected');
  }

  public on<T = any>(type: WSMessageType | 'open' | 'close' | 'error', handler: WSMessageHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    return () => this.off(type, handler);
  }

  public off<T = any>(type: WSMessageType | 'open' | 'close' | 'error', handler: WSMessageHandler<T>): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  public onStatusChange(handler: WSStatusChangeHandler): () => void {
    this.statusListeners.add(handler);
    return () => {
      this.statusListeners.delete(handler);
    };
  }

  private notifyStatus(status: 'connecting' | 'connected' | 'disconnected'): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (err) {
        console.error('[WebSocketCollaborationClient] Error in status listener:', err);
      }
    });
  }

  private emit(type: WSMessageType | 'open' | 'close' | 'error', payload: any): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[WebSocketCollaborationClient] Error in listener for ${type}:`, err);
        }
      });
    }
  }
}

export const wsCollaborationClient = new WebSocketCollaborationClient();
