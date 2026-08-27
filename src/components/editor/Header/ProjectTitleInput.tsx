import React from 'react';
import { useAppSelector, useAppDispatch, updateProjectName, setTitle } from '../../../store';

export const ProjectTitleInput: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentProjectId = useAppSelector(state => state.projects.currentProjectId);
  const projects = useAppSelector(state => state.projects.projects);
  const fallbackTitle = useAppSelector(state => state.editor.title);

  const activeProject = projects.find(p => p.id === currentProjectId);
  const title = activeProject ? activeProject.name : fallbackTitle;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (currentProjectId) {
      dispatch(updateProjectName({ id: currentProjectId, name: newName }));
    }
    dispatch(setTitle(newName));
  };

  return (
    <div className="project-title-container">
      <input
        type="text"
        className="header-title-input"
        value={title}
        onChange={handleChange}
        placeholder="Untitled Document"
      />
    </div>
  );
};
