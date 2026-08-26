import type {PayloadAction} from '@reduxjs/toolkit';
import {createSlice} from '@reduxjs/toolkit';
import type {TypstProject} from './db';
import {parseXmlToCells} from '../utils/xmlSerializer';
import {api} from '../utils/api';


export interface Cell {
  id: string;
  content: string;
  title?: string;
}

export interface TextTypstFile {
  path: string;
  isBinary?: false;
  cells: Cell[];
  fileUuid?: string;
}

export interface BinaryTypstFile {
  path: string;
  isBinary: true;
  binaryData: Uint8Array;
  fileUuid?: string;
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

const isInitiallyOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;
const storedUser = getStoredUser();

const initialState: DocumentState = {
  title: 'Untitled Typst Document',
  files: {},
  activeFilePath: '',
  activeCellId: null,
  previewMode: 'side-by-side',
  isCompiling: false,
  connectionStatus: isInitiallyOffline ? 'offline' : 'connected',
  compilerReady: false,
  compilerError: null,
  currentProjectId: null,
  projects: [],
  screen: (storedUser || isInitiallyOffline) ? 'dashboard' : 'login',
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
          id: crypto.randomUUID(),
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
      if (action.payload === 'connected' && !state.currentUser) {
        if (state.screen !== 'login' && state.screen !== 'register') {
          state.screen = 'login';
          state.currentProjectId = null;
          state.files = {};
          state.activeFilePath = '';
          state.activeCellId = null;
        }
      } else if (action.payload === 'offline') {
        if (state.screen === 'login' || state.screen === 'register') {
          state.screen = state.currentProjectId ? 'editor' : 'dashboard';
        }
        if (typeof window !== 'undefined' && (window.location.hash === '#/login' || window.location.hash === '#/register')) {
          window.location.hash = state.currentProjectId ? `#/project/${state.currentProjectId}` : '#/';
        }
      }
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
        if (isOffline) {
          state.screen = 'dashboard';
        } else if (state.screen !== 'login' && state.screen !== 'register') {
          state.screen = state.currentUser ? 'dashboard' : 'login';
        }
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
      if (state.connectionStatus === 'offline' && (action.payload === 'login' || action.payload === 'register')) {
        state.screen = state.currentProjectId ? 'editor' : 'dashboard';
        if (typeof window !== 'undefined' && (window.location.hash === '#/login' || window.location.hash === '#/register')) {
          window.location.hash = state.currentProjectId ? `#/project/${state.currentProjectId}` : '#/';
        }
        return;
      }
      state.screen = action.payload;
    },
    loginUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.screen = 'dashboard';
      localStorage.setItem('typstlab_user', JSON.stringify(action.payload));
      window.location.hash = '#/';
    },
    logoutUser: (state) => {
      state.currentUser = null;
      localStorage.removeItem('typstlab_user');
      api.setToken(null);
      if (state.connectionStatus === 'offline') {
        state.screen = state.currentProjectId ? 'editor' : 'dashboard';
        if (typeof window !== 'undefined' && (window.location.hash === '#/login' || window.location.hash === '#/register')) {
          window.location.hash = state.currentProjectId ? `#/project/${state.currentProjectId}` : '#/';
        }
      } else {
        state.screen = 'login';
        state.currentProjectId = null;
        state.files = {};
        state.activeFilePath = '';
        state.activeCellId = null;
        window.location.hash = '#/login';
      }
    },
    
    // Multi-file actions
    initializeProject: (state, action: PayloadAction<TypstFile[]>) => {
      const loadedFiles = action.payload;
      state.files = {};
      if (loadedFiles.length > 0) {
        loadedFiles.forEach(f => {
          if (!f.isBinary && f.cells) {
            const seenCellIds = new Set<string>();
            f.cells = f.cells.filter(c => {
              if (!c.id || seenCellIds.has(c.id)) return false;
              seenCellIds.add(c.id);
              return true;
            });
          }
          state.files[f.path] = f;
        });
      }
      const paths = Object.keys(state.files);
      state.activeFilePath = paths[0] || '';
      const activeFile = state.files[state.activeFilePath];
      state.activeCellId = (activeFile && !activeFile.isBinary) ? activeFile.cells[0]?.id || null : null;
    },
    addFile: (state, action: PayloadAction<{ path: string }>) => {
      const { path } = action.payload;
      if (state.files[path]) return;
      const newFile: TextTypstFile = {
        path,
        isBinary: false,
        fileUuid: crypto.randomUUID(),
        cells: [
          {
            id: crypto.randomUUID(),
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
          state.activeFilePath = '';
          state.activeCellId = null;
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
        fileUuid: crypto.randomUUID(),
        binaryData
      };
    },
    addTextFileWithContent: (state, action: PayloadAction<{ path: string; content: string }>) => {
      const { path, content } = action.payload;
      let cells: Cell[];
      
      if (path.endsWith('.typxml')) {
        try {
          cells = parseXmlToCells(content);
        } catch (err) {
          console.warn('Failed to parse XML blocks, falling back to plain text:', err);
          cells = [
            {
              id: crypto.randomUUID(),
              content,
              title: 'Imported Content'
            }
          ];
        }
      } else {
        cells = [
          {
            id: crypto.randomUUID(),
            content,
            title: 'Imported Content'
          }
        ];
      }

      state.files[path] = {
        path,
        isBinary: false,
        fileUuid: crypto.randomUUID(),
        cells
      };
      state.activeFilePath = path;
      state.activeCellId = cells.length > 0 ? cells[0].id : null;
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
