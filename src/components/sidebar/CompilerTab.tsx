import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { AlertTriangle, CheckCircle, Loader } from 'lucide-react';

export const CompilerTab: React.FC = () => {
  const { compilerReady, compilerError } = useAppSelector(
    (state) => state.document
  );

  return (
    <div className="pane-content">
      {compilerError ? (
        <div className="status-error-pane">
          <AlertTriangle size={14} className="err-icon" />
          <span>Compilation Error detected</span>
          <pre className="error-details">{compilerError}</pre>
        </div>
      ) : !compilerReady ? (
        <div className="status-loading-pane" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader size={14} className="spinner-small" />
          <span>Loading compiler...</span>
        </div>
      ) : (
        <div className="empty-state-message" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>
          <CheckCircle size={14} style={{ color: 'var(--success-color)' }} />
          <span>No compilation errors</span>
        </div>
      )}
    </div>
  );
};
