import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addFile, deleteFile, renameFile, setActiveFilePath } from '../../store/documentSlice';
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

  const handleSaveCreate = (name: string) => {
    let filename = name;
    if (!filename.endsWith('.typ')) {
      filename += '.typ';
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

  return (
    <div className="pane-content">
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
              
              {isActive && (
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
