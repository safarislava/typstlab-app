import { httpClient } from '../httpClient';
import type { ProjectApiResponse, SyncRequest, SyncResponse } from '../../../core/types';

export const projectsApi = {
  async createProject(name: string): Promise<ProjectApiResponse> {
    return httpClient.request<ProjectApiResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async createProjectWithId(id: string, name: string): Promise<ProjectApiResponse> {
    return httpClient.request<ProjectApiResponse>('/projects', {
      method: 'POST',
      body: JSON.stringify({ id, name })
    });
  },

  async getProjectDetails(projectId: string): Promise<ProjectApiResponse> {
    return httpClient.request<ProjectApiResponse>(`/projects/${projectId}`);
  },

  async syncProject(projectId: string, syncRequest: SyncRequest): Promise<SyncResponse> {
    return httpClient.request<SyncResponse>(`/projects/${projectId}/sync`, {
      method: 'POST',
      body: JSON.stringify(syncRequest)
    });
  }
};
