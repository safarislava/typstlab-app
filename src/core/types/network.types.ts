export type ConnectionStatus = 'connected' | 'connecting' | 'offline';

export interface HealthCheckResult {
  isHealthy: boolean;
  status?: number;
  error?: string;
}

export type NetworkErrorListener = () => void;
export type AuthErrorListener = () => void;
export type TokenRefreshListener = (newToken: string) => void;
