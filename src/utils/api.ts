const getApiBaseUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return ''; // Proxied by Vite dev server
  }
  return 'https://typstlab-api.safarislava.tech';
};

class ApiClient {
  private baseUrl: string = getApiBaseUrl();
  private token: string | null = localStorage.getItem('typstlab_access_token');
  private onTokenRefreshed: ((token: string) => void) | null = null;
  private onAuthError: (() => void) | null = null;

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('typstlab_access_token', token);
    } else {
      localStorage.removeItem('typstlab_access_token');
    }
  }

  public getToken() {
    return this.token;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        cache: 'no-store'
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  public registerTokenRefreshCallback(callback: (token: string) => void) {
    this.onTokenRefreshed = callback;
  }

  public registerAuthErrorCallback(callback: () => void) {
    this.onAuthError = callback;
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    // Set headers
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const config = {
      ...options,
      headers
    };

    let response = await fetch(url, config);

    // Auto-refresh token if 401
    if (response.status === 401 && path !== '/login' && path !== '/register' && path !== '/refresh') {
      try {
        const refreshedToken = await this.refresh();
        if (refreshedToken) {
          headers.set('Authorization', `Bearer ${refreshedToken}`);
          response = await fetch(url, {
            ...options,
            headers
          });
        }
      } catch (err) {
        console.error('Failed to auto-refresh token:', err);
        if (this.onAuthError) {
          this.onAuthError();
        }
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = { message: errorText || response.statusText };
      }
      throw new Error(errorJson.message || errorJson.error || `HTTP error ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  public async register(email: string, password: string, role: string = 'user'): Promise<any> {
    return this.request('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, role })
    });
  }

  public async login(email: string, password: string): Promise<{ token: string }> {
    const data = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    return data;
  }

  public async refresh(): Promise<string> {
    // The browser will automatically send the HttpOnly refresh_token cookie
    const data = await this.request('/refresh', {
      method: 'POST'
    });
    if (data && data.token) {
      this.setToken(data.token);
      if (this.onTokenRefreshed) {
        this.onTokenRefreshed(data.token);
      }
      return data.token;
    }
    throw new Error('No token returned on refresh');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/logout', {
        method: 'POST'
      });
    } finally {
      this.setToken(null);
    }
  }

  public async createProject(name: string): Promise<{ id: string; name: string; updated_at: string }> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  public async getProjectDetails(projectId: string): Promise<any> {
    return this.request(`/projects/${projectId}`);
  }

  public async getProjectFiles(projectId: string): Promise<any[]> {
    return this.request(`/projects/${projectId}/files`);
  }

  public async createTypstFile(projectId: string, name: string): Promise<any> {
    return this.request(`/projects/${projectId}/files/typst`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  public async createBinaryFile(projectId: string, name: string, contentBase64: string): Promise<any> {
    return this.request(`/projects/${projectId}/files/binary`, {
      method: 'POST',
      body: JSON.stringify({ name, content: contentBase64 })
    });
  }

  public async deleteFile(projectId: string, fileId: string): Promise<void> {
    return this.request(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  public async getTypstFile(fileId: string): Promise<any> {
    return this.request(`/files/typst/${fileId}`);
  }

  public async sendTypstFileChanges(fileId: string, deltaBase64: string): Promise<any> {
    return this.request(`/files/typst/${fileId}/changes`, {
      method: 'POST',
      body: JSON.stringify({ delta: deltaBase64 })
    });
  }

  public async getBinaryFileMetadata(fileId: string): Promise<any> {
    return this.request(`/files/binary/${fileId}`);
  }

  public async getBinaryFileRaw(fileId: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/files/binary/${fileId}/raw`;
    const headers = new Headers();
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch raw binary: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }
}

export const api = new ApiClient();
