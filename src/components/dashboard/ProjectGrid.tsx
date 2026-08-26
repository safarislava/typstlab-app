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
      <button className="project-card create-card" onClick={onOpenCreateModal}>
        <div className="create-card-icon">
          <Plus size={28} />
        </div>
        <span className="create-card-title">Create New Project</span>
        <span className="create-card-desc">Start writing Typst from scratch</span>
      </button>

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
        <div className="empty-search-state">
          <BookOpen size={48} />
          <h3>No projects found</h3>
          <p>No project matches your search query "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};
