import React from 'react';
import { CellList } from './CellList';
import { WordRibbon } from './WordRibbon';

export const EditorWorkspace: React.FC = () => {
  return (
    <main className="editor-workspace">
      <WordRibbon />
      <div className="workspace-body">
        <CellList />
      </div>
    </main>
  );
};
