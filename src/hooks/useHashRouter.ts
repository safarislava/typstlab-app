import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector, setScreen, setCurrentProjectId } from '../store';
import type { ScreenType } from '../core/types';

export function useHashRouter() {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(state => state.network.connectionStatus);
  const currentUser = useAppSelector(state => state.auth.currentUser);

  const normalizeLocation = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const pathname = window.location.pathname;
    if (pathname.startsWith('/invites/') || pathname.startsWith('/invite/')) {
      const code = pathname
        .replace(/^\/(invites|invite)\//, '')
        .replace(/\/accept\/?$/, '')
        .replace(/\/$/, '');
      if (code) {
        window.history.replaceState(null, '', `/#/invite/${code}`);
        return `#/invite/${code}`;
      }
    }
    return window.location.hash;
  }, []);

  const [currentHash, setCurrentHash] = useState(() => normalizeLocation());

  const parseRoute = useCallback((hash: string) => {
    if (hash.startsWith('#/project/')) {
      const projectId = hash.replace('#/project/', '');
      return { screen: 'editor' as ScreenType, projectId, inviteCode: null };
    }
    if (hash.startsWith('#/invite/') || hash.startsWith('#/invites/')) {
      const rawCode = hash.replace(/^#\/(invite|invites)\//, '');
      const inviteCode = rawCode.replace(/\/accept\/?$/, '').replace(/\/$/, '');
      return { screen: 'invite' as ScreenType, projectId: null, inviteCode };
    }
    if (hash === '#/login') {
      return { screen: 'login' as ScreenType, projectId: null, inviteCode: null };
    }
    if (hash === '#/register') {
      return { screen: 'register' as ScreenType, projectId: null, inviteCode: null };
    }
    return { screen: 'dashboard' as ScreenType, projectId: null, inviteCode: null };
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
      const hash = normalizeLocation();
      setCurrentHash(hash);
      const { screen, projectId, inviteCode } = parseRoute(hash);

      // Route guards:
      // 1. In offline mode: No authorization required. Disable login/register screens.
      if (connectionStatus === 'offline') {
        if (screen === 'login' || screen === 'register' || screen === 'invite') {
          navigateTo(projectId ? 'editor' : 'dashboard', projectId);
          return;
        }
      }

      // 2. In online mode (connected): Authorization is mandatory.
      if (connectionStatus === 'connected') {
        if (!currentUser && screen !== 'login' && screen !== 'register') {
          if (screen === 'invite' && inviteCode) {
            sessionStorage.setItem('pending_invite_code', inviteCode);
          }
          navigateTo('login');
          return;
        }
        if (currentUser && (screen === 'login' || screen === 'register')) {
          const pendingInvite = sessionStorage.getItem('pending_invite_code');
          if (pendingInvite) {
            sessionStorage.removeItem('pending_invite_code');
            window.location.hash = `#/invite/${pendingInvite}`;
            return;
          }
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
  }, [connectionStatus, currentUser, dispatch, navigateTo, normalizeLocation, parseRoute]);

  const { screen, projectId, inviteCode } = parseRoute(currentHash);

  return {
    screen,
    projectId,
    inviteCode,
    navigateTo
  };
}
