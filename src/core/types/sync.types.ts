export type SyncFileType = 'typst' | 'binary';

export type SyncAction = 'upload' | 'download' | 'apply_changes' | 'rename' | 'delete';

export interface SyncFileManifest {
  id: string;
  name: string;
  type: SyncFileType;
  yjs_state_vector?: string;
  checksum?: string;
}

export interface SyncInstruction {
  action: SyncAction;
  file_id: string;
  new_name?: string;
  payload?: string;
}

export interface SyncProjectResponse {
  instructions: SyncInstruction[];
}
