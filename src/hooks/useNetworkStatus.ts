import { useEffect, useCallback, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector, setConnectionStatus, logoutUser } from '../store';
import { authApi, httpClient, syncProjectWithServer } from '../services';

let isGlobalChecking = false;

export function useNetworkStatus() {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(state => state.network.connectionStatus);
  const user = useAppSelector(state => state.auth.currentUser);
  const currentProjectId = useAppSelector(state => state.projects.currentProjectId);
  const [isChecking, setIsChecking] = useState(false);
  const prevConnectionStatus = useRef(connectionStatus);
  const connectionStatusRef = useRef(connectionStatus);
  connectionStatusRef.current = connectionStatus;

  // Reconnection logic (health check)
  const reconnect = useCallback(async (): Promise<boolean> => {
    if (isGlobalChecking) return false;
    isGlobalChecking = true;
    setIsChecking(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      dispatch(setConnectionStatus('offline'));
      setIsChecking(false);
      isGlobalChecking = false;
      return false;
    }

    try {
      const isHealthy = await authApi.checkHealth();
      if (!isHealthy) {
        dispatch(setConnectionStatus('offline'));
        setIsChecking(false);
        isGlobalChecking = false;
        return false;
      }

      dispatch(setConnectionStatus('connected'));
      setIsChecking(false);
      isGlobalChecking = false;
      return true;
    } catch {
      dispatch(setConnectionStatus('offline'));
      setIsChecking(false);
      isGlobalChecking = false;
      return false;
    }
  }, [dispatch]);

  // Trigger sync on transition from offline/connecting -> connected
  useEffect(() => {
    if (
      prevConnectionStatus.current !== 'connected' &&
      connectionStatus === 'connected' &&
      currentProjectId
    ) {
      void syncProjectWithServer(currentProjectId, user || undefined);
    }
    prevConnectionStatus.current = connectionStatus;
  }, [connectionStatus, currentProjectId, user]);

  // Global event and interceptor listeners mounted once
  useEffect(() => {
    // Initial health check on mount
    void reconnect();

    const handleOnline = () => {
      void reconnect();
    };

    const handleOffline = () => {
      dispatch(setConnectionStatus('offline'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pollInterval = setInterval(() => {
      void reconnect();
    }, 15000);

    httpClient.registerNetworkErrorCallback(() => {
      dispatch(setConnectionStatus('offline'));
    });

    httpClient.registerAuthErrorCallback(() => {
      if (connectionStatusRef.current === 'connected') {
        dispatch(logoutUser());
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pollInterval);
    };
  }, [dispatch, reconnect]);

  return {
    connectionStatus,
    isChecking,
    reconnect
  };
}
