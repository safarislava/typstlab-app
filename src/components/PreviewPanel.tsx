import React, { useEffect, useState, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../store';
import { setIsCompiling, setCompilerError } from '../store/documentSlice';
import { RefreshCw, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Hand, Maximize2 } from 'lucide-react';
import { $typst } from '@myriaddreamin/typst.ts';
import { globalCompilerQueue } from '../lsp/compilerQueue';
import { syncFilesToVfs } from '../services';

interface PageData {
  svgHtml: string;
  width: number;
  height: number;
}

// Helper function to split a multi-page compiled SVG string into standalone SVG pages
function splitPages(svgHtml: string): PageData[] {
  if (!svgHtml || !svgHtml.includes('<svg')) return [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgHtml, 'image/svg+xml');
    
    const parserError = doc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      console.warn('XML Parser Error while parsing SVG, falling back to HTML parser:', parserError.textContent);
      const htmlDoc = parser.parseFromString(svgHtml, 'text/html');
      const rootSvg = htmlDoc.querySelector('svg');
      if (!rootSvg) return [{ svgHtml, width: 595, height: 842 }];
      return performSplit(rootSvg, svgHtml);
    }

    const rootSvg = doc.querySelector('svg');
    if (!rootSvg) {
      return [{ svgHtml, width: 595, height: 842 }];
    }

    return performSplit(rootSvg, svgHtml);
  } catch (err) {
    console.error('Error splitting SVG pages:', err);
    return [{ svgHtml, width: 595, height: 842 }];
  }
}

function performSplit(rootSvg: Element, originalHtml: string): PageData[] {
  const styleEl = rootSvg.querySelector('style');
  const defsEl = rootSvg.querySelector('defs');

  // Find all page groups — DIRECT children of root SVG only.
  const pages = Array.from(rootSvg.children).filter((el) => {
    if (el.tagName.toLowerCase() !== 'g') return false;
    const cls = el.getAttribute('class') || '';
    return cls.split(/\s+/).includes('typst-page');
  }) as SVGGElement[];

  if (pages.length === 0) {
    const viewBox = rootSvg.getAttribute('viewBox');
    let width = 595;
    let height = 842;
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(parseFloat);
      if (parts.length === 4) {
        width = parts[2];
        height = parts[3];
      }
    }
    return [{ svgHtml: originalHtml, width, height }];
  }

  const pageSvgs: PageData[] = [];

  pages.forEach((pageGroup) => {
    const width = parseFloat(pageGroup.getAttribute('data-page-width') || '595');
    const height = parseFloat(pageGroup.getAttribute('data-page-height') || '842');

    const transform = pageGroup.getAttribute('transform') || '';
    let translateY = 0;
    let translateX = 0;
    const translateMatch = transform.match(/translate\(\s*([-\d.]+)\s*[,\s]\s*([-\d.]+)\s*\)/);
    if (translateMatch) {
      translateX = parseFloat(translateMatch[1]);
      translateY = parseFloat(translateMatch[2]);
    }

    const clonedGroup = pageGroup.cloneNode(true) as SVGElement;

    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newSvg.setAttribute('viewBox', `${translateX} ${translateY} ${width} ${height}`);
    newSvg.setAttribute('width', '100%');
    newSvg.setAttribute('height', '100%');
    newSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    newSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    newSvg.setAttribute('class', 'typst-doc');

    if (styleEl) {
      newSvg.appendChild(styleEl.cloneNode(true));
    }
    if (defsEl) {
      newSvg.appendChild(defsEl.cloneNode(true));
    }
    newSvg.appendChild(clonedGroup);

    const serializer = new XMLSerializer();
    pageSvgs.push({
      svgHtml: serializer.serializeToString(newSvg),
      width,
      height
    });
  });

  return pageSvgs;
}

