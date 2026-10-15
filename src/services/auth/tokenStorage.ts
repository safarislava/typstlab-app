const TOKEN_KEY = 'typstlab_access_token';
const USER_KEY = 'typstlab_user';

// Clean up any legacy access token stored in localStorage
try {
  localStorage.removeItem(TOKEN_KEY);
} catch {
  // Ignore localStorage access errors (e.g. in private browsing/sandboxes)
}

export const tokenStorage = {
  /**
   * Access token is stored exclusively in HttpOnly cookies managed by the browser.
   * Client-side JavaScript cannot and should not access it.
   */
  getToken(): string | null {
    return null;
  },

  setToken(_token: string | null): void {
    // Access token is managed exclusively via HttpOnly cookies.
    // Ensure no token is kept in localStorage.
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore
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
