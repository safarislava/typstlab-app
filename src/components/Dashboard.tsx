import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { addProject, deleteProject, updateProjectName, logoutUser } from '../store/documentSlice';
import { api } from '../utils/api';
import { Plus, Search, Folder, Calendar, Trash2, Edit2, Check, X, ArrowRight, BookOpen, LogOut } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.document.projects);
  const currentUser = useAppSelector((state) => state.document.currentUser);
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  // Renaming state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreateProject = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    let projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    let createdAt = Date.now();
    let updatedAt = Date.now();

    if (connectionStatus === 'connected') {
      try {
        const response = await api.createProject(newProjectName.trim());
        projectId = response.id;
        if (response.updated_at) {
          createdAt = new Date(response.updated_at).getTime();
          updatedAt = createdAt;
        }
      } catch (err) {
        console.error('Failed to create project on server:', err);
      }
    }

    const newProj = {
      id: projectId,
      name: newProjectName.trim(),
      createdAt,
      updatedAt,
      ownerId: connectionStatus === 'connected' ? currentUser?.username : undefined,
    };

    dispatch(addProject(newProj));
    setNewProjectName('');
    setShowCreateModal(false);

    // Automatically load and open the new project
    handleOpenProject(projectId);
  };

  const handleOpenProject = (projectId: string) => {
    window.location.hash = `#/project/${projectId}`;
  };

  const handleStartRename = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setEditingProjectId(id);
    setEditingName(name);
  };

  const handleSaveRename = (e: React.SyntheticEvent<HTMLFormElement>, id: string) => {
    e.preventDefault();
    if (editingName.trim()) {
      dispatch(updateProjectName({ id, name: editingName.trim() }));
    }
    setEditingProjectId(null);
  };

  const handleCancelRename = () => {
    setEditingProjectId(null);
  };

  const handleStartDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch(deleteProject(id));
    setConfirmDeleteId(null);
    if (window.location.hash === `#/project/${id}`) {
      window.location.hash = '#/';
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  // Format date nicely
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter projects based on query
  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      {/* Main Content Area */}
      <main className="dashboard-content">
        {/* Welcome Section */}
        <section className="dashboard-welcome">
          <div className="welcome-content-wrapper">
            <div className="welcome-text">
              <h1>Welcome to <span>TypstLab</span></h1>
              <p>Create, compile, and manage Typst documents with interactive markup cells.</p>
            </div>
            
            {connectionStatus === 'connected' && currentUser && (
              <div className="dashboard-user-card">
                <div className="user-card-avatar">
                  {currentUser.username[0].toUpperCase()}
                </div>
                <div className="user-card-details">
                  <div className="user-card-name">{currentUser.fullName || currentUser.username}</div>
                  <div className="user-card-username">@{currentUser.username}</div>
                </div>
                <button 
                  className="btn-switch-user" 
                  onClick={() => dispatch(logoutUser())}
                  title="Сменить пользователя"
                >
                  <LogOut size={16} />
                  <span>Сменить пользователя</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Toolbar: Search and Stats */}
        <div className="dashboard-toolbar">
          <div className="search-box">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

        </div>

        {/* Projects Grid */}
        <div className="projects-grid">
          {/* Create New Card */}
          <div className="project-card create-card" onClick={() => setShowCreateModal(true)}>
            <div className="create-card-content">
              <div className="plus-circle">
                <Plus size={28} />
              </div>
              <h3>Create New Project</h3>
              <p>Start a fresh Typst document</p>
            </div>
          </div>

          {/* Existing Project Cards */}
          {filteredProjects.map((project) => {
            const isEditing = editingProjectId === project.id;
            const isConfirmingDelete = confirmDeleteId === project.id;

            return (
              <div
                key={project.id}
                className={`project-card ${isConfirmingDelete ? 'confirm-delete-state' : ''}`}
                onClick={() => !isEditing && !isConfirmingDelete && handleOpenProject(project.id)}
              >
                {/* Delete Confirmation Overlay */}
                {isConfirmingDelete ? (
                  <div className="delete-overlay">
                    <p>Delete this project and all its files?</p>
                    <div className="overlay-actions">
                      <button 
                        className="btn-confirm-delete"
                        onClick={(e) => handleConfirmDelete(e, project.id)}
                      >
                        Delete
                      </button>
                      <button 
                        className="btn-cancel"
                        onClick={handleCancelDelete}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="project-card-header">
                  <div className="project-icon-wrapper">
                    <Folder className="project-icon" size={24} />
                  </div>
                  
                  {/* Actions (Rename, Delete) */}
                  {!isEditing && !isConfirmingDelete && (
                    <div className="project-card-actions">
                      <button
                        className="card-action-btn"
                        onClick={(e) => handleStartRename(e, project.id, project.name)}
                        title="Rename Project"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="card-action-btn delete-btn"
                        onClick={(e) => handleStartDelete(e, project.id)}
                        title="Delete Project"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="project-card-body">
                  {isEditing ? (
                    <form 
                      className="rename-form"
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={(e) => handleSaveRename(e, project.id)}
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        className="rename-input"
                      />
                      <div className="rename-actions">
                        <button type="submit" className="rename-btn-save">
                          <Check size={14} />
                        </button>
                        <button type="button" className="rename-btn-cancel" onClick={handleCancelRename}>
                          <X size={14} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <h3 className="project-name">{project.name}</h3>
                  )}
                </div>

                <div className="project-card-footer">
                  <div className="project-date">
                    <Calendar size={12} className="footer-icon" />
                    <span>{formatDate(project.updatedAt)}</span>
                  </div>
                  <div className="open-indicator">
                    <span>Open</span>
                    <ArrowRight size={14} className="arrow-icon" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && searchQuery && (
          <div className="dashboard-empty-state">
            <BookOpen size={48} className="empty-icon" />
            <h3>No projects found</h3>
            <p>No projects match your search query "{searchQuery}"</p>
            <button className="btn-secondary" onClick={() => setSearchQuery('')}>
              Clear Search
            </button>
          </div>
        )}

        {filteredProjects.length === 0 && !searchQuery && (
          <div className="dashboard-empty-state">
            <BookOpen size={48} className="empty-icon" />
            <h3>No projects yet</h3>
            <p>Create your first project to start compiling Typst documents.</p>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              <span>Create Project</span>
            </button>
          </div>
        )}
      </main>

      {/* Creation Modal/Dialog Overlay */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Project</h2>
              <button className="close-modal" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <label htmlFor="project-name">Project Name</label>
                <input
                  id="project-name"
                  type="text"
                  placeholder="e.g. Quarterly Report, Resume"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
