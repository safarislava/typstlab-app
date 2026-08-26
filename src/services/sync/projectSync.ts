import { projectsApi, filesApi } from '../api';
import { projectRepository, fileRepository } from '../storage';
import { 
  encodeCellsToYjsDelta, 
  encodeYjsStateVector, 
  applyYjsDelta, 
  decodeYjsDeltaToCells, 
  uint8ArrayToBase64 
} from './crdt/deltaCodec';
import type { SyncFileManifest, SyncInstruction, User } from '../../core/types';

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

      // 2. Build local files manifest with valid client UUIDs
      const localFiles = await fileRepository.getFilesForProject(projectId);
      const manifestFiles: SyncFileManifest[] = [];

      for (const file of localFiles) {
        let fileUuid = file.fileUuid;
        if (!fileUuid || !fileUuid.includes('-')) {
          fileUuid = crypto.randomUUID();
          file.fileUuid = fileUuid;
          await fileRepository.saveFile(file);
        }

        manifestFiles.push({
          id: fileUuid,
          name: file.path,
          type: file.isBinary ? 'binary' : 'typst',
          yjs_state_vector: file.isBinary ? undefined : encodeYjsStateVector(fileUuid, file.cells || [])
        });
      }

      // 3. Send sync manifest request
      let instructions: SyncInstruction[] = [];
      try {
        const syncResponse = await projectsApi.syncProject(projectId, manifestFiles);
        instructions = syncResponse.instructions || [];
      } catch {
        // Fallback: Upload missing files directly
        for (const localFile of localFiles) {
          try {
            if (localFile.isBinary && localFile.binaryData) {
              const base64Content = uint8ArrayToBase64(localFile.binaryData);
              await filesApi.createBinaryFile(projectId, localFile.path, base64Content);
            } else {
              const createdFile = await filesApi.createTypstFile(projectId, localFile.path);
              const delta = encodeCellsToYjsDelta(localFile.fileUuid || createdFile.id, localFile.cells || []);
              await filesApi.sendTypstFileChanges(createdFile.id, delta);
            }
          } catch {
            // Ignore fallback errors
          }
        }
      }

      // 4. Process instructions from server
      for (const inst of instructions) {
        try {
          const fileId = inst.file_id;
          const fileName = fileId.includes(':') ? fileId.split(':').slice(1).join(':') : fileId;
          const localFile = localFiles.find(f => f.fileUuid === fileId || f.path === fileName || f.id === fileId);

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
                const createdFile = await filesApi.createFileWithId(projectId, {
                  id: fileId,
                  name: localFile.path,
                  type: 'typst'
                });
                const delta = encodeCellsToYjsDelta(fileId, localFile.cells || []);
                await filesApi.sendTypstFileChanges(createdFile.id || fileId, delta);
              }
            }
          } else if (inst.action === 'download') {
            if (inst.payload) {
              const cells = decodeYjsDeltaToCells(inst.payload);
              await fileRepository.saveFile({
                id: `${projectId}:${fileName}`,
                projectId,
                path: fileName,
                isBinary: false,
                cells,
                fileUuid: fileId
              });
            }
          } else if (inst.action === 'apply_changes') {
            if (localFile && !localFile.isBinary && inst.payload) {
              const updatedCells = applyYjsDelta(fileId, localFile.cells || [], inst.payload);
              await fileRepository.saveFile({
                id: `${projectId}:${fileName}`,
                projectId,
                path: fileName,
                isBinary: false,
                cells: updatedCells,
                fileUuid: fileId
              });
            }
          } else if (inst.action === 'rename' && inst.new_name) {
            if (localFile) {
              await fileRepository.deleteFile(projectId, localFile.path);
              await fileRepository.saveFile({
                ...localFile,
                id: `${projectId}:${inst.new_name}`,
                projectId,
                path: inst.new_name
              });
            }
          } else if (inst.action === 'delete') {
            await fileRepository.deleteFile(projectId, fileName);
          }
        } catch (instErr) {
          console.error(`Failed to execute sync instruction ${inst.action}:`, instErr);
        }
      }

      return true;
    } catch (err) {
      console.error(`Failed to sync project ${projectId}:`, err);
      return false;
    } finally {
      inFlightSyncs.delete(projectId);
    }
  })();

  inFlightSyncs.set(projectId, syncPromise);
  return syncPromise;
}
