import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TypstProject } from '../../core/types';

interface ProjectsState {
  projects: TypstProject[];
  currentProjectId: string | null;
  searchQuery: string;
}

const initialState: ProjectsState = {
  projects: [],
  currentProjectId: null,
  searchQuery: ''
};

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects(state, action: PayloadAction<TypstProject[]>) {
      state.projects = action.payload;
    },
    setCurrentProjectId(state, action: PayloadAction<string | null>) {
      state.currentProjectId = action.payload;
    },
    addProject(state, action: PayloadAction<TypstProject>) {
      state.projects.push(action.payload);
    },
    deleteProject(state, action: PayloadAction<string>) {
      state.projects = state.projects.filter(p => p.id !== action.payload);
      if (state.currentProjectId === action.payload) {
        state.currentProjectId = null;
      }
    },
    updateProjectName(state, action: PayloadAction<{ id: string; name: string }>) {
      const { id, name } = action.payload;
      const project = state.projects.find(p => p.id === id);
      if (project) {
        project.name = name;
        project.updatedAt = Date.now();
      }
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    }
  }
});

export const {
  setProjects,
  setCurrentProjectId,
  addProject,
  deleteProject,
  updateProjectName,
  setSearchQuery
} = projectsSlice.actions;

export default projectsSlice.reducer;
