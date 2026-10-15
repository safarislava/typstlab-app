import { httpClient } from '../httpClient';
import type { ProjectApiResponse } from '../../../core/types';

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
  }
};

