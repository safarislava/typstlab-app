import { httpClient, authApi, projectsApi, filesApi } from '../services';

class ApiCompatibilityWrapper {
  public setToken(token: string | null) {
    httpClient.setToken(token);
  }

  public getToken() {
    return httpClient.getToken();
  }

  public async checkHealth(): Promise<boolean> {
    return httpClient.checkHealth();
  }

  public registerTokenRefreshCallback(callback: (token: string) => void) {
    httpClient.registerTokenRefreshCallback(callback);
  }

  public registerAuthErrorCallback(callback: () => void) {
    httpClient.registerAuthErrorCallback(callback);
  }

  public registerNetworkErrorCallback(callback: () => void) {
    httpClient.registerNetworkErrorCallback(callback);
  }

  public async register(email: string, password: string, role: string = 'user'): Promise<any> {
    return authApi.register(email, password, role);
  }

  public async login(email: string, password: string): Promise<{ token: string }> {
    return authApi.login(email, password);
  }

  public async refresh(): Promise<string> {
    return authApi.refresh();
  }

  public async logout(): Promise<void> {
    return authApi.logout();
  }

  public async createProject(name: string): Promise<{ id: string; name: string; updated_at: string }> {
    return projectsApi.createProject(name) as any;
  }

  public async createProjectWithId(id: string, name: string): Promise<{ id: string; name: string; updated_at: string }> {
    return projectsApi.createProjectWithId(id, name) as any;
  }

  public async syncProject(projectId: string, files: any[]): Promise<{ instructions: any[] }> {
    return projectsApi.syncProject(projectId, files);
  }

  public async createFileWithId(projectId: string, fileData: { id: string; name: string; type: 'typst' | 'binary'; content?: string }): Promise<any> {
    return filesApi.createFileWithId(projectId, fileData);
  }

  public async getProjectDetails(projectId: string): Promise<any> {
    return projectsApi.getProjectDetails(projectId);
  }

  public async getProjectFiles(projectId: string): Promise<any[]> {
    return filesApi.getProjectFiles(projectId);
  }

  public async createTypstFile(projectId: string, name: string): Promise<any> {
    return filesApi.createTypstFile(projectId, name);
  }

  public async createBinaryFile(projectId: string, name: string, contentBase64: string): Promise<any> {
    return filesApi.createBinaryFile(projectId, name, contentBase64);
  }

  public async deleteFile(projectId: string, fileId: string): Promise<void> {
    return filesApi.deleteFile(projectId, fileId);
  }

  public async getTypstFile(fileId: string): Promise<any> {
    return filesApi.getTypstFile(fileId);
  }

  public async sendTypstFileChanges(fileId: string, deltaBase64: string): Promise<any> {
    return filesApi.sendTypstFileChanges(fileId, deltaBase64);
  }

  public async getBinaryFileMetadata(fileId: string): Promise<any> {
    return filesApi.getBinaryFileMetadata(fileId);
  }

  public async getBinaryFileRaw(fileId: string): Promise<ArrayBuffer> {
    return filesApi.getBinaryFileRaw(fileId);
  }
}

export const api = new ApiCompatibilityWrapper();
