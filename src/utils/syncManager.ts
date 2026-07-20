import { api } from './api';
import { 
  getAllProjectsFromDB, 
  getFilesForProjectFromDB, 
  saveProjectToDB, 
  saveFileToDB, 
  deleteProjectFromDB, 
  deleteFileFromDB 
} from '../store/db';
import { encodeCellsToYjsDelta, uint8ArrayToBase64 } from './yjsSync';
import type { User } from '../store/documentSlice';

/**
 * Synchronizes offline created projects and files to the server.
 * When a project starts with "proj_" prefix, it was created offline.
 * This function registers it on the Go backend server, uploads its files,
 * updates the local IndexedDB IDs to match server UUIDs, and handles hash updates.
 */
export async function syncOfflineDataToServer(currentUser: User): Promise<void> {
  try {
    const allProjects = await getAllProjectsFromDB();
    const offlineProjects = allProjects.filter(p => p.id.startsWith('proj_'));

    if (offlineProjects.length === 0) {
      return;
    }

    console.log(`Syncing ${offlineProjects.length} offline projects to server...`);

    for (const project of offlineProjects) {
      try {
        // 1. Create project on server
        const serverProj = await api.createProject(project.name);
        const serverProjectId = serverProj.id;

        // 2. Fetch local files of this offline project
        const localFiles = await getFilesForProjectFromDB(project.id);

        for (const file of localFiles) {
          try {
            if (file.isBinary && file.binaryData) {
              // Upload binary file
              const base64Content = uint8ArrayToBase64(file.binaryData);
              await api.createBinaryFile(serverProjectId, file.path, base64Content);

              // Cache under new server project ID
              await saveFileToDB({
                id: `${serverProjectId}:${file.path}`,
                projectId: serverProjectId,
                path: file.path,
                isBinary: true,
                binaryData: file.binaryData
              });
            } else {
              // Create typst file
              const createdFile = await api.createTypstFile(serverProjectId, file.path);
              const serverFileId = createdFile.id;

              // Upload cells contents
              const delta = encodeCellsToYjsDelta(file.cells || []);
              await api.sendTypstFileChanges(serverFileId, delta);

              // Cache under new server project ID
              await saveFileToDB({
                id: `${serverProjectId}:${file.path}`,
                projectId: serverProjectId,
                path: file.path,
                isBinary: false,
                cells: file.cells
              });
            }

            // Delete old file cache
            await deleteFileFromDB(project.id, file.path);
          } catch (fileErr) {
            console.error(`Failed to sync file ${file.path} for project ${project.name}:`, fileErr);
          }
        }

        // 3. Save new project metadata locally
        await saveProjectToDB({
          id: serverProjectId,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: Date.now(),
          ownerId: currentUser.username
        });

        // 4. Delete old project from local DB
        await deleteProjectFromDB(project.id);

        // 5. Update URL hash if this project was open
        if (window.location.hash === `#/project/${project.id}`) {
          window.location.hash = `#/project/${serverProjectId}`;
        }
      } catch (projErr) {
        console.error(`Failed to sync project ${project.name} to server:`, projErr);
      }
    }

    console.log('Offline synchronization completed successfully.');
  } catch (err) {
    console.error('Error during offline synchronization:', err);
  }
}
