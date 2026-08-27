import React from 'react';
import { Plus, BookOpen } from 'lucide-react';
import type { TypstProject } from '../../core/types';
import { ProjectCard } from './ProjectCard';

interface ProjectGridProps {
  projects: TypstProject[];
  searchQuery: string;
  onOpenProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenCreateModal: () => void;
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  searchQuery,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onOpenCreateModal
}) => {
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="projects-grid">
      {/* Create New Project Card */}
      <div className="project-card create-card" onClick={onOpenCreateModal}>
        <div className="create-card-content">
          <div className="plus-circle">
            <Plus size={24} />
          </div>
          <h3>Create New Project</h3>
          <p>Start writing Typst from scratch</p>
        </div>
      </div>

      {/* Existing Project Cards */}
      {filteredProjects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onOpen={onOpenProject}
          onRename={onRenameProject}
          onDelete={onDeleteProject}
        />
      ))}

      {/* Empty State when search has no results */}
      {filteredProjects.length === 0 && searchQuery && (
        <div className="dashboard-empty-state">
          <div className="empty-icon">
            <BookOpen size={40} />
          </div>
          <h3>No projects found</h3>
          <p>No project matches your search query "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};
