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
    type === 'document/renameFile' ||
    type === 'document/addBinaryFile' ||
    type === 'document/addTextFileWithContent'
  ) {
    const state = store.getState().document;
    const targetPath = (action as any).payload?.path || state.activeFilePath;
    const fileToSave = state.files[targetPath];
    if (fileToSave) {
      saveFileToDB(fileToSave).catch(err => console.error('Failed to save to DB:', err));
    }
  } else if (type === 'document/deleteFile') {
    const deletedPath = (action as any).payload;
    deleteFileFromDB(deletedPath).catch(err => console.error('Failed to delete from DB:', err));
  }

  return result;
};
