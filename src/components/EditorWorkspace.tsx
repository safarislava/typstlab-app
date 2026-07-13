import React from 'react';
import { CellList } from './CellList';

export const EditorWorkspace: React.FC = () => {
  return (
    <main className="editor-workspace">
      <div className="workspace-body">
        <CellList />
      </div>
    </main>
  );
};
