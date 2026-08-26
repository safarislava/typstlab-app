import React, { useState, useEffect } from 'react';
import type { BinaryTypstFile } from '../../../core/types';

interface BinaryPreviewProps {
  file: BinaryTypstFile;
}

export const BinaryPreview: React.FC<BinaryPreviewProps> = ({ file }) => {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (file.binaryData) {
      const blob = new Blob([file.binaryData.buffer as ArrayBuffer]);
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setImageUrl('');
    }
  }, [file]);

  const fileSizeKb = file.binaryData
    ? (file.binaryData.length / 1024).toFixed(1)
    : '0';

  return (
    <main className="editor-workspace">
      <div className="binary-preview-container">
        <img src={imageUrl} alt={file.path} />
        <div className="binary-meta">
          <h3>{file.path}</h3>
          <p>Image File • {fileSizeKb} KB</p>
        </div>
      </div>
    </main>
  );
};
