import React from 'react';
import { Loader, AlertCircle } from 'lucide-react';
import { useAppSelector } from '../../store';

export const StatusBadge: React.FC = () => {
  const { isCompiling, compilerReady, compilerError } = useAppSelector(
    state => state.compiler
  );

  if (isCompiling) {
    return (
      <div className="status-badge compiling" title="Compiling document...">
        <Loader className="status-icon spinner-small" size={14} />
        <span>Compiling...</span>
      </div>
    );
  }

  if (compilerError) {
    return (
      <div
        className="status-badge error"
        title={typeof compilerError === 'string' ? compilerError : 'Compilation Error'}
      >
        <AlertCircle className="status-icon" size={14} />
        <span>Error</span>
      </div>
    );
  }

  if (!compilerReady) {
    return (
      <div className="status-badge loading" title="Loading Typst Compiler...">
        <Loader className="status-icon spinner-small" size={14} />
        <span>Loading Compiler...</span>
      </div>
    );
  }

  return null;
};
