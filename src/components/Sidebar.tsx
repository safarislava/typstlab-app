import React from 'react';
import { useAppDispatch, setActiveCellId } from '../store';
import { SidebarDock } from './sidebar/SidebarDock';
import type { SidebarTab } from './sidebar/SidebarDock';
import { FilesTab } from './sidebar/FilesTab';
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
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      )}
    </aside>
  );
};
export type { SidebarTab };
