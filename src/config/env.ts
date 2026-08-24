export type AppEnv = 'development' | 'production';

export interface AppConfig {
  env: AppEnv;
  isDev: boolean;
  isProd: boolean;
  apiBaseUrl: string;
  wsBaseUrl: string;
}

const mode: AppEnv = (import.meta.env.VITE_APP_ENV || import.meta.env.MODE) === 'production' ? 'production' : 'development';
const isDev = mode === 'development';

export const config: AppConfig = {
  env: mode,
  isDev,
  isProd: !isDev,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL ?? '',
};

export default config;
