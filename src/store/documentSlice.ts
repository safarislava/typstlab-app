import type {PayloadAction} from '@reduxjs/toolkit';
import {createSlice} from '@reduxjs/toolkit';
import type { TypstProject } from './db';

export interface Cell {
  id: string;
  content: string;
  title?: string;
}

export interface TextTypstFile {
  path: string;
  isBinary?: false;
  cells: Cell[];
}

export interface BinaryTypstFile {
  path: string;
  isBinary: true;
  binaryData: Uint8Array;
}

export type TypstFile = TextTypstFile | BinaryTypstFile;

export interface User {
  username: string;
  email?: string;
  fullName?: string;
}

interface DocumentState {
  title: string;
  files: Record<string, TypstFile>;
  activeFilePath: string;
  activeCellId: string | null;
  previewMode: 'side-by-side' | 'preview-only' | 'edit-only';
  isCompiling: boolean;
  connectionStatus: 'connected' | 'connecting' | 'offline';
  compilerReady: boolean;
  compilerError: string | null;
  currentProjectId: string | null;
  projects: TypstProject[];
  screen: 'dashboard' | 'editor' | 'login' | 'register';
  currentUser: User | null;
}

const getStoredUser = (): User | null => {
  try {
    const userJson = localStorage.getItem('typstlab_user');
    return userJson ? JSON.parse(userJson) : null;
  } catch {
    return null;
  }
};

const storedUser = getStoredUser();

