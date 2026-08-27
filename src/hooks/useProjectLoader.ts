import { useState, useCallback } from 'react';
import { 
  useAppDispatch, 
  useAppSelector, 
  initializeProject, 
  setCurrentProjectId, 
  setProjects, 
  setTitle 
} from '../store';
import { projectRepository, fileRepository, syncProjectWithServer, projectsApi } from '../services';
import type { TypstFile, TypstProject } from '../core/types';

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

        // 2. Validate and load project metadata
        let allProjects = await projectRepository.getAll();
        let targetProject = allProjects.find(p => p.id === projectId);

        // If not found locally but connected, check server details
        if (!targetProject && connectionStatus === 'connected') {
          try {
            const serverProj = await projectsApi.getProjectDetails(projectId);
            if (serverProj && serverProj.id) {
              const newLocalProj: TypstProject = {
                id: serverProj.id,
                name: serverProj.name || 'Untitled Project',
                createdAt: serverProj.created_at ? new Date(serverProj.created_at).getTime() : Date.now(),
                updatedAt: serverProj.updated_at ? new Date(serverProj.updated_at).getTime() : Date.now(),
                ownerId: currentUser?.username || undefined
              };
              await projectRepository.save(newLocalProj);
              allProjects = await projectRepository.getAll();
              targetProject = newLocalProj;
            }
          } catch (serverErr) {
            console.warn('Failed to fetch project details from server:', serverErr);
          }
        }

        const authorized =
          connectionStatus === 'connected'
            ? allProjects.some(
                p => p.id === projectId && (!currentUser || !p.ownerId || p.ownerId === currentUser.username)
              )
            : allProjects.some(p => p.id === projectId);

        if (!authorized || !targetProject) {
          setError('Project not found or not authorized');
          setIsLoading(false);
          return false;
        }

        // 3. Populate projects list and title in Redux
        const userProjects = (connectionStatus === 'connected' && currentUser)
          ? allProjects.filter(p => !p.ownerId || p.ownerId === currentUser.username)
          : allProjects;

        dispatch(setProjects(userProjects));
        dispatch(setCurrentProjectId(projectId));
        dispatch(setTitle(targetProject.name));

        // 4. Load files from IndexedDB into Redux
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
