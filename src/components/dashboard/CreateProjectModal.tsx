import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [projectName, setProjectName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreate(projectName.trim());
    setProjectName('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New Project</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label htmlFor="new-project-name">Project Name</label>
            <input
              id="new-project-name"
              type="text"
              placeholder="e.g. Master Thesis, Quantum Physics Notes..."
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              autoFocus
              className="modal-input"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
              disabled={!projectName.trim()}
            >
              <Plus size={16} />
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
