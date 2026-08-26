import type { Middleware } from '@reduxjs/toolkit';
import { projectRepository, fileRepository } from '../../services/storage';

export const persistenceMiddleware: Middleware = store => next => action => {
  const type = (action as any).type;

  // Track old metadata before reduction
  let oldRenamedPath: string | undefined;
  if (type === 'editor/renameFile' || type === 'document/renameFile') {
    oldRenamedPath = (action as any).payload?.oldPath;
  }

  const result = next(action);
  const state = store.getState();
  const currentProjectId = state.projects?.currentProjectId || state.document?.currentProjectId;

  // File mutations
  if (
    type === 'editor/updateCellContent' ||
    type === 'editor/updateCellTitle' ||
    type === 'editor/addCell' ||
    type === 'editor/deleteCell' ||
    type === 'editor/moveCell' ||
    type === 'editor/addFile' ||
    type === 'editor/addBinaryFile' ||
    type === 'editor/addTextFileWithContent' ||
    type === 'document/updateCellContent' ||
    type === 'document/updateCellTitle' ||
    type === 'document/addCell' ||
    type === 'document/deleteCell' ||
    type === 'document/moveCell' ||
    type === 'document/addFile' ||
    type === 'document/addBinaryFile' ||
    type === 'document/addTextFileWithContent'
  ) {
    if (currentProjectId) {
      const targetPath = (action as any).payload?.path || state.editor?.activeFilePath || state.document?.activeFilePath;
      const fileToSave = (state.editor?.files || state.document?.files)?.[targetPath];
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
  } else if (type === 'editor/renameFile' || type === 'document/renameFile') {
    const { newPath } = (action as any).payload;
    if (currentProjectId && oldRenamedPath) {
      fileRepository.deleteFile(currentProjectId, oldRenamedPath).catch(console.error);
      const fileToSave = (state.editor?.files || state.document?.files)?.[newPath];
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
  } else if (type === 'editor/deleteFile' || type === 'document/deleteFile') {
    const deletedPath = (action as any).payload;
    if (currentProjectId && deletedPath) {
      fileRepository.deleteFile(currentProjectId, deletedPath).catch(console.error);
    }
  }

  // Project mutations
  else if (type === 'projects/addProject' || type === 'document/addProject') {
    const project = (action as any).payload;
    if (project) {
      projectRepository.save(project).catch(console.error);
    }
  } else if (type === 'projects/updateProjectName' || type === 'document/updateProjectName') {
    const { id } = (action as any).payload;
    const project = (state.projects?.projects || state.document?.projects)?.find((p: any) => p.id === id);
    if (project) {
      projectRepository.save(project).catch(console.error);
    }
  } else if (type === 'projects/deleteProject' || type === 'document/deleteProject') {
    const projectId = (action as any).payload;
    if (projectId) {
      projectRepository.delete(projectId).catch(console.error);
    }
  }

  return result;
};
