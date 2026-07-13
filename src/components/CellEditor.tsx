import React, { useEffect, useRef } from 'react';
import { useAppDispatch } from '../store/hooks';
import { updateCellContent } from '../store/documentSlice';

interface CellEditorProps {
  id: string;
  content: string;
  isActive: boolean;
  onFocus: () => void;
  index: number;
}

export const CellEditor: React.FC<CellEditorProps> = ({ id, content, isActive, onFocus, index }) => {
  const dispatch = useAppDispatch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch(updateCellContent({ id, content: e.target.value }));
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
      <div className="cell-lang-tag">Cell [{index}]</div>
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