export const PreviewPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { files, activeFilePath, isCompiling, compilerReady, compilerError } = useAppSelector(
    (state) => state.document
  );
  
  const [renderedPages, setRenderedPages] = useState<PageData[]>([]);
  const [zoom, setZoom] = useState<number>(1.0);
  const [isPanToolActive, setIsPanToolActive] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0
  });

  // Track global Space key for quick hold-to-pan navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (e.target as HTMLElement)?.tagName;
      const isEditingText = ['INPUT', 'TEXTAREA'].includes(activeTag) || (e.target as HTMLElement)?.closest('.cm-editor');
      if (e.code === 'Space' && !isEditingText) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsDraggingPan(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(3.0, parseFloat((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, parseFloat((z - 0.15).toFixed(2))));
  const handleResetZoom = () => setZoom(1.0);

  const handleFitWidth = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 96; // padding space
    const pageWidth = renderedPages[0]?.width || 595;
    const calculatedZoom = Math.min(2.5, Math.max(0.4, parseFloat((containerWidth / pageWidth).toFixed(2))));
    setZoom(calculatedZoom);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => Math.min(3.0, Math.max(0.3, parseFloat((z + delta).toFixed(2)))));
    }
  };

  const isPanningActive = isPanToolActive || isSpacePressed;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isPanningActive)) {
      if (!containerRef.current) return;
      e.preventDefault();
      setIsDraggingPan(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: containerRef.current.scrollLeft,
        scrollTop: containerRef.current.scrollTop
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPan || !containerRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - panStartRef.current.startX;
    const deltaY = e.clientY - panStartRef.current.startY;
    containerRef.current.scrollLeft = panStartRef.current.scrollLeft - deltaX;
    containerRef.current.scrollTop = panStartRef.current.scrollTop - deltaY;
  };

  const handleMouseUp = () => {
    setIsDraggingPan(false);
  };

  // Debounced Compilation Loop
  useEffect(() => {
    if (!compilerReady) return;

    if (!activeFilePath || !files[activeFilePath] || files[activeFilePath].isBinary) {
      setRenderedPages([]);
      dispatch(setCompilerError(null));
      return;
    }

    const compileTimer = setTimeout(async () => {
      dispatch(setIsCompiling(true));

      try {
        await syncFilesToVfs(files);

        const result = await globalCompilerQueue.run(async () => {
          return await $typst.svg({ mainFilePath: `/${activeFilePath}` });
        });

        if (result !== null) {
          const pages = splitPages(result);
          setRenderedPages(pages);
          dispatch(setCompilerError(null));
        }
      } catch (err: any) {
        console.error('Typst Compilation Error:', err);
        dispatch(setCompilerError(err?.toString() || 'An unknown compilation error occurred'));
      } finally {
        dispatch(setIsCompiling(false));
      }
    }, 500);

    return () => clearTimeout(compileTimer);
  }, [files, activeFilePath, compilerReady, dispatch]);

  // Direct physical layout width calculation (prevents transform-origin clipping)
  const basePageWidth = renderedPages[0]?.width || 595;
  const scaledWidth = Math.round(basePageWidth * zoom);

  return (
    <section className="preview-panel">
      {/* Top Floating Zoom Controls Bar */}
      <div className="preview-toolbar">
        <div className="zoom-controls">
          <button 
            className={`zoom-btn ${isPanToolActive ? 'active' : ''}`}
            onClick={() => setIsPanToolActive(!isPanToolActive)}
            title="Pan Hand Tool (Hold Space or drag)"
          >
            <Hand size={14} />
          </button>

          <div className="toolbar-divider" />

          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out (-15%)" disabled={zoom <= 0.3}>
            <ZoomOut size={14} />
          </button>

          <select 
            className="zoom-select"
            value={zoom.toFixed(2)}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            title="Zoom level"
          >
            <option value="0.30">30%</option>
            <option value="0.50">50%</option>
            <option value="0.75">75%</option>
            <option value="1.00">100%</option>
            <option value="1.25">125%</option>
            <option value="1.50">150%</option>
            <option value="2.00">200%</option>
            <option value="2.50">250%</option>
            <option value="3.00">300%</option>
          </select>

          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In (+15%)" disabled={zoom >= 3.0}>
            <ZoomIn size={14} />
          </button>

          <button className="zoom-btn" onClick={handleFitWidth} title="Fit Width">
            <Maximize2 size={14} />
          </button>

          <button className="zoom-btn reset-btn" onClick={handleResetZoom} title="Reset Zoom (100%)">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className={`preview-container ${isPanningActive ? 'is-pan-active' : ''} ${isDraggingPan ? 'is-dragging-pan' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="preview-canvas-stage">
          {!compilerReady && (
            <div className="preview-loader">
              <RefreshCw className="spinner" />
              <span>Loading Typst WebAssembly compiler...</span>
            </div>
          )}

          {compilerReady && (
            <div 
              className="preview-output-wrapper"
              style={{
                width: `${scaledWidth}px`,
                maxWidth: 'none',
                transition: isDraggingPan ? 'none' : 'width 0.15s ease-out'
              }}
            >
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

              {!compilerError && renderedPages.length === 0 && (
                <div className="preview-placeholder">
                  Write some Typst markup to compile...
                </div>
              )}

              {!compilerError && renderedPages.length > 0 && renderedPages.map((page, index) => (
                <div 
                  key={`page-${index}-${page.width}x${page.height}`}
                  className="svg-render-container"
                  style={{
                    aspectRatio: `${page.width} / ${page.height}`,
                    width: '100%',
                    maxWidth: '100%'
                  } as React.CSSProperties}
                  dangerouslySetInnerHTML={{ __html: page.svgHtml }} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
