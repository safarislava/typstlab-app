import { httpClient } from '../httpClient';
import type { ProjectInvite, CreateInviteRequest, ProjectApiResponse } from '../../../core/types';

export const invitesApi = {
  async listInvites(projectId: string): Promise<ProjectInvite[]> {
    return httpClient.request<ProjectInvite[]>(`/projects/${projectId}/invites`, {
      method: 'GET'
    });
  },

  async createInvite(projectId: string, expiresAt?: string): Promise<ProjectInvite> {
    const payload: CreateInviteRequest = expiresAt ? { expires_at: expiresAt } : {};
    return httpClient.request<ProjectInvite>(`/projects/${projectId}/invites`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async revokeInvite(projectId: string, inviteId: string): Promise<void> {
    return httpClient.request<void>(`/projects/${projectId}/invites/${inviteId}`, {
      method: 'DELETE'
    });
  },

  async acceptInvite(code: string): Promise<ProjectApiResponse> {
    return httpClient.request<ProjectApiResponse>(`/invites/${code}/accept`, {
      method: 'POST'
    });
  }
};
