import { wsCollaborationClient } from './webSocketClient';
import { fileRepository } from '../storage';
import { 
  projectMetadataManager, 
  encodeYjsStateVector, 
  applyYjsDelta,
  applySyncResponse 
} from '../sync';
import type { 
  WSSyncInitPayload, 
  WSSyncResponsePayload, 
  WSCRDTUpdateRequest, 
  WSCRDTUpdateBroadcast, 
  WSMetadataUpdateRequest, 
  WSMetadataUpdateBroadcast,
  Cell
} from '../../core/types';

export type SyncCompletedListener = (projectId: string) => void;
export type RemoteContentListener = (fileId: string, cells: Cell[], senderId: string) => void;
export type RemoteMetadataListener = (projectId: string, senderId: string) => void;

export class CollaborationSyncService {
  private currentProjectId: string | null = null;
  private unsubscribers: Array<() => void> = [];
  private syncCompletedListeners: Set<SyncCompletedListener> = new Set();
  private remoteContentListeners: Set<RemoteContentListener> = new Set();
  private remoteMetadataListeners: Set<RemoteMetadataListener> = new Set();

  public init(projectId: string): void {
    if (this.currentProjectId === projectId) {
      return;
    }

    this.cleanup();
    this.currentProjectId = projectId;

    // 1. Subscribe to connection open to trigger initial handshake
    const unOpen = wsCollaborationClient.on('open', () => {
      if (this.currentProjectId) {
        void this.sendSyncInit(this.currentProjectId);
      }
    });

    // 2. Subscribe to sync_response from server
    const unSync = wsCollaborationClient.on<WSSyncResponsePayload>('sync_response', payload => {
      if (this.currentProjectId && payload) {
        void this.handleSyncResponse(this.currentProjectId, payload);
      }
    });

    // 3. Subscribe to remote Typst CRDT updates
    const unCrdt = wsCollaborationClient.on<WSCRDTUpdateBroadcast>('crdt_update', payload => {
      if (this.currentProjectId && payload) {
        void this.handleRemoteCrdtUpdate(this.currentProjectId, payload);
      }
    });

    // 4. Subscribe to remote file tree metadata updates
    const unMeta = wsCollaborationClient.on<WSMetadataUpdateBroadcast>('metadata_update', payload => {
      if (this.currentProjectId && payload) {
        void this.handleRemoteMetadataUpdate(this.currentProjectId, payload);
      }
    });

    this.unsubscribers.push(unOpen, unSync, unCrdt, unMeta);

    // If already connected, immediately initiate handshake
    if (wsCollaborationClient.isConnected()) {
      void this.sendSyncInit(projectId);
    }
  }

  /**
   * Performs initial synchronization handshake: gathers local state vectors and sends sync_init.
   */
  public async sendSyncInit(projectId: string): Promise<void> {
    try {
      const localFiles = await fileRepository.getFilesForProject(projectId);
      projectMetadataManager.initFromLocalFiles(projectId, localFiles);

      const metadataStateVector = projectMetadataManager.encodeMetadataStateVector(projectId);
      const contentVectors: Record<string, string> = {};

      for (const file of localFiles) {
        if (!file.isBinary && file.fileUuid) {
          contentVectors[file.fileUuid] = encodeYjsStateVector(file.fileUuid, file.cells || []);
        }
      }

      const payload: WSSyncInitPayload = {
        metadata_state_vector: metadataStateVector || undefined,
        content_vectors: Object.keys(contentVectors).length > 0 ? contentVectors : undefined
      };

      wsCollaborationClient.send<WSSyncInitPayload>('sync_init', payload);
    } catch (err) {
      console.error(`[CollaborationSyncService] Failed to send sync_init for ${projectId}:`, err);
    }
  }

  /**
   * Applies sync_response instructions and metadata delta from server.
   */
  public async handleSyncResponse(projectId: string, response: WSSyncResponsePayload): Promise<void> {
    try {
      await applySyncResponse(projectId, response);
      this.syncCompletedListeners.forEach(listener => {
        try {
          listener(projectId);
        } catch (err) {
          console.error('[CollaborationSyncService] Error in syncCompleted listener:', err);
        }
      });
    } catch (err) {
      console.error(`[CollaborationSyncService] Failed to handle sync_response for ${projectId}:`, err);
    }
  }

