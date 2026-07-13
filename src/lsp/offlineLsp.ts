import { linter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { autocompletion } from '@codemirror/autocomplete';
import type { CompletionResult } from '@codemirror/autocomplete';

interface ParsedError {
  line: number;
  column: number;
  message: string;
}

// Regex parser to extract line, column and clean error description from typst-ts output
function parseTypstError(errorStr: string | null): ParsedError | null {
  if (!errorStr) return null;

  const match = errorStr.match(/:(\d+):(\d+)/);
  if (match) {
    const line = parseInt(match[1], 10);
    const column = parseInt(match[2], 10);
    const firstLine = errorStr.split('\n')[0] || errorStr;
    const cleanMessage = firstLine.replace(/^error:\s*/i, '');
    return { line, column, message: cleanMessage };
  }

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

    currentGlobalLine += cellLines + 1;
  }

  return null;
}

// Local variable type inference based on assignment value
function inferVariableType(varName: string, fullContent: string): 'array' | 'dictionary' | 'string' | 'any' {
  if (!varName) return 'any';
  
  const escapedVar = varName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(?:#\\s*)?\\blet\\s+${escapedVar}\\s*=\\s*([^\\n;]+)`, 'g');
  
  let match;
  let lastDefinition = '';
  
  while ((match = regex.exec(fullContent)) !== null) {
    lastDefinition = match[1].trim();
  }
  
  if (!lastDefinition) return 'any';
  
  if (lastDefinition.startsWith('"') || lastDefinition.startsWith("'")) {
    return 'string';
  }
  
  if (lastDefinition.startsWith('(')) {
    let insideQuotes = false;
    let hasColon = false;
    
    for (let i = 1; i < lastDefinition.length; i++) {
      const char = lastDefinition[i];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      }
      if (char === ':' && !insideQuotes) {
        hasColon = true;
        break;
      }
      if (char === ')' && !insideQuotes) {
        break;
      }
    }
    
    return hasColon ? 'dictionary' : 'array';
  }
  
  return 'any';
}

// Custom completion option creator supporting multiline render layout
function createCompletionOption(opt: { label: string, type: string, detail: string, info: string }) {
  return {
    label: opt.label,
    type: opt.type,
    detail: opt.detail,
    info: opt.info,
    render(completion: any) {
      const dom = document.createElement("div");
      dom.className = "cm-completion-custom-item";
      dom.style.width = "100%";
      
      const titleRow = document.createElement("div");
      titleRow.className = "cm-completion-title-row";
      titleRow.style.display = "flex";
      titleRow.style.alignItems = "center";
      titleRow.style.width = "100%";
      
      const labelSpan = document.createElement("span");
      labelSpan.className = "cm-completionLabel";
      labelSpan.textContent = completion.label;
      
      const detailSpan = document.createElement("span");
      detailSpan.className = "cm-completionDetail";
      detailSpan.textContent = completion.detail || "";
      
      titleRow.appendChild(labelSpan);
      titleRow.appendChild(detailSpan);
      dom.appendChild(titleRow);
      
      if (completion.info) {
        const descRow = document.createElement("div");
        descRow.className = "cm-completion-desc-row";
        descRow.textContent = completion.info;
        dom.appendChild(descRow);
      }
      
      return dom;
    }
  };
}

// Returns the offline CodeMirror linter extension
export function getOfflineLinter(id: string, cells: any[], compilerError: string | null) {
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
}

