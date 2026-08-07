import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setCompilerReady, setCompilerError, setProjects, setCurrentProjectId, initializeProject, setConnectionStatus, setScreen, setPreviewMode } from './store/documentSlice';
import type { TypstFile } from './store/documentSlice';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EditorWorkspace } from './components/EditorWorkspace';
import { PreviewPanel } from './components/PreviewPanel';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { $typst } from '@myriaddreamin/typst.ts';
import type { SidebarTab } from './components/sidebar/SidebarDock';
import { initDB, saveProjectToDB, getFilesForProjectFromDB, getProjectsForUserFromDB, migrateLegacyProjectsToUser, getAllProjectsFromDB } from './store/db';
import type { TypstProject } from './store/db';
import { api } from './utils/api';
import { syncProjectWithServer } from './utils/syncManager';

let wasmInitialized = false;

function App() {
  const dispatch = useAppDispatch();
  const previewMode = useAppSelector((state) => state.document.previewMode);
  const screen = useAppSelector((state) => state.document.screen);
  const currentUser = useAppSelector((state) => state.document.currentUser);
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);

  // Layout resizing states
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [editorPercent, setEditorPercent] = useState(50);
  const [activeTab, setActiveTab] = useState<SidebarTab | null>('files');

  // Initialize Typst WASM compiler globally on app start
  useEffect(() => {
    const initWasm = async () => {
      if (wasmInitialized) {
        dispatch(setCompilerReady(true));
        return;
      }
      try {
        $typst.setCompilerInitOptions({
          getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
        });
        $typst.setRendererInitOptions({
          getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
        });
        wasmInitialized = true;
        dispatch(setCompilerReady(true));
      } catch (err: any) {
        console.error('Typst WASM initialization error in App:', err);
        dispatch(setCompilerError(err?.message || 'Failed to load WebAssembly modules'));
      }
    };
    initWasm();
  }, [dispatch]);

  // Register global network error listener to transition to offline state when API calls fail
  useEffect(() => {
    api.registerNetworkErrorCallback(() => {
      dispatch(setConnectionStatus('offline'));
    });
  }, [dispatch]);

  // Check backend (HTTP /health) availability ONLY once on site startup and on browser online event
  useEffect(() => {
    const checkInitialBackend = async () => {
      if (!navigator.onLine) {
        dispatch(setConnectionStatus('offline'));
        return;
      }

      try {
        const isHealthy = await api.checkHealth();
        dispatch(setConnectionStatus(isHealthy ? 'connected' : 'offline'));
      } catch {
        dispatch(setConnectionStatus('offline'));
      }
    };

    const handleOffline = () => {
      dispatch(setConnectionStatus('offline'));
    };

    const handleOnline = () => {
      checkInitialBackend();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Initial check on mount only
    checkInitialBackend();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [dispatch]);

  // Load projects list for the dashboard
  useEffect(() => {
    if (connectionStatus === 'connected' && !currentUser) {
      dispatch(setProjects([]));
      return;
    }

    const loadProjectsList = async () => {
      try {
        await initDB();
        let dbProjects: TypstProject[];
        
        if (connectionStatus === 'connected' && currentUser) {
          await migrateLegacyProjectsToUser(currentUser.username);
          dbProjects = await getProjectsForUserFromDB(currentUser.username);
          
          if (!dbProjects || dbProjects.length === 0) {
            const defaultProj = {
              id: crypto.randomUUID(),
              name: 'My First Project',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ownerId: currentUser.username
            };
            await saveProjectToDB(defaultProj);
            dbProjects = [defaultProj];
          }
        } else {
          dbProjects = await getAllProjectsFromDB();
          
          if (!dbProjects || dbProjects.length === 0) {
            const defaultProj = {
              id: crypto.randomUUID(),
              name: 'My First Project',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            await saveProjectToDB(defaultProj);
            dbProjects = [defaultProj];
          }
        }
        dispatch(setProjects(dbProjects));
      } catch (err) {
        console.error('Error loading projects list:', err);
      }
    };

    loadProjectsList();
  }, [dispatch, currentUser, connectionStatus]);

  // Handle hash-based routing (project selection/loading)
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/project/')) {
        const projectId = hash.replace('#/project/', '');
        dispatch(setCurrentProjectId(projectId));
        
        try {
          await initDB();
          
          // Perform project sync if connected
          if (connectionStatus === 'connected') {
            try {
              await syncProjectWithServer(projectId, currentUser || undefined);
            } catch (syncErr) {
              console.warn('Sync failed, switching to offline mode:', syncErr);
              dispatch(setConnectionStatus('offline'));
            }
          }

          // Verify project existence in IndexedDB
          const allProjects = await getAllProjectsFromDB();
          const authorized = allProjects.some(p => p.id === projectId);

          if (!authorized) {
            console.warn('Project not found locally or on server');
            window.location.hash = '#/';
            return;
          }

          const dbFiles = await getFilesForProjectFromDB(projectId);
          const reduxFiles: TypstFile[] = dbFiles.map(f => {
            if (f.isBinary) {
              return {
                path: f.path,
                isBinary: true,
                binaryData: f.binaryData!,
                fileUuid: f.fileUuid
              };
            } else {
              return {
                path: f.path,
                isBinary: false,
                cells: f.cells || [],
                fileUuid: f.fileUuid
              };
            }
          });

          dispatch(initializeProject(reduxFiles));
          dispatch(setCurrentProjectId(projectId));
        } catch (err) {
          console.error('Failed to load project files from hash route:', err);
          window.location.hash = '#/';
        }
      } else if (hash === '#/login') {
        dispatch(setCurrentProjectId(null));
        dispatch(setScreen('login'));
      } else if (hash === '#/register') {
        dispatch(setCurrentProjectId(null));
        dispatch(setScreen('register'));
      } else {
        dispatch(setCurrentProjectId(null));
        if (currentUser) {
          dispatch(setScreen('dashboard'));
        } else {
          dispatch(setScreen('login'));
          if (window.location.hash !== '#/login') {
            window.location.hash = '#/login';
          }
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Run on initial load/mount/status changes
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [dispatch, connectionStatus, currentUser, screen]);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const [isWorkspaceNarrow, setIsWorkspaceNarrow] = useState(false);

  const checkWorkspaceResponsiveness = useCallback(() => {
    if (!workspaceRef.current) return;
    const width = workspaceRef.current.clientWidth;
    const narrow = width < 700;
    setIsWorkspaceNarrow(narrow);

    if (narrow && previewMode === 'side-by-side') {
      dispatch(setPreviewMode('edit-only'));
    }
  }, [dispatch, previewMode]);

  // Initial mount & layout change responsiveness check (e.g. initial load with opened sidebar)
  useLayoutEffect(() => {
    if (screen === 'editor') {
      const timer = setTimeout(checkWorkspaceResponsiveness, 0);
      return () => clearTimeout(timer);
    }
  }, [screen, activeTab, sidebarWidth, checkWorkspaceResponsiveness]);

  // Continuous ResizeObserver for live window & element resizing
  useEffect(() => {
    if (!workspaceRef.current) return;

    const observer = new ResizeObserver(() => {
      checkWorkspaceResponsiveness();
    });

    observer.observe(workspaceRef.current);
    checkWorkspaceResponsiveness();

    return () => observer.disconnect();
  }, [checkWorkspaceResponsiveness]);

  // Sidebar drag resizer handler
  const startSidebarResize = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;

    const doResize = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;

      if (newWidth < 100) {
        setActiveTab(null);
      } else {
        if (activeTab === null) {
          setActiveTab('files');
        }
        setSidebarWidth(Math.min(500, Math.max(150, newWidth)));
      }
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
      document.body.classList.remove('is-resizing');
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
    document.body.classList.add('is-resizing');
  };

  // Editor/Preview drag resizer handler
  const startEditorResize = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const remainingWidth = workspaceRef.current ? workspaceRef.current.clientWidth : (window.innerWidth - actualSidebarWidth);
    const startX = mouseDownEvent.clientX;
    const startPercent = editorPercent;

    const doResize = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const deltaPercent = (deltaX / remainingWidth) * 100;
      const newPercent = startPercent + deltaPercent;
      setEditorPercent(Math.min(70, Math.max(30, newPercent)));
    };

    const stopResize = () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
      document.body.classList.remove('is-resizing');
    };

    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
    document.body.classList.add('is-resizing');
  };

  const actualSidebarWidth = activeTab === null ? 48 : sidebarWidth;

  // Calculate widths dynamically depending on previewMode and resizer values
  const editorWidthExpr = previewMode === 'side-by-side'
    ? `calc(${editorPercent}% - 3px)`
    : '100%';

  if (screen === 'login') {
    return <Login />;
  }

  if (screen === 'register') {
    return <Register />;
  }

  if (screen === 'dashboard') {
    return <Dashboard />;
  }

  return (
    <div className={`app-container ${isWorkspaceNarrow ? 'narrow-workspace' : ''}`}>
      <Header />
      <div className={`app-layout preview-mode-${previewMode}`}>
        
        {/* Sidebar Container Column */}
        <div style={{ width: `${actualSidebarWidth}px`, flexShrink: 0 }}>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Sidebar Resizer (only visible when not collapsed) */}
        {activeTab !== null && (
          <div 
            className="resizer-bar" 
            onMouseDown={startSidebarResize}
          />
        )}

        {/* Central Workspace Container (Editor + Preview split) */}
        <div ref={workspaceRef} className="workspace-container" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {previewMode !== 'preview-only' && (
            <div style={{ width: editorWidthExpr, flexShrink: 0, height: '100%', minWidth: 0 }}>
              <EditorWorkspace />
            </div>
          )}

          {previewMode === 'side-by-side' && (
            <div 
              className="resizer-bar" 
              onMouseDown={startEditorResize}
            />
          )}

          {previewMode !== 'edit-only' && (
            <div style={{ flex: 1, height: '100%', overflow: 'hidden', minWidth: 0 }}>
              <PreviewPanel />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
