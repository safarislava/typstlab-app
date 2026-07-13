import React from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setTitle, setPreviewMode } from '../store/documentSlice';
import { Download, Columns, Eye, Edit3, CheckCircle, AlertCircle, Loader, Wifi, WifiOff } from 'lucide-react';
import { $typst } from '@myriaddreamin/typst.ts';

export const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const { title, cells, previewMode, isCompiling, connectionStatus, compilerReady, compilerError } = useAppSelector(
    (state) => state.document
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setTitle(e.target.value));
  };

  const handleExportPDF = async () => {
    if (!compilerReady) return;
    try {
      const fullSource = cells.map(cell => cell.content).join('\n\n');
      const pdfBytes = await $typst.pdf({ mainContent: fullSource });
      if (pdfBytes) {
        const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, '_') || 'document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert('Error exporting PDF: ' + (err?.message || err));
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand-container">
          <svg className="typst-logo-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#239dad" />
            <path d="M10 21V11h12v3h-8v7h-4z" fill="white" />
          </svg>
          <div className="brand-logo-text">
            <span className="logo-typst">typst</span>
            <span className="logo-lab">lab</span>
          </div>
        </div>
        
        <div className="breadcrumb-separator">/</div>
        
        <div className="project-title-container">
          <input
            type="text"
            className="header-title-input"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Document"
          />
        </div>
      </div>

      <div className="header-center">
        {isCompiling ? (
          <div className="status-badge compiling">
            <Loader className="status-icon spinner-small" size={14} />
            <span>Compiling...</span>
          </div>
        ) : compilerError ? (
          <div className="status-badge error">
            <AlertCircle className="status-icon" size={14} />
            <span>Error</span>
          </div>
        ) : compilerReady ? (
          <div className="status-badge ready">
            <CheckCircle className="status-icon" size={14} />
            <span>Ready</span>
          </div>
        ) : (
          <div className="status-badge loading">
            <Loader className="status-icon spinner-small" size={14} />
            <span>Loading Compiler...</span>
          </div>
        )}

        <div className="connection-badge">
          {connectionStatus === 'connected' ? (
            <div className="status-indicator online" title="Connected">
              <Wifi size={14} />
            </div>
          ) : (
            <div className="status-indicator offline" title="Offline Mode">
              <WifiOff size={14} />
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
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
            className={`layout-toggle-btn ${previewMode === 'side-by-side' ? 'active' : ''}`}
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

        <button
          className="export-pdf-btn"
          onClick={handleExportPDF}
          disabled={!compilerReady || isCompiling}
        >
          <Download size={15} />
          <span>Export PDF</span>
        </button>
      </div>
    </header>
  );
};
