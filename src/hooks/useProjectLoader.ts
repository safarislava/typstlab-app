import { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector, initializeProject, setCurrentProjectId } from '../store';
import { projectRepository, fileRepository, syncProjectWithServer } from '../services';
import type { TypstFile } from '../core/types';

export function useProjectLoader() {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(state => state.network.connectionStatus);
  const currentUser = useAppSelector(state => state.auth.currentUser);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Sync with server if connected
        if (connectionStatus === 'connected') {
          try {
            await syncProjectWithServer(projectId, currentUser || undefined);
          } catch (syncErr) {
            console.warn('Sync failed on project load:', syncErr);
          }
        }

        // 2. Validate project exists in local storage
        const allProjects = await projectRepository.getAll();
        const authorized =
          connectionStatus === 'connected'
            ? allProjects.some(
                p => p.id === projectId && (!currentUser || p.ownerId === currentUser.username)
              )
            : allProjects.some(p => p.id === projectId);

        if (!authorized) {
          setError('Project not found or not authorized');
          setIsLoading(false);
          return false;
        }

        // 3. Load files from IndexedDB into Redux
        const dbFiles = await fileRepository.getFilesForProject(projectId);
        let reduxFiles: TypstFile[] = dbFiles.map(f => {
          if (f.isBinary) {
            return {
              path: f.path,
              isBinary: true,
              binaryData: f.binaryData!,
              fileUuid: f.fileUuid
            };
          } else {
            const seenIds = new Set<string>();
            const cleanCells = (f.cells || []).filter(c => {
              if (!c.id || seenIds.has(c.id)) return false;
              seenIds.add(c.id);
              return true;
            });
            return {
              path: f.path,
              isBinary: false,
              cells: cleanCells,
              fileUuid: f.fileUuid
            };
          }
        });

        // If project has no files yet, create default main.typxml
        if (reduxFiles.length === 0) {
          const defaultCell = { 
            id: crypto.randomUUID(), 
            content: '#set page(paper: "a4")\n\n= Welcome to TypstLab\n\nStart writing your document in Typst markup here.' 
          };
          const defaultFile: TypstFile = {
            path: 'main.typxml',
            isBinary: false,
            cells: [defaultCell],
            fileUuid: crypto.randomUUID()
          };
          reduxFiles = [defaultFile];
          await fileRepository.saveFile({
            id: `${projectId}:main.typxml`,
            projectId,
            path: 'main.typxml',
            isBinary: false,
            cells: [defaultCell],
            fileUuid: defaultFile.fileUuid
          });
        }

        dispatch(initializeProject(reduxFiles));
        dispatch(setCurrentProjectId(projectId));
        setIsLoading(false);
        return true;
      } catch (err: any) {
        console.error('Failed to load project:', err);
        setError(err?.message || 'Error loading project');
        setIsLoading(false);
        return false;
      }
    },
    [connectionStatus, currentUser, dispatch]
  );

  return {
    loadProject,
    isLoading,
    error
  };
}
