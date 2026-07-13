import React, { useEffect, useRef } from 'react';
import { useAppDispatch } from '../store/hooks';
import { updateCellContent, updateCellTitle } from '../store/documentSlice';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(updateCellContent({ id, content: e.target.value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateCellTitle({ id, title: e.target.value }));
  };

  // Adjust textarea height to match content scrollHeight
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [content]);

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
      <textarea
        ref={textareaRef}
        className="code-editor-textarea"
        value={content}
        onChange={handleChange}
        onFocus={onFocus}
        placeholder="// Write Typst here..."
        spellCheck={false}
        rows={1}
      />
    </div>
  );
};
