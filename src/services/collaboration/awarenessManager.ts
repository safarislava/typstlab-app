import { wsCollaborationClient } from './webSocketClient';
import { store } from '../../store';
import { 
  setCollaborators, 
  updateCollaborator, 
  removeCollaborator, 
  clearCollaboration 
} from '../../store/slices/collaborationSlice';
import type { 
  WSAwarenessSnapshotPayload, 
  WSAwarenessUpdateClientRequest, 
  WSAwarenessRemovePayload, 
  WSUserPresence 
} from '../../core/types';

export class AwarenessManager {
  private currentProjectId: string | null = null;
  private currentFileId: string | null = null;
  private cursorDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Array<() => void> = [];
  private readonly cursorDebounceMs = 120;

  public getCurrentFileId(): string | null {
    return this.currentFileId;
  }

  public init(projectId: string): void {
    if (this.currentProjectId === projectId) {
      return;
    }

    this.cleanup();
    this.currentProjectId = projectId;

    // 1. Initial snapshot of room presences
    const unSnapshot = wsCollaborationClient.on<WSAwarenessSnapshotPayload>('awareness_snapshot', payload => {
      if (payload && Array.isArray(payload.presences)) {
        store.dispatch(setCollaborators(payload.presences));
      }
    });

    // 2. Incoming awareness update from a collaborator
    const unUpdate = wsCollaborationClient.on<WSUserPresence>('awareness_update', payload => {
      if (payload && payload.user_id) {
        store.dispatch(updateCollaborator(payload));
      }
    });

    // 3. Collaborator disconnected
    const unRemove = wsCollaborationClient.on<WSAwarenessRemovePayload>('awareness_remove', payload => {
      if (payload && payload.user_id) {
        store.dispatch(removeCollaborator(payload.user_id));
      }
    });

    // 4. On socket close, reset collaborators in store
    const unClose = wsCollaborationClient.on('close', () => {
      store.dispatch(clearCollaboration());
    });

    this.unsubscribers.push(unSnapshot, unUpdate, unRemove, unClose);
  }

  /**
   * Tracks local cursor or selection changes in an active file.
   */
  public updateLocalCursor(fileId: string, anchor: number, head: number): void {
    if (!fileId) return;
    this.currentFileId = fileId;

    if (this.cursorDebounceTimer) {
      clearTimeout(this.cursorDebounceTimer);
    }

    this.cursorDebounceTimer = setTimeout(() => {
      this.cursorDebounceTimer = null;
      if (!wsCollaborationClient.isConnected()) return;

      const payload: WSAwarenessUpdateClientRequest = {
        file_id: fileId,
        cursor: { anchor, head }
      };

      wsCollaborationClient.send<WSAwarenessUpdateClientRequest>('awareness_update', payload);
    }, this.cursorDebounceMs);
  }

  public cleanup(): void {
    if (this.cursorDebounceTimer) {
      clearTimeout(this.cursorDebounceTimer);
      this.cursorDebounceTimer = null;
    }

    this.unsubscribers.forEach(un => un());
    this.unsubscribers = [];
    this.currentProjectId = null;
    this.currentFileId = null;
  }
}

export const awarenessManager = new AwarenessManager();
