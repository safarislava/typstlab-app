import type { User } from '../../core/types';

export interface DecodedJwtPayload {
  email?: string;
  name?: string;
  fullName?: string;
  sub?: string;
  role?: string;
  exp?: number;
  [key: string]: any;
}

export function decodeJwt(token: string): DecodedJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode JWT:', err);
    return null;
  }
}

export function extractUserFromToken(token: string, fallbackEmail: string): User {
  const payload = decodeJwt(token);
  const email = payload?.email || fallbackEmail;
  const username = email.includes('@') ? email.split('@')[0] : email || 'user';
  const fullName = payload?.fullName || payload?.name || username;

  return {
    username,
    email,
    fullName
  };
}
