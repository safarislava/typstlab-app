import React, { useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setIsCompiling, setCompilerError } from '../store/documentSlice';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { $typst } from '@myriaddreamin/typst.ts';
import { globalCompilerQueue } from '../lsp/compilerQueue';

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
    
    const parserError = doc.querySelector('parsererror');
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
  // querySelectorAll would also find nested g.typst-page inside page content,
  // which causes phantom duplicate pages. Using rootSvg.children limits depth to 1.
  const pages = Array.from(rootSvg.children).filter((el) => {
    if (el.tagName.toLowerCase() !== 'g') return false;
    const cls = el.getAttribute('class') || '';
    return cls.split(/\s+/).includes('typst-page');
  }) as SVGGElement[];

  console.log(`[TypstLab Preview] Pages detected: ${pages.length}`);

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

  // Parse the root SVG viewBox to understand the coordinate system
  const rootViewBox = rootSvg.getAttribute('viewBox');
  console.log(`[TypstLab Preview] Root SVG viewBox: ${rootViewBox}`);

  const pageSvgs: PageData[] = [];

  pages.forEach((pageGroup, idx) => {
    const width = parseFloat(pageGroup.getAttribute('data-page-width') || '595');
    const height = parseFloat(pageGroup.getAttribute('data-page-height') || '842');

    // Extract the Y translation from the group's existing transform attribute.
    // Typst positions each page at translate(0, cumulativeY) in the root coordinate space.
    // The content *inside* the group uses coordinates relative to the group, so after
    // the group's translation, absolute SVG Y coords = pageLocalY + translateY.
    // To render just this page, we need viewBox origin at (0, translateY) so that
    // the page-local content [0..height] maps to the viewport.
    const transform = pageGroup.getAttribute('transform') || '';
    let translateY = 0;
    let translateX = 0;
    const translateMatch = transform.match(/translate\(\s*([-\d.]+)\s*[,\s]\s*([-\d.]+)\s*\)/);
    if (translateMatch) {
      translateX = parseFloat(translateMatch[1]);
      translateY = parseFloat(translateMatch[2]);
    }

    console.log(`[TypstLab Preview] Page ${idx + 1}: w=${width} h=${height} tx=${translateX} ty=${translateY} transform="${transform}"`);

    // Clone the group but keep its original transform intact.
    // The viewBox will be shifted to the page's position in the document space.
    const clonedGroup = pageGroup.cloneNode(true) as SVGElement;

    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // viewBox starts at (translateX, translateY) and spans (width, height)
    // This "windows" into exactly this page's region of the shared coordinate space.
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
  const { cells, isCompiling, compilerReady, compilerError } = useAppSelector(
    (state) => state.document
  );
  
  const [renderedPages, setRenderedPages] = useState<PageData[]>([]);

  // Debounced Compilation Loop
  useEffect(() => {
    if (!compilerReady) return;

    const compileTimer = setTimeout(async () => {
      dispatch(setIsCompiling(true));

      // Concatenate all cells to form the full document content
      const fullSource = cells.map(cell => cell.content).join('\n\n');

      if (!fullSource.trim()) {
        setRenderedPages([]);
        dispatch(setCompilerError(null));
        dispatch(setIsCompiling(false));
        return;
      }

      try {
        // Compile and render directly to SVG in a single WASM call to avoid borrow checker errors
        const result = await globalCompilerQueue.run(async () => {
          return await $typst.svg({ mainContent: fullSource });
        });

        if (result !== null) {
          const pages = splitPages(result);
          setRenderedPages(pages);
          dispatch(setCompilerError(null)); // Clear compiler errors on success
        }
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

            {!compilerError && renderedPages.length === 0 && (
              <div className="preview-placeholder">
                Write some Typst markup to compile...
              </div>
            )}

            {!compilerError && renderedPages.length > 0 && renderedPages.map((page, index) => (
              <div 
                key={index}
                className="svg-render-container"
                style={{
                  aspectRatio: `${page.width} / ${page.height}`,
                  width: '100%',
                  maxWidth: `${page.width}px`
                } as React.CSSProperties}
                dangerouslySetInnerHTML={{ __html: page.svgHtml }} 
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
