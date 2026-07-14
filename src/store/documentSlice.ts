import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Cell {
  id: string;
  content: string;
  title?: string;
}

export interface TypstFile {
  path: string; // e.g. 'main.typ', 'utils.typ'
  cells: Cell[];
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
}

const initialState: DocumentState = {
  title: 'Untitled Typst Document',
  files: {
    'main.typ': {
      path: 'main.typ',
      cells: [
        {
          id: 'cell-initial-1',
          content: '= Welcome to TypstLab\n\nThis is an interactive document editing platform. You can create cells of Typst markup.\n\n#pagebreak()',
          title: 'Welcome Section'
        },
        {
          id: 'cell-initial-2',
          content: '// Edit this Typst code\n#set text(fill: rgb("1c5a99"), size: 14pt)\n\nHello *TypstLab* from WebAssembly! ',
          title: 'Styling Example'
        }
      ]
    }
  },
  activeFilePath: 'main.typ',
  activeCellId: 'cell-initial-2',
  previewMode: 'side-by-side',
  isCompiling: false,
  connectionStatus: 'offline',
  compilerReady: false,
  compilerError: null
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
      if (activeFile) {
        const cell = activeFile.cells.find(c => c.id === id);
        if (cell) {
          cell.content = content;
        }
      }
    },
    updateCellTitle: (state, action: PayloadAction<{ id: string; title: string }>) => {
      const { id, title } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile) {
        const cell = activeFile.cells.find(c => c.id === id);
        if (cell) {
          cell.title = title;
        }
      }
    },
    addCell: (state, action: PayloadAction<{ index: number }>) => {
      const { index } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile) {
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
      if (activeFile) {
        activeFile.cells = activeFile.cells.filter(c => c.id !== id);
        if (state.activeCellId === id) {
          state.activeCellId = activeFile.cells[0]?.id || null;
        }
      }
    },
    moveCell: (state, action: PayloadAction<{ id: string; direction: 'up' | 'down' }>) => {
      const { id, direction } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (!activeFile) return;
      const index = activeFile.cells.findIndex(c => c.id === id);
      if (index === -1) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= activeFile.cells.length) return;
      
      const temp = activeFile.cells[index];
      activeFile.cells[index] = activeFile.cells[newIndex];
      activeFile.cells[newIndex] = temp;
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
    
    // Multi-file actions
    initializeProject: (state, action: PayloadAction<TypstFile[]>) => {
      const loadedFiles = action.payload;
      if (loadedFiles.length > 0) {
        state.files = {};
        loadedFiles.forEach(f => {
          state.files[f.path] = f;
        });
        
        const paths = Object.keys(state.files);
        if (!paths.includes(state.activeFilePath)) {
          state.activeFilePath = paths[0];
        }
        const activeFile = state.files[state.activeFilePath];
        state.activeCellId = activeFile?.cells[0]?.id || null;
      }
    },
    addFile: (state, action: PayloadAction<{ path: string }>) => {
      const { path } = action.payload;
      if (state.files[path]) return;
      state.files[path] = {
        path,
        cells: [
          {
            id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: `// ${path}\n`
          }
        ]
      };
      state.activeFilePath = path;
      state.activeCellId = state.files[path].cells[0].id;
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
          state.activeCellId = state.files[keys[0]].cells[0]?.id || null;
        } else {
          // Re-create default main.typ if all deleted
          const defaultPath = 'main.typ';
          state.files[defaultPath] = {
            path: defaultPath,
            cells: [{ id: 'cell-default-1', content: '= Welcome to TypstLab\n' }]
          };
          state.activeFilePath = defaultPath;
          state.activeCellId = 'cell-default-1';
        }
      }
    },
    setActiveFilePath: (state, action: PayloadAction<string>) => {
      state.activeFilePath = action.payload;
      const activeFile = state.files[action.payload];
      state.activeCellId = activeFile?.cells[0]?.id || null;
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
  setActiveFilePath
} = documentSlice.actions;

export default documentSlice.reducer;
