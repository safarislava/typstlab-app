import type { TypstProject } from '../../../core/types';
import { initDB, PROJECTS_STORE, FILES_STORE } from '../dbConnection';
import { fileRepository } from './file.repo';

export const projectRepository = {
  async getAll(): Promise<TypstProject[]> {
    const db = await initDB();
    return new Promise<TypstProject[]>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  },

  async getByOwner(username: string): Promise<TypstProject[]> {
    const all = await this.getAll();
    return all.filter(p => p.ownerId === username);
  },

  async save(project: TypstProject): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.put(project);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async delete(projectId: string): Promise<void> {
    const db = await initDB();

    // 1. Delete project metadata
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.delete(projectId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // 2. Delete all associated project files
    const files = await fileRepository.getFilesForProject(projectId);
    if (files.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(FILES_STORE, 'readwrite');
        const store = transaction.objectStore(FILES_STORE);
        let count = 0;
        files.forEach(f => {
          const req = store.delete(f.id);
          req.onsuccess = () => {
            count++;
            if (count === files.length) resolve();
          };
          req.onerror = () => reject(req.error);
        });
      });
    }
  },

  async migrateLegacyProjectsToUser(username: string): Promise<TypstProject[]> {
    const allProjects = await this.getAll();
    const migrated: TypstProject[] = [];
    const savePromises: Promise<void>[] = [];

    for (const project of allProjects) {
      if (!project.ownerId) {
        const updatedProject: TypstProject = { ...project, ownerId: username };
        savePromises.push(this.save(updatedProject));
        migrated.push(updatedProject);
      } else if (project.ownerId === username) {
        migrated.push(project);
      }
    }

    if (savePromises.length > 0) {
      await Promise.all(savePromises);
    }

    return migrated;
  }
};
