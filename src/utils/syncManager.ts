import { api } from './api';
import { 
  getAllProjectsFromDB, 
  getFilesForProjectFromDB, 
  saveFileToDB, 
  deleteFileFromDB 
} from '../store/db';
import { 
  encodeCellsToYjsDelta, 
  encodeYjsStateVector, 
  applyYjsDelta, 
  decodeYjsDeltaToCells, 
  uint8ArrayToBase64 
} from './yjsSync';
import type { User } from '../store/documentSlice';

export interface SyncFileManifest {
  id: string;
  name: string;
  type: 'typst' | 'binary';
  yjs_state_vector?: string;
  checksum?: string;
}

export interface SyncInstruction {
  action: 'upload' | 'download' | 'apply_changes' | 'rename' | 'delete';
  file_id: string;
  new_name?: string;
  payload?: string;
}

const inFlightSyncs = new Map<string, Promise<boolean>>();

/**
 * Synchronizes a single project with the server using the POST /projects/{projectID}/sync specification.
 * Parallel/duplicate calls for the same projectId are deduplicated into a single in-flight promise.
 */
export async function syncProjectWithServer(projectId: string, _currentUser?: User): Promise<boolean> {
  if (inFlightSyncs.has(projectId)) {
    return inFlightSyncs.get(projectId)!;
  }

  const syncPromise = (async () => {
    try {
      // 1. Check if project exists on server, create if missing (404)
      try {
        await api.getProjectDetails(projectId);
      } catch (err) {
        // Server returned 404. Create the project on server passing the client's UUID.
        const localProjects = await getAllProjectsFromDB();
        const localProj = localProjects.find(p => p.id === projectId);
        const projName = localProj?.name || 'Untitled Project';
        try {
          await api.createProjectWithId(projectId, projName);
        } catch (createErr) {
          console.warn('Failed to create project with client UUID on server:', createErr);
        }
      }

      // 2. Build local files manifest with valid client UUIDs
      const localFiles = await getFilesForProjectFromDB(projectId);
      const manifestFiles: SyncFileManifest[] = [];

      for (const file of localFiles) {
        let fileUuid = file.fileUuid;
        if (!fileUuid || !fileUuid.includes('-')) {
          fileUuid = crypto.randomUUID();
          file.fileUuid = fileUuid;
          await saveFileToDB(file);
        }

        manifestFiles.push({
          id: fileUuid,
          name: file.path,
          type: file.isBinary ? 'binary' : 'typst',
          yjs_state_vector: file.isBinary ? undefined : encodeYjsStateVector(file.cells || [])
        });
      }

      // 3. Send POST /projects/{projectID}/sync manifest request
      let syncResponse: { instructions: SyncInstruction[] } = { instructions: [] };
      try {
        syncResponse = await api.syncProject(projectId, manifestFiles);
      } catch (syncErr) {
        // Fallback: If POST /projects/{projectID}/sync is not supported by server, upload missing files directly
        for (const localFile of localFiles) {
          try {
            if (localFile.isBinary && localFile.binaryData) {
              const base64Content = uint8ArrayToBase64(localFile.binaryData);
              await api.createBinaryFile(projectId, localFile.path, base64Content);
            } else {
              const createdFile = await api.createTypstFile(projectId, localFile.path);
              const delta = encodeCellsToYjsDelta(localFile.cells || []);
              await api.sendTypstFileChanges(createdFile.id, delta);
            }
          } catch {
            // Ignore fallback errors
          }
        }
      }

      const instructions = syncResponse.instructions || [];

      // 4. Process returned instructions
      for (const inst of instructions) {
        try {
          const fileId = inst.file_id;
          const fileName = fileId.includes(':') ? fileId.split(':').slice(1).join(':') : fileId;
          const localFile = localFiles.find(f => f.fileUuid === fileId || f.path === fileName || f.id === fileId);

          if (inst.action === 'upload') {
            if (localFile) {
              if (localFile.isBinary && localFile.binaryData) {
                const base64Content = uint8ArrayToBase64(localFile.binaryData);
                await api.createFileWithId(projectId, {
                  id: fileId,
                  name: localFile.path,
                  type: 'binary',
                  content: base64Content
                });
              } else {
                const createdFile = await api.createFileWithId(projectId, {
                  id: fileId,
                  name: localFile.path,
                  type: 'typst'
                });
                const delta = encodeCellsToYjsDelta(localFile.cells || []);
                await api.sendTypstFileChanges(createdFile.id || fileId, delta);
              }
            }
          } else if (inst.action === 'download') {
            if (inst.payload) {
              const cells = decodeYjsDeltaToCells(inst.payload);
              await saveFileToDB({
                id: `${projectId}:${fileName}`,
                projectId,
                path: fileName,
                isBinary: false,
                cells
              });
            }
          } else if (inst.action === 'apply_changes') {
            if (localFile && !localFile.isBinary && inst.payload) {
              const updatedCells = applyYjsDelta(localFile.cells || [], inst.payload);
              await saveFileToDB({
                id: `${projectId}:${fileName}`,
                projectId,
                path: fileName,
                isBinary: false,
                cells: updatedCells
              });
            }
          } else if (inst.action === 'rename' && inst.new_name) {
            if (localFile) {
              await deleteFileFromDB(projectId, localFile.path);
              await saveFileToDB({
                ...localFile,
                id: `${projectId}:${inst.new_name}`,
                projectId,
                path: inst.new_name
              });
            }
          } else if (inst.action === 'delete') {
            await deleteFileFromDB(projectId, fileName);
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
