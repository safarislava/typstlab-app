import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addFile, deleteFile, renameFile, setActiveFilePath, addBinaryFile, addTextFileWithContent } from '../../store/documentSlice';
import { Plus } from 'lucide-react';
import { FileCreateInput } from './files/FileCreateInput';
import { FileItem } from './files/FileItem';
import { FileCellsList } from './files/FileCellsList';

interface FilesTabProps {
  onOutlineClick: (cellId: string) => void;
}

export const FilesTab: React.FC<FilesTabProps> = ({ onOutlineClick }) => {
  const dispatch = useAppDispatch();
  const { files, activeFilePath, activeCellId } = useAppSelector((state) => state.document);
  const [isCreating, setIsCreating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleSaveCreate = (name: string) => {
    let filename = name;
    if (!filename.endsWith('.typxml')) {
      filename += '.typxml';
    }
    if (files[filename]) {
      alert('A file with this name already exists.');
      return;
    }
    dispatch(addFile({ path: filename }));
    setIsCreating(false);
  };

  const handleRename = (oldPath: string, newPath: string) => {
    dispatch(renameFile({ oldPath, newPath }));
  };

  const handleDelete = (path: string) => {
    if (confirm(`Are you sure you want to delete "${path}"?`)) {
      dispatch(deleteFile(path));
    }
  };

  const checkIfFileExists = (name: string) => {
    return !!files[name];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    for (const file of droppedFiles) {
      const name = file.name;
      if (name.endsWith('.typxml')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          dispatch(addTextFileWithContent({ path: name, content }));
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const binaryData = new Uint8Array(arrayBuffer);
          dispatch(addBinaryFile({ path: name, binaryData }));
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  return (
    <div
      className={`pane-content files-tab-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {isDragging && (
        <div className="drag-drop-overlay">
          <div className="overlay-content">
            <Plus size={32} />
            <span>Drop to add files</span>
          </div>
        </div>
      )}

      <div className="pane-header">
        <span>Files</span>
        <button
          onClick={() => setIsCreating(true)}
          className="create-file-btn"
          title="Create new file"
        >
          <Plus size={16} />
        </button>
      </div>

      {isCreating && (
        <FileCreateInput
          onSave={handleSaveCreate}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <div className="file-tree">
        {Object.values(files).map((file) => {
          const isActive = file.path === activeFilePath;

          return (
            <div key={file.path} style={{ display: 'flex', flexDirection: 'column' }}>
              <FileItem
                file={file}
                isActive={isActive}
                onSelect={() => dispatch(setActiveFilePath(file.path))}
                onDelete={() => handleDelete(file.path)}
                onRename={(newPath) => handleRename(file.path, newPath)}
                exists={checkIfFileExists}
              />
              
              {isActive && !file.isBinary && file.cells && (
                <FileCellsList
                  cells={file.cells}
                  activeCellId={activeCellId}
                  onOutlineClick={onOutlineClick}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default FilesTab;
