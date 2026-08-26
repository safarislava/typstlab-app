import type { TypstProject } from '../../core/types';

export const DB_NAME = 'TypstLabDB';
export const DB_VERSION = 3;
export const PROJECTS_STORE = 'projects';
export const FILES_STORE = 'project_files';
export const USERS_STORE = 'users';

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      const transaction = request.transaction!;

      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(USERS_STORE)) {
        db.createObjectStore(USERS_STORE, { keyPath: 'username' });
      }

      // Migration from version 1 if applicable
      if (db.objectStoreNames.contains('files')) {
        const oldFilesStore = transaction.objectStore('files');
        const getRequest = oldFilesStore.getAll();

        getRequest.onsuccess = () => {
          const oldFiles = getRequest.result;
          const projectsStore = transaction.objectStore(PROJECTS_STORE);
          const newFilesStore = transaction.objectStore(FILES_STORE);

          const defaultProject: TypstProject = {
            id: 'default-project',
            name: 'Default Project',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          projectsStore.put(defaultProject);

          oldFiles.forEach((file: any) => {
            newFilesStore.put({
              id: `default-project:${file.path}`,
              projectId: 'default-project',
              path: file.path,
              isBinary: file.isBinary || false,
              binaryData: file.binaryData,
              cells: file.cells
            });
          });

          db.deleteObjectStore('files');
        };
      }
    };
  });

  return dbPromise;
}
