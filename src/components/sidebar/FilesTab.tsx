import React from 'react';
import { useAppSelector } from '../../store/hooks';
import { FileText } from 'lucide-react';

interface FilesTabProps {
  onOutlineClick: (cellId: string) => void;
}

export const FilesTab: React.FC<FilesTabProps> = ({ onOutlineClick }) => {
  const { cells, activeCellId } = useAppSelector((state) => state.document);

  return (
    <div className="pane-content">
      <div className="pane-header">Files</div>
      <div className="file-tree">
        <div className="file-item active">
          <FileText size={16} className="file-icon" />
          <span>main.typ</span>
        </div>
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
      </div>
    </div>
  );
};
