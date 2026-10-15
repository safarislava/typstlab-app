import { httpClient } from '../httpClient';
import type { LoginResponse, RegisterResponse } from '../../../core/types';

export const authApi = {
  async register(email: string, password: string): Promise<RegisterResponse> {
    return httpClient.request<RegisterResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await httpClient.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    httpClient.setToken(data.token);
    return data;
  },

  async refresh(): Promise<string> {
    return httpClient.refreshToken();
  },

  async logout(): Promise<void> {
    try {
      await httpClient.request('/logout', {
        method: 'POST'
      });
    } finally {
      httpClient.setToken(null);
    }
  },

  async checkHealth(): Promise<boolean> {
    return httpClient.checkHealth();
  }
};
