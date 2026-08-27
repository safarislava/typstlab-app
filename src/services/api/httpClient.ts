import { config } from '../../config/env';
import { tokenStorage } from '../auth';
import type { NetworkErrorListener, AuthErrorListener, TokenRefreshListener } from '../../core/types';

export class HttpClient {
  private baseUrl: string = config.apiBaseUrl;
  private onTokenRefreshed: TokenRefreshListener | null = null;
  private onAuthError: AuthErrorListener | null = null;
  private onNetworkError: NetworkErrorListener | null = null;

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getToken(): string | null {
    return tokenStorage.getToken();
  }

  public setToken(token: string | null): void {
    tokenStorage.setToken(token);
  }

  public registerTokenRefreshCallback(callback: TokenRefreshListener): void {
    this.onTokenRefreshed = callback;
  }

  public registerAuthErrorCallback(callback: AuthErrorListener): void {
    this.onAuthError = callback;
  }

  public registerNetworkErrorCallback(callback: NetworkErrorListener): void {
    this.onNetworkError = callback;
  }

  private notifyNetworkError(): void {
    if (this.onNetworkError) {
      this.onNetworkError();
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store'
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  public async request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const token = this.getToken();

    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const requestConfig: RequestInit = {
      ...options,
      headers
    };

    let response: Response;
    try {
      response = await fetch(url, requestConfig);
    } catch (fetchErr) {
      if (path !== '/health') {
        this.notifyNetworkError();
      }
      throw fetchErr;
    }

    // Trigger offline on server-side 5xx infrastructure failure
    if (response.status >= 500 && path !== '/health') {
      this.notifyNetworkError();
    }

    // Auto-refresh token if 401 Unauthorized
    if (
      response.status === 401 &&
      path !== '/login' &&
      path !== '/register' &&
      path !== '/refresh'
    ) {
      try {
        const refreshedToken = await this.refreshToken();
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
      const error = new Error(errorJson.message || errorJson.error || `HTTP error ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json();
  }

  public async refreshToken(): Promise<string> {
    const data = await this.request<{ token: string }>('/refresh', {
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
}

export const httpClient = new HttpClient();
