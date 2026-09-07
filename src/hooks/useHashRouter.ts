import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector, setScreen, setCurrentProjectId } from '../store';
import type { ScreenType } from '../core/types';

export function useHashRouter() {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(state => state.network.connectionStatus);
  const currentUser = useAppSelector(state => state.auth.currentUser);

  const [currentHash, setCurrentHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash : ''
  );

  const parseRoute = useCallback((hash: string) => {
    if (hash.startsWith('#/project/')) {
      const projectId = hash.replace('#/project/', '');
      return { screen: 'editor' as ScreenType, projectId };
    }
    if (hash === '#/login') {
      return { screen: 'login' as ScreenType, projectId: null };
    }
    if (hash === '#/register') {
      return { screen: 'register' as ScreenType, projectId: null };
    }
    return { screen: 'dashboard' as ScreenType, projectId: null };
  }, []);

  const navigateTo = useCallback((screen: ScreenType, projectId?: string | null) => {
    if (screen === 'editor' && projectId) {
      window.location.hash = `#/project/${projectId}`;
    } else if (screen === 'login') {
      window.location.hash = '#/login';
    } else if (screen === 'register') {
      window.location.hash = '#/register';
    } else {
      window.location.hash = '#/';
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setCurrentHash(hash);
      const { screen, projectId } = parseRoute(hash);

      // Route guards:
      // 1. In offline mode: No authorization required. Disable login/register screens.
      if (connectionStatus === 'offline') {
        if (screen === 'login' || screen === 'register') {
          navigateTo(projectId ? 'editor' : 'dashboard', projectId);
          return;
        }
      }

      // 2. In online mode (connected): Authorization is mandatory.
      if (connectionStatus === 'connected') {
        if (!currentUser && screen !== 'login' && screen !== 'register') {
          navigateTo('login');
          return;
        }
        if (currentUser && (screen === 'login' || screen === 'register')) {
          navigateTo(projectId ? 'editor' : 'dashboard', projectId);
          return;
        }
      }

      dispatch(setScreen(screen));
      dispatch(setCurrentProjectId(projectId));
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [connectionStatus, currentUser, dispatch, navigateTo, parseRoute]);

  const { screen, projectId } = parseRoute(currentHash);

  return {
    screen,
    projectId,
    navigateTo
  };
}
