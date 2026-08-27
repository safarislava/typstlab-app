import React, { useState } from 'react';
import { Folder, Calendar, Edit2, Trash2, Check, X, ArrowRight } from 'lucide-react';
import type { TypstProject } from '../../core/types';

interface ProjectCardProps {
  project: TypstProject;
  onOpen: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onRename,
  onDelete
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setNameInput(project.name);
  };

  const handleSaveRename = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (nameInput.trim()) {
      onRename(project.id, nameInput.trim());
    }
    setIsRenaming(false);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(false);
    setNameInput(project.name);
  };

  const handleStartDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(project.id);
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConfirmingDelete(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="project-card" onClick={() => onOpen(project.id)}>
      <div className="project-card-header">
        <div className="project-icon">
          <Folder size={20} />
        </div>
        <div className="project-card-actions" onClick={e => e.stopPropagation()}>
          {isConfirmingDelete ? (
            <div className="delete-confirm-actions">
              <span className="confirm-text">Удалить?</span>
              <button
                className="btn-action confirm-delete"
                onClick={handleConfirmDelete}
                title="Подтвердить удаление"
              >
                <Check size={14} />
              </button>
              <button
                className="btn-action cancel-delete"
                onClick={handleCancelDelete}
                title="Отмена"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <button
                className="btn-action"
                onClick={handleStartRename}
                title="Переименовать"
              >
                <Edit2 size={15} />
              </button>
              <button
                className="btn-action danger"
                onClick={handleStartDelete}
                title="Удалить проект"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="project-card-body">
        {isRenaming ? (
          <form className="rename-form" onSubmit={handleSaveRename} onClick={e => e.stopPropagation()}>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              autoFocus
              className="rename-input"
            />
            <button type="submit" className="btn-rename-save" title="Сохранить">
              <Check size={14} />
            </button>
            <button
              type="button"
              className="btn-rename-cancel"
              onClick={handleCancelRename}
              title="Отмена"
            >
              <X size={14} />
            </button>
          </form>
        ) : (
          <h3 className="project-name" title={project.name}>
            {project.name}
          </h3>
        )}
      </div>

      <div className="project-card-footer">
        <div className="project-meta">
          <Calendar size={13} />
          <span>{formatDate(project.updatedAt || project.createdAt)}</span>
        </div>
        <div className="project-open-hint">
          <span>Open</span>
          <ArrowRight size={13} />
        </div>
      </div>
    </div>
  );
};