// Returns the offline CodeMirror autocompletion extension
export function getOfflineAutocomplete(cells: any[]) {
  return autocompletion({
    override: [
      (context): CompletionResult | null => {
        // Case A: Suggesting dot methods (e.g. a.map, a.len)
        const methodWord = context.matchBefore(/\.\w*/);
        if (methodWord) {
          const pos = context.pos - methodWord.text.length;
          const lineBefore = context.state.doc.sliceString(Math.max(0, pos - 50), pos);
          const varMatch = lineBefore.match(/([a-zA-Z_][a-zA-Z0-9_-]*)\s*$/);
          const varName = varMatch ? varMatch[1] : '';

          const fullDocSource = cells.map(c => c.content).join('\n\n');
          const varType = inferVariableType(varName, fullDocSource);

          const arrayMethods = [
            { label: 'all', type: 'method', detail: 'array.all(fn)', info: 'Whether the given function returns \'true\' for all items in the array.' },
            { label: 'any', type: 'method', detail: 'array.any(fn)', info: 'Whether the given function returns \'true\' for any item in the array.' },
            { label: 'at', type: 'method', detail: 'array.at(index)', info: 'Retrieves the value at the specified index.' },
            { label: 'chunks', type: 'method', detail: 'array.chunks(size)', info: 'Splits the array into chunks of a given size.' },
            { label: 'contains', type: 'method', detail: 'array.contains(item)', info: 'Returns true if the array contains the specified item.' },
            { label: 'dedup', type: 'method', detail: 'array.dedup()', info: 'Returns a new array with consecutive duplicate elements removed.' },
            { label: 'enumerate', type: 'method', detail: 'array.enumerate()', info: 'Returns a list of index-element pairs.' },
            { label: 'filter', type: 'method', detail: 'array.filter(fn)', info: 'Filters elements based on a predicate function.' },
            { label: 'find', type: 'method', detail: 'array.find(fn)', info: 'Returns the first element matching a predicate.' },
            { label: 'first', type: 'method', detail: 'array.first()', info: 'Returns the first element of the array.' },
            { label: 'flatten', type: 'method', detail: 'array.flatten()', info: 'Flattens nested arrays.' },
            { label: 'fold', type: 'method', detail: 'array.fold(init, fn)', info: 'Reduces the array using a fold function.' },
            { label: 'insert', type: 'method', detail: 'array.insert(index, item)', info: 'Inserts an item at the specified index.' },
            { label: 'intersperse', type: 'method', detail: 'array.intersperse(item)', info: 'Places an item between each element of the array.' },
            { label: 'len', type: 'method', detail: 'array.len()', info: 'Returns the number of elements in the array.' },
            { label: 'map', type: 'method', detail: 'array.map(fn)', info: 'Applies a function to each item in the array and returns a new array with the results.' },
            { label: 'pop', type: 'method', detail: 'array.pop()', info: 'Removes and returns the last element.' },
            { label: 'push', type: 'method', detail: 'array.push(item)', info: 'Appends an item to the end of the array.' },
            { label: 'remove', type: 'method', detail: 'array.remove(index)', info: 'Removes the element at the specified index.' },
            { label: 'rev', type: 'method', detail: 'array.rev()', info: 'Reverses the array.' },
            { label: 'slice', type: 'method', detail: 'array.slice(start, end)', info: 'Extracts a sub-slice of the array.' },
            { label: 'sorted', type: 'method', detail: 'array.sorted()', info: 'Returns a sorted copy of the array.' },
            { label: 'split', type: 'method', detail: 'array.split(sep)', info: 'Splits the array by separator.' },
          ];

          const stringMethods = [
            { label: 'len', type: 'method', detail: 'string.len()', info: 'Returns the length of the string.' },
            { label: 'at', type: 'method', detail: 'string.at(index)', info: 'Retrieves the character at the specified index.' },
            { label: 'slice', type: 'method', detail: 'string.slice(start, end)', info: 'Extracts a substring.' },
            { label: 'contains', type: 'method', detail: 'string.contains(substring)', info: 'Checks if string contains substring.' },
            { label: 'split', type: 'method', detail: 'string.split(separator)', info: 'Splits the string into array of substrings.' },
            { label: 'trim', type: 'method', detail: 'string.trim()', info: 'Removes leading and trailing whitespace.' },
            { label: 'replace', type: 'method', detail: 'string.replace(pattern, repl)', info: 'Replaces occurrences of a pattern.' },
            { label: 'clusters', type: 'method', detail: 'string.clusters()', info: 'Splits string into Unicode grapheme clusters.' },
            { label: 'starts-with', type: 'method', detail: 'string.starts-with(prefix)', info: 'Checks if string starts with prefix.' },
            { label: 'ends-with', type: 'method', detail: 'string.ends-with(suffix)', info: 'Checks if string ends with suffix.' },
          ];

          const dictionaryMethods = [
            { label: 'len', type: 'method', detail: 'dict.len()', info: 'Returns the number of pairs in the dictionary.' },
            { label: 'at', type: 'method', detail: 'dict.at(key)', info: 'Retrieves the value for the key.' },
            { label: 'keys', type: 'method', detail: 'dict.keys()', info: 'Returns an array of all dictionary keys.' },
            { label: 'values', type: 'method', detail: 'dict.values()', info: 'Returns an array of all dictionary values.' },
            { label: 'pairs', type: 'method', detail: 'dict.pairs()', info: 'Returns an array of key-value tuples.' },
            { label: 'remove', type: 'method', detail: 'dict.remove(key)', info: 'Removes key-value pair and returns value.' },
            { label: 'insert', type: 'method', detail: 'dict.insert(key, value)', info: 'Inserts key-value pair.' },
            { label: 'contains', type: 'method', detail: 'dict.contains(key)', info: 'Returns true if dictionary has key.' },
          ];

          let selectedPool = [...arrayMethods, ...stringMethods, ...dictionaryMethods];
          if (varType === 'array') {
            selectedPool = arrayMethods;
          } else if (varType === 'string') {
            selectedPool = stringMethods;
          } else if (varType === 'dictionary') {
            selectedPool = dictionaryMethods;
          }

          const query = methodWord.text.slice(1);
          return {
            from: methodWord.from + 1,
            options: selectedPool
              .filter(m => m.label.startsWith(query))
              .map(createCompletionOption),
          };
        }

        // Case B: Suggesting main hashtag calls (starts with '#')
        const hashtagWord = context.matchBefore(/#\w*/);
        if (hashtagWord) {
          const options = [
            { label: '#let', type: 'keyword', detail: 'Declare variable / function', info: 'Bind a value or function to an identifier.' },
            { label: '#set', type: 'keyword', detail: 'Set style rule', info: 'Configure basic layout and style rules.' },
            { label: '#show', type: 'keyword', detail: 'Show customization rule', info: 'Redefine how a specific element type is rendered.' },
            { label: '#import', type: 'keyword', detail: 'Import external module', info: 'Load functions or variables from a different file.' },
            { label: '#include', type: 'keyword', detail: 'Include document file', info: 'Include the contents of another Typst file inline.' },
            { label: '#if', type: 'keyword', detail: 'Conditional block', info: 'Conditionally compile markup based on expression.' },
            { label: '#for', type: 'keyword', detail: 'Loop block', info: 'Repeat markup generation over an array or range.' },
            { label: '#align', type: 'function', detail: 'Align layout elements', info: 'Align content vertically and/or horizontally.' },
            { label: '#rect', type: 'function', detail: 'Draw rectangle box', info: 'Draw a rectangle with customizable fill, stroke, and corners.' },
            { label: '#circle', type: 'function', detail: 'Draw circle bubble', info: 'Draw a circle with customizable fill and stroke.' },
            { label: '#image', type: 'function', detail: 'Load image file', info: 'Insert a raster (PNG/JPEG) or vector (SVG) image.' },
            { label: '#text', type: 'function', detail: 'Apply text style', info: 'Customize standard text settings (font family, weight, fill).' },
            { label: '#page', type: 'function', detail: 'Apply page styling', info: 'Setup page layout (dimensions, margins, headers).' },
            { label: '#grid', type: 'function', detail: 'Create multi-grid layout', info: 'Arrange columns and rows of content in a grid.' },
            { label: '#table', type: 'function', detail: 'Create a table block', info: 'Insert tabular content with custom column sizes.' },
            { label: '#pagebreak', type: 'function', detail: 'Break page', info: 'Force compile to start on a new page layout.' },
          ];
          return {
            from: hashtagWord.from,
            options: options
              .filter(o => o.label.startsWith(hashtagWord.text))
              .map(createCompletionOption),
          };
        }

        // Case C: Suggesting parameters, variables, and common functions inside brackets/params
        const word = context.matchBefore(/\w+/);
        if (!word) return null;

        const properties = [
          { label: 'width', type: 'property', detail: 'width value', info: 'Specifies width dimensions (e.g. 10cm, 50%).' },
          { label: 'height', type: 'property', detail: 'height value', info: 'Specifies height dimensions (e.g. auto, 12pt).' },
          { label: 'fill', type: 'property', detail: 'background color', info: 'Applies fill color (e.g. red, rgb("..."))' },
          { label: 'stroke', type: 'property', detail: 'border line style', info: 'Draws border lines (e.g. 1pt + black)' },
          { label: 'margin', type: 'property', detail: 'margins spacing', info: 'Configure margins on page/container layouts.' },
          { label: 'font', type: 'property', detail: 'font family name', info: 'Choose font family name string.' },
          { label: 'size', type: 'property', detail: 'font size offset', info: 'Set typography font size (e.g. 12pt).' },
          { label: 'weight', type: 'property', detail: 'font weight value', info: 'Set typography weight (e.g. "bold", 700).' },
          { label: 'spacing', type: 'property', detail: 'spacing offset', info: 'Configure layout spacing.' },
          { label: 'align', type: 'property', detail: 'alignment orientation', info: 'Choose alignment orientation.' },
          { label: 'range', type: 'function', detail: 'range function', info: 'Create an array sequence of integers.' },
          { label: 'min', type: 'function', detail: 'minimum value', info: 'Find minimum number in list.' },
          { label: 'max', type: 'function', detail: 'maximum value', info: 'Find maximum number in list.' },
          { label: 'abs', type: 'function', detail: 'absolute value', info: 'Get absolute number.' },
          { label: 'calc', type: 'keyword', detail: 'calculations', info: 'Access math calculation helper functions.' },
          { label: 'assert', type: 'function', detail: 'assertion check', info: 'Fail compilation if condition is false.' },
          { label: 'true', type: 'keyword', detail: 'boolean true', info: 'Boolean true constant.' },
          { label: 'false', type: 'keyword', detail: 'boolean false', info: 'Boolean false constant.' },
          { label: 'none', type: 'keyword', detail: 'none value', info: 'Represents empty value.' },
          { label: 'auto', type: 'keyword', detail: 'automatic sizing', info: 'Lets layout calculate automatically.' },
        ];

        return {
          from: word.from,
          options: properties
            .filter(o => o.label.startsWith(word.text))
            .map(createCompletionOption),
        };
      }
    ]
  });
}