const initialState: DocumentState = {
  title: 'Untitled Typst Document',
  files: {},
  activeFilePath: '',
  activeCellId: null,
  previewMode: 'side-by-side',
  isCompiling: false,
  connectionStatus: 'offline',
  compilerReady: false,
  compilerError: null,
  currentProjectId: null,
  projects: [],
  screen: storedUser ? 'dashboard' : 'login',
  currentUser: storedUser
};

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setTitle: (state, action: PayloadAction<string>) => {
      state.title = action.payload;
    },
    updateCellContent: (state, action: PayloadAction<{ id: string; content: string }>) => {
      const { id, content } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        const cell = activeFile.cells.find(c => c.id === id);
        if (cell) {
          cell.content = content;
        }
      }
    },
    updateCellTitle: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const { id, title } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        const cell = activeFile.cells.find(c => c.id === id);
        if (cell) {
          cell.title = title;
        }
      }
    },
    addCell: (state, action: PayloadAction<{ index: number }>) => {
      const { index } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        const newCell: Cell = {
          id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: ''
        };
        activeFile.cells.splice(index, 0, newCell);
        state.activeCellId = newCell.id;
      }
    },
    deleteCell: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        activeFile.cells = activeFile.cells.filter(c => c.id !== id);
        if (state.activeCellId === id) {
          state.activeCellId = activeFile.cells[0]?.id || null;
        }
      }
    },
    moveCell: (state, action: PayloadAction<{ id: string; direction: 'up' | 'down' }>) => {
      const { id, direction } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        const index = activeFile.cells.findIndex(c => c.id === id);
        if (index === -1) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= activeFile.cells.length) return;
        
        const temp = activeFile.cells[index];
        activeFile.cells[index] = activeFile.cells[newIndex];
        activeFile.cells[newIndex] = temp;
      }
    },
    setActiveCellId: (state, action: PayloadAction<string | null>) => {
      state.activeCellId = action.payload;
    },
    setPreviewMode: (state, action: PayloadAction<'side-by-side' | 'preview-only' | 'edit-only'>) => {
      state.previewMode = action.payload;
    },
    setIsCompiling: (state, action: PayloadAction<boolean>) => {
      state.isCompiling = action.payload;
    },
    setConnectionStatus: (state, action: PayloadAction<'connected' | 'connecting' | 'offline'>) => {
      state.connectionStatus = action.payload;
    },
    setCompilerReady: (state, action: PayloadAction<boolean>) => {
      state.compilerReady = action.payload;
    },
    setCompilerError: (state, action: PayloadAction<string | null>) => {
      state.compilerError = action.payload;
    },
    
    // Projects actions
    setProjects: (state, action: PayloadAction<TypstProject[]>) => {
      state.projects = action.payload;
    },
    setCurrentProjectId: (state, action: PayloadAction<string | null>) => {
      state.currentProjectId = action.payload;
      const isOffline = state.connectionStatus === 'offline';
      if (action.payload === null) {
        state.screen = (isOffline || state.currentUser) ? 'dashboard' : 'login';
        state.files = {};
        state.activeFilePath = '';
        state.activeCellId = null;
      } else {
        state.screen = (isOffline || state.currentUser) ? 'editor' : 'login';
      }
    },
    addProject: (state, action: PayloadAction<TypstProject>) => {
      state.projects.push(action.payload);
    },
    deleteProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter(p => p.id !== action.payload);
      if (state.currentProjectId === action.payload) {
        state.currentProjectId = null;
        const isOffline = state.connectionStatus === 'offline';
        state.screen = (isOffline || state.currentUser) ? 'dashboard' : 'login';
        state.files = {};
        state.activeFilePath = '';
        state.activeCellId = null;
      }
    },
    updateProjectName: (state, action: PayloadAction<{ id: string; name: string }>) => {
      const { id, name } = action.payload;
      const project = state.projects.find(p => p.id === id);
      if (project) {
        project.name = name;
        project.updatedAt = Date.now();
      }
    },
    setScreen: (state, action: PayloadAction<'dashboard' | 'editor' | 'login' | 'register'>) => {
      state.screen = action.payload;
    },
    loginUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.screen = 'dashboard';
      localStorage.setItem('typstlab_user', JSON.stringify(action.payload));
    },
    logoutUser: (state) => {
      state.currentUser = null;
      state.screen = 'login';
      state.currentProjectId = null;
      state.files = {};
      state.activeFilePath = '';
      state.activeCellId = null;
      localStorage.removeItem('typstlab_user');
    },
    
    // Multi-file actions
    initializeProject: (state, action: PayloadAction<TypstFile[]>) => {
      const loadedFiles = action.payload;
      state.files = {};
      if (loadedFiles.length > 0) {
        loadedFiles.forEach(f => {
          state.files[f.path] = f;
        });
      } else {
        // Initialize default main.typ if empty
        const defaultPath = 'main.typ';
        state.files[defaultPath] = {
          path: defaultPath,
          isBinary: false,
          cells: [
            {
              id: `cell-default-1`,
              content: '= Welcome to TypstLab\n\nThis is your new project. Start editing!\n',
              title: 'Welcome'
            }
          ]
        };
      }
      const paths = Object.keys(state.files);
      state.activeFilePath = paths[0] || 'main.typ';
      const activeFile = state.files[state.activeFilePath];
      state.activeCellId = (activeFile && !activeFile.isBinary) ? activeFile.cells[0]?.id || null : null;
    },
    addFile: (state, action: PayloadAction<{ path: string }>) => {
      const { path } = action.payload;
      if (state.files[path]) return;
      const newFile: TextTypstFile = {
        path,
        isBinary: false,
        cells: [
          {
            id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: `// ${path}\n`
          }
        ]
      };
      state.files[path] = newFile;
      state.activeFilePath = path;
      state.activeCellId = newFile.cells[0].id;
    },
    renameFile: (state, action: PayloadAction<{ oldPath: string; newPath: string }>) => {
      const { oldPath, newPath } = action.payload;
      if (!state.files[oldPath] || state.files[newPath]) return;
      const file = state.files[oldPath];
      file.path = newPath;
      state.files[newPath] = file;
      delete state.files[oldPath];
      if (state.activeFilePath === oldPath) {
        state.activeFilePath = newPath;
      }
    },
    deleteFile: (state, action: PayloadAction<string>) => {
      const path = action.payload;
      delete state.files[path];
      if (state.activeFilePath === path) {
        const keys = Object.keys(state.files);
        if (keys.length > 0) {
          state.activeFilePath = keys[0];
          const activeFile = state.files[keys[0]];
          state.activeCellId = (activeFile && !activeFile.isBinary) ? activeFile.cells[0]?.id || null : null;
        } else {
          // Re-create default main.typ if all deleted
          const defaultPath = 'main.typ';
          state.files[defaultPath] = {
            path: defaultPath,
            isBinary: false,
            cells: [{id: 'cell-default-1', content: '= Welcome to TypstLab\n'}]
          };
          state.activeFilePath = defaultPath;
          state.activeCellId = 'cell-default-1';
        }
      }
    },
    setActiveFilePath: (state, action: PayloadAction<string>) => {
      state.activeFilePath = action.payload;
      const activeFile = state.files[action.payload];
      state.activeCellId = (activeFile && !activeFile.isBinary) ? activeFile.cells[0]?.id || null : null;
    },
    addBinaryFile: (state, action: PayloadAction<{ path: string; binaryData: Uint8Array }>) => {
      const { path, binaryData } = action.payload;
      state.files[path] = {
        path,
        isBinary: true,
        binaryData
      };
    },
    addTextFileWithContent: (state, action: PayloadAction<{ path: string; content: string }>) => {
      const { path, content } = action.payload;
      const newFile: TextTypstFile = {
        path,
        isBinary: false,
        cells: [
          {
            id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            title: 'Imported Content'
          }
        ]
      };
      state.files[path] = newFile;
      state.activeFilePath = path;
      state.activeCellId = newFile.cells[0].id;
    }
  }
});

export const {
  setTitle,
  updateCellContent,
  updateCellTitle,
  addCell,
  deleteCell,
  moveCell,
  setActiveCellId,
  setPreviewMode,
  setIsCompiling,
  setConnectionStatus,
  setCompilerReady,
  setCompilerError,
  initializeProject,
  addFile,
  renameFile,
  deleteFile,
  setActiveFilePath,
  addBinaryFile,
  addTextFileWithContent,
  setProjects,
  setCurrentProjectId,
  addProject,
  deleteProject,
  updateProjectName,
  setScreen,
  loginUser,
  logoutUser
} = documentSlice.actions;

export default documentSlice.reducer;
