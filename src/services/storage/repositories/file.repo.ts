import type { DBTypstFile } from '../../../core/types';
import { initDB, FILES_STORE } from '../dbConnection';

export const fileRepository = {
  async getFilesForProject(projectId: string): Promise<DBTypstFile[]> {
    const db = await initDB();
    return new Promise<DBTypstFile[]>((resolve, reject) => {
      const transaction = db.transaction(FILES_STORE, 'readonly');
      const store = transaction.objectStore(FILES_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allFiles: DBTypstFile[] = request.result || [];
        const projectFiles = allFiles.filter(f => f.projectId === projectId);
        resolve(projectFiles);
      };
    });
  },

  async saveFile(file: DBTypstFile): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FILES_STORE, 'readwrite');
      const store = transaction.objectStore(FILES_STORE);
      const request = store.put(file);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  },

  async deleteFile(projectId: string, path: string): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FILES_STORE, 'readwrite');
      const store = transaction.objectStore(FILES_STORE);
      const id = `${projectId}:${path}`;
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
};
