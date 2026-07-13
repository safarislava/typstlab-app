import React from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setTitle } from '../store/documentSlice';
import { CellList } from './CellList';
import { BookOpen } from 'lucide-react';

export const EditorWorkspace: React.FC = () => {
  const title = useAppSelector((state) => state.document.title);
  const dispatch = useAppDispatch();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTitle(e.target.value));
  };

  return (
    <main className="editor-workspace">
      <div className="workspace-header">
        <div className="doc-title-container">
          <BookOpen className="title-icon" />
          <input
            type="text"
            className="doc-title-input"
            value={title}
            onChange={handleTitleChange}
            placeholder="Name your document..."
          />
        </div>
      </div>

      <div className="workspace-body">
        <CellList />
      </div>
    </main>
  );
};
