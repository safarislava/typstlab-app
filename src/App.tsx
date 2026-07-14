import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setCompilerReady, setCompilerError, setProjects } from './store/documentSlice';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EditorWorkspace } from './components/EditorWorkspace';
import { PreviewPanel } from './components/PreviewPanel';
import { Dashboard } from './components/Dashboard';
import { $typst } from '@myriaddreamin/typst.ts';
import type { SidebarTab } from './components/sidebar/SidebarDock';
import { initDB, getAllProjectsFromDB, saveProjectToDB } from './store/db';

let wasmInitialized = false;

function App() {
  const dispatch = useAppDispatch();
  const previewMode = useAppSelector((state) => state.document.previewMode);
  const screen = useAppSelector((state) => state.document.screen);

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

  // Load projects from IndexedDB on startup
  useEffect(() => {
    const loadProjects = async () => {
      try {
        await initDB();
        let dbProjects = await getAllProjectsFromDB();
        
        if (!dbProjects || dbProjects.length === 0) {
          // Create default project on first load to migrate existing users or start fresh
          const defaultProj = {
            id: 'default-project',
            name: 'Default Project',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await saveProjectToDB(defaultProj);
          dbProjects = [defaultProj];
        }
        
        dispatch(setProjects(dbProjects));
      } catch (err) {
        console.error('Error loading projects from IndexedDB:', err);
      }
    };
    loadProjects();
  }, [dispatch]);

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

  if (screen === 'dashboard') {
    return <Dashboard />;
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
