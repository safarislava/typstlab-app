import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Cell, TypstFile, TextTypstFile, PreviewMode } from '../../core/types';
import { parseXmlToCells } from '../../utils/xmlSerializer';

interface EditorState {
  title: string;
  files: Record<string, TypstFile>;
  activeFilePath: string;
  activeCellId: string | null;
  previewMode: PreviewMode;
}

const initialState: EditorState = {
  title: 'Untitled Typst Document',
  files: {},
  activeFilePath: '',
  activeCellId: null,
  previewMode: 'side-by-side'
};

export const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setTitle(state, action: PayloadAction<string>) {
      state.title = action.payload;
    },
    updateCellContent(state, action: PayloadAction<{ id: string; content: string }>) {
      const { id, content } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        const cell = activeFile.cells.find(c => c.id === id);
        if (cell) {
          cell.content = content;
        }
      }
    },
    updateCellTitle(state, action: PayloadAction<{ id: string; title: string }>) {
      const { id, title } = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        const cell = activeFile.cells.find(c => c.id === id);
        if (cell) {
          cell.title = title;
        }
      }
    },
    addCell(state, action: PayloadAction<{ index: number }>) {
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
    deleteCell(state, action: PayloadAction<string>) {
      const id = action.payload;
      const activeFile = state.files[state.activeFilePath];
      if (activeFile && !activeFile.isBinary) {
        activeFile.cells = activeFile.cells.filter(c => c.id !== id);
        if (state.activeCellId === id) {
          state.activeCellId = activeFile.cells[0]?.id || null;
        }
      }
    },
    moveCell(state, action: PayloadAction<{ id: string; direction: 'up' | 'down' }>) {
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
    setActiveCellId(state, action: PayloadAction<string | null>) {
      state.activeCellId = action.payload;
    },
    setPreviewMode(state, action: PayloadAction<PreviewMode>) {
      state.previewMode = action.payload;
    },
    initializeProject(state, action: PayloadAction<TypstFile[]>) {
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
      state.activeCellId = activeFile && !activeFile.isBinary ? activeFile.cells[0]?.id || null : null;
    },
    addFile(state, action: PayloadAction<{ path: string }>) {
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
    renameFile(state, action: PayloadAction<{ oldPath: string; newPath: string }>) {
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
    deleteFile(state, action: PayloadAction<string>) {
      const path = action.payload;
      delete state.files[path];
      if (state.activeFilePath === path) {
        const keys = Object.keys(state.files);
        if (keys.length > 0) {
          state.activeFilePath = keys[0];
          const activeFile = state.files[keys[0]];
          state.activeCellId = activeFile && !activeFile.isBinary ? activeFile.cells[0]?.id || null : null;
        } else {
          state.activeFilePath = '';
          state.activeCellId = null;
        }
      }
    },
    setActiveFilePath(state, action: PayloadAction<string>) {
      state.activeFilePath = action.payload;
      const activeFile = state.files[action.payload];
      state.activeCellId = activeFile && !activeFile.isBinary ? activeFile.cells[0]?.id || null : null;
    },
    addBinaryFile(state, action: PayloadAction<{ path: string; binaryData: Uint8Array }>) {
      const { path, binaryData } = action.payload;
      state.files[path] = {
        path,
        isBinary: true,
        fileUuid: crypto.randomUUID(),
        binaryData
      };
    },
    addTextFileWithContent(state, action: PayloadAction<{ path: string; content: string }>) {
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
    },
    resetEditor(state) {
      state.files = {};
      state.activeFilePath = '';
      state.activeCellId = null;
      state.title = 'Untitled Typst Document';
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
  initializeProject,
  addFile,
  renameFile,
  deleteFile,
  setActiveFilePath,
  addBinaryFile,
  addTextFileWithContent,
  resetEditor
} = editorSlice.actions;

export default editorSlice.reducer;
