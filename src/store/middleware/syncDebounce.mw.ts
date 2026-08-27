import type { Middleware } from '@reduxjs/toolkit';
import { 
  filesApi,
  encodeCellsToYjsDelta, 
  uint8ArrayToBase64, 
  yjsDocManager,
  syncProjectWithServer
} from '../../services';

const fileSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 600;

export const syncDebounceMiddleware: Middleware = store => next => action => {
  const type = (action as any).type;
  const stateBefore = store.getState();

  // Capture fileUuid before potential deletion or rename
  let deletedFileUuid: string | undefined;
  let renamedFileUuid: string | undefined;

  if (type === 'editor/deleteFile') {
    const path = (action as any).payload;
    deletedFileUuid = stateBefore.editor?.files?.[path]?.fileUuid;
  } else if (type === 'editor/renameFile') {
    const { oldPath } = (action as any).payload;
    renamedFileUuid = stateBefore.editor?.files?.[oldPath]?.fileUuid;
  }

  const result = next(action);
  const state = store.getState();
  const connectionStatus = state.network?.connectionStatus;
  const currentProjectId = state.projects?.currentProjectId;
  const currentUser = state.auth?.currentUser || undefined;

  if (connectionStatus !== 'connected' || !currentProjectId) {
    return result;
  }

  // Helper to trigger project sync fallback on client error (like 404 on changes, mismatch, etc.)
  const handleClientSyncFallback = (reason: string, err: any) => {
    console.warn(`[SyncMiddleware] ${reason}. Triggering project sync fallback.`, err);
    void syncProjectWithServer(currentProjectId, currentUser);
  };

  // Handle Creations & File Adds
  if (type === 'editor/addFile' || type === 'editor/addTextFileWithContent') {
    const targetPath = (action as any).payload?.path;
    const file = state.editor?.files?.[targetPath];
    if (file && !file.isBinary) {
      const fileUuid = file.fileUuid || crypto.randomUUID();
      filesApi.createFileWithId(currentProjectId, {
        id: fileUuid,
        name: targetPath,
        type: 'typst'
      })
        .then(async res => {
          if (res?.state) {
            yjsDocManager.setServerState(fileUuid, res.state);
          }
          const delta = encodeCellsToYjsDelta(fileUuid, file.cells || []);
          if (delta) {
            const sendRes = await filesApi.sendTypstFileChanges(fileUuid, delta);
            if (sendRes?.state) {
              yjsDocManager.setServerState(fileUuid, sendRes.state);
            }
          }
        })
        .catch(err => {
          handleClientSyncFallback(`Failed to create typst file ${targetPath}`, err);
        });
    }
  } else if (type === 'editor/addBinaryFile') {
    const { path, binaryData } = (action as any).payload;
    const file = state.editor?.files?.[path];
    const fileUuid = file?.fileUuid || crypto.randomUUID();
    const base64Content = uint8ArrayToBase64(binaryData);
    filesApi.createFileWithId(currentProjectId, {
      id: fileUuid,
      name: path,
      type: 'binary',
      content: base64Content
    }).catch(err => {
      handleClientSyncFallback(`Failed to upload binary file ${path}`, err);
    });
  } else if (
    type === 'editor/updateCellContent' ||
    type === 'editor/updateCellTitle' ||
    type === 'editor/addCell' ||
    type === 'editor/deleteCell' ||
    type === 'editor/moveCell'
  ) {
    const targetPath = (action as any).payload?.path || state.editor?.activeFilePath;
    const file = state.editor?.files?.[targetPath];
    if (file && !file.isBinary) {
      const fileUuid = file.fileUuid || crypto.randomUUID();
      if (fileSyncTimers.has(fileUuid)) {
        clearTimeout(fileSyncTimers.get(fileUuid));
      }

      const timer = setTimeout(async () => {
        fileSyncTimers.delete(fileUuid);
        const latestState = store.getState();
        if (latestState.network?.connectionStatus !== 'connected') return;

        const latestFile = latestState.editor?.files?.[targetPath];
        if (!latestFile || latestFile.isBinary) return;

        try {
          const delta = encodeCellsToYjsDelta(fileUuid, latestFile.cells || []);
          if (delta) {
            const sendRes = await filesApi.sendTypstFileChanges(fileUuid, delta);
            if (sendRes?.state) {
              yjsDocManager.setServerState(fileUuid, sendRes.state);
            }
          }
        } catch (err: any) {
          // On 404 (file missing on server) or other client errors, trigger full project sync
          handleClientSyncFallback(`Failed to sync changes for ${targetPath} (${fileUuid})`, err);
        }
      }, SYNC_DEBOUNCE_MS);

      fileSyncTimers.set(fileUuid, timer);
    }
  } else if (type === 'editor/renameFile') {
    const { newPath } = (action as any).payload;
    const file = state.editor?.files?.[newPath];
    if (file) {
      const fileUuid = file.fileUuid || crypto.randomUUID();
      if (renamedFileUuid) {
        filesApi.deleteFile(currentProjectId, renamedFileUuid).catch(err => {
          handleClientSyncFallback(`Failed to delete old file during rename ${renamedFileUuid}`, err);
        });
      }
      if (file.isBinary && file.binaryData) {
        const base64Content = uint8ArrayToBase64(file.binaryData);
        filesApi.createFileWithId(currentProjectId, {
          id: fileUuid,
          name: newPath,
          type: 'binary',
          content: base64Content
        }).catch(err => {
          handleClientSyncFallback(`Failed to upload renamed binary file ${newPath}`, err);
        });
      } else {
        filesApi.createFileWithId(currentProjectId, {
          id: fileUuid,
          name: newPath,
          type: 'typst'
        })
          .then(async () => {
            const delta = encodeCellsToYjsDelta(fileUuid, file.cells || []);
            if (delta) {
              await filesApi.sendTypstFileChanges(fileUuid, delta);
            }
          })
          .catch(err => {
            handleClientSyncFallback(`Failed to recreate renamed typst file ${newPath}`, err);
          });
      }
    }
  } else if (type === 'editor/deleteFile') {
    if (deletedFileUuid) {
      filesApi.deleteFile(currentProjectId, deletedFileUuid).catch(err => {
        handleClientSyncFallback(`Failed to delete file ${deletedFileUuid}`, err);
      });
    }
  }

  return result;
};
