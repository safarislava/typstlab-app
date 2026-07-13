import React from 'react';
import { FolderOpen, List, Cpu, Settings } from 'lucide-react';

export type SidebarTab = 'files' | 'outline' | 'compiler' | 'settings';

interface SidebarDockProps {
  activeTab: SidebarTab | null;
  setActiveTab: (tab: SidebarTab | null) => void;
}

export const SidebarDock: React.FC<SidebarDockProps> = ({ activeTab, setActiveTab }) => {
  const handleTabClick = (tab: SidebarTab) => {
    if (activeTab === tab) {
      setActiveTab(null);
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="sidebar-dock">
      <button
        className={`dock-item ${activeTab === 'files' ? 'active' : ''}`}
        onClick={() => handleTabClick('files')}
        title="Files"
      >
        <FolderOpen size={20} />
      </button>
      <button
        className={`dock-item ${activeTab === 'outline' ? 'active' : ''}`}
        onClick={() => handleTabClick('outline')}
        title="Outline"
      >
        <List size={20} />
      </button>
      <button
        className={`dock-item ${activeTab === 'compiler' ? 'active' : ''}`}
        onClick={() => handleTabClick('compiler')}
        title="Compiler logs"
      >
        <Cpu size={20} />
      </button>
      <button
        className={`dock-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => handleTabClick('settings')}
        title="Settings"
      >
        <Settings size={20} />
      </button>
    </div>
  );
};
