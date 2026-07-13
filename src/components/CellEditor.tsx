import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';
import { linter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { autocompletion } from '@codemirror/autocomplete';
import type { CompletionResult } from '@codemirror/autocomplete';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateCellContent, updateCellTitle } from '../store/documentSlice';

// Helper structures for compilation errors mapping
interface ParsedError {
  line: number;
  column: number;
  message: string;
}

// Regex parser to extract line, column and clean error description from typst-ts output
function parseTypstError(errorStr: string | null): ParsedError | null {
  if (!errorStr) return null;

  // Matches "main.typ:4:13" pattern
  const match = errorStr.match(/:(\d+):(\d+)/);
  if (match) {
    const line = parseInt(match[1], 10);
    const column = parseInt(match[2], 10);
    const firstLine = errorStr.split('\n')[0] || errorStr;
    const cleanMessage = firstLine.replace(/^error:\s*/i, '');
    return { line, column, message: cleanMessage };
  }

  // Fallback match for "at line X, column Y"
  const matchAlt = errorStr.match(/at line (\d+)(?:,\s*column\s*(\d+))?/i);
  if (matchAlt) {
    const line = parseInt(matchAlt[1], 10);
    const column = matchAlt[2] ? parseInt(matchAlt[2], 10) : 1;
    const firstLine = errorStr.split('\n')[0] || errorStr;
    const cleanMessage = firstLine.replace(/^error:\s*/i, '');
    return { line, column, message: cleanMessage };
  }

  return null;
}

// Maps a global compiled source line number back to its specific Cell and cell line
function mapGlobalLineToCell(globalLine: number, cells: any[]): { cellId: string; cellLine: number } | null {
  let currentGlobalLine = 1;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cellLines = cell.content.split('\n').length;
    const startLine = currentGlobalLine;
    const endLine = currentGlobalLine + cellLines - 1;

    if (globalLine >= startLine && globalLine <= endLine) {
      return {
        cellId: cell.id,
        cellLine: globalLine - startLine + 1
      };
    }

    // Offset account for the cell lines and the join('\n\n') newline separation (+1 empty line)
    currentGlobalLine += cellLines + 1;
  }

  return null;
}

// Define a custom IntelliJ IDEA Dark theme (New UI style)
const intellijDarkTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#1e1f22', // IntelliJ background
    foreground: '#bcbec4', // IntelliJ default text
    caret: '#ffffff',      // caret indicator
    selection: '#214283',  // blue selection highlight
    gutterBackground: '#1e1f22',
    gutterForeground: '#6f737a', // line numbers
    lineHighlight: 'rgba(255, 255, 255, 0.015)',
  },
  styles: [
    { tag: t.keyword, color: '#cf8e6d', fontWeight: 'bold' },     // orange keywords
    { tag: t.comment, color: '#7a7e85', fontStyle: 'italic' },    // grey comments
    { tag: t.string, color: '#6aab73' },                          // green strings
    { tag: t.heading, color: '#ffffff', fontWeight: 'bold' },     // white headings
    { tag: t.meta, color: '#29c2b6' },                            // teal-green for math delimiters ($)
    { tag: t.typeName, color: '#ffc66d' },                         // yellow built-ins
    { tag: t.propertyName, color: '#9876aa' },                    // lavender parameters
    { tag: t.atom, color: '#56b6c2' },                            // cyan constants
    { tag: t.number, color: '#2eb5e8' },                          // light blue numbers
    { tag: t.operator, color: '#bcbec4' },                        // gray operators
    { tag: t.variableName, color: '#9876aa' },                    // lavender variables
    { tag: t.emphasis, fontStyle: 'italic', fontWeight: 'bold' }
  ],
});

