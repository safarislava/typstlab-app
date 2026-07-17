import React, { useState, useRef, useEffect } from 'react';
import { FileText, FileImage, Trash2, Edit, Download } from 'lucide-react';
import type { TypstFile } from '../../../store/documentSlice';
import { downloadTypstFile } from '../../../utils/fileDownloader';

interface FileItemProps {
  file: TypstFile;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  exists: (name: string) => boolean;
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  isActive,
  onSelect,
  onDelete,
  onRename,
  exists
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(file.path);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditing]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    downloadTypstFile(file);
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(file.path);
  };

  const handleSaveRename = () => {
    let name = editName.trim();
    if (!name || name === file.path) {
      setIsEditing(false);
      return;
    }
    
    // Auto-append original extension if the user did not specify any extension (no dot in name)
    if (!name.includes('.')) {
      const dotIndex = file.path.lastIndexOf('.');
      if (dotIndex !== -1) {
        name += file.path.substring(dotIndex);
      }
    }
    
    if (name !== file.path && exists(name)) {
      alert('A file with this name already exists.');
      return;
    }
    onRename(name);
    setIsEditing(false);
  };

  return (
    <div
      className={`file-item ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
      onClick={() => !isEditing && onSelect()}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}
    >
      {!isEditing && (
        <div className="file-actions">
          <button
            onClick={handleDownload}
            title="Download file"
          >
            <Download size={12} />
          </button>
          <button
            onClick={handleStartRename}
            title="Rename file"
          >
            <Edit size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete file"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {file.isBinary ? (
        <FileImage
          size={16}
          className="file-icon"
          style={{ color: 'var(--accent-color)' }}
        />
      ) : (
        <FileText
          size={16}
          className="file-icon"
        />
      )}

      <div style={{ marginLeft: '8px', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="file-rename-input"
          />
        ) : (
          <span className="file-name">
            {file.path}
          </span>
        )}
      </div>
    </div>
  );
};
