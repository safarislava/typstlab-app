import React, { useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { useAppDispatch, useAppSelector, updateCellContent, updateCellTitle } from '../store';
import { useLspExtensions } from '../lsp/lspManager';
import { createRemoteCursorsPlugin } from '../lsp/remoteCursorExtension';
import { intellijDarkTheme, typstHighlightLanguage } from '../lsp/typstHighlight';
import { globalEditorRegistry } from '../lsp/editorRegistry';
import { awarenessManager } from '../services';

interface CellEditorProps {
  id: string;
  content: string;
  title?: string;
  isActive: boolean;
  onFocus: () => void;
  index: number;
}

export const CellEditor: React.FC<CellEditorProps> = ({
  id,
  content,
  title,
  isActive,
  onFocus,
  index
}) => {
  const dispatch = useAppDispatch();
  const compilerError = useAppSelector((state) => state.compiler.compilerError);
  const files = useAppSelector((state) => state.editor.files);
  const activeFilePath = useAppSelector((state) => state.editor.activeFilePath);
  const collaborators = useAppSelector((state) => state.collaboration.collaborators);
  const activeFile = files[activeFilePath];
  const cells = activeFile && !activeFile.isBinary ? activeFile.cells : [];

  const handleCodeChange = (value: string) => {
    dispatch(updateCellContent({ id, content: value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateCellTitle({ id, title: e.target.value }));
  };

  const handleFocus = () => {
    onFocus();
    globalEditorRegistry.setActiveId(id);
    if (activeFile?.fileUuid) {
      awarenessManager.updateLocalCursor(activeFile.fileUuid, 0, 0);
    }
  };

  const handleEditorUpdate = (update: ViewUpdate) => {
    if (update.selectionSet && isActive && activeFile?.fileUuid) {
      const mainSel = update.state.selection.main;
      awarenessManager.updateLocalCursor(activeFile.fileUuid, mainSel.anchor, mainSel.head);
    }
  };

  // Keep registry updated
  useEffect(() => {
    if (isActive) {
      globalEditorRegistry.setActiveId(id);
    }
  }, [isActive, id]);

  useEffect(() => {
    return () => {
      globalEditorRegistry.unregister(id);
    };
  }, [id]);

  // Retrieve appropriate LSP extensions
  const lspExtensions = useLspExtensions(id, cells, compilerError, content);

  const remoteCursors = useMemo(() => {
    return createRemoteCursorsPlugin(Object.values(collaborators), activeFile?.fileUuid);
  }, [collaborators, activeFile?.fileUuid]);

  return (
    <div className={`code-cell ${isActive ? 'active' : ''}`} onClick={handleFocus}>
      <div className="cell-header-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div className="cell-lang-tag">Cell [{index}]</div>
        <span style={{ color: '#404249', fontSize: '10px' }}>|</span>
        <input
          type="text"
          className="cell-title-input"
          value={title || ''}
          onChange={handleTitleChange}
          placeholder="Section Title / Cell Note..."
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      
      <div className="codemirror-wrapper">
        <CodeMirror
          value={content}
          height="auto"
          theme={intellijDarkTheme}
          extensions={[
            typstHighlightLanguage,
            EditorView.lineWrapping,
            ...lspExtensions,
            remoteCursors
          ]}
          onChange={handleCodeChange}
          onUpdate={handleEditorUpdate}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: true,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightActiveLine: isActive,
            highlightSelectionMatches: true,
            tabSize: 2,
          }}
          onCreateEditor={(view) => {
            globalEditorRegistry.register(id, view);
          }}
        />
      </div>
    </div>
  );
};
