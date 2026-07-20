import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setCompilerReady, setCompilerError, setProjects, setCurrentProjectId, initializeProject, setConnectionStatus, setScreen } from './store/documentSlice';
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
import { initDB, saveProjectToDB, saveFileToDB, getFilesForProjectFromDB, getProjectsForUserFromDB, migrateLegacyProjectsToUser, getAllProjectsFromDB } from './store/db';
import type { TypstProject } from './store/db';
import { api } from './utils/api';
import { syncOfflineDataToServer } from './utils/syncManager';

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

  // Poll backend (HTTP /health) availability to update online/offline connectionStatus
  useEffect(() => {
    let checkInterval: any;
    let isChecking = false;

    const checkBackend = async () => {
      if (isChecking) return;
      isChecking = true;

      try {
        const isHealthy = await api.checkHealth();
        if (isHealthy) {
          dispatch(setConnectionStatus('connected'));
        } else {
          dispatch(setConnectionStatus('offline'));
        }
      } catch {
        dispatch(setConnectionStatus('offline'));
      } finally {
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
          // Sync any offline created projects/files to Go backend
          await syncOfflineDataToServer(currentUser);
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
    // If online (connected) and no user is logged in, redirect to login page (except if on login/register screen)
    if (connectionStatus === 'connected' && !currentUser) {
      dispatch(setCurrentProjectId(null));
      if (screen !== 'login' && screen !== 'register') {
        dispatch(setScreen('login'));
      }
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
          if (connectionStatus === 'connected' && currentUser) {
            try {
              const serverProj = await api.getProjectDetails(projectId);
              if (serverProj) {
                authorized = true;
                // Cache/Update project info locally
                await saveProjectToDB({
                  id: serverProj.id,
                  name: serverProj.name,
                  createdAt: serverProj.created_at ? new Date(serverProj.created_at).getTime() : Date.now(),
                  updatedAt: serverProj.updated_at ? new Date(serverProj.updated_at).getTime() : Date.now(),
                  ownerId: currentUser.username
                });
              }
            } catch (err) {
              console.warn('Failed to verify project with server, checking local IndexedDB:', err);
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

          let reduxFiles: TypstFile[] = [];
          let loadedFromBackend = false;

          if (connectionStatus === 'connected') {
            try {
              const serverFiles = await api.getProjectFiles(projectId);
              for (const file of serverFiles) {
                if (file.type === 'typst') {
                  const typstFileDetails = await api.getTypstFile(file.id);
                  const cells = typstFileDetails.blocks ? typstFileDetails.blocks.map((b: any) => ({
                    id: b.id,
                    content: b.content,
                    title: b.name
                  })) : [];

                  reduxFiles.push({
                    path: file.name,
                    isBinary: false,
                    cells,
                    backendId: file.id
                  });

                  // Cache locally
                  await saveFileToDB({
                    id: `${projectId}:${file.name}`,
                    projectId,
                    path: file.name,
                    isBinary: false,
                    cells
                  });
                } else if (file.type === 'binary') {
                  const rawBuffer = await api.getBinaryFileRaw(file.id);
                  const binaryData = new Uint8Array(rawBuffer);

                  reduxFiles.push({
                    path: file.name,
                    isBinary: true,
                    binaryData,
                    backendId: file.id
                  });

                  // Cache locally
                  await saveFileToDB({
                    id: `${projectId}:${file.name}`,
                    projectId,
                    path: file.name,
                    isBinary: true,
                    binaryData
                  });
                }
              }
              loadedFromBackend = true;
            } catch (err) {
              console.error('Failed to sync files from server, falling back to local files:', err);
            }
          }

          if (!loadedFromBackend) {
            const dbFiles = await getFilesForProjectFromDB(projectId);
            reduxFiles = dbFiles.map(f => {
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
          }

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
  }, [dispatch, connectionStatus, currentUser, screen]);

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
