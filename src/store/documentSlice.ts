import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface Cell {
  id: string;
  content: string;
}

interface DocumentState {
  title: string;
  cells: Cell[];
  activeCellId: string | null;
  previewMode: 'side-by-side' | 'preview-only' | 'edit-only';
  isCompiling: boolean;
  connectionStatus: 'connected' | 'connecting' | 'offline';
  compilerReady: boolean;
  compilerError: string | null;
}

const initialState: DocumentState = {
  title: 'Untitled Typst Document',
  cells: [
    {
      id: 'cell-initial-1',
      content: '= Welcome to TypstLab\n\nThis is an interactive document editing platform. You can create cells of Typst markup.'
    },
    {
      id: 'cell-initial-2',
      content: '// Edit this Typst code\n#set page(width: 10cm, height: auto, margin: 1cm)\n#set text(fill: rgb("1c5a99"), size: 14pt)\n\nHello *TypstLab* from WebAssembly!'
    }
  ],
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
      const cell = state.cells.find(c => c.id === id);
      if (cell) {
        cell.content = content;
      }
    },
    addCell: (state, action: PayloadAction<{ index: number }>) => {
      const { index } = action.payload;
      const newCell: Cell = {
        id: `cell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: ''
      };
      state.cells.splice(index, 0, newCell);
      state.activeCellId = newCell.id;
    },
    deleteCell: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      state.cells = state.cells.filter(c => c.id !== id);
      if (state.activeCellId === id) {
        state.activeCellId = state.cells[0]?.id || null;
      }
    },
    moveCell: (state, action: PayloadAction<{ id: string; direction: 'up' | 'down' }>) => {
      const { id, direction } = action.payload;
      const index = state.cells.findIndex(c => c.id === id);
      if (index === -1) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= state.cells.length) return;
      
      const temp = state.cells[index];
      state.cells[index] = state.cells[newIndex];
      state.cells[newIndex] = temp;
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
    }
  }
});

export const {
  setTitle,
  updateCellContent,
  addCell,
  deleteCell,
  moveCell,
  setActiveCellId,
  setPreviewMode,
  setIsCompiling,
  setConnectionStatus,
  setCompilerReady,
  setCompilerError
} = documentSlice.actions;

export default documentSlice.reducer;

