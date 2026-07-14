import React, { useState, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  Binary, ChevronDown,
  Table, Image, Link, ChevronRight, Shapes,
  Sigma, Calculator
} from 'lucide-react';
import { globalEditorRegistry } from '../lsp/editorRegistry';

interface SymbolItem {
  char: string;
  charShift: string;
  name: string;
  nameShift: string;
  cmd: string;
}

interface OperatorItem {
  char: string;
  name: string;
  cmd: string;
}

const symbols: SymbolItem[] = [
  { char: 'α', charShift: 'Α', name: 'alpha', nameShift: 'Alpha', cmd: 'symbol-alpha' },
  { char: 'β', charShift: 'Β', name: 'beta', nameShift: 'Beta', cmd: 'symbol-beta' },
  { char: 'γ', charShift: 'Γ', name: 'gamma', nameShift: 'Gamma', cmd: 'symbol-gamma' },
  { char: 'δ', charShift: 'Δ', name: 'delta', nameShift: 'Delta', cmd: 'symbol-delta' },
  { char: 'ε', charShift: 'Ε', name: 'epsilon', nameShift: 'Epsilon', cmd: 'symbol-epsilon' },
  { char: 'ζ', charShift: 'Ζ', name: 'zeta', nameShift: 'Zeta', cmd: 'symbol-zeta' },
  { char: 'η', charShift: 'Η', name: 'eta', nameShift: 'Eta', cmd: 'symbol-eta' },
  { char: 'θ', charShift: 'Θ', name: 'theta', nameShift: 'Theta', cmd: 'symbol-theta' },
  { char: 'ι', charShift: 'Ι', name: 'iota', nameShift: 'Iota', cmd: 'symbol-iota' },
  { char: 'κ', charShift: 'Κ', name: 'kappa', nameShift: 'Kappa', cmd: 'symbol-kappa' },
  { char: 'λ', charShift: 'Λ', name: 'lambda', nameShift: 'Lambda', cmd: 'symbol-lambda' },
  { char: 'μ', charShift: 'Μ', name: 'mu', nameShift: 'Mu', cmd: 'symbol-mu' },
  { char: 'ν', charShift: 'Ν', name: 'nu', nameShift: 'Nu', cmd: 'symbol-nu' },
  { char: 'ξ', charShift: 'Ξ', name: 'xi', nameShift: 'Xi', cmd: 'symbol-xi' },
  { char: 'ο', charShift: 'Ο', name: 'omicron', nameShift: 'Omicron', cmd: 'symbol-omicron' },
  { char: 'π', charShift: 'Π', name: 'pi', nameShift: 'Pi', cmd: 'symbol-pi' },
  { char: 'ρ', charShift: 'Ρ', name: 'rho', nameShift: 'Rho', cmd: 'symbol-rho' },
  { char: 'σ', charShift: 'Σ', name: 'sigma', nameShift: 'Sigma', cmd: 'symbol-sigma' },
  { char: 'τ', charShift: 'Т', name: 'tau', nameShift: 'Tau', cmd: 'symbol-tau' },
  { char: 'υ', charShift: 'Υ', name: 'upsilon', nameShift: 'Upsilon', cmd: 'symbol-upsilon' },
  { char: 'φ', charShift: 'Φ', name: 'phi', nameShift: 'Phi', cmd: 'symbol-phi' },
  { char: 'χ', charShift: 'Х', name: 'chi', nameShift: 'Chi', cmd: 'symbol-chi' },
  { char: 'ψ', charShift: 'Ψ', name: 'psi', nameShift: 'Psi', cmd: 'symbol-psi' },
  { char: 'ω', charShift: 'Ω', name: 'omega', nameShift: 'Omega', cmd: 'symbol-omega' }
];