// A highly precise, stateful tokenizer for the Typst language.
// Handles markup mode, math mode, raw blocks, comments, and stateful code mode.
const typstHighlightLanguage = StreamLanguage.define({
  name: 'typst',
  token(stream, state: any) {
    // Reset single-line code mode at the start of a new line
    if (stream.sol()) {
      if (state.stack[state.stack.length - 1] === 'code' && state.inCodeLine) {
        state.stack.pop();
        state.inCodeLine = false;
      }
    }

    // 1. Handle Multi-line comments
    if (state.inBlockComment) {
      if (stream.match('*/')) {
        state.inBlockComment = false;
      } else {
        stream.next();
      }
      return 'comment';
    }
    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'comment';
    }

    // 2. Handle Single-line comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // 3. Handle Raw Blocks (multiline code blocks like ``` ... ```)
    if (state.inRawBlock) {
      if (stream.match('```')) {
        state.inRawBlock = false;
      } else {
        stream.next();
      }
      return 'string';
    }
    if (stream.match('```')) {
      state.inRawBlock = true;
      return 'string';
    }

    // 4. Handle Math Mode $ ... $
    if (state.inMath) {
      if (stream.match('$')) {
        state.inMath = false;
        return 'meta'; // delimiter $
      }
      if (stream.match('#')) {
        const match = stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/) as RegExpMatchArray | null;
        if (match) {
          const bracketMatch = stream.match(/^\s*[({[]/, false) as RegExpMatchArray | null;
          if (bracketMatch) {
            const bracket = bracketMatch[0].trim();
            if (bracket === '[') {
              state.stack.push('markup');
              state.markupDepth.push(1);
            } else {
              state.stack.push('code');
              state.codeBrackets.push(1);
              stream.match(/^\s*[({[]/); // consume
            }
            return 'keyword';
          }
          return 'keyword';
        }
        return 'operator';
      }
      // Operators and numbers in math mode are default/white
      if (stream.match(new RegExp('[-+*/=^_<>&|]+'))) {
        return null;
      }
      if (stream.match(/[0-9]+/)) {
        return null;
      }
      // Words/variables in math mode are lavender-purple
      if (stream.match(/[a-zA-Z]+/)) {
        return 'variableName';
      }
      stream.next();
      return null;
    }
    if (stream.match('$')) {
      state.inMath = true;
      return 'meta'; // delimiter $
    }

    // Get current mode from top of stack
    const currentMode = state.stack[state.stack.length - 1] || 'markup';

    // 5. Code Mode Logic
    if (currentMode === 'code') {
      // Brackets closing
      if (stream.match(/[)\]}]/)) {
        const topBrackets = state.codeBrackets.length - 1;
        state.codeBrackets[topBrackets] = Math.max(0, state.codeBrackets[topBrackets] - 1);
        
        if (state.codeBrackets[topBrackets] === 0 && !state.inCodeLine) {
          state.stack.pop();
          state.codeBrackets.pop();
        }
        return 'bracket';
      }
      
      // Brackets opening (except '[')
      if (stream.match(/[({]/)) {
        const topBrackets = state.codeBrackets.length - 1;
        state.codeBrackets[topBrackets]++;
        return 'bracket';
      }

      // '[' starts a content block (markup mode) inside code mode!
      if (stream.match('[')) {
        state.stack.push('markup');
        state.markupDepth.push(1);
        return 'bracket';
      }

      // Keywords in code mode
      if (stream.match(/\b(let|set|show|if|else|for|while|import|include|return|and|or|not|in|as)\b/)) {
        return 'keyword';
      }

      // Atoms / Constants
      if (stream.match(/\b(true|false|none|auto)\b/)) {
        return 'atom';
      }

      // Built-in functions / colors / styles
      if (stream.match(/\b(rgb|luma|align|rect|square|circle|image|text|page|grid|table|colbreak|pagebreak)\b/)) {
        return 'typeName';
      }

      // Properties / Parameters (e.g. "width:")
      if (stream.match(/[a-zA-Z0-9_-]+(?=\s*:)/)) {
        return 'propertyName';
      }

      // Strings
      if (stream.match(/"[^"\\]*(?:\\.[^"\\]*)*"/)) {
        return 'string';
      }

      // Numbers with units (e.g. 10cm, 12pt, 1.5em, 50%)
      if (stream.match(/[0-9]+(?:\.[0-9]+)?(?:pt|mm|cm|in|em|fr|%)/)) {
        return 'number';
      }

      // Regular numbers
      if (stream.match(/[0-9]+(?:\.[0-9]+)?/)) {
        return 'number';
      }

      // Operators
      if (stream.match(new RegExp('[-+*/=<>!&|]+'))) {
        return 'operator';
      }

      // Identifiers / variables
      if (stream.match(/[a-zA-Z_][a-zA-Z0-9_-]*/)) {
        return 'variableName';
      }

      // Skip whitespace
      if (stream.eatSpace()) return null;

      stream.next();
      return null;
    }

    // 6. Markup Mode Logic
    // Headings (starts with '=' at start of line)
    if (stream.sol() && stream.match(/=+ /)) {
      stream.skipToEnd();
      return 'heading';
    }

    // List bullets (e.g. "- " or "+ " or "1. ")
    if (stream.sol() && stream.match(/(?:[-+]\s+|[0-9]+\.\s+)/)) {
      return 'meta';
    }

    // Brackets inside markup (for nested content blocks `[Outer [Inner]]`)
    if (stream.match('[')) {
      if (state.markupDepth.length > 0) {
        state.markupDepth[state.markupDepth.length - 1]++;
      }
      return 'bracket';
    }
    if (stream.match(']')) {
      if (state.markupDepth.length > 0) {
        state.markupDepth[state.markupDepth.length - 1]--;
        if (state.markupDepth[state.markupDepth.length - 1] === 0) {
          state.stack.pop();
          state.markupDepth.pop();
        }
      }
      return 'bracket';
    }

    // Code mode starter '#'
    if (stream.match('#')) {
      const match = stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/) as RegExpMatchArray | null;
      if (match) {
        const word = match[0];
        // Keywords like #let, #set, #show enter code mode
        if (['let', 'set', 'show', 'if', 'else', 'for', 'while', 'import', 'include', 'return'].includes(word)) {
          state.stack.push('code');
          const bracketMatch = stream.match(/^\s*[({[]/, false) as RegExpMatchArray | null;
          if (bracketMatch) {
            const bracket = bracketMatch[0].trim();
            if (bracket === '[') {
              state.stack.pop();
              state.stack.push('markup');
              state.markupDepth.push(1);
              stream.match(/^\s*\[/); // consume it
            } else {
              state.codeBrackets.push(1);
              stream.match(/^\s*[({]/); // consume it
            }
          } else {
            state.inCodeLine = true;
            state.codeBrackets.push(0);
          }
          return 'keyword';
        }
        // Custom or built-in functions
        stream.match(/^(\.[a-zA-Z_][a-zA-Z0-9_-]*)*/);
        const bracketMatch = stream.match(/^\s*[({[]/, false) as RegExpMatchArray | null;
        if (bracketMatch) {
          const bracket = bracketMatch[0].trim();
          if (bracket === '[') {
            state.stack.push('markup');
            state.markupDepth.push(1);
            stream.match(/^\s*\[/); // consume it
          } else {
            state.stack.push('code');
            state.codeBrackets.push(1);
            stream.match(/^\s*[({]/); // consume it
          }
        }
        return 'typeName';
      }
      return 'operator';
    }

    // Inline bold formatting *text*
    if (stream.match(/\*[^*]+\*/)) {
      return 'emphasis';
    }

    // Inline italic formatting _text_
    if (stream.match(/_[^_]+_/)) {
      return 'emphasis';
    }

    // Monospaced code inline `text`
    if (stream.match(/`[^`]*`/)) {
      return 'string';
    }

    // Plain text
    stream.next();
    return null;
  },
  startState() {
    return {
      inBlockComment: false,
      inRawBlock: false,
      inMath: false,
      stack: ['markup'],
      codeBrackets: [],
      markupDepth: [],
      inCodeLine: false
    };
  },
  copyState(state: any) {
    return {
      inBlockComment: state.inBlockComment,
      inRawBlock: state.inRawBlock,
      inMath: state.inMath,
      stack: [...state.stack],
      codeBrackets: [...state.codeBrackets],
      markupDepth: [...state.markupDepth],
      inCodeLine: state.inCodeLine
    };
  }
});

interface CellEditorProps {
  id: string;
  content: string;
  title?: string;
  isActive: boolean;
  onFocus: () => void;
  index: number;
}

export const CellEditor: React.FC<CellEditorProps> = ({
  id,
  content,
  title,
  isActive,
  onFocus,
  index
}) => {
  const dispatch = useAppDispatch();
  const compilerError = useAppSelector((state) => state.document.compilerError);
  const cells = useAppSelector((state) => state.document.cells);

  const handleCodeChange = (value: string) => {
    dispatch(updateCellContent({ id, content: value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateCellTitle({ id, title: e.target.value }));
  };

  // 1. Reactive Linter logic mapping compiled errors to current cell
  const cellLinter = React.useMemo(() => {
    return linter((view) => {
      const diagnostics: Diagnostic[] = [];
      if (!compilerError) return diagnostics;

      const parsed = parseTypstError(compilerError);
      if (!parsed) return diagnostics;

      const mapped = mapGlobalLineToCell(parsed.line, cells);
      if (mapped && mapped.cellId === id) {
        const lineNum = Math.min(Math.max(1, mapped.cellLine), view.state.doc.lines);
        const line = view.state.doc.line(lineNum);
        
        diagnostics.push({
          from: line.from,
          to: line.to,
          severity: 'error',
          message: parsed.message,
        });
      }
      return diagnostics;
    });
  }, [compilerError, cells, id]);

  // 2. Rich Local Autocomplete for Typst elements
  const typstAutocomplete = React.useMemo(() => {
    return autocompletion({
      override: [
        (context): CompletionResult | null => {
          // Case A: Suggesting dot methods (e.g. a.map, a.len)
          const methodWord = context.matchBefore(/\.\w*/);
          if (methodWord) {
            const methods = [
              { label: 'map', type: 'method', detail: 'array.map(item => ...)' },
              { label: 'filter', type: 'method', detail: 'array.filter(item => ...)' },
              { label: 'find', type: 'method', detail: 'array.find(item => ...)' },
              { label: 'fold', type: 'method', detail: 'array.fold(init, (acc, item) => ...)' },
              { label: 'any', type: 'method', detail: 'array.any(item => ...)' },
              { label: 'all', type: 'method', detail: 'array.all(item => ...)' },
              { label: 'len', type: 'method', detail: 'collection.len()' },
              { label: 'at', type: 'method', detail: 'collection.at(index)' },
              { label: 'slice', type: 'method', detail: 'collection.slice(start, end)' },
              { label: 'insert', type: 'method', detail: 'collection.insert(index, item)' },
              { label: 'remove', type: 'method', detail: 'collection.remove(index)' },
              { label: 'push', type: 'method', detail: 'array.push(item)' },
              { label: 'pop', type: 'method', detail: 'array.pop()' },
              { label: 'contains', type: 'method', detail: 'collection.contains(item)' },
              { label: 'join', type: 'method', detail: 'array.join(separator)' },
              { label: 'keys', type: 'method', detail: 'dictionary.keys()' },
              { label: 'values', type: 'method', detail: 'dictionary.values()' },
              { label: 'pairs', type: 'method', detail: 'dictionary.pairs()' },
              { label: 'split', type: 'method', detail: 'string.split(separator)' },
              { label: 'replace', type: 'method', detail: 'string.replace(pattern, replacement)' },
              { label: 'trim', type: 'method', detail: 'string.trim()' },
            ];
            const query = methodWord.text.slice(1);
            return {
              from: methodWord.from + 1,
              options: methods.filter(m => m.label.startsWith(query)),
            };
          }

          // Case B: Suggesting main hashtag calls (starts with '#')
          const hashtagWord = context.matchBefore(/#\w*/);
          if (hashtagWord) {
            const options = [
              { label: '#let', type: 'keyword', detail: 'Declare variable / function' },
              { label: '#set', type: 'keyword', detail: 'Set style rule' },
              { label: '#show', type: 'keyword', detail: 'Show customization rule' },
              { label: '#import', type: 'keyword', detail: 'Import external module' },
              { label: '#include', type: 'keyword', detail: 'Include document file' },
              { label: '#if', type: 'keyword', detail: 'Conditional block' },
              { label: '#for', type: 'keyword', detail: 'Loop block' },
              { label: '#align', type: 'function', detail: 'Align layout elements' },
              { label: '#rect', type: 'function', detail: 'Draw rectangle box' },
              { label: '#circle', type: 'function', detail: 'Draw circle bubble' },
              { label: '#image', type: 'function', detail: 'Load image file' },
              { label: '#text', type: 'function', detail: 'Apply text style' },
              { label: '#page', type: 'function', detail: 'Apply page styling' },
              { label: '#grid', type: 'function', detail: 'Create multi-grid layout' },
              { label: '#table', type: 'function', detail: 'Create a table block' },
              { label: '#pagebreak', type: 'function', detail: 'Break page' },
            ];
            return {
              from: hashtagWord.from,
              options: options.filter(o => o.label.startsWith(hashtagWord.text)),
            };
          }

          // Case C: Suggesting parameters, variables, and common functions inside brackets/params
          const word = context.matchBefore(/\w+/);
          if (!word) return null;

          const properties = [
            { label: 'width', type: 'property', detail: 'width value (e.g. 10cm, 50%)' },
            { label: 'height', type: 'property', detail: 'height value (e.g. auto, 12pt)' },
            { label: 'fill', type: 'property', detail: 'background color (e.g. red, rgb("..."))' },
            { label: 'stroke', type: 'property', detail: 'border line style (e.g. 1pt + black)' },
            { label: 'margin', type: 'property', detail: 'margins (e.g. 1.5cm)' },
            { label: 'font', type: 'property', detail: 'font family name' },
            { label: 'size', type: 'property', detail: 'font size (e.g. 12pt)' },
            { label: 'weight', type: 'property', detail: 'font weight value' },
            { label: 'spacing', type: 'property', detail: 'spacing offset' },
            { label: 'align', type: 'property', detail: 'alignment orientation' },
            { label: 'range', type: 'function', detail: 'range(limit) / range(start, end)' },
            { label: 'min', type: 'function', detail: 'min(a, b, ...)' },
            { label: 'max', type: 'function', detail: 'max(a, b, ...)' },
            { label: 'abs', type: 'function', detail: 'abs(value)' },
            { label: 'calc', type: 'keyword', detail: 'Math calculations module' },
            { label: 'assert', type: 'function', detail: 'assert(condition)' },
            { label: 'true', type: 'keyword' },
            { label: 'false', type: 'keyword' },
            { label: 'none', type: 'keyword' },
            { label: 'auto', type: 'keyword' },
          ];

          return {
            from: word.from,
            options: properties.filter(o => o.label.startsWith(word.text)),
          };
        }
      ]
    });
  }, []);

  return (
    <div className={`code-cell ${isActive ? 'active' : ''}`} onClick={onFocus}>
      <div className="cell-header-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div className="cell-lang-tag">Cell [{index}]</div>
        <span style={{ color: '#404249', fontSize: '10px' }}>|</span>
        <input
          type="text"
          className="cell-title-input"
          value={title || ''}
          onChange={handleTitleChange}
          onFocus={onFocus}
          placeholder="Unnamed Block"
          spellCheck={false}
        />
      </div>
      
      <div className="editor-wrapper" style={{ border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <CodeMirror
          value={content}
          height="auto"
          theme={intellijDarkTheme}
          extensions={[typstHighlightLanguage, cellLinter, typstAutocomplete]}
          onChange={handleCodeChange}
          onFocus={onFocus}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: true,
            tabSize: 2,
          }}
          style={{ fontSize: '13px', fontFamily: 'Fira Code, monospace' }}
        />
      </div>
    </div>
  );
};
