import * as Y from 'yjs';

class YjsDocManager {
  private fileYDocs = new Map<string, Y.Doc>();
  private fileYjsStates = new Map<string, string>();

  public getOrCreateDoc(fileId?: string): Y.Doc {
    if (!fileId) return new Y.Doc();
    let doc = this.fileYDocs.get(fileId);
    if (!doc) {
      doc = new Y.Doc();
      this.fileYDocs.set(fileId, doc);
    }
    return doc;
  }

  public setServerState(fileId: string, base64State: string): void {
    if (fileId && base64State) {
      this.fileYjsStates.set(fileId, base64State);
    }
  }

  public getServerState(fileId: string): string | undefined {
    return this.fileYjsStates.get(fileId);
  }

  public clearDoc(fileId: string): void {
    this.fileYDocs.delete(fileId);
    this.fileYjsStates.delete(fileId);
  }

  public clearAll(): void {
    this.fileYDocs.clear();
    this.fileYjsStates.clear();
  }
}

export const yjsDocManager = new YjsDocManager();