const operators: OperatorItem[] = [
  // Row 1: Calculus & Limits
  { char: '∫', name: 'integral', cmd: 'op-int' },
  { char: '∬', name: 'double int', cmd: 'op-int2' },
  { char: '∮', name: 'contour int', cmd: 'op-intc' },
  { char: '|', name: 'limits bar (Newton-Leibniz)', cmd: 'op-limits' },
  { char: 'lim', name: 'limit', cmd: 'op-lim' },
  { char: '∂', name: 'partial derivative', cmd: 'op-diff' },

  // Row 2: Algebra & Basic Operators
  { char: '∑', name: 'sum', cmd: 'op-sum' },
  { char: '∏', name: 'product', cmd: 'op-prod' },
  { char: '√', name: 'sqrt', cmd: 'op-sqrt' },
  { char: '∇', name: 'nabla', cmd: 'op-nabla' },
  { char: '±', name: 'plus-minus', cmd: 'op-pm' },
  { char: '∞', name: 'infinity', cmd: 'op-inf' },

  // Row 3: Relations & Arrows
  { char: '→', name: 'tends to', cmd: 'op-to' },
  { char: '↔', name: 'equivalence', cmd: 'op-lrarrow' },
  { char: '≈', name: 'approx', cmd: 'op-approx' },
  { char: '≠', name: 'not equal', cmd: 'op-neq' },
  { char: '≤', name: 'less-equal', cmd: 'op-le' },
  { char: '≥', name: 'great-equal', cmd: 'op-ge' },

  // Row 4: Logic & Set Theory
  { char: '∈', name: 'element of', cmd: 'op-in' },
  { char: '∉', name: 'not in', cmd: 'op-notin' },
  { char: '∪', name: 'union', cmd: 'op-union' },
  { char: '∩', name: 'intersect', cmd: 'op-sect' },
  { char: '∀', name: 'for all', cmd: 'op-forall' },
  { char: '∃', name: 'exists', cmd: 'op-exists' }
];

const GRID_SIZE = 5; // 5x5 table insertion grid

// Generates an empty Typst table with [] in cells by default
const generateTypstTable = (cols: number, rows: number): string => {
  const colSpec = Array(cols).fill('1fr').join(', ');
  const alignSpec = Array(cols).fill('center').join(', ');
  
  let content = `\n#table(\n  columns: (${colSpec}),\n  align: (${alignSpec}),\n`;
  
  // Headers row (empty brackets)
  content += '  ';
  for (let c = 1; c <= cols; c++) {
    content += `[]${c === cols ? '' : ', '}`;
  }
  content += ',\n';
  
  // Data rows (empty brackets)
  for (let r = 1; r < rows; r++) {
    content += '  ';
    for (let c = 1; c <= cols; c++) {
      content += `[]${c === cols ? '' : ', '}`;
    }
    content += ',\n';
  }
  
  content += ')\n';
  return content;
};

