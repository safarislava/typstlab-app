import { httpClient } from '../httpClient';

export interface CreateFilePayload {
  id: string;
  name: string;
  type: 'typst' | 'binary';
  content?: string;
}

export const filesApi = {
  async getProjectFiles(projectId: string): Promise<any[]> {
    return httpClient.request(`/projects/${projectId}/files`);
  },

  async createFileWithId(projectId: string, fileData: CreateFilePayload): Promise<any> {
    return httpClient.request(`/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify(fileData)
    });
  },

  async createTypstFile(projectId: string, name: string): Promise<any> {
    return httpClient.request(`/projects/${projectId}/files/typst`, {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  async createBinaryFile(projectId: string, name: string, contentBase64: string): Promise<any> {
    return httpClient.request(`/projects/${projectId}/files/binary`, {
      method: 'POST',
      body: JSON.stringify({ name, content: contentBase64 })
    });
  },

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    return httpClient.request(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE'
    });
  },

  async getTypstFile(fileId: string): Promise<any> {
    return httpClient.request(`/files/typst/${fileId}`);
  },

  async sendTypstFileChanges(fileId: string, deltaBase64: string): Promise<any> {
    return httpClient.request(`/files/typst/${fileId}/changes`, {
      method: 'POST',
      body: JSON.stringify({ delta: deltaBase64 })
    });
  },

  async getBinaryFileMetadata(fileId: string): Promise<any> {
    return httpClient.request(`/files/binary/${fileId}`);
  },

  async getBinaryFileRaw(fileId: string): Promise<ArrayBuffer> {
    const url = `${httpClient.getBaseUrl()}/files/binary/${fileId}/raw`;
    const headers = new Headers();
    const token = httpClient.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch raw binary: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }
};
