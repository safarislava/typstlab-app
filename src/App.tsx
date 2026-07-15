import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setCompilerReady, setCompilerError, setProjects, setCurrentProjectId, initializeProject, setConnectionStatus } from './store/documentSlice';
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

  // Poll backend (WebSocket LSP) availability to update online/offline connectionStatus
  useEffect(() => {
    let checkInterval: any;
    let isChecking = false;

    const checkBackend = () => {
      if (isChecking) return;
      isChecking = true;

      try {
        const socket = new WebSocket('ws://localhost:8080/lsp');
        
        socket.onopen = () => {
          dispatch(setConnectionStatus('connected'));
          socket.close();
          isChecking = false;
        };

        socket.onerror = () => {
          dispatch(setConnectionStatus('offline'));
          isChecking = false;
        };
      } catch {
        dispatch(setConnectionStatus('offline'));
        isChecking = false;
      }
    };

    // Run check immediately on mount
    checkBackend();

    // Poll every 5 seconds to track backend online/offline state changes
    checkInterval = setInterval(checkBackend, 5000);

    return () => {
      clearInterval(checkInterval);
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
              id: `proj_default_${Date.now()}`,
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
              id: `proj_default_${Date.now()}`,
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
    // If online (connected) and no user is logged in, redirect to login page
    if (connectionStatus === 'connected' && !currentUser) {
      dispatch(setCurrentProjectId(null));
      if (window.location.hash.startsWith('#/project/')) {
        window.location.hash = '#/';
      }
      return;
    }

    const handleHashChange = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/project/')) {
        const projectId = hash.replace('#/project/', '');
        
        try {
          await initDB();
          
          // Verify project existence and authorization
          let authorized = false;
          if (connectionStatus === 'connected') {
            if (currentUser) {
              const userProjects = await getProjectsForUserFromDB(currentUser.username);
              authorized = userProjects.some(p => p.id === projectId);
            }
          } else {
            const allProjects = await getAllProjectsFromDB();
            authorized = allProjects.some(p => p.id === projectId);
          }

          if (!authorized) {
            console.warn('Project not found or unauthorized access');
            window.location.hash = '#/';
            return;
          }

          const dbFiles = await getFilesForProjectFromDB(projectId);
          const reduxFiles: TypstFile[] = dbFiles.map(f => {
            if (f.isBinary) {
              return {
                path: f.path,
                isBinary: true,
                binaryData: f.binaryData!
              };
            } else {
              return {
                path: f.path,
                isBinary: false,
                cells: f.cells || []
              };
            }
          });
          dispatch(initializeProject(reduxFiles));
          dispatch(setCurrentProjectId(projectId));
        } catch (err) {
          console.error('Failed to load project files from hash route:', err);
          window.location.hash = '#/';
        }
      } else {
        dispatch(setCurrentProjectId(null));
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    
    // Run on initial load/mount/status changes
    handleHashChange();

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [dispatch, connectionStatus, currentUser]);

  // Sidebar drag resizer handler
  const startSidebarResize = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;

    const doResize = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;

      // If dragged below 100px, collapse the sidebar tab automatically
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
    const actualSidebarWidth = activeTab === null ? 48 : sidebarWidth;
    const remainingWidth = window.innerWidth - actualSidebarWidth;
    const startX = mouseDownEvent.clientX;
    const startPercent = editorPercent;

    const doResize = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const deltaPercent = (deltaX / remainingWidth) * 100;
      const newPercent = startPercent + deltaPercent;
      setEditorPercent(Math.min(85, Math.max(15, newPercent)));
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
    ? `calc((100% - ${actualSidebarWidth}px) * ${editorPercent} / 100 - 3px)`
    : '100%';

  if (connectionStatus === 'offline') {
    if (screen === 'login' || screen === 'register' || screen === 'dashboard') {
      return <Dashboard />;
    }
  } else {
    if (screen === 'login') {
      return <Login />;
    }

    if (screen === 'register') {
      return <Register />;
    }

    if (screen === 'dashboard') {
      return <Dashboard />;
    }
  }

  return (
    <div className="app-container">
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
        <div className="workspace-container" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {previewMode !== 'preview-only' && (
            <div style={{ width: editorWidthExpr, flexShrink: 0, height: '100%' }}>
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
            <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
              <PreviewPanel />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;
