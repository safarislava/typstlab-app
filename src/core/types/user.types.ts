import type { Timestamp } from './common.types';

export interface User {
  username: string;
  email?: string;
  fullName?: string;
}

export interface DBUser {
  username: string;
  passwordHash: string;
  email?: string;
  fullName?: string;
  createdAt: Timestamp;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role?: string;
}
