import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setConnectionStatus, setActiveCellId } from '../store/documentSlice';
import { FileText, Cpu, Wifi, WifiOff, Settings, List, FolderOpen, AlertTriangle } from 'lucide-react';

type SidebarTab = 'files' | 'outline' | 'compiler' | 'settings';

interface OutlineItem {
  cellId: string;
  text: string;
  level: number;
}

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const { cells, connectionStatus, compilerReady, compilerError, activeCellId } = useAppSelector(
    (state) => state.document
  );

  const [activeTab, setActiveTab] = useState<SidebarTab>('files');

  const toggleConnection = () => {
    dispatch(
      setConnectionStatus(
        connectionStatus === 'offline' ? 'connected' : 'offline'
      )
    );
  };

  // Extract outline headings (e.g. '= Header', '== Subheader') from cells
  const extractOutline = (): OutlineItem[] => {
    const items: OutlineItem[] = [];
    cells.forEach((cell) => {
      const lines = cell.content.split('\n');
      lines.forEach((line) => {
        const match = line.match(/^(=+)\s+(.+)$/);
        if (match) {
          items.push({
            cellId: cell.id,
            text: match[2].replace(/[*_]/g, '').trim(), // clean formatting markup
            level: match[1].length,
          });
        }
      });
    });
    return items;
  };

  const outline = extractOutline();

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

      {/* Main Sidebar Pane */}
      <div className="sidebar-pane">
        {activeTab === 'files' && (
          <div className="pane-content">
            <div className="pane-header">Files</div>
            <div className="file-tree">
              <div className="file-item active">
                <FileText size={16} className="file-icon" />
                <span>main.typ</span>
              </div>
              <div className="file-sub-tree">
                {cells.map((cell, index) => (
                  <div
                    key={cell.id}
                    className={`cell-link-item ${activeCellId === cell.id ? 'active' : ''}`}
                    onClick={() => handleOutlineClick(cell.id)}
                  >
                    <span className="cell-bullet"></span>
                    <span className="cell-link-text">
                      Cell {index + 1} ({cell.content.slice(0, 15).trim() || 'empty'}...)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'outline' && (
          <div className="pane-content">
            <div className="pane-header">Outline</div>
            {outline.length === 0 ? (
              <div className="pane-empty-state">
                No headings found. Add headings using <code>= Header</code> in your Typst cells.
              </div>
            ) : (
              <div className="outline-list">
                {outline.map((item, index) => (
                  <div
                    key={`${item.cellId}-${index}`}
                    className={`outline-item level-${Math.min(item.level, 3)}`}
                    onClick={() => handleOutlineClick(item.cellId)}
                  >
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'compiler' && (
          <div className="pane-content">
            <div className="pane-header">WASM Engine</div>
            <div className="compiler-pane-status">
              <div className="status-row">
                <span className="status-label">Compiler Status:</span>
                <span className={`status-value ${compilerReady ? 'success' : 'loading'}`}>
                  {compilerReady ? 'Ready' : 'Loading...'}
                </span>
              </div>
              {compilerError && (
                <div className="status-error-pane">
                  <AlertTriangle size={14} className="err-icon" />
                  <span>Compilation Error detected</span>
                </div>
              )}
              <div className="divider"></div>
              <div className="status-row clickable" onClick={toggleConnection}>
                <span className="status-label">Cloud Sync:</span>
                <span className="status-value-icon">
                  {connectionStatus === 'connected' ? (
                    <span className="connection-text success">
                      <Wifi size={14} className="inline-icon" /> Online
                    </span>
                  ) : (
                    <span className="connection-text offline">
                      <WifiOff size={14} className="inline-icon" /> Offline
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="pane-content">
            <div className="pane-header">Settings</div>
            <div className="settings-list">
              <div className="setting-item">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Enable Autocomplete</span>
                </label>
              </div>
              <div className="setting-item">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Real-time Compile</span>
                </label>
              </div>
              <div className="setting-item">
                <label className="checkbox-label">
                  <input type="checkbox" defaultChecked />
                  <span>Show Line Numbers</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-pane-footer">
          <span className="version-label">Typst Compiler v0.11.0</span>
        </div>
      </div>
    </aside>
  );
};
