import React from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { addCell, setActiveCellId } from '../store/documentSlice';
import { CellContainer } from './CellContainer';
import { Plus } from 'lucide-react';

export const CellList: React.FC = () => {
  const { cells, activeCellId } = useAppSelector((state) => state.document);
  const dispatch = useAppDispatch();

  const handleAddCell = (index: number) => {
    dispatch(addCell({ index }));
  };

  const handleFocusCell = (id: string) => {
    dispatch(setActiveCellId(id));
  };

  // Renders the horizontal divider button for inserting cells
  const renderCellDivider = (index: number) => {
    return (
      <div className="cell-divider">
        <div className="divider-line"></div>
        <div className="divider-buttons">
          <button 
            className="divider-btn code" 
            onClick={() => handleAddCell(index)}
          >
            <Plus size={12} />
            <span>Add Cell</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="cell-list">
      {/* Divider at the very top (index 0) */}
      {renderCellDivider(0)}

      {cells.map((cell, index) => (
        <React.Fragment key={cell.id}>
          <CellContainer
            cell={cell}
            index={index + 1}
            isActive={cell.id === activeCellId}
            onFocus={() => handleFocusCell(cell.id)}
          />
          {/* Divider after this cell */}
          {renderCellDivider(index + 1)}
        </React.Fragment>
      ))}

      {cells.length === 0 && (
        <div className="empty-state">
          <p>No cells in this document. Create a cell to get started!</p>
          <div className="empty-state-buttons">
            <button className="btn btn-primary" onClick={() => handleAddCell(0)}>
              <Plus size={16} />
              <span>Add Cell</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

