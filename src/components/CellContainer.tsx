import React from 'react';
import { useAppDispatch } from '../store/hooks';
import { moveCell, deleteCell } from '../store/documentSlice';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { CellEditor } from './CellEditor';
import type { Cell } from '../store/documentSlice';

interface CellContainerProps {
  cell: Cell;
  index: number;
  isActive: boolean;
  onFocus: () => void;
}

export const CellContainer: React.FC<CellContainerProps> = ({ cell, index, isActive, onFocus }) => {
  const dispatch = useAppDispatch();

  return (
    <div className={`cell-container ${isActive ? 'focused' : ''}`}>
      <div className="cell-toolbar">
        <div className="toolbar-right-group">
          <button
            className="toolbar-btn"
            onClick={() => dispatch(moveCell({ id: cell.id, direction: 'up' }))}
            title="Move Cell Up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            className="toolbar-btn"
            onClick={() => dispatch(moveCell({ id: cell.id, direction: 'down' }))}
            title="Move Cell Down"
          >
            <ArrowDown size={14} />
          </button>
          <button
            className="toolbar-btn delete"
            onClick={() => dispatch(deleteCell(cell.id))}
            title="Delete Cell"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="cell-body">
        <CellEditor
          id={cell.id}
          content={cell.content}
          isActive={isActive}
          onFocus={onFocus}
          index={index}
        />
      </div>
    </div>
  );
};

