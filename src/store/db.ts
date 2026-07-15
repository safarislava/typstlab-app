import type {Cell} from './documentSlice';

export interface TypstProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  ownerId?: string; // Optional field to link projects to a user
}

export interface DBTypstFile {
  id: string; // "projectId:path"
  projectId: string;
  path: string;
  isBinary?: boolean;
  binaryData?: Uint8Array;
  cells?: Cell[];
}

export interface DBUser {
  username: string;
  passwordHash: string;
  email?: string;
  fullName?: string;
  createdAt: number;
}

const DB_NAME = 'TypstLabDB';
const DB_VERSION = 3;
const PROJECTS_STORE = 'projects';
const FILES_STORE = 'project_files';
const USERS_STORE = 'users';

// Password hashing using standard Web Crypto API
export const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

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

      // Migration from version 1
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
};

// User CRUD operations
export const getUserFromDB = async (username: string): Promise<DBUser | null> => {
  const db = await initDB();
  return new Promise<DBUser | null>((resolve, reject) => {
    const transaction = db.transaction(USERS_STORE, 'readonly');
    const store = transaction.objectStore(USERS_STORE);
    const request = store.get(username);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        // Fallback: search all users case-insensitively to support legacy users
        const allRequest = store.getAll();
        allRequest.onerror = () => reject(allRequest.error);
        allRequest.onsuccess = () => {
          const allUsers: DBUser[] = allRequest.result || [];
          const matchedUser = allUsers.find(
            u => u.username.toLowerCase() === username.toLowerCase()
          );
          resolve(matchedUser || null);
        };
      }
    };
  });
};

export const saveUserToDB = async (user: DBUser): Promise<void> => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(USERS_STORE, 'readwrite');
    const store = transaction.objectStore(USERS_STORE);
    const request = store.put(user);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};


// Project CRUD
export const saveProjectToDB = async (project: TypstProject): Promise<void> => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.put(project);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const deleteProjectFromDB = async (projectId: string): Promise<void> => {
  const db = await initDB();
  
  // 1. Delete the project
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readwrite');
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.delete(projectId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // 2. Delete all files in the project
  const files = await getFilesForProjectFromDB(projectId);
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
};

export const getAllProjectsFromDB = async (): Promise<TypstProject[]> => {
  const db = await initDB();
  return new Promise<TypstProject[]>((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getProjectsForUserFromDB = async (username: string): Promise<TypstProject[]> => {
  const db = await initDB();
  return new Promise<TypstProject[]>((resolve, reject) => {
    const transaction = db.transaction(PROJECTS_STORE, 'readonly');
    const store = transaction.objectStore(PROJECTS_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allProjects: TypstProject[] = request.result || [];
      const userProjects = allProjects.filter(p => p.ownerId === username);
      resolve(userProjects);
    };
  });
};

export const migrateLegacyProjectsToUser = async (username: string): Promise<TypstProject[]> => {
  const allProjects = await getAllProjectsFromDB();
  const migrated: TypstProject[] = [];
  
  for (const project of allProjects) {
    if (!project.ownerId) {
      const updatedProject = { ...project, ownerId: username };
      await saveProjectToDB(updatedProject);
      migrated.push(updatedProject);
    } else if (project.ownerId === username) {
      migrated.push(project);
    }
  }
  return migrated;
};

// File CRUD
export const getFilesForProjectFromDB = async (projectId: string): Promise<DBTypstFile[]> => {
  const db = await initDB();
  return new Promise<DBTypstFile[]>((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readonly');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allFiles: DBTypstFile[] = request.result;
      const projectFiles = allFiles.filter(f => f.projectId === projectId);
      resolve(projectFiles);
    };
  });
};

export const saveFileToDB = async (file: DBTypstFile): Promise<void> => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
    const request = store.put(file);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const deleteFileFromDB = async (projectId: string, path: string): Promise<void> => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FILES_STORE, 'readwrite');
    const store = transaction.objectStore(FILES_STORE);
    const id = `${projectId}:${path}`;
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
