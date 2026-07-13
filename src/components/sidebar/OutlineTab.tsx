import React from 'react';
import { useAppSelector } from '../../store/hooks';

interface OutlineTabProps {
  onOutlineClick: (cellId: string) => void;
}

interface OutlineItem {
  cellId: string;
  text: string;
  level: number;
}

export const OutlineTab: React.FC<OutlineTabProps> = ({ onOutlineClick }) => {
  const { cells } = useAppSelector((state) => state.document);

  const extractOutline = (): OutlineItem[] => {
    const items: OutlineItem[] = [];
    cells.forEach((cell) => {
      const lines = cell.content.split('\n');
      lines.forEach((line) => {
        const match = line.match(/^(=+)\s+(.+)$/);
        if (match) {
          items.push({
            cellId: cell.id,
            text: match[2].replace(/[*_]/g, '').trim(),
            level: match[1].length,
          });
        }
      });
    });
    return items;
  };

  const outline = extractOutline();

  return (
    <div className="pane-content">
      <div className="pane-header">Outline</div>
      {outline.length === 0 ? (
        <div className="pane-empty-state">
          No headings found. Add headings using <code>= Header</code> in your Typst cells.
        </div>
      ) : (
        <div className="outline-list">
          {outline.map((item, index) => (
            <div
              key={`${item.cellId}-${index}`}
              className={`outline-item level-${Math.min(item.level, 3)}`}
              onClick={() => onOutlineClick(item.cellId)}
            >
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
