export type SyncFileType = 'typst' | 'binary';

export type SyncInstructionAction = 'download' | 'upload' | 'apply_changes';

export interface SyncInstruction {
  action: SyncInstructionAction;
  file_id: string;
  delta?: string; // Base64 CRDT delta update (used for apply_changes)
}

export interface SyncRequest {
  metadata_delta?: string;
  metadata_state_vector?: string;
  content_vectors?: Record<string, string>; // Map<file_id, Base64_state_vector>
}

export interface SyncResponse {
  metadata_delta?: string;
  instructions: SyncInstruction[];
}

export interface ProjectMetadataFileEntry {
  id: string; // fileUuid
  name: string; // path
  type: SyncFileType;
  isDeleted?: boolean;
  updatedAt?: number;
}
