import type { Middleware } from '@reduxjs/toolkit';
import { saveFileToDB, deleteFileFromDB } from './db';

export const dbMiddleware: Middleware = store => next => action => {
  const result = next(action);
  const type = (action as any).type;

  if (
    type === 'document/updateCellContent' ||
    type === 'document/updateCellTitle' ||
    type === 'document/addCell' ||
    type === 'document/deleteCell' ||
    type === 'document/moveCell' ||
    type === 'document/addFile' ||
    type === 'document/renameFile'
  ) {
    const state = store.getState().document;
    const activeFile = state.files[state.activeFilePath];
    if (activeFile) {
      saveFileToDB(activeFile).catch(err => console.error('Failed to save to DB:', err));
    }
  } else if (type === 'document/deleteFile') {
    const deletedPath = (action as any).payload;
    deleteFileFromDB(deletedPath).catch(err => console.error('Failed to delete from DB:', err));
  }

  return result;
};
