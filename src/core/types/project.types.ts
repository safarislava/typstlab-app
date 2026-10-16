import type { Timestamp } from './common.types';

export interface TypstProject {
  id: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId?: string; // Links project to a user (null/undefined for anonymous local projects)
}

export interface ProjectCreateDto {
  id?: string;
  name: string;
}

export interface ProjectUpdateDto {
  id: string;
  name?: string;
  updatedAt?: Timestamp;
}

export interface ProjectApiResponse {
  id: string;
  name: string;
  user_ids?: string[];
  updated_at?: string;
  created_at?: string;
}

export interface ProjectMember {
  id: string; // UUID
  email: string;
}

export interface AddMemberRequest {
  email: string;
}

export interface CreateInviteRequest {
  expires_at?: string; // ISO 8601 UTC (RFC3339)
}

export interface ProjectInvite {
  id: string; // UUID
  project_id: string; // UUID
  code: string;
  created_by: string; // UUID
  expires_at: string; // ISO 8601 (RFC3339)
  created_at: string; // ISO 8601 (RFC3339)
}
