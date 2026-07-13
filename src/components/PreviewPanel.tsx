import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setIsCompiling, setCompilerError } from '../store/documentSlice';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { $typst } from '@myriaddreamin/typst.ts';

export const PreviewPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { cells, isCompiling, compilerReady, compilerError } = useAppSelector(
    (state) => state.document
  );
  
  const [renderedSvg, setRenderedSvg] = useState<string>('');

  // Debounced Compilation Loop
  useEffect(() => {
    if (!compilerReady) return;

    const compileTimer = setTimeout(async () => {
      dispatch(setIsCompiling(true));

      // Concatenate all cells to form the full document content
      const fullSource = cells.map(cell => cell.content).join('\n\n');

      if (!fullSource.trim()) {
        setRenderedSvg('<p class="preview-placeholder">Write some Typst markup to compile...</p>');
        dispatch(setCompilerError(null));
        dispatch(setIsCompiling(false));
        return;
      }

      try {
        // Compile directly to SVG in browser via WebAssembly
        const svgResult = await $typst.svg({ mainContent: fullSource });
        setRenderedSvg(svgResult);
        dispatch(setCompilerError(null)); // Clear compiler errors on success
      } catch (err: any) {
        console.error('Typst Compilation Error:', err);
        dispatch(setCompilerError(err?.toString() || 'An unknown compilation error occurred'));
      } finally {
        dispatch(setIsCompiling(false));
      }
    }, 500); // 500ms debounce to prevent constant compiling on keystroke

    return () => clearTimeout(compileTimer);
  }, [cells, compilerReady, dispatch]);

  return (
    <section className="preview-panel">
      <div className="preview-container">
        {!compilerReady && (
          <div className="preview-loader">
            <RefreshCw className="spinner" />
            <span>Loading Typst WebAssembly compiler...</span>
          </div>
        )}

        {compilerReady && (
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
