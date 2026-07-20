import type { Middleware } from '@reduxjs/toolkit';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, deleteProjectFromDB } from './db';
import { api } from '../utils/api';
import { encodeCellsToYjsDelta, uint8ArrayToBase64 } from '../utils/yjsSync';

export const dbMiddleware: Middleware = store => next => action => {
  const type = (action as any).type;

  // Capture metadata before action changes the state
  let deletedFileBackendId: string | undefined;
  let renamedFileBackendId: string | undefined;

  if (type === 'document/deleteFile') {
    const path = (action as any).payload;
    deletedFileBackendId = store.getState().document.files[path]?.backendId;
  } else if (type === 'document/renameFile') {
    const { oldPath } = (action as any).payload;
    renamedFileBackendId = store.getState().document.files[oldPath]?.backendId;
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
        // Local IndexedDB persistence
        saveFileToDB({
          id: `${currentProjectId}:${targetPath}`,
          projectId: currentProjectId,
          path: targetPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: (fileToSave as any).binaryData,
          cells: (fileToSave as any).cells
        }).catch(err => console.error('Failed to save file to DB:', err));

        // Online Go backend synchronization
        if (state.connectionStatus === 'connected') {
          if (fileToSave.backendId) {
            // Already exists on server, sync edits
            if (!fileToSave.isBinary) {
              const delta = encodeCellsToYjsDelta(fileToSave.cells || []);
              api.sendTypstFileChanges(fileToSave.backendId, delta)
                .catch(err => console.error('Failed to sync file changes to server:', err));
            }
          } else {
            // Needs to be created on server
            if (type === 'document/addFile') {
              api.createTypstFile(currentProjectId, targetPath)
                .then(res => {
                  store.dispatch({
                    type: 'document/setFileBackendId',
                    payload: { path: targetPath, backendId: res.id }
                  });
                })
                .catch(err => console.error('Failed to create typst file on server:', err));
            } else if (type === 'document/addTextFileWithContent') {
              api.createTypstFile(currentProjectId, targetPath)
                .then(async (res) => {
                  store.dispatch({
                    type: 'document/setFileBackendId',
                    payload: { path: targetPath, backendId: res.id }
                  });
                  const delta = encodeCellsToYjsDelta(fileToSave.cells || []);
                  await api.sendTypstFileChanges(res.id, delta);
                })
                .catch(err => console.error('Failed to create typst file with content on server:', err));
            } else if (type === 'document/addBinaryFile') {
              const base64Content = uint8ArrayToBase64((fileToSave as any).binaryData);
              api.createBinaryFile(currentProjectId, targetPath, base64Content)
                .then(res => {
                  store.dispatch({
                    type: 'document/setFileBackendId',
                    payload: { path: targetPath, backendId: res.id }
                  });
                })
                .catch(err => console.error('Failed to upload binary file to server:', err));
            }
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
        saveFileToDB({
          id: `${currentProjectId}:${newPath}`,
          projectId: currentProjectId,
          path: newPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: (fileToSave as any).binaryData,
          cells: (fileToSave as any).cells
        }).catch(err => console.error('Failed to save renamed file to DB:', err));

        // Online sync: delete old file and create new one
        if (state.connectionStatus === 'connected') {
          if (renamedFileBackendId) {
            api.deleteFile(currentProjectId, renamedFileBackendId)
              .catch(err => console.error('Failed to delete old file on server during rename:', err));
          }

          if (fileToSave.isBinary) {
            const base64Content = uint8ArrayToBase64(fileToSave.binaryData);
            api.createBinaryFile(currentProjectId, newPath, base64Content)
              .then(res => {
                store.dispatch({
                  type: 'document/setFileBackendId',
                  payload: { path: newPath, backendId: res.id }
                });
              })
              .catch(err => console.error('Failed to recreate renamed binary file on server:', err));
          } else {
            api.createTypstFile(currentProjectId, newPath)
              .then(async (res) => {
                store.dispatch({
                  type: 'document/setFileBackendId',
                  payload: { path: newPath, backendId: res.id }
                });
                const delta = encodeCellsToYjsDelta(fileToSave.cells || []);
                await api.sendTypstFileChanges(res.id, delta);
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

      if (state.connectionStatus === 'connected' && deletedFileBackendId) {
        api.deleteFile(currentProjectId, deletedFileBackendId)
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
      // Note: No DELETE /projects/{projectID} endpoint exists in the OpenAPI spec.
    }
  }

  return result;
};
