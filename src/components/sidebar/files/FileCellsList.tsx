import React from 'react';
import type { Cell } from '../../../store/documentSlice';

interface FileCellsListProps {
  cells: Cell[];
  activeCellId: string | null;
  onOutlineClick: (cellId: string) => void;
}

export const FileCellsList: React.FC<FileCellsListProps> = ({
  cells,
  activeCellId,
  onOutlineClick
}) => {
  return (
    <div className="file-sub-tree">
      {cells.map((cell, index) => (
        <div
          key={cell.id}
          className={`cell-link-item ${activeCellId === cell.id ? 'active' : ''}`}
          onClick={() => onOutlineClick(cell.id)}
        >
          <span className="cell-bullet"></span>
          <span className="cell-link-text">
            {cell.title ? `${index + 1}. ${cell.title}` : `Cell ${index + 1}`}
          </span>
        </div>
      ))}
    </div>
  );
};
