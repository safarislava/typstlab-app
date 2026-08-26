import React from 'react';
import { Wifi, WifiOff, Loader } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export const ConnectionIndicator: React.FC = () => {
  const { connectionStatus, isChecking, reconnect } = useNetworkStatus();

  const getTitle = () => {
    if (isChecking || connectionStatus === 'connecting') {
      return 'Checking connection status...';
    }
    if (connectionStatus === 'connected') {
      return 'Connected (Click to check /health)';
    }
    return 'Offline Mode (Click to check /health and reconnect)';
  };

  return (
    <div
      className="connection-badge"
      onClick={() => { void reconnect(); }}
      style={{ cursor: 'pointer' }}
      title={getTitle()}
    >
      {isChecking || connectionStatus === 'connecting' ? (
        <div className="status-indicator loading">
          <Loader className="spinner-small" size={14} />
        </div>
      ) : connectionStatus === 'connected' ? (
        <div className="status-indicator online">
          <Wifi size={14} />
        </div>
      ) : (
        <div className="status-indicator offline">
          <WifiOff size={14} />
        </div>
      )}
    </div>
  );
};
