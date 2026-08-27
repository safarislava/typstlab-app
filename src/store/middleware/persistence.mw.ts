import type { Middleware } from '@reduxjs/toolkit';
import { projectRepository, fileRepository } from '../../services';

export const persistenceMiddleware: Middleware = store => next => action => {
  const type = (action as any).type;

  // Track old metadata before reduction
  let oldRenamedPath: string | undefined;
  if (type === 'editor/renameFile') {
    oldRenamedPath = (action as any).payload?.oldPath;
  }

  const result = next(action);
  const state = store.getState();
  const currentProjectId = state.projects?.currentProjectId;

  // File persistence
  if (
    type === 'editor/updateCellContent' ||
    type === 'editor/updateCellTitle' ||
    type === 'editor/addCell' ||
    type === 'editor/deleteCell' ||
    type === 'editor/moveCell' ||
    type === 'editor/addFile' ||
    type === 'editor/addBinaryFile' ||
    type === 'editor/addTextFileWithContent'
  ) {
    if (currentProjectId) {
      const targetPath = (action as any).payload?.path || state.editor?.activeFilePath;
      const fileToSave = state.editor?.files?.[targetPath];
      if (fileToSave) {
        fileRepository.saveFile({
          id: `${currentProjectId}:${targetPath}`,
          projectId: currentProjectId,
          path: targetPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: fileToSave.binaryData,
          cells: fileToSave.cells,
          fileUuid: fileToSave.fileUuid || crypto.randomUUID()
        }).catch(err => console.error('Persistence failed for file:', err));
      }
    }
  } else if (type === 'editor/renameFile') {
    const { newPath } = (action as any).payload;
    if (currentProjectId && oldRenamedPath) {
      fileRepository.deleteFile(currentProjectId, oldRenamedPath).catch(console.error);
      const fileToSave = state.editor?.files?.[newPath];
      if (fileToSave) {
        fileRepository.saveFile({
          id: `${currentProjectId}:${newPath}`,
          projectId: currentProjectId,
          path: newPath,
          isBinary: fileToSave.isBinary || false,
          binaryData: fileToSave.binaryData,
          cells: fileToSave.cells,
          fileUuid: fileToSave.fileUuid || crypto.randomUUID()
        }).catch(console.error);
      }
    }
  } else if (type === 'editor/deleteFile') {
    const deletedPath = (action as any).payload;
    if (currentProjectId && deletedPath) {
      fileRepository.deleteFile(currentProjectId, deletedPath).catch(console.error);
    }
  }

  // Project persistence
  else if (type === 'projects/addProject') {
    const project = (action as any).payload;
    if (project) {
      projectRepository.save(project).catch(console.error);
    }
  } else if (type === 'projects/updateProjectName') {
    const { id } = (action as any).payload;
    const project = state.projects?.projects?.find((p: any) => p.id === id);
    if (project) {
      projectRepository.save(project).catch(console.error);
    }
  } else if (type === 'projects/deleteProject') {
    const projectId = (action as any).payload;
    if (projectId) {
      projectRepository.delete(projectId).catch(console.error);
    }
  }

  return result;
};
