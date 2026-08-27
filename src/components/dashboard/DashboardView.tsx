import React, { useState, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { 
  addProject, 
  deleteProject, 
  updateProjectName, 
  setProjects 
} from '../../store';
import { projectRepository } from '../../services';
import { projectsApi } from '../../services';
import { DashboardWelcome } from './DashboardWelcome';
import { ProjectSearchBar } from './ProjectSearchBar';
import { ProjectGrid } from './ProjectGrid';
import { CreateProjectModal } from './CreateProjectModal';

export const DashboardView: React.FC = () => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector(state => state.projects?.projects || state.document?.projects);
  const currentUser = useAppSelector(state => state.auth?.currentUser || state.document?.currentUser);
  const connectionStatus = useAppSelector(state => state.network?.connectionStatus || state.document?.connectionStatus);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load project list based on connection mode
  useEffect(() => {
    async function loadProjects() {
      try {
        if (connectionStatus === 'connected') {
          if (!currentUser) {
            dispatch(setProjects([]));
            return;
          }
          await projectRepository.migrateLegacyProjectsToUser(currentUser.username);
          const userProjects = await projectRepository.getByOwner(currentUser.username);
          dispatch(setProjects(userProjects));
        } else {
          // Offline mode: show ALL local projects
          const allProjects = await projectRepository.getAll();
          dispatch(setProjects(allProjects));
        }
      } catch (err) {
        console.error('Failed to load dashboard projects:', err);
      }
    }

    void loadProjects();
  }, [dispatch, currentUser, connectionStatus]);

  const handleCreateProject = async (name: string) => {
    const clientUuid: string = crypto.randomUUID();
    let projectId: string = clientUuid;
    let createdAt: number = Date.now();
    let updatedAt: number = Date.now();

    if (connectionStatus === 'connected') {
      try {
        const response = await projectsApi.createProjectWithId(clientUuid, name);
        if (response?.id) projectId = response.id;
        if (response?.updated_at) {
          createdAt = new Date(response.updated_at).getTime();
          updatedAt = createdAt;
        }
      } catch (err) {
        console.warn('Backend project creation failed, keeping client UUID for sync:', err);
      }
    }

    const newProject = {
      id: projectId,
      name,
      createdAt,
      updatedAt,
      ownerId: currentUser?.username || undefined
    };

    dispatch(addProject(newProject));
    window.location.hash = `#/project/${projectId}`;
  };

  const handleOpenProject = (projectId: string) => {
    window.location.hash = `#/project/${projectId}`;
  };

  const handleRenameProject = (id: string, name: string) => {
    dispatch(updateProjectName({ id, name }));
  };

  const handleDeleteProject = (id: string) => {
    dispatch(deleteProject(id));
  };

  return (
    <div className="dashboard-container">
      <main className="dashboard-content">
        <DashboardWelcome />
        <ProjectSearchBar
          searchQuery={searchQuery}
          totalProjects={projects.length}
          onSearchChange={setSearchQuery}
        />
        <ProjectGrid
          projects={projects}
          searchQuery={searchQuery}
          onOpenProject={handleOpenProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          onOpenCreateModal={() => setShowCreateModal(true)}
        />
      </main>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
};
