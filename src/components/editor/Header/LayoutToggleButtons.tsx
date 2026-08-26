import React from 'react';
import { Edit3, Columns, Eye } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../../store';
import { setPreviewMode } from '../../../store';

export const LayoutToggleButtons: React.FC = () => {
  const dispatch = useAppDispatch();
  const previewMode = useAppSelector(state => state.editor?.previewMode || state.document?.previewMode);

  return (
    <div className="layout-toggles">
      <button
        className={`layout-toggle-btn ${previewMode === 'edit-only' ? 'active' : ''}`}
        onClick={() => dispatch(setPreviewMode('edit-only'))}
        title="Edit Only"
      >
        <Edit3 size={16} />
        <span>Edit</span>
      </button>
      <button
        className={`layout-toggle-btn btn-split ${previewMode === 'side-by-side' ? 'active' : ''}`}
        onClick={() => dispatch(setPreviewMode('side-by-side'))}
        title="Side-by-Side"
      >
        <Columns size={16} />
        <span>Split</span>
      </button>
      <button
        className={`layout-toggle-btn ${previewMode === 'preview-only' ? 'active' : ''}`}
        onClick={() => dispatch(setPreviewMode('preview-only'))}
        title="Preview Only"
      >
        <Eye size={16} />
        <span>Preview</span>
      </button>
    </div>
  );
};
