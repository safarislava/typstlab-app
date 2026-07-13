import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateCellContent, updateCellTitle } from '../store/documentSlice';
import { useLspExtensions } from '../lsp/lspManager';
import { intellijDarkTheme, typstHighlightLanguage } from '../lsp/typstHighlight';

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
  const compilerError = useAppSelector((state) => state.document.compilerError);
  const cells = useAppSelector((state) => state.document.cells);

  const handleCodeChange = (value: string) => {
    dispatch(updateCellContent({ id, content: value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateCellTitle({ id, title: e.target.value }));
  };

  // Retrieve appropriate LSP extensions (automatically swaps between online WebSocket and offline fallback)
  const lspExtensions = useLspExtensions(id, cells, compilerError, content);

  return (
    <div className={`code-cell ${isActive ? 'active' : ''}`} onClick={onFocus}>
      <div className="cell-header-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div className="cell-lang-tag">Cell [{index}]</div>
        <span style={{ color: '#404249', fontSize: '10px' }}>|</span>
        <input
          type="text"
          className="cell-title-input"
          value={title || ''}
          onChange={handleTitleChange}
          onFocus={onFocus}
          placeholder="Unnamed Block"
          spellCheck={false}
        />
      </div>
      
      <div className="editor-wrapper" style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <CodeMirror
          value={content}
          height="auto"
          theme={intellijDarkTheme}
          extensions={[typstHighlightLanguage, ...lspExtensions]}
          onChange={handleCodeChange}
          onFocus={onFocus}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: true,
            tabSize: 2,
          }}
          style={{ fontSize: '13px', fontFamily: 'Fira Code, monospace' }}
        />
      </div>
    </div>
  );
};