  /**
   * Sends local cell CRDT delta update over WebSocket.
   */
  public sendCrdtUpdate(fileId: string, delta: string): void {
    if (!fileId || !delta) return;

    wsCollaborationClient.send<WSCRDTUpdateRequest>('crdt_update', {
      file_id: fileId,
      delta
    });
  }

  /**
   * Handles incoming remote CRDT delta from another collaborator.
   */
  public async handleRemoteCrdtUpdate(projectId: string, broadcast: WSCRDTUpdateBroadcast): Promise<void> {
    const { file_id, sender_id, delta } = broadcast;
    if (!file_id || !delta) return;

    try {
      const localFiles = await fileRepository.getFilesForProject(projectId);
      const targetFile = localFiles.find(f => f.fileUuid === file_id);
      const currentCells = targetFile && !targetFile.isBinary ? targetFile.cells || [] : [];

      const updatedCells = applyYjsDelta(file_id, currentCells, delta);

      if (targetFile) {
        await fileRepository.saveFile({
          ...targetFile,
          cells: updatedCells
        });
      }

      this.remoteContentListeners.forEach(listener => {
        try {
          listener(file_id, updatedCells, sender_id);
        } catch (err) {
          console.error('[CollaborationSyncService] Error in remoteContent listener:', err);
        }
      });
    } catch (err) {
      console.error(`[CollaborationSyncService] Failed to handle remote crdt_update for ${file_id}:`, err);
    }
  }

  /**
   * Sends local file tree metadata changes over WebSocket.
   */
  public sendMetadataUpdate(projectId: string): void {
    try {
      const delta = projectMetadataManager.encodeMetadataDelta(projectId);
      if (delta) {
        wsCollaborationClient.send<WSMetadataUpdateRequest>('metadata_update', { delta });
      }
    } catch (err) {
      console.error(`[CollaborationSyncService] Failed to send metadata_update for ${projectId}:`, err);
    }
  }

  /**
   * Handles incoming remote metadata delta (file creations, renames, deletions).
   */
  public async handleRemoteMetadataUpdate(projectId: string, broadcast: WSMetadataUpdateBroadcast): Promise<void> {
    const { sender_id, delta } = broadcast;
    if (!delta) return;

    try {
      projectMetadataManager.applyMetadataDelta(projectId, delta);

      const allEntries = projectMetadataManager.getAllEntries(projectId);
      for (const entry of allEntries) {
        if (entry.isDeleted) {
          await fileRepository.deleteFile(projectId, entry.name);
        }
      }

      const localFiles = await fileRepository.getFilesForProject(projectId);
      for (const localFile of localFiles) {
        const metaEntry = allEntries.find(m => m.id === localFile.fileUuid);
        if (metaEntry && !metaEntry.isDeleted && metaEntry.name !== localFile.path) {
          await fileRepository.deleteFile(projectId, localFile.path);
          localFile.path = metaEntry.name;
          await fileRepository.saveFile({
            ...localFile,
            id: `${projectId}:${metaEntry.name}`,
            path: metaEntry.name
          });
        }
      }

      this.remoteMetadataListeners.forEach(listener => {
        try {
          listener(projectId, sender_id);
        } catch (err) {
          console.error('[CollaborationSyncService] Error in remoteMetadata listener:', err);
        }
      });
    } catch (err) {
      console.error(`[CollaborationSyncService] Failed to handle remote metadata_update for ${projectId}:`, err);
    }
  }

  public onSyncCompleted(listener: SyncCompletedListener): () => void {
    this.syncCompletedListeners.add(listener);
    return () => {
      this.syncCompletedListeners.delete(listener);
    };
  }

  public onContentUpdated(listener: RemoteContentListener): () => void {
    this.remoteContentListeners.add(listener);
    return () => {
      this.remoteContentListeners.delete(listener);
    };
  }

  public onMetadataUpdated(listener: RemoteMetadataListener): () => void {
    this.remoteMetadataListeners.add(listener);
    return () => {
      this.remoteMetadataListeners.delete(listener);
    };
  }

  public cleanup(): void {
    this.unsubscribers.forEach(un => un());
    this.unsubscribers = [];
    this.currentProjectId = null;
  }
}

export const collaborationSyncService = new CollaborationSyncService();
