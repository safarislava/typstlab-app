import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { CellList } from './CellList';
import { WordRibbon } from './WordRibbon';

export const EditorWorkspace: React.FC = () => {
  const { files, activeFilePath } = useAppSelector((state) => state.document);
  const activeFile = files[activeFilePath];
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (activeFile?.isBinary && activeFile.binaryData) {
      const blob = new Blob([activeFile.binaryData.buffer as ArrayBuffer]);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setImageUrl('');
    }
  }, [activeFile]);

  if (activeFile?.isBinary) {
    const fileSizeKb = activeFile.binaryData 
      ? (activeFile.binaryData.length / 1024).toFixed(1) 
      : '0';

    return (
      <main className="editor-workspace">
        <div className="binary-preview-container">
          <img src={imageUrl} alt={activeFile.path} />
          <div className="binary-meta">
            <h3>{activeFile.path}</h3>
            <p>Image File • {fileSizeKb} KB</p>
          </div>
        </div>
      </main>
    );
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
