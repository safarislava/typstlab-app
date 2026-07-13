import React from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setConnectionStatus } from '../../store/documentSlice';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';

export const CompilerTab: React.FC = () => {
  const dispatch = useAppDispatch();
  const { connectionStatus, compilerReady, compilerError } = useAppSelector(
    (state) => state.document
  );

  const toggleConnection = () => {
    dispatch(
      setConnectionStatus(
        connectionStatus === 'offline' ? 'connected' : 'offline'
      )
    );
  };

  return (
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
  );
};
