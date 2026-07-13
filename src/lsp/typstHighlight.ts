import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';

// Define a custom IntelliJ IDEA Dark theme (New UI style)
export const intellijDarkTheme = createTheme({
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
export const typstHighlightLanguage = StreamLanguage.define({
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
      // Code interpolation inside math mode (e.g. #a or #b.at(i))
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
    if (stream.sol() && stream.match(/[-+]\s+|[0-9]+\.\s+/)) {
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
