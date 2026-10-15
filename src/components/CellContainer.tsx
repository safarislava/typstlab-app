import React from 'react';
import { useAppDispatch, moveCell, deleteCell, updateCellTitle } from '../store';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { CellEditor } from './CellEditor';
import type { Cell } from '../core/types';

interface CellContainerProps {
  cell: Cell;
  index: number;
  isActive: boolean;
  onFocus: () => void;
}

export const CellContainer: React.FC<CellContainerProps> = ({ cell, index, isActive, onFocus }) => {
  const dispatch = useAppDispatch();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateCellTitle({ id: cell.id, title: e.target.value }));
  };

  return (
    <div 
      id={`cell-container-${cell.id}`} 
      className={`cell-container ${isActive ? 'focused' : ''}`}
      onClick={onFocus}
    >
      <div className="cell-toolbar">
        <div className="toolbar-left-group">
          <span className="cell-lang-tag">Cell {index}</span>
          <span className="toolbar-separator">|</span>
          <input
            type="text"
            className="cell-title-input"
            value={cell.title || ''}
            onChange={handleTitleChange}
            placeholder="Title..."
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="toolbar-right-group">
          <button
            className="toolbar-btn"
            onClick={() => dispatch(moveCell({ id: cell.id, direction: 'up' }))}
            title="Move Cell Up"
          >
            <ArrowUp size={13} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => dispatch(moveCell({ id: cell.id, direction: 'down' }))}
            title="Move Cell Down"
          >
            <ArrowDown size={13} />
          </button>
          <button
            className="toolbar-btn delete"
            onClick={() => dispatch(deleteCell(cell.id))}
            title="Delete Cell"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="cell-body">
        <CellEditor
          id={cell.id}
          content={cell.content}
          title={cell.title}
          isActive={isActive}
          onFocus={onFocus}
          index={index}
        />
      </div>
    </div>
  );
};
