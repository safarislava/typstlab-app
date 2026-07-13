import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setPreviewMode, setIsCompiling } from '../store/documentSlice';
import { Download, Columns, Eye, Edit3, RefreshCw, AlertTriangle } from 'lucide-react';
import { $typst } from '@myriaddreamin/typst.ts';

let wasmInitialized = false;

export const PreviewPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { cells, title, previewMode, isCompiling } = useAppSelector((state) => state.document);
  
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [compilerError, setCompilerError] = useState<string | null>(null);
  const [compilerReady, setCompilerReady] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize the Typst WASM Compiler
  useEffect(() => {
    const init = async () => {
      if (wasmInitialized) {
        setCompilerReady(true);
        return;
      }
      
      try {
        // Configure CDN modules for WebAssembly binaries
        await $typst.setCompilerInitOptions({
          getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
        });
        await $typst.setRendererInitOptions({
          getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
        });
        wasmInitialized = true;
        setCompilerReady(true);
      } catch (err: any) {
        console.error('Typst WASM initialization error:', err);
        setInitError(err?.message || 'Failed to load WebAssembly modules');
      }
    };
    
    init();
  }, []);

  // Debounced Compilation Loop
  useEffect(() => {
    if (!compilerReady) return;

    const compileTimer = setTimeout(async () => {
      dispatch(setIsCompiling(true));
      setCompilerError(null);

      // Concatenate all cells to form the full document content
      const fullSource = cells.map(cell => cell.content).join('\n\n');

      if (!fullSource.trim()) {
        setRenderedSvg('<p class="preview-placeholder">Write some Typst markup to compile...</p>');
        dispatch(setIsCompiling(false));
        return;
      }

      try {
        // Compile directly to SVG in browser via WebAssembly
        const svgResult = await $typst.svg({ mainContent: fullSource });
        setRenderedSvg(svgResult);
      } catch (err: any) {
        console.error('Typst Compilation Error:', err);
        setCompilerError(err?.toString() || 'An unknown compilation error occurred');
      } finally {
        dispatch(setIsCompiling(false));
      }
    }, 500); // 500ms debounce to prevent constant compiling on keystroke

    return () => clearTimeout(compileTimer);
  }, [cells, compilerReady, dispatch]);

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
    <section className="preview-panel">
      <div className="preview-header">
        <div className="preview-actions">
          <button
            className={`btn-icon ${previewMode === 'edit-only' ? 'active' : ''}`}
            onClick={() => dispatch(setPreviewMode('edit-only'))}
            title="Edit Only"
          >
            <Edit3 size={18} />
          </button>
          <button
            className={`btn-icon ${previewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => dispatch(setPreviewMode('side-by-side'))}
            title="Side-by-Side"
          >
            <Columns size={18} />
          </button>
          <button
            className={`btn-icon ${previewMode === 'preview-only' ? 'active' : ''}`}
            onClick={() => dispatch(setPreviewMode('preview-only'))}
            title="Preview Only"
          >
            <Eye size={18} />
          </button>
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={handleExportPDF}
          disabled={!compilerReady || isCompiling}
        >
          <Download size={16} />
          <span>Export PDF</span>
        </button>
      </div>

      <div className="preview-container">
        {initError && (
          <div className="preview-error-box">
            <AlertTriangle className="error-icon" />
            <h3>WASM Loader Error</h3>
            <p>{initError}</p>
          </div>
        )}

        {!compilerReady && !initError && (
          <div className="preview-loader">
            <RefreshCw className="spinner" />
            <span>Loading Typst WebAssembly compiler...</span>
          </div>
        )}

        {compilerReady && !initError && (
          <div className="preview-output-wrapper">
            {isCompiling && (
              <div className="compiling-toast">
                <RefreshCw className="spinner-small" />
                <span>Recompiling...</span>
              </div>
            )}

            {compilerError && (
              <div className="compiler-error-box">
                <div className="error-header">
                  <AlertTriangle size={18} />
                  <h4>Compilation Error</h4>
                </div>
                <pre className="error-message">{compilerError}</pre>
              </div>
            )}

            {!compilerError && (
              <div className="preview-document-page wasm-rendered">
                <div 
                  className="svg-render-container"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }} 
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
