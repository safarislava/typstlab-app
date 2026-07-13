import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';
import { useAppDispatch } from '../store/hooks';
import { updateCellContent, updateCellTitle } from '../store/documentSlice';

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
      state.inCodeLine = false;
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
      // Code interpolation inside math mode (e.g. #a)
      if (stream.match('#')) {
        stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/);
        return 'keyword';
      }
      // Operators in math mode are white/default
      if (stream.match(new RegExp('[-+*/=^_<>&|]+'))) {
        return null;
      }
      // Numbers in math mode are white/default
      if (stream.match(/[0-9]+/)) {
        return null;
      }
      // Words/variables in math mode (e.g. omega, Omega, dot) are lavender-purple
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

    // 5. Handle Code Mode (inside brackets/parentheses, or on a single-line statement like #let)
    if (state.codeModeBrackets > 0 || state.inCodeLine) {
      // Brackets closing (exits code mode if brackets drop to 0 and not in a code line)
      if (stream.match(/[)\]}]/)) {
        state.codeModeBrackets = Math.max(0, state.codeModeBrackets - 1);
        return 'bracket';
      }
      // Brackets opening
      if (stream.match(/[({[]/)) {
        state.codeModeBrackets++;
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

    // 6. Handle Markup Mode
    // Headings (starts with '=' at start of line)
    if (stream.sol() && stream.match(/=+ /)) {
      stream.skipToEnd();
      return 'heading';
    }

    // List bullets (e.g. "- " or "+ " or "1. ")
    if (stream.sol() && stream.match(/(?:[-+]\s+|[0-9]+\.\s+)/)) {
      return 'meta';
    }

    // Code mode starter '#'
    if (stream.match('#')) {
      const match = stream.match(/^[a-zA-Z_][a-zA-Z0-9_-]*/) as RegExpMatchArray | null;
      if (match) {
        const word = match[0];
        // Keywords like #let, #set, #show enter single-line code mode
        if (['let', 'set', 'show', 'if', 'else', 'for', 'while', 'import', 'include', 'return'].includes(word)) {
          state.inCodeLine = true;
          if (stream.match(/^\s*[({[]/, false)) {
            state.codeModeBrackets = 1;
            stream.match(/^\s*[({[]/); // consume the bracket
          }
          return 'keyword';
        }
        // Custom or built-in functions
        if (stream.match(/^\s*[({[]/, false)) {
          state.codeModeBrackets = 1;
          stream.match(/^\s*[({[]/); // consume the bracket
          return 'typeName';
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
      codeModeBrackets: 0,
      inCodeLine: false
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

  const handleCodeChange = (value: string) => {
    dispatch(updateCellContent({ id, content: value }));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateCellTitle({ id, title: e.target.value }));
  };

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
          extensions={[typstHighlightLanguage]}
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
