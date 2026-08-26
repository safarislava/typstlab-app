import type { Middleware } from '@reduxjs/toolkit';
import { filesApi } from '../../services';
import { 
  encodeCellsToYjsDelta, 
  uint8ArrayToBase64, 
  yjsDocManager 
} from '../../services';

const fileSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 600;

export const syncDebounceMiddleware: Middleware = store => next => action => {
  const type = (action as any).type;
  const stateBefore = store.getState();

  // Capture fileUuid before potential deletion or rename
  let deletedFileUuid: string | undefined;
  let renamedFileUuid: string | undefined;

  if (type === 'editor/deleteFile' || type === 'document/deleteFile') {
    const path = (action as any).payload;
    deletedFileUuid = (stateBefore.editor?.files || stateBefore.document?.files)?.[path]?.fileUuid;
  } else if (type === 'editor/renameFile' || type === 'document/renameFile') {
    const { oldPath } = (action as any).payload;
    renamedFileUuid = (stateBefore.editor?.files || stateBefore.document?.files)?.[oldPath]?.fileUuid;
  }

  const result = next(action);
  const state = store.getState();
  const connectionStatus = state.network?.connectionStatus || state.document?.connectionStatus;
  const currentProjectId = state.projects?.currentProjectId || state.document?.currentProjectId;

  if (connectionStatus !== 'connected' || !currentProjectId) {
    return result;
  }

  // Handle Creations & Edits
  if (
    type === 'editor/addFile' ||
    type === 'editor/addTextFileWithContent' ||
    type === 'document/addFile' ||
    type === 'document/addTextFileWithContent'
  ) {
    const targetPath = (action as any).payload?.path;
    const file = (state.editor?.files || state.document?.files)?.[targetPath];
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
        .catch(err => console.error('Failed to create typst file on server:', err));
    }
  } else if (type === 'editor/addBinaryFile' || type === 'document/addBinaryFile') {
    const { path, binaryData } = (action as any).payload;
    const file = (state.editor?.files || state.document?.files)?.[path];
    const fileUuid = file?.fileUuid || crypto.randomUUID();
    const base64Content = uint8ArrayToBase64(binaryData);
    filesApi.createFileWithId(currentProjectId, {
      id: fileUuid,
      name: path,
      type: 'binary',
      content: base64Content
    }).catch(err => console.error('Failed to upload binary file to server:', err));
  } else if (
    type === 'editor/updateCellContent' ||
    type === 'editor/updateCellTitle' ||
    type === 'editor/addCell' ||
    type === 'editor/deleteCell' ||
    type === 'editor/moveCell' ||
    type === 'document/updateCellContent' ||
    type === 'document/updateCellTitle' ||
    type === 'document/addCell' ||
    type === 'document/deleteCell' ||
    type === 'document/moveCell'
  ) {
    const targetPath = state.editor?.activeFilePath || state.document?.activeFilePath;
    const file = (state.editor?.files || state.document?.files)?.[targetPath];
    if (file && !file.isBinary) {
      const fileUuid = file.fileUuid || crypto.randomUUID();
      if (fileSyncTimers.has(fileUuid)) {
        clearTimeout(fileSyncTimers.get(fileUuid));
      }

      const timer = setTimeout(async () => {
        fileSyncTimers.delete(fileUuid);
        const latestState = store.getState();
        const conn = latestState.network?.connectionStatus || latestState.document?.connectionStatus;
        if (conn !== 'connected') return;

        const latestFile = (latestState.editor?.files || latestState.document?.files)?.[targetPath];
        if (!latestFile || latestFile.isBinary) return;

        try {
          const delta = encodeCellsToYjsDelta(fileUuid, latestFile.cells || []);
          if (delta) {
            const sendRes = await filesApi.sendTypstFileChanges(fileUuid, delta);
            if (sendRes?.state) {
              yjsDocManager.setServerState(fileUuid, sendRes.state);
            }
          }
        } catch (err) {
          console.error('Failed to sync debounced file changes to server:', err);
        }
      }, SYNC_DEBOUNCE_MS);

      fileSyncTimers.set(fileUuid, timer);
    }
  } else if (type === 'editor/renameFile' || type === 'document/renameFile') {
    const { newPath } = (action as any).payload;
    const file = (state.editor?.files || state.document?.files)?.[newPath];
    if (file) {
      const fileUuid = file.fileUuid || crypto.randomUUID();
      if (renamedFileUuid) {
        filesApi.deleteFile(currentProjectId, renamedFileUuid).catch(console.error);
      }
      if (file.isBinary && file.binaryData) {
        const base64Content = uint8ArrayToBase64(file.binaryData);
        filesApi.createFileWithId(currentProjectId, {
          id: fileUuid,
          name: newPath,
          type: 'binary',
          content: base64Content
        }).catch(console.error);
      } else {
        filesApi.createFileWithId(currentProjectId, {
          id: fileUuid,
          name: newPath,
          type: 'typst'
        })
          .then(async () => {
            const delta = encodeCellsToYjsDelta(fileUuid, file.cells || []);
            await filesApi.sendTypstFileChanges(fileUuid, delta);
          })
          .catch(console.error);
      }
    }
  } else if (type === 'editor/deleteFile' || type === 'document/deleteFile') {
    if (deletedFileUuid) {
      filesApi.deleteFile(currentProjectId, deletedFileUuid).catch(console.error);
    }
  }

  return result;
};
