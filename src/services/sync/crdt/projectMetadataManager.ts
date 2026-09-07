import * as Y from 'yjs';
import type { DBTypstFile, ProjectMetadataFileEntry, SyncFileType } from '../../../core/types';
import { uint8ArrayToBase64, base64ToUint8Array } from './deltaCodec';

export class ProjectMetadataManager {
  private projectYDocs = new Map<string, Y.Doc>();

  public getOrCreateMetadataDoc(projectId: string): Y.Doc {
    let doc = this.projectYDocs.get(projectId);
    if (!doc) {
      doc = new Y.Doc();
      this.projectYDocs.set(projectId, doc);
    }
    return doc;
  }

  /**
   * Initializes or populates the metadata CRDT document with local database files.
   */
  public initFromLocalFiles(projectId: string, files: DBTypstFile[]): void {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const filesMap = ydoc.getMap<Y.Map<any>>('files');

    ydoc.transact(() => {
      files.forEach(file => {
        const fileId = file.fileUuid || crypto.randomUUID();
        let fileMap = filesMap.get(fileId);
        if (!fileMap) {
          fileMap = new Y.Map();
          fileMap.set('id', fileId);
          fileMap.set('name', file.path);
          fileMap.set('type', file.isBinary ? 'binary' : 'typst');
          fileMap.set('isDeleted', false);
          fileMap.set('updatedAt', Date.now());
          filesMap.set(fileId, fileMap);
        } else {
          // If already in CRDT, update name if needed without reviving deleted files
          if (!fileMap.get('isDeleted')) {
            fileMap.set('name', file.path);
            fileMap.set('type', file.isBinary ? 'binary' : 'typst');
          }
        }
      });
    });
  }

  /**
   * Encodes the current project metadata state vector into Base64.
   */
  public encodeMetadataStateVector(projectId: string): string {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const sv = Y.encodeStateVector(ydoc);
    return uint8ArrayToBase64(sv);
  }

  /**
   * Encodes the metadata CRDT delta updates into Base64.
   */
  public encodeMetadataDelta(projectId: string, targetStateVectorBase64?: string): string {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    if (targetStateVectorBase64) {
      try {
        const targetSv = base64ToUint8Array(targetStateVectorBase64);
        const update = Y.encodeStateAsUpdate(ydoc, targetSv);
        return uint8ArrayToBase64(update);
      } catch (err) {
        console.warn('Failed to encode metadata delta with target state vector:', err);
      }
    }
    const update = Y.encodeStateAsUpdate(ydoc);
    return uint8ArrayToBase64(update);
  }

  /**
   * Applies received Base64 metadata delta to the project Yjs document.
   */
  public applyMetadataDelta(projectId: string, deltaBase64: string): ProjectMetadataFileEntry[] {
    if (!deltaBase64) return this.getFiles(projectId);

    const ydoc = this.getOrCreateMetadataDoc(projectId);
    try {
      const binaryUpdate = base64ToUint8Array(deltaBase64);
      Y.applyUpdate(ydoc, binaryUpdate);
    } catch (err) {
      console.error(`Failed to apply metadata delta for project ${projectId}:`, err);
    }

    return this.getFiles(projectId);
  }

  /**
   * Records a newly added file in the CRDT metadata document.
   */
  public trackFileAddition(
    projectId: string,
    file: { id: string; name: string; type: SyncFileType; updatedAt?: number }
  ): void {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const filesMap = ydoc.getMap<Y.Map<any>>('files');

    ydoc.transact(() => {
      let fileMap = filesMap.get(file.id);
      if (!fileMap) {
        fileMap = new Y.Map();
        filesMap.set(file.id, fileMap);
      }
      fileMap.set('id', file.id);
      fileMap.set('name', file.name);
      fileMap.set('type', file.type);
      fileMap.set('isDeleted', false);
      fileMap.set('updatedAt', file.updatedAt || Date.now());
    });
  }

  /**
   * Records a file rename in the CRDT metadata document.
   */
  public trackFileRename(projectId: string, fileId: string, newPath: string): void {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const filesMap = ydoc.getMap<Y.Map<any>>('files');

    ydoc.transact(() => {
      const fileMap = filesMap.get(fileId);
      if (fileMap) {
        fileMap.set('name', newPath);
        fileMap.set('updatedAt', Date.now());
      }
    });
  }

  /**
   * Records a file deletion in the CRDT metadata document.
   */
  public trackFileDeletion(projectId: string, fileId: string): void {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const filesMap = ydoc.getMap<Y.Map<any>>('files');

    ydoc.transact(() => {
      const fileMap = filesMap.get(fileId);
      if (fileMap) {
        fileMap.set('isDeleted', true);
        fileMap.set('updatedAt', Date.now());
      }
    });
  }

  /**
   * Retrieves all active (non-deleted) file entries.
   */
  public getFiles(projectId: string): ProjectMetadataFileEntry[] {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const filesMap = ydoc.getMap<Y.Map<any>>('files');
    const result: ProjectMetadataFileEntry[] = [];

    filesMap.forEach(fileMap => {
      if (fileMap && typeof fileMap.get === 'function') {
        const isDeleted = fileMap.get('isDeleted') === true;
        if (!isDeleted) {
          result.push({
            id: fileMap.get('id'),
            name: fileMap.get('name'),
            type: fileMap.get('type') as SyncFileType,
            isDeleted: false,
            updatedAt: fileMap.get('updatedAt') || 0
          });
        }
      }
    });

    return result;
  }

  /**
   * Retrieves all file entries including deleted ones.
   */
  public getAllEntries(projectId: string): ProjectMetadataFileEntry[] {
    const ydoc = this.getOrCreateMetadataDoc(projectId);
    const filesMap = ydoc.getMap<Y.Map<any>>('files');
    const result: ProjectMetadataFileEntry[] = [];

    filesMap.forEach(fileMap => {
      if (fileMap && typeof fileMap.get === 'function') {
        result.push({
          id: fileMap.get('id'),
          name: fileMap.get('name'),
          type: fileMap.get('type') as SyncFileType,
          isDeleted: fileMap.get('isDeleted') === true,
          updatedAt: fileMap.get('updatedAt') || 0
        });
      }
    });

    return result;
  }

  public clear(projectId?: string): void {
    if (projectId) {
      this.projectYDocs.delete(projectId);
    } else {
      this.projectYDocs.clear();
    }
  }
}

export const projectMetadataManager = new ProjectMetadataManager();