export const WordRibbon: React.FC = () => {
  const [showSymbols, setShowSymbols] = useState(false);
  const [showOperators, setShowOperators] = useState(false);
  const [showTableDropdown, setShowTableDropdown] = useState(false);
  const [hoveredGrid, setHoveredGrid] = useState({ rows: 0, cols: 0 });
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // Monitor global Shift key state for real-time symbol case rendering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    // Reset shift if window loses focus
    const handleBlur = () => {
      setIsShiftPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleTableInsert = (cols: number, rows: number) => {
    const view = globalEditorRegistry.getActiveView();
    if (!view) {
      alert("Please click inside a cell to make it active before inserting a table!");
      return;
    }

    const tableMarkup = generateTypstTable(cols, rows);
    const { from, to } = view.state.selection.main;
    const transaction = view.state.update({
      changes: { from, to, insert: tableMarkup },
      selection: { anchor: from + tableMarkup.length }
    });
    view.dispatch(transaction);
    view.focus();
    
    setShowTableDropdown(false);
    setHoveredGrid({ rows: 0, cols: 0 });
  };

  const executeCommand = (type: string, useShift = false) => {
    const view = globalEditorRegistry.getActiveView();
    if (!view) {
      alert("Please click inside a cell to make it active before formatting!");
      return;
    }

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.sliceDoc(from, to);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      // Font Group
      case 'bold':
        replacement = `*${selectedText}*`;
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'italic':
        replacement = `_${selectedText}_`;
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'underline':
        replacement = `#underline[${selectedText}]`;
        cursorOffset = selectedText ? replacement.length : 11;
        break;
      case 'strike':
        replacement = `#strike[${selectedText}]`;
        cursorOffset = selectedText ? replacement.length : 8;
        break;

      // Code Group
      case 'code-block':
        replacement = `\`\`\`typst\n${selectedText || ''}\n\`\`\``;
        cursorOffset = selectedText ? replacement.length : 9; // on the empty line inside the code block
        break;

      // Insert Group (Table handled separately, all paths/URLs/captions empty by default)
      case 'image':
        replacement = `\n#image("")\n`;
        cursorOffset = 9; // inside the quotes of #image("")
        break;
      case 'figure':
        replacement = `\n#figure(\n  ${selectedText || '[]'},\n  caption: [],\n)\n`;
        cursorOffset = selectedText ? replacement.length : 13; // inside the body brackets `[]` of the figure
        break;
      case 'link':
        replacement = `#link("")[${selectedText || ''}]`;
        cursorOffset = 7; // inside the quotes of #link("")
        break;
      case 'pagebreak':
        replacement = `\n#pagebreak()\n`;
        cursorOffset = replacement.length;
        break;

      // Math Group (Inner text is empty by default)
      case 'math-block':
        replacement = `\n$ ${selectedText || ''} $\n`;
        cursorOffset = selectedText ? replacement.length : 3; // inside the math block
        break;

      // Operators
      case 'op-sum':
        replacement = 'sum_()^()';
        cursorOffset = 5;
        break;
      case 'op-prod':
        replacement = 'prod_()^()';
        cursorOffset = 6;
        break;
      case 'op-int':
        replacement = 'integral_()^()';
        cursorOffset = 10;
        break;
      case 'op-int2':
        replacement = 'integral.double';
        cursorOffset = replacement.length;
        break;
      case 'op-intc':
        replacement = 'integral.cont';
        cursorOffset = replacement.length;
        break;
      case 'op-limits':
        replacement = '|_()^()';
        cursorOffset = 3;
        break;
      case 'op-lim':
        replacement = 'lim_()';
        cursorOffset = 5;
        break;
      case 'op-sqrt':
        replacement = 'sqrt()';
        cursorOffset = 5;
        break;
      case 'op-nabla':
        replacement = 'nabla';
        cursorOffset = replacement.length;
        break;
      case 'op-diff':
        replacement = 'diff';
        cursorOffset = replacement.length;
        break;
      case 'op-union':
        replacement = 'union';
        cursorOffset = replacement.length;
        break;
      case 'op-sect':
        replacement = 'sect';
        cursorOffset = replacement.length;
        break;
      case 'op-pm':
        replacement = 'plus.minus';
        cursorOffset = replacement.length;
        break;
      case 'op-inf':
        replacement = 'infinity';
        cursorOffset = replacement.length;
        break;
      case 'op-to':
        replacement = 'to';
        cursorOffset = replacement.length;
        break;
      case 'op-lrarrow':
        replacement = 'arrow.l.r';
        cursorOffset = replacement.length;
        break;
      case 'op-approx':
        replacement = 'approx';
        cursorOffset = replacement.length;
        break;
      case 'op-neq':
        replacement = '!=';
        cursorOffset = replacement.length;
        break;
      case 'op-le':
        replacement = '<=';
        cursorOffset = replacement.length;
        break;
      case 'op-ge':
        replacement = '>=';
        cursorOffset = replacement.length;
        break;
      case 'op-in':
        replacement = 'in';
        cursorOffset = replacement.length;
        break;
      case 'op-notin':
        replacement = 'in.not';
        cursorOffset = replacement.length;
        break;
      case 'op-forall':
        replacement = 'forall';
        cursorOffset = replacement.length;
        break;
      case 'op-exists':
        replacement = 'exists';
        cursorOffset = replacement.length;
        break;

      // Greek Symbols (Typst math format, capitalized if shift is held)
      case 'symbol-alpha':
        replacement = useShift ? 'Alpha' : 'alpha';
        cursorOffset = replacement.length;
        break;
      case 'symbol-beta':
        replacement = useShift ? 'Beta' : 'beta';
        cursorOffset = replacement.length;
        break;
      case 'symbol-gamma':
        replacement = useShift ? 'Gamma' : 'gamma';
        cursorOffset = replacement.length;
        break;
      case 'symbol-delta':
        replacement = useShift ? 'Delta' : 'delta';
        cursorOffset = replacement.length;
        break;
      case 'symbol-epsilon':
        replacement = useShift ? 'Epsilon' : 'epsilon';
        cursorOffset = replacement.length;
        break;
      case 'symbol-zeta':
        replacement = useShift ? 'Zeta' : 'zeta';
        cursorOffset = replacement.length;
        break;
      case 'symbol-eta':
        replacement = useShift ? 'Eta' : 'eta';
        cursorOffset = replacement.length;
        break;
      case 'symbol-theta':
        replacement = useShift ? 'Theta' : 'theta';
        cursorOffset = replacement.length;
        break;
      case 'symbol-iota':
        replacement = useShift ? 'Iota' : 'iota';
        cursorOffset = replacement.length;
        break;
      case 'symbol-kappa':
        replacement = useShift ? 'Kappa' : 'kappa';
        cursorOffset = replacement.length;
        break;
      case 'symbol-lambda':
        replacement = useShift ? 'Lambda' : 'lambda';
        cursorOffset = replacement.length;
        break;
      case 'symbol-mu':
        replacement = useShift ? 'Mu' : 'mu';
        cursorOffset = replacement.length;
        break;
      case 'symbol-nu':
        replacement = useShift ? 'Nu' : 'nu';
        cursorOffset = replacement.length;
        break;
      case 'symbol-xi':
        replacement = useShift ? 'Xi' : 'xi';
        cursorOffset = replacement.length;
        break;
      case 'symbol-omicron':
        replacement = useShift ? 'Omicron' : 'omicron';
        cursorOffset = replacement.length;
        break;
      case 'symbol-pi':
        replacement = useShift ? 'Pi' : 'pi';
        cursorOffset = replacement.length;
        break;
      case 'symbol-rho':
        replacement = useShift ? 'Rho' : 'rho';
        cursorOffset = replacement.length;
        break;
      case 'symbol-sigma':
        replacement = useShift ? 'Sigma' : 'sigma';
        cursorOffset = replacement.length;
        break;
      case 'symbol-tau':
        replacement = useShift ? 'Tau' : 'tau';
        cursorOffset = replacement.length;
        break;
      case 'symbol-upsilon':
        replacement = useShift ? 'Upsilon' : 'upsilon';
        cursorOffset = replacement.length;
        break;
      case 'symbol-phi':
        replacement = useShift ? 'Phi' : 'phi';
        cursorOffset = replacement.length;
        break;
      case 'symbol-chi':
        replacement = useShift ? 'Chi' : 'chi';
        cursorOffset = replacement.length;
        break;
      case 'symbol-psi':
        replacement = useShift ? 'Psi' : 'psi';
        cursorOffset = replacement.length;
        break;
      case 'symbol-omega':
        replacement = useShift ? 'Omega' : 'omega';
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    const transaction = view.state.update({
      changes: { from, to, insert: replacement },
      selection: { anchor: from + cursorOffset }
    });
    view.dispatch(transaction);
    view.focus();
  };

  return (
    <div className="word-ribbon">
      <div className="ribbon-panel single-page">
        <div className="ribbon-groups">
          {/* Group 1: Font */}
          <div className="ribbon-group">
            <div className="group-content">
              <button className="ribbon-btn" onClick={() => executeCommand('bold')} title="Bold (*text*)">
                <Bold size={15} />
              </button>
              <button className="ribbon-btn" onClick={() => executeCommand('italic')} title="Italic (_text_)">
                <Italic size={15} />
              </button>
              <button className="ribbon-btn" onClick={() => executeCommand('underline')} title="Underline (#underline[text])">
                <Underline size={15} />
              </button>
              <button className="ribbon-btn" onClick={() => executeCommand('strike')} title="Strikethrough (#strike[text])">
                <Strikethrough size={15} />
              </button>
            </div>
          </div>

          <div className="ribbon-group-separator" />

          {/* Group 2: Code */}
          <div className="ribbon-group">
            <div className="group-content">
              <button className="ribbon-btn" onClick={() => executeCommand('code-block')} title="Code Block (```typst...)">
                <Binary size={15} />
              </button>
            </div>
          </div>

          <div className="ribbon-group-separator" />

          {/* Group 3: Insert with Table dropdown */}
          <div className="ribbon-group table-dropdown-container">
            <div className="group-content">
              {/* Word-like Table Dropdown Trigger */}
              <div style={{ position: 'relative' }}>
                <button 
                  className={`ribbon-btn dropdown-trigger ${showTableDropdown ? 'active' : ''}`}
                  onClick={() => {
                    setShowTableDropdown(!showTableDropdown);
                    setShowSymbols(false);
                    setShowOperators(false);
                    setHoveredGrid({ rows: 0, cols: 0 });
                  }}
                  title="Insert Table Grid"
                >
                  <Table size={15} />
                  <ChevronDown size={10} className="chevron-icon" />
                </button>
                
                {showTableDropdown && (
                  <>
                    <div className="ribbon-dropdown-backdrop" onClick={() => setShowTableDropdown(false)} />
                    <div className="ribbon-dropdown-menu table-selector-popup">
                      <div className="table-grid-header">
                        {hoveredGrid.rows > 0 && hoveredGrid.cols > 0 
                          ? `${hoveredGrid.cols} × ${hoveredGrid.rows} Table` 
                          : "Select size"}
                      </div>
                      <div 
                        className="table-grid-interactive" 
                        onMouseLeave={() => setHoveredGrid({ rows: 0, cols: 0 })}
                      >
                        {Array.from({ length: GRID_SIZE }).map((_, rIdx) => {
                          const rowNum = rIdx + 1;
                          return (
                            <div key={rowNum} className="table-grid-row">
                              {Array.from({ length: GRID_SIZE }).map((_, cIdx) => {
                                const colNum = cIdx + 1;
                                const isActive = rowNum <= hoveredGrid.rows && colNum <= hoveredGrid.cols;
                                return (
                                  <div 
                                    key={colNum} 
                                    className={`table-grid-cell ${isActive ? 'active' : ''}`}
                                    onMouseEnter={() => setHoveredGrid({ rows: rowNum, cols: colNum })}
                                    onClick={() => handleTableInsert(colNum, rowNum)}
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button className="ribbon-btn" onClick={() => executeCommand('image')} title="Insert Image">
                <Image size={15} />
              </button>
              <button className="ribbon-btn" onClick={() => executeCommand('figure')} title="Insert Figure with Caption">
                <Shapes size={15} />
              </button>
              <button className="ribbon-btn" onClick={() => executeCommand('link')} title="Insert Link">
                <Link size={15} />
              </button>
              <button className="ribbon-btn" onClick={() => executeCommand('pagebreak')} title="Insert Page Break">
                <ChevronRight size={15} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>
          </div>

          <div className="ribbon-group-separator" />

          {/* Group 4: Math Block */}
          <div className="ribbon-group">
            <div className="group-content">
              <button className="ribbon-btn" onClick={() => executeCommand('math-block')} title="Math Formula ($ x $) ">
                <Calculator size={15} />
              </button>
            </div>
          </div>

          {/* Group 5: Greek Letters Dropdown */}
          <div className="ribbon-group symbols-dropdown-container">
            <div className="group-content">
              <button 
                className={`ribbon-btn dropdown-trigger ${showSymbols ? 'active' : ''}`} 
                onClick={() => {
                  setShowSymbols(!showSymbols);
                  setShowOperators(false);
                  setShowTableDropdown(false);
                }}
                title="Greek Alphabet (Hold Shift for uppercase)"
              >
                <span style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: '1' }}>
                  {isShiftPressed ? 'Ω' : 'ω'}
                </span>
                <ChevronDown size={10} className="chevron-icon" />
              </button>
              
              {showSymbols && (
                <>
                  <div className="ribbon-dropdown-backdrop" onClick={() => setShowSymbols(false)} />
                  <div className="ribbon-dropdown-menu cols-6">
                    {symbols.map((s) => {
                      const displayChar = isShiftPressed ? s.charShift : s.char;
                      const displayName = isShiftPressed ? s.nameShift : s.name;
                      return (
                        <button 
                          key={s.cmd} 
                          className="dropdown-symbol-item" 
                          onClick={(e) => {
                            executeCommand(s.cmd, e.shiftKey || isShiftPressed);
                            setShowSymbols(false);
                          }}
                          title={displayName}
                        >
                          <span className="symbol-char">{displayChar}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Group 6: Operators Dropdown */}
          <div className="ribbon-group symbols-dropdown-container">
            <div className="group-content">
              <button 
                className={`ribbon-btn dropdown-trigger ${showOperators ? 'active' : ''}`} 
                onClick={() => {
                  setShowOperators(!showOperators);
                  setShowSymbols(false);
                  setShowTableDropdown(false);
                }}
                title="Math Operators & Relations"
              >
                <Sigma size={15} />
                <ChevronDown size={10} className="chevron-icon" />
              </button>
              
              {showOperators && (
                <>
                  <div className="ribbon-dropdown-backdrop" onClick={() => setShowOperators(false)} />
                  <div className="ribbon-dropdown-menu cols-6">
                    {operators.map((op) => (
                      <button 
                        key={op.cmd} 
                        className="dropdown-symbol-item" 
                        onClick={() => {
                          executeCommand(op.cmd);
                          setShowOperators(false);
                        }}
                        title={op.name}
                      >
                        <span className="symbol-char">{op.char}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
