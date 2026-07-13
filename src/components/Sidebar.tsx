import React, { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setActiveCellId } from '../store/documentSlice';
import { SidebarDock } from './sidebar/SidebarDock';
import type { SidebarTab } from './sidebar/SidebarDock';
import { FilesTab } from './sidebar/FilesTab';
import { OutlineTab } from './sidebar/OutlineTab';
import { CompilerTab } from './sidebar/CompilerTab';
import { SettingsTab } from './sidebar/SettingsTab';

interface SidebarProps {
  activeTab: SidebarTab | null;
  setActiveTab: (tab: SidebarTab | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const dispatch = useAppDispatch();

  const handleOutlineClick = (cellId: string) => {
    dispatch(setActiveCellId(cellId));
    const element = document.getElementById(`cell-container-${cellId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const isCollapsed = activeTab === null;

  return (
    <aside className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Far-Left Dock (Icons Only) */}
      <SidebarDock activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Sidebar Pane */}
      {!isCollapsed && (
        <div className="sidebar-pane">
          {activeTab === 'files' && <FilesTab onOutlineClick={handleOutlineClick} />}
          {activeTab === 'outline' && <OutlineTab onOutlineClick={handleOutlineClick} />}
          {activeTab === 'compiler' && <CompilerTab />}
          {activeTab === 'settings' && <SettingsTab />}

          <div className="sidebar-pane-footer">
            <span className="version-label">Typst Compiler v0.11.0</span>
          </div>
        </div>
      )}
    </aside>
  );
};
export type { SidebarTab };
