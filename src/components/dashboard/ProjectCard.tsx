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
    <div 
      className={`project-card ${isConfirmingDelete ? 'confirm-delete-state' : ''}`} 
      onClick={() => !isConfirmingDelete && onOpen(project.id)}
    >
      <div className="project-card-header">
        <div className="project-icon-wrapper">
          <Folder size={22} />
        </div>
        <div className="project-card-actions" onClick={e => e.stopPropagation()}>
          <button
            className="card-action-btn"
            onClick={handleStartRename}
            title="Переименовать"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="card-action-btn delete-btn"
            onClick={handleStartDelete}
            title="Удалить проект"
          >
            <Trash2 size={14} />
          </button>
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
            <div className="rename-actions">
              <button type="submit" title="Сохранить">
                <Check size={14} />
              </button>
              <button type="button" onClick={handleCancelRename} title="Отмена">
                <X size={14} />
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="project-name" title={project.name}>
              {project.name}
            </h3>
            <p className="project-desc">Typst Document Project</p>
          </>
        )}
      </div>

      <div className="project-card-footer">
        <div className="project-date">
          <Calendar size={13} />
          <span>{formatDate(project.updatedAt || project.createdAt)}</span>
        </div>
        <div className="open-indicator">
          <span>Open</span>
          <ArrowRight size={13} />
        </div>
      </div>

      {isConfirmingDelete && (
        <div className="delete-overlay" onClick={e => e.stopPropagation()}>
          <p>Удалить проект «{project.name}»?</p>
          <div className="overlay-actions">
            <button className="btn-confirm-delete" onClick={handleConfirmDelete}>
              Удалить
            </button>
            <button className="btn-cancel" onClick={handleCancelDelete}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
