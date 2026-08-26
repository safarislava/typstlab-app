import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setPreviewMode } from '../../store/slices/editorSlice';
import { EditorHeader } from './Header/EditorHeader';
import { Sidebar } from '../Sidebar';
import { EditorWorkspace } from '../EditorWorkspace';
import { PreviewPanel } from '../PreviewPanel';
import { useSplitPane } from '../../hooks/useSplitPane';
import { useProjectLoader } from '../../hooks/useProjectLoader';
import type { SidebarTab } from '../sidebar/SidebarDock';

interface EditorLayoutProps {
  projectId: string;
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ projectId }) => {
  const dispatch = useAppDispatch();
  const previewMode = useAppSelector(state => state.editor?.previewMode || state.document?.previewMode);
  const [activeTab, setActiveTab] = useState<SidebarTab | null>('files');
  const [isWorkspaceNarrow, setIsWorkspaceNarrow] = useState(false);

  const {
    sidebarWidth,
    editorPercent,
    workspaceRef,
    startSidebarResize,
    startEditorResize
  } = useSplitPane();

  const { loadProject } = useProjectLoader();

  // Load project files when projectId changes
  useEffect(() => {
    if (projectId) {
      void loadProject(projectId);
    }
  }, [projectId, loadProject]);

  // Responsive narrow workspace check
  const checkWorkspaceResponsiveness = useCallback(() => {
    if (!workspaceRef.current) return;
    const width = workspaceRef.current.clientWidth;
    const narrow = width < 700;
    setIsWorkspaceNarrow(narrow);

    if (narrow && previewMode === 'side-by-side') {
      dispatch(setPreviewMode('edit-only'));
    }
  }, [dispatch, previewMode, workspaceRef]);

  useEffect(() => {
    if (!workspaceRef.current) return;
    const observer = new ResizeObserver(() => {
      checkWorkspaceResponsiveness();
    });
    observer.observe(workspaceRef.current);
    checkWorkspaceResponsiveness();

    return () => observer.disconnect();
  }, [checkWorkspaceResponsiveness, workspaceRef]);

  const actualSidebarWidth = activeTab === null ? 48 : sidebarWidth;
  const editorWidthExpr =
    previewMode === 'side-by-side' ? `calc(${editorPercent}% - 3px)` : '100%';

  return (
    <div className={`app-container ${isWorkspaceNarrow ? 'narrow-workspace' : ''}`}>
      <EditorHeader />
      <div className={`app-layout preview-mode-${previewMode}`}>
        {/* Sidebar Container Column */}
        <div style={{ width: `${actualSidebarWidth}px`, flexShrink: 0 }}>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Sidebar Resizer (only visible when not collapsed) */}
        {activeTab !== null && (
          <div className="resizer-bar" onMouseDown={startSidebarResize} />
        )}

        {/* Central Workspace Container (Editor + Preview split) */}
        <div
          ref={workspaceRef}
          className="workspace-container"
          style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
        >
          {previewMode !== 'preview-only' && (
            <div
              style={{
                width: editorWidthExpr,
                flexShrink: 0,
                height: '100%',
                minWidth: 0
              }}
            >
              <EditorWorkspace />
            </div>
          )}

          {previewMode === 'side-by-side' && (
            <div className="resizer-bar" onMouseDown={startEditorResize} />
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
};
