import type { Middleware } from '@reduxjs/toolkit';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, deleteProjectFromDB } from './db';
import { api } from '../utils/api';
import { encodeCellsToYjsDelta, uint8ArrayToBase64, updateFileYjsState } from '../utils/yjsSync';

const fileSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SYNC_DEBOUNCE_MS = 600;

export const dbMiddleware: Middleware = store => next => action => {
  const type = (action as any).type;

  // Capture metadata before action changes the state
  let deletedFileUuid: string | undefined;
  let renamedFileUuid: string | undefined;

  if (type === 'document/deleteFile') {
    const path = (action as any).payload;
    deletedFileUuid = store.getState().document.files[path]?.fileUuid;
  } else if (type === 'document/renameFile') {
    const { oldPath } = (action as any).payload;
    renamedFileUuid = store.getState().document.files[oldPath]?.fileUuid;
  }

  const result = next(action);

  // File persistence & Sync
  if (
    type === 'document/updateCellContent' ||
    type === 'document/updateCellTitle' ||
    type === 'document/addCell' ||
    type === 'document/deleteCell' ||
    type === 'document/moveCell' ||
    type === 'document/addFile' ||
    type === 'document/addBinaryFile' ||
    type === 'document/addTextFileWithContent'
  ) {
    const state = store.getState().document;
    const currentProjectId = state.currentProjectId;
    if (currentProjectId) {
      const targetPath = (action as any).payload?.path || state.activeFilePath;
      const fileToSave = state.files[targetPath];
      if (fileToSave) {
        const fileUuid = fileToSave.fileUuid || crypto.randomUUID();

        // Local IndexedDB persistence (Instant)
        saveFileToDB({
          id: `${currentProjectId}:${targetPath}`,
          projectId: currentProjectId,
          path: targetPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: (fileToSave as any).binaryData,
          cells: (fileToSave as any).cells,
          fileUuid
        }).catch(err => console.error('Failed to save file to DB:', err));

        // Online Go backend synchronization
        if (state.connectionStatus === 'connected') {
          if (type === 'document/addFile' || type === 'document/addTextFileWithContent') {
            api.createFileWithId(currentProjectId, {
              id: fileUuid,
              name: targetPath,
              type: 'typst'
            })
              .then(async (res) => {
                if (res?.state) {
                  updateFileYjsState(fileUuid, res.state);
                }
                const delta = encodeCellsToYjsDelta(fileUuid, fileToSave.cells || []);
                if (delta) {
                  const sendRes = await api.sendTypstFileChanges(fileUuid, delta);
                  if (sendRes?.state) {
                    updateFileYjsState(fileUuid, sendRes.state);
                  }
                }
              })
              .catch(err => console.error('Failed to create typst file on server:', err));
          } else if (type === 'document/addBinaryFile') {
            const base64Content = uint8ArrayToBase64((fileToSave as any).binaryData);
            api.createFileWithId(currentProjectId, {
              id: fileUuid,
              name: targetPath,
              type: 'binary',
              content: base64Content
            })
              .catch(err => console.error('Failed to upload binary file to server:', err));
          } else if (!fileToSave.isBinary) {
            // Edit actions (updateCellContent, updateCellTitle, addCell, deleteCell, moveCell)
            if (fileSyncTimers.has(fileUuid)) {
              clearTimeout(fileSyncTimers.get(fileUuid));
            }

            const timer = setTimeout(async () => {
              fileSyncTimers.delete(fileUuid);
              const latestState = store.getState().document;
              if (latestState.connectionStatus !== 'connected') return;
              const latestFile = latestState.files[targetPath];
              if (!latestFile || latestFile.isBinary) return;

              try {
                const delta = encodeCellsToYjsDelta(fileUuid, latestFile.cells || []);
                if (delta) {
                  const sendRes = await api.sendTypstFileChanges(fileUuid, delta);
                  if (sendRes?.state) {
                    updateFileYjsState(fileUuid, sendRes.state);
                  }
                }
              } catch (err) {
                console.error('Failed to sync debounced file changes to server:', err);
              }
            }, SYNC_DEBOUNCE_MS);

            fileSyncTimers.set(fileUuid, timer);
          }
        }
      }
    }
  } else if (type === 'document/renameFile') {
    const { oldPath, newPath } = (action as any).payload;
    const state = store.getState().document;
    const currentProjectId = state.currentProjectId;
    if (currentProjectId) {
      deleteFileFromDB(currentProjectId, oldPath).catch(err => console.error('Failed to delete old file during rename:', err));
      
      const fileToSave = state.files[newPath];
      if (fileToSave) {
        const fileUuid = fileToSave.fileUuid || crypto.randomUUID();
        saveFileToDB({
          id: `${currentProjectId}:${newPath}`,
          projectId: currentProjectId,
          path: newPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: (fileToSave as any).binaryData,
          cells: (fileToSave as any).cells,
          fileUuid
        }).catch(err => console.error('Failed to save renamed file to DB:', err));

        // Online sync: delete old file on server and create new one with fileUuid
        if (state.connectionStatus === 'connected') {
          if (renamedFileUuid) {
            api.deleteFile(currentProjectId, renamedFileUuid)
              .catch(err => console.error('Failed to delete old file on server during rename:', err));
          }

          if (fileToSave.isBinary) {
            const base64Content = uint8ArrayToBase64(fileToSave.binaryData);
            api.createFileWithId(currentProjectId, {
              id: fileUuid,
              name: newPath,
              type: 'binary',
              content: base64Content
            })
              .catch(err => console.error('Failed to recreate renamed binary file on server:', err));
          } else {
            api.createFileWithId(currentProjectId, {
              id: fileUuid,
              name: newPath,
              type: 'typst'
            })
              .then(async () => {
                const delta = encodeCellsToYjsDelta(fileUuid, fileToSave.cells || []);
                await api.sendTypstFileChanges(fileUuid, delta);
              })
              .catch(err => console.error('Failed to recreate renamed typst file on server:', err));
          }
        }
      }
    }
  } else if (type === 'document/deleteFile') {
    const deletedPath = (action as any).payload;
    const state = store.getState().document;
    const currentProjectId = state.currentProjectId;
    if (currentProjectId) {
      deleteFileFromDB(currentProjectId, deletedPath).catch(err => console.error('Failed to delete file from DB:', err));

      if (state.connectionStatus === 'connected' && deletedFileUuid) {
        api.deleteFile(currentProjectId, deletedFileUuid)
          .catch(err => console.error('Failed to delete file on server:', err));
      }
    }
  }

  // Project persistence
  else if (type === 'document/addProject') {
    const project = (action as any).payload;
    if (project) {
      saveProjectToDB(project).catch(err => console.error('Failed to save project to DB:', err));
    }
  } else if (type === 'document/updateProjectName') {
    const { id } = (action as any).payload;
    const state = store.getState().document;
    const project = state.projects.find((p: any) => p.id === id);
    if (project) {
      saveProjectToDB(project).catch(err => console.error('Failed to update project name in DB:', err));
    }
  } else if (type === 'document/deleteProject') {
    const projectId = (action as any).payload;
    if (projectId) {
      deleteProjectFromDB(projectId).catch(err => console.error('Failed to delete project from DB:', err));
    }
  }

  return result;
};
