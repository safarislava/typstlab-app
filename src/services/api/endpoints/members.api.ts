import { httpClient } from '../httpClient';
import type { ProjectMember, AddMemberRequest } from '../../../core/types';

export const membersApi = {
  async listMembers(projectId: string): Promise<ProjectMember[]> {
    return httpClient.request<ProjectMember[]>(`/projects/${projectId}/members`, {
      method: 'GET'
    });
  },

  async addMember(projectId: string, email: string): Promise<ProjectMember> {
    const payload: AddMemberRequest = { email };
    return httpClient.request<ProjectMember>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async removeMember(projectId: string, userId: string): Promise<void> {
    return httpClient.request<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE'
    });
  }
};
