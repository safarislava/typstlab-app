import type { Middleware } from '@reduxjs/toolkit';
import { saveFileToDB, deleteFileFromDB, saveProjectToDB, deleteProjectFromDB } from './db';

export const dbMiddleware: Middleware = store => next => action => {
  const result = next(action);
  const type = (action as any).type;

  // File persistence
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
        saveFileToDB({
          id: `${currentProjectId}:${targetPath}`,
          projectId: currentProjectId,
          path: targetPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: (fileToSave as any).binaryData,
          cells: (fileToSave as any).cells
        }).catch(err => console.error('Failed to save file to DB:', err));
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
      }
    }
  } else if (type === 'document/deleteFile') {
    const deletedPath = (action as any).payload;
    const state = store.getState().document;
    const currentProjectId = state.currentProjectId;
    if (currentProjectId) {
      deleteFileFromDB(currentProjectId, deletedPath).catch(err => console.error('Failed to delete file from DB:', err));
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
