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
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    let name = newFileName.trim();
    if (!name) {
      name = 'untitled.typxml';
    }
    onSave(name);
  };

  return (
    <form
      className="file-create-input-container"
      onSubmit={handleSubmit}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="untitled.typxml"
        value={newFileName}
        onChange={(e) => setNewFileName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        className="file-create-input"
      />
      <button
        type="submit"
        className="file-create-btn"
        title="Confirm"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
        className="file-create-cancel-btn"
        title="Cancel"
      >
        <X size={14} />
      </button>
    </form>
  );
};
