import { httpClient } from '../httpClient';

export interface CreateFilePayload {
  id: string;
  name: string;
  type?: 'typst' | 'binary';
  content?: string;
}

export interface TypstFileBlockResponse {
  id: string;
  name?: string;
  content: string;
}

export interface TypstFileApiResponse {
  id: string;
  project_id: string;
  name: string;
  type: 'typst';
  state?: string;
  blocks?: TypstFileBlockResponse[];
  updated_at?: string;
}

export interface BinaryFileMetadataResponse {
  id: string;
  project_id: string;
  name: string;
  type: 'binary';
  size: number;
  updated_at?: string;
}

export interface FileSummaryResponse {
  id: string;
  project_id: string;
  name: string;
  type: 'typst' | 'binary';
  updated_at?: string;
}

export const filesApi = {
  async getProjectFiles(projectId: string): Promise<FileSummaryResponse[]> {
    return httpClient.request<FileSummaryResponse[]>(`/projects/${projectId}/files`);
  },

  async createFileWithId(projectId: string, fileData: CreateFilePayload): Promise<FileSummaryResponse> {
    return httpClient.request<FileSummaryResponse>(`/projects/${projectId}/files`, {
      method: 'POST',
      body: JSON.stringify(fileData)
    });
  },

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    return httpClient.request<void>(`/projects/${projectId}/files/${fileId}`, {
      method: 'DELETE'
    });
  },

  async getTypstFile(fileId: string): Promise<TypstFileApiResponse> {
    return httpClient.request<TypstFileApiResponse>(`/files/typst/${fileId}`);
  },

  async sendTypstFileChanges(fileId: string, deltaBase64: string): Promise<TypstFileApiResponse> {
    return httpClient.request<TypstFileApiResponse>(`/files/typst/${fileId}/changes`, {
      method: 'POST',
      body: JSON.stringify({ delta: deltaBase64 })
    });
  },

  async getBinaryFileMetadata(fileId: string): Promise<BinaryFileMetadataResponse> {
    return httpClient.request<BinaryFileMetadataResponse>(`/files/binary/${fileId}`);
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
