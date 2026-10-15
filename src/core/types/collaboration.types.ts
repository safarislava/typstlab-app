export type WSMessageType =
  | 'sync_init'
  | 'sync_response'
  | 'crdt_update'
  | 'metadata_update'
  | 'awareness_snapshot'
  | 'awareness_update'
  | 'awareness_remove'
  | 'ping'
  | 'pong'
  | 'error';

export interface WSMessageEnvelope<T = unknown> {
  type: WSMessageType;
  payload: T;
}

export type WSSyncInstructionAction = 'download' | 'upload' | 'apply_changes';

export interface WSSyncInstruction {
  action: WSSyncInstructionAction;
  file_id: string;
  delta?: string; // Base64 CRDT delta update (used for apply_changes)
}

export interface WSSyncInitPayload {
  metadata_state_vector?: string;
  content_vectors?: Record<string, string>; // Map<file_id, Base64_state_vector>
}

export interface WSSyncResponsePayload {
  metadata_delta?: string;
  instructions: WSSyncInstruction[];
}

export interface WSCRDTUpdateRequest {
  file_id: string;
  delta: string; // Base64-encoded Yjs binary update delta
}

export interface WSCRDTUpdateBroadcast {
  file_id: string;
  sender_id: string; // Authenticated user UUID stamped by server
  delta: string; // Base64-encoded Yjs binary update delta
}

export interface WSMetadataUpdateRequest {
  delta: string; // Base64-encoded metadata Yjs binary update delta
}

export interface WSMetadataUpdateBroadcast {
  sender_id: string; // Authenticated user UUID stamped by server
  delta: string; // Base64-encoded metadata Yjs binary update delta
}

export interface WSCursor {
  anchor: number;
  head: number;
}

export interface WSUserPresence {
  user_id: string;
  email: string;
  color: string;
  file_id: string;
  cursor: WSCursor;
}

export interface WSAwarenessSnapshotPayload {
  presences: WSUserPresence[];
}

export interface WSAwarenessUpdateClientRequest {
  file_id: string;
  cursor: WSCursor;
}

export interface WSAwarenessRemovePayload {
  user_id: string;
}

export interface WSErrorPayload {
  message: string;
}
