const TOKEN_KEY = 'typstlab_access_token';
const USER_KEY = 'typstlab_user';

export const tokenStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error('Failed to access localStorage for token:', e);
    }
  },

  getStoredUser<T>(): T | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setStoredUser<T>(user: T | null): void {
    try {
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(USER_KEY);
      }
    } catch (e) {
      console.error('Failed to access localStorage for user:', e);
    }
  },

  clear(): void {
    this.setToken(null);
    this.setStoredUser(null);
  }
};
