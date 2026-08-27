import { useEffect, useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setConnectionStatus } from '../store';
import { logoutUser } from '../store';
import { authApi, httpClient } from '../services';

export function useNetworkStatus() {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(
    state => state.network?.connectionStatus || state.document?.connectionStatus
  );
  const currentUser = useAppSelector(
    state => state.auth?.currentUser || state.document?.currentUser
  );
  const [isChecking, setIsChecking] = useState(false);

  // Reconnection logic (health check + token validation)
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (isChecking) return false;
    setIsChecking(true);
    dispatch(setConnectionStatus('connecting'));

    if (!navigator.onLine) {
      dispatch(setConnectionStatus('offline'));
      setIsChecking(false);
      return false;
    }

    try {
      const isHealthy = await authApi.checkHealth();
      if (!isHealthy) {
        dispatch(setConnectionStatus('offline'));
        setIsChecking(false);
        return false;
      }

      // If server is healthy, verify session
      const token = httpClient.getToken();
      if (token) {
        dispatch(setConnectionStatus('connected'));
      } else {
        dispatch(setConnectionStatus('connected'));
      }

      setIsChecking(false);
      return true;
    } catch {
      dispatch(setConnectionStatus('offline'));
      setIsChecking(false);
      return false;
    }
  }, [dispatch, isChecking]);

  // Global event and interceptor listeners
  useEffect(() => {
    const handleOnline = () => {
      void reconnect();
    };

    const handleOffline = () => {
      dispatch(setConnectionStatus('offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    httpClient.registerNetworkErrorCallback(() => {
      dispatch(setConnectionStatus('offline'));
    });

    httpClient.registerAuthErrorCallback(() => {
      if (connectionStatus === 'connected') {
        dispatch(logoutUser());
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch, connectionStatus, currentUser, reconnect]);

  return {
    connectionStatus,
    isChecking,
    reconnect
  };
}
