import React from 'react';
import { FolderOpen, Settings } from 'lucide-react';

export type SidebarTab = 'files' | 'settings';

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
        className={`dock-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => handleTabClick('settings')}
        title="Settings"
      >
        <Settings size={20} />
      </button>
    </div>
  );
};
