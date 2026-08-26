import React from 'react';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { updateProjectName } from '../../../store/slices/projectsSlice';
import { setTitle } from '../../../store/slices/editorSlice';

export const ProjectTitleInput: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentProjectId = useAppSelector(state => state.projects?.currentProjectId || state.document?.currentProjectId);
  const projects = useAppSelector(state => state.projects?.projects || state.document?.projects);
  const fallbackTitle = useAppSelector(state => state.editor?.title || state.document?.title);

  const activeProject = projects.find(p => p.id === currentProjectId);
  const title = activeProject ? activeProject.name : fallbackTitle;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    if (currentProjectId) {
      dispatch(updateProjectName({ id: currentProjectId, name: newName }));
    } else {
      dispatch(setTitle(newName));
    }
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
