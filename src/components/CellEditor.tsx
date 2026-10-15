import React, { useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { useAppDispatch, useAppSelector, updateCellContent, updateCellTitle } from '../store';
import { useLspExtensions } from '../lsp/lspManager';
import { createRemoteCursorsPlugin } from '../lsp/remoteCursorExtension';
import { intellijDarkTheme, typstHighlightLanguage } from '../lsp/typstHighlight';
import { globalEditorRegistry } from '../lsp/editorRegistry';
import { awarenessManager } from '../services';
import type { WSUserPresence } from '../core/types';

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
    const view = globalEditorRegistry.get(id);
    if (view && activeFile?.fileUuid) {
      const sel = view.state.selection.main;
      awarenessManager.updateLocalCursor(activeFile.fileUuid, sel.anchor, sel.head, id);
    }
  };

  const handleEditorUpdate = (update: ViewUpdate) => {
    if (update.view.hasFocus) {
      if (!isActive) {
        onFocus();
        globalEditorRegistry.setActiveId(id);
      }
      if (activeFile?.fileUuid && (update.selectionSet || update.focusChanged)) {
        const mainSel = update.state.selection.main;
        awarenessManager.updateLocalCursor(activeFile.fileUuid, mainSel.anchor, mainSel.head, id);
      }
    } else if (isActive && update.selectionSet && activeFile?.fileUuid) {
      const mainSel = update.state.selection.main;
      awarenessManager.updateLocalCursor(activeFile.fileUuid, mainSel.anchor, mainSel.head, id);
    }
  };

  // Keep registry updated and track local cursor position without resetting to 0
  useEffect(() => {
    if (isActive) {
      globalEditorRegistry.setActiveId(id);
      const view = globalEditorRegistry.get(id);
      if (view && activeFile?.fileUuid) {
        const sel = view.state.selection.main;
        awarenessManager.updateLocalCursor(activeFile.fileUuid, sel.anchor, sel.head, id);
      }
    }
  }, [isActive, id, activeFile?.fileUuid]);

  useEffect(() => {
    return () => {
      globalEditorRegistry.unregister(id);
    };
  }, [id]);

  // Retrieve appropriate LSP extensions
  const lspExtensions = useLspExtensions(id, cells, compilerError, content);

  const showSelfCursor = useAppSelector((state) => state.collaboration.showSelfCursor);
  const localPresence = useAppSelector((state) => state.collaboration.localPresence);
  const currentUser = useAppSelector((state) => state.auth.currentUser);
  const currentEmail = currentUser?.email;

  const remoteCursors = useMemo(() => {
    const list: WSUserPresence[] = Object.values(collaborators).filter(c => {
      if (currentEmail && c.email?.toLowerCase() === currentEmail.toLowerCase()) {
        return false;
      }
      return true;
    });

    if (showSelfCursor && localPresence) {
      list.push(localPresence);
    }

    return createRemoteCursorsPlugin(
      list, 
      activeFile?.fileUuid, 
      id, 
      showSelfCursor ? undefined : currentEmail
    );
  }, [collaborators, localPresence, activeFile?.fileUuid, id, currentEmail, showSelfCursor]);

  return (
    <div className={`code-cell ${isActive ? 'active' : ''}`} onClick={handleFocus}>
      <div className="cell-header-row">
        <div className="cell-lang-tag">Cell [{index}]</div>
        <span style={{ color: '#404249', fontSize: '9px' }}>|</span>
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
          onFocus={handleFocus}
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
