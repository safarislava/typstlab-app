import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/slices/authSlice';
import { setCurrentProjectId } from '../store/slices/projectsSlice';
import type { ScreenType } from '../core/types';

export function useHashRouter() {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(
    state => state.network?.connectionStatus || state.document?.connectionStatus
  );
  const currentUser = useAppSelector(
    state => state.auth?.currentUser || state.document?.currentUser
  );

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

      // Route guards: Offline allows direct access to dashboard/editor
      const isOffline = connectionStatus === 'offline';
      if (isOffline && (screen === 'login' || screen === 'register')) {
        navigateTo(projectId ? 'editor' : 'dashboard', projectId);
        return;
      }

      // Online without auth redirects to login
      if (!isOffline && !currentUser && (screen === 'dashboard' || screen === 'editor')) {
        navigateTo('login');
        return;
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
