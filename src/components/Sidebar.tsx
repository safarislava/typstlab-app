import React, { useState } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setActiveCellId } from '../store/documentSlice';
import { SidebarDock } from './sidebar/SidebarDock';
import type { SidebarTab } from './sidebar/SidebarDock';
import { FilesTab } from './sidebar/FilesTab';
import { OutlineTab } from './sidebar/OutlineTab';
import { CompilerTab } from './sidebar/CompilerTab';
import { SettingsTab } from './sidebar/SettingsTab';

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');

  const handleOutlineClick = (cellId: string) => {
    dispatch(setActiveCellId(cellId));
    const element = document.getElementById(`cell-container-${cellId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <aside className="sidebar-container">
      {/* Far-Left Dock (Icons Only) */}
      <SidebarDock activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Sidebar Pane */}
      <div className="sidebar-pane">
        {activeTab === 'files' && <FilesTab onOutlineClick={handleOutlineClick} />}
        {activeTab === 'outline' && <OutlineTab onOutlineClick={handleOutlineClick} />}
        {activeTab === 'compiler' && <CompilerTab />}
        {activeTab === 'settings' && <SettingsTab />}

        <div className="sidebar-pane-footer">
          <span className="version-label">Typst Compiler v0.11.0</span>
        </div>
      </div>
    </aside>
  );
};
export type { SidebarTab };
