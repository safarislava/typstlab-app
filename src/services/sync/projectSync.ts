import { projectsApi, filesApi } from '../api';
import { projectRepository, fileRepository } from '../storage';
import { 
  applyYjsDelta, 
  decodeYjsDeltaToCells, 
  uint8ArrayToBase64,
  yjsDocManager,
  projectMetadataManager
} from './crdt';
import type { SyncResponse, User, ProjectMetadataFileEntry, Cell } from '../../core/types';

const inFlightSyncs = new Map<string, Promise<boolean>>();

/**
 * Synchronizes a single project with the server using the POST /projects/{projectID}/sync specification.
 */
export async function syncProjectWithServer(projectId: string, _currentUser?: User): Promise<boolean> {
  if (inFlightSyncs.has(projectId)) {
    return inFlightSyncs.get(projectId)!;
  }

  const syncPromise = (async () => {
    try {
      // 1. Check if project exists on server, create if missing (404)
      try {
        await projectsApi.getProjectDetails(projectId);
      } catch {
        const localProjects = await projectRepository.getAll();
        const localProj = localProjects.find(p => p.id === projectId);
        const projName = localProj?.name || 'Untitled Project';
        try {
          await projectsApi.createProjectWithId(projectId, projName);
        } catch (createErr) {
          console.warn('Failed to create project with client UUID on server:', createErr);
        }
      }

      // 2. Fetch local files and ensure deterministic client UUIDs
      const localFiles = await fileRepository.getFilesForProject(projectId);
      const saveFilePromises: Promise<void>[] = [];

      for (const file of localFiles) {
        if (!file.fileUuid || !file.fileUuid.includes('-')) {
          file.fileUuid = crypto.randomUUID();
          saveFilePromises.push(fileRepository.saveFile(file));
        }
      }

      if (saveFilePromises.length > 0) {
        await Promise.all(saveFilePromises);
      }

      // 3. Initialize / update Project Metadata CRDT with local files
      projectMetadataManager.initFromLocalFiles(projectId, localFiles);

      // Note: Legacy HTTP sync POST /projects/{id}/sync is deprecated.
      // WebSocket collaboration service handles sync_init and sync_response.
      return true;
    } catch (err) {
      console.error(`Failed to prepare project sync ${projectId}:`, err);
      return false;
    } finally {
      inFlightSyncs.delete(projectId);
    }
  })();

  inFlightSyncs.set(projectId, syncPromise);
  return syncPromise;
}

/**
 * Applies sync response payload (metadata delta and instructions) to local state.
 */
export async function applySyncResponse(projectId: string, syncResponse: SyncResponse): Promise<void> {
  // 1. Apply server metadata delta if received
  if (syncResponse.metadata_delta) {
    projectMetadataManager.applyMetadataDelta(projectId, syncResponse.metadata_delta);
  }

  // 2. Reflect metadata changes (deletions and renames) in local IndexedDB
  const allMetadataEntries = projectMetadataManager.getAllEntries(projectId);
  for (const entry of allMetadataEntries) {
    if (entry.isDeleted) {
      await fileRepository.deleteFile(projectId, entry.name);
    }
  }

  const localFiles = await fileRepository.getFilesForProject(projectId);
  for (const localFile of localFiles) {
    const metaEntry = allMetadataEntries.find((m: ProjectMetadataFileEntry) => m.id === localFile.fileUuid);
    if (metaEntry && !metaEntry.isDeleted && metaEntry.name !== localFile.path) {
      await fileRepository.deleteFile(projectId, localFile.path);
      localFile.path = metaEntry.name;
      await fileRepository.saveFile({
        ...localFile,
        id: `${projectId}:${metaEntry.name}`,
        path: metaEntry.name
      });
    }
  }

  // 3. Process instructions from server in parallel
  const instructions = syncResponse.instructions || [];
  const updatedLocalFiles = await fileRepository.getFilesForProject(projectId);

  await Promise.allSettled(
    instructions.map(async inst => {
      try {
        const fileId = inst.file_id;
        const metaEntry = allMetadataEntries.find((m: ProjectMetadataFileEntry) => m.id === fileId);
        const localFile = updatedLocalFiles.find(f => f.fileUuid === fileId || (metaEntry && f.path === metaEntry.name));

        if (inst.action === 'upload') {
          if (localFile) {
            if (localFile.isBinary && localFile.binaryData) {
              const base64Content = uint8ArrayToBase64(localFile.binaryData);
              await filesApi.createFileWithId(projectId, {
                id: fileId,
                name: localFile.path,
                type: 'binary',
                content: base64Content
              });
            } else {
              await filesApi.createFileWithId(projectId, {
                id: fileId,
                name: localFile.path,
                type: 'typst'
              });
            }
          }
        } else if (inst.action === 'download') {
          try {
            const typstRes = await filesApi.getTypstFile(fileId);
            if (typstRes && typstRes.name) {
              if (typstRes.state) {
                yjsDocManager.setServerState(fileId, typstRes.state);
              }
              let cells: Cell[] = typstRes.blocks?.map(b => ({
                id: b.id,
                content: b.content,
                title: b.name
              })) || [];

              if (cells.length === 0 && typstRes.state) {
                cells = decodeYjsDeltaToCells(typstRes.state);
              }

              projectMetadataManager.trackFileAddition(projectId, {
                id: fileId,
                name: typstRes.name,
                type: 'typst'
              });

              await fileRepository.saveFile({
                id: `${projectId}:${typstRes.name}`,
                projectId,
                path: typstRes.name,
                isBinary: false,
                cells,
                fileUuid: fileId
              });
            }
          } catch {
            try {
              const binMeta = await filesApi.getBinaryFileMetadata(fileId);
              const rawBytes = await filesApi.getBinaryFileRaw(fileId);

              projectMetadataManager.trackFileAddition(projectId, {
                id: fileId,
                name: binMeta.name,
                type: 'binary'
              });

              await fileRepository.saveFile({
                id: `${projectId}:${binMeta.name}`,
                projectId,
                path: binMeta.name,
                isBinary: true,
                binaryData: new Uint8Array(rawBytes),
                fileUuid: fileId
              });
            } catch (binErr) {
              console.error(`Failed to download binary file ${fileId}:`, binErr);
            }
          }
        } else if (inst.action === 'apply_changes') {
          if (inst.delta) {
            const fileName = metaEntry?.name || localFile?.path || fileId;
            const updatedCells = applyYjsDelta(fileId, localFile?.cells || [], inst.delta);
            await fileRepository.saveFile({
              id: `${projectId}:${fileName}`,
              projectId,
              path: fileName,
              isBinary: false,
              cells: updatedCells,
              fileUuid: fileId
            });
          }
        }
      } catch (instErr) {
        console.error(`Failed to execute sync instruction ${inst.action} on ${inst.file_id}:`, instErr);
      }
    })
  );
}

