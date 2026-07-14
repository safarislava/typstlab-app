import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface FileCreateInputProps {
  onSave: (name: string) => void;
  onCancel: () => void;
}

export const FileCreateInput: React.FC<FileCreateInputProps> = ({ onSave, onCancel }) => {
  const [newFileName, setNewFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleCreateFile = () => {
    const name = newFileName.trim();
    if (name) {
      onSave(name);
    }
  };

  return (
    <div className="file-create-input-container">
      <input
        ref={inputRef}
        type="text"
        placeholder="filename.typ"
        value={newFileName}
        onChange={(e) => setNewFileName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateFile();
          if (e.key === 'Escape') onCancel();
        }}
        className="file-create-input"
      />
      <button
        onClick={handleCreateFile}
        className="file-create-btn"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="file-create-cancel-btn"
      >
        <X size={14} />
      </button>
    </div>
  );
};
