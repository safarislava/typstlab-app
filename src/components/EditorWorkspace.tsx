import React from 'react';
import { useAppSelector } from '../store';
import { CellList } from './CellList';
import { WordRibbon } from './WordRibbon';
import { BinaryPreview } from './editor/Workspace';

export const EditorWorkspace: React.FC = () => {
  const { files, activeFilePath } = useAppSelector(state => state.editor);
  const activeFile = files[activeFilePath];

  if (activeFile?.isBinary) {
    return <BinaryPreview file={activeFile} />;
  }

  return (
    <main className="editor-workspace">
      <WordRibbon />
      <div className="workspace-body">
        <CellList />
      </div>
    </main>
  );
};
