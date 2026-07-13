import React from 'react';
import { FolderOpen, List, Cpu, Settings } from 'lucide-react';

export type SidebarTab = 'files' | 'outline' | 'compiler' | 'settings';

interface SidebarDockProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
}

export const SidebarDock: React.FC<SidebarDockProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="sidebar-dock">
      <button
        className={`dock-item ${activeTab === 'files' ? 'active' : ''}`}
        onClick={() => setActiveTab('files')}
        title="Files"
      >
        <FolderOpen size={20} />
      </button>
      <button
        className={`dock-item ${activeTab === 'outline' ? 'active' : ''}`}
        onClick={() => setActiveTab('outline')}
        title="Outline"
      >
        <List size={20} />
      </button>
      <button
        className={`dock-item ${activeTab === 'compiler' ? 'active' : ''}`}
        onClick={() => setActiveTab('compiler')}
        title="Compiler logs"
      >
        <Cpu size={20} />
      </button>
      <button
        className={`dock-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveTab('settings')}
        title="Settings"
      >
        <Settings size={20} />
      </button>
    </div>
  );
};
