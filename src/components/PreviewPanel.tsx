import React, { useEffect, useState, useRef } from 'react';
import { useAppSelector, useAppDispatch, setIsCompiling, setCompilerError } from '../store';
import { RefreshCw, AlertTriangle, ZoomIn, ZoomOut, RotateCcw, Hand, Maximize2 } from 'lucide-react';
import { $typst } from '@myriaddreamin/typst.ts';
import { compilerQueue, syncFilesToVfs } from '../services';

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

function performSplit(rootSvg: Element, _originalHtml: string): PageData[] {
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
    const serializer = new XMLSerializer();
    return [{
      svgHtml: serializer.serializeToString(rootSvg),
      width,
      height
    }];
  }

  const pageSvgs: PageData[] = [];

  pages.forEach((pageGroup) => {
    const clonedGroup = pageGroup.cloneNode(true) as SVGGElement;
    const transform = clonedGroup.getAttribute('transform') || '';
    const match = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
    
    let width = 595;
    let height = 842;

    if (match) {
      clonedGroup.removeAttribute('transform');
    }

    const dataWidth = pageGroup.getAttribute('data-page-width');
    const dataHeight = pageGroup.getAttribute('data-page-height');
    if (dataWidth && dataHeight) {
      width = parseFloat(dataWidth);
      height = parseFloat(dataHeight);
    }

    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
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
  const { files, activeFilePath } = useAppSelector((state) => state.editor);
  const { isCompiling, compilerReady, compilerError } = useAppSelector((state) => state.compiler);
  
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
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Math.min(3.0, Math.max(0.3, parseFloat((z + delta).toFixed(2)))));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanToolActive || isSpacePressed || e.button === 1) { // Left click in Pan mode or middle-click
      setIsDraggingPan(true);
      if (containerRef.current) {
        panStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          scrollLeft: containerRef.current.scrollLeft,
          scrollTop: containerRef.current.scrollTop
        };
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingPan || !containerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDraggingPan(false);
  };

  useEffect(() => {
    if (!compilerReady) return;

    let isSubscribed = true;

    // Use global compiler queue to serialize all compilations cleanly without race conditions
    void compilerQueue.run(async () => {
      if (!isSubscribed) return;

      dispatch(setIsCompiling(true));

      try {
        await syncFilesToVfs(files);

        const activeFile = files[activeFilePath];
        let mainPath = '/main.typ';

        if (activeFile && !activeFile.isBinary) {
          mainPath = `/${activeFile.path}`;
        } else {
          const firstTypst = Object.values(files).find(f => !f.isBinary);
          if (firstTypst) {
            mainPath = `/${firstTypst.path}`;
          }
        }

        const svg = await $typst.svg({
          mainFilePath: mainPath,
        });

        if (isSubscribed) {
          const pages = splitPages(svg);
          setRenderedPages(pages);
          dispatch(setCompilerError(null));
        }
      } catch (err: any) {
        if (isSubscribed) {
          let errorMsg = 'Compilation failed';
          if (typeof err === 'string') {
            errorMsg = err;
          } else if (err?.message) {
            errorMsg = err.message;
          }
          dispatch(setCompilerError(errorMsg));
        }
      } finally {
        if (isSubscribed) {
          dispatch(setIsCompiling(false));
        }
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [files, activeFilePath, compilerReady, dispatch]);

  const isPanningCursor = isPanToolActive || isSpacePressed;

  return (
    <div className="preview-panel">
      {/* Top Floating Zoom Controls */}
      <div className="preview-toolbar">
        <div className="zoom-controls">
          <button 
            className={`zoom-btn ${isPanToolActive ? 'active' : ''}`}
            onClick={() => setIsPanToolActive(!isPanToolActive)} 
            title={isPanToolActive ? "Pan Mode (Active) [Hold Space]" : "Hand / Pan Tool [Hold Space]"}
          >
            <Hand size={14} />
          </button>
          <div className="toolbar-divider" />
          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out (Ctrl -)">
            <ZoomOut size={14} />
          </button>
          <select 
            className="zoom-select" 
            value={Math.round(zoom * 100)} 
            onChange={(e) => setZoom(parseInt(e.target.value, 10) / 100)}
          >
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
          </select>
          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In (Ctrl +)">
            <ZoomIn size={14} />
          </button>
          <div className="toolbar-divider" />
          <button className="zoom-btn" onClick={handleFitWidth} title="Fit to Width">
            <Maximize2 size={13} />
          </button>
          <button className="zoom-btn" onClick={handleResetZoom} title="Reset 100%">
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className={`preview-container ${isPanningCursor ? 'is-pan-active' : ''} ${isDraggingPan ? 'is-dragging-pan' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="preview-wrapper">
          {isCompiling && (
            <div className="compiling-toast">
              <RefreshCw size={12} className="spinner-small" />
              <span>Compiling...</span>
            </div>
          )}

          {!compilerReady ? (
            <div className="preview-placeholder">
              <div className="loading-spinner">
                <RefreshCw size={18} className="spinner-small" />
              </div>
              <p>Initializing Typst WebAssembly Engine...</p>
            </div>
          ) : (
            <div 
              className="preview-content-flow"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: isDraggingPan ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              {compilerError && (
                <div className="preview-error-box">
                  <div className="error-header">
                    <AlertTriangle size={18} className="error-icon" />
                    <h3>Typst Compilation Error</h3>
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
    </div>
  );
};
