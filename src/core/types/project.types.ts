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
  updated_at?: string;
  created_at?: string;
}
