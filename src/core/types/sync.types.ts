import type { 
  WSSyncInstructionAction, 
  WSSyncInstruction, 
  WSSyncInitPayload, 
  WSSyncResponsePayload 
} from './collaboration.types';

export type SyncFileType = 'typst' | 'binary';

export type SyncInstructionAction = WSSyncInstructionAction;
export type SyncInstruction = WSSyncInstruction;

export interface SyncRequest extends WSSyncInitPayload {
  metadata_delta?: string;
}

export type SyncResponse = WSSyncResponsePayload;

export interface ProjectMetadataFileEntry {
  id: string; // fileUuid
  name: string; // path
  type: SyncFileType;
  isDeleted?: boolean;
  updatedAt?: number;
}
