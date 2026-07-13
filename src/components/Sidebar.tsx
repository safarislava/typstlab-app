import React from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setConnectionStatus } from '../store/documentSlice';
import { FileText, Cpu, Wifi, WifiOff, Settings, Sparkles } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);
  const dispatch = useAppDispatch();

  const toggleConnection = () => {
    dispatch(
      setConnectionStatus(
        connectionStatus === 'offline' ? 'connected' : 'offline'
      )
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Sparkles className="brand-icon" />
        <h2>TypstLab</h2>
      </div>

      <div className="sidebar-section">
        <div className="section-header">Workspace</div>
        <ul className="sidebar-nav">
          <li className="active">
            <FileText className="nav-icon" />
            <span>Active Document</span>
          </li>
        </ul>
      </div>

      <div className="sidebar-section">
        <div className="section-header">Status</div>
        <div className="status-panel">
          <div className="status-item" onClick={toggleConnection} style={{ cursor: 'pointer' }}>
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="status-icon success" />
                <span className="status-text success">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="status-icon warning" />
                <span className="status-text warning">Offline Mode</span>
              </>
            )}
          </div>
          <div className="status-item">
            <Cpu className="status-icon" />
            <span className="status-text">WASM Ready</span>
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="footer-item">
          <Settings className="footer-icon" />
          <span>Settings</span>
        </div>
        <div className="footer-version">v0.1.0</div>
      </div>
    </aside>
  );
};
