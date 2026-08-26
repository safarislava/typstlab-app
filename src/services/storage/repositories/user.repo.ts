import type { DBUser } from '../../../core/types';
import { initDB, USERS_STORE } from '../dbConnection';

export const userRepository = {
  async getUser(username: string): Promise<DBUser | null> {
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
          // Case-insensitive fallback
          const allRequest = store.getAll();
          allRequest.onerror = () => reject(allRequest.error);
          allRequest.onsuccess = () => {
            const allUsers: DBUser[] = allRequest.result || [];
            const matched = allUsers.find(
              u => u.username.toLowerCase() === username.toLowerCase()
            );
            resolve(matched || null);
          };
        }
      };
    });
  },

  async saveUser(user: DBUser): Promise<void> {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(USERS_STORE, 'readwrite');
      const store = transaction.objectStore(USERS_STORE);
      const request = store.put(user);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
};
