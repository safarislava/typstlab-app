import { useEffect } from 'react';
import { 
  useAppDispatch, 
  useAppSelector, 
  setWsStatus, 
  updateFileCells, 
  initializeProject, 
  clearCollaboration 
} from '../store';
import { 
  wsCollaborationClient, 
  collaborationSyncService, 
  awarenessManager,
  fileRepository 
} from '../services';
import type { TypstFile } from '../core/types';

export function useCollaborationSession(projectId: string | null) {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(state => state.network.connectionStatus);

  useEffect(() => {
    if (!projectId || connectionStatus !== 'connected') {
      return;
    }

    // 1. Sync WS connection status to Redux store
    const unStatus = wsCollaborationClient.onStatusChange(status => {
      dispatch(setWsStatus(status));
    });

    // 2. Initialize sync and awareness domain managers
    collaborationSyncService.init(projectId);
    awarenessManager.init(projectId);

    // 3. Connect WebSocket to project room
    wsCollaborationClient.connect(projectId);

    // 4. Handle incoming remote content updates (live typst editing)
    const unContent = collaborationSyncService.onContentUpdated((fileId, updatedCells) => {
      dispatch(updateFileCells({ fileUuid: fileId, cells: updatedCells }));
    });

    // 5. Handle incoming remote file tree metadata updates (additions, renames, deletions)
    const unMetadata = collaborationSyncService.onMetadataUpdated(async projId => {
      if (projId === projectId) {
        const dbFiles = await fileRepository.getFilesForProject(projectId);
        const reduxFiles: TypstFile[] = dbFiles.map(f => {
          if (f.isBinary) {
            return {
              path: f.path,
              isBinary: true,
              binaryData: f.binaryData!,
              fileUuid: f.fileUuid
            };
          } else {
            return {
              path: f.path,
              isBinary: false,
              cells: f.cells || [],
              fileUuid: f.fileUuid
            };
          }
        });
        dispatch(initializeProject(reduxFiles));
      }
    });

    return () => {
      unStatus();
      unContent();
      unMetadata();
      awarenessManager.cleanup();
      collaborationSyncService.cleanup();
      wsCollaborationClient.disconnect();
      dispatch(clearCollaboration());
    };
  }, [projectId, connectionStatus, dispatch]);
}
