import { useState, useRef, useCallback } from 'react';
import type React from 'react';

interface UseSplitPaneOptions {
  initialSidebarWidth?: number;
  initialEditorPercent?: number;
  minSidebarWidth?: number;
  maxSidebarWidth?: number;
  minEditorPercent?: number;
  maxEditorPercent?: number;
}

export function useSplitPane(options: UseSplitPaneOptions = {}) {
  const {
    initialSidebarWidth = 240,
    initialEditorPercent = 50,
    minSidebarWidth = 150,
    maxSidebarWidth = 500,
    minEditorPercent = 30,
    maxEditorPercent = 70
  } = options;

  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [editorPercent, setEditorPercent] = useState(initialEditorPercent);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const startSidebarResize = useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      mouseDownEvent.preventDefault();
      const startX = mouseDownEvent.clientX;
      const startWidth = sidebarWidth;

      const doResize = (mouseMoveEvent: MouseEvent) => {
        const deltaX = mouseMoveEvent.clientX - startX;
        const newWidth = startWidth + deltaX;

        if (newWidth < 100) {
          setIsSidebarOpen(false);
        } else {
          setIsSidebarOpen(true);
          setSidebarWidth(Math.min(maxSidebarWidth, Math.max(minSidebarWidth, newWidth)));
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
    },
    [sidebarWidth, minSidebarWidth, maxSidebarWidth]
  );

  const startEditorResize = useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      mouseDownEvent.preventDefault();
      const remainingWidth = workspaceRef.current
        ? workspaceRef.current.clientWidth
        : window.innerWidth - (isSidebarOpen ? sidebarWidth : 48);
      const startX = mouseDownEvent.clientX;
      const startPercent = editorPercent;

      const doResize = (mouseMoveEvent: MouseEvent) => {
        const deltaX = mouseMoveEvent.clientX - startX;
        const deltaPercent = (deltaX / remainingWidth) * 100;
        const newPercent = startPercent + deltaPercent;
        setEditorPercent(Math.min(maxEditorPercent, Math.max(minEditorPercent, newPercent)));
      };

      const stopResize = () => {
        window.removeEventListener('mousemove', doResize);
        window.removeEventListener('mouseup', stopResize);
        document.body.classList.remove('is-resizing');
      };

      window.addEventListener('mousemove', doResize);
      window.addEventListener('mouseup', stopResize);
      document.body.classList.add('is-resizing');
    },
    [editorPercent, isSidebarOpen, sidebarWidth, minEditorPercent, maxEditorPercent]
  );

  return {
    sidebarWidth,
    setSidebarWidth,
    editorPercent,
    setEditorPercent,
    isSidebarOpen,
    setIsSidebarOpen,
    workspaceRef,
    startSidebarResize,
    startEditorResize
  };
}
