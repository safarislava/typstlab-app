import type { Cell } from '../store/documentSlice';

/**
 * Escapes special characters for XML compatibility.
 */
export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Normalizes XML indentation and removes leading/trailing formatting spaces from blocks.
 */
function cleanXmlBlockContent(rawContent: string): string {
  // Split into lines
  const lines = rawContent.split(/\r?\n/);
  
  // Remove first line if it is empty/whitespace-only (typically after the opening tag)
  if (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  
  // Remove last line if it is empty/whitespace-only (typically before the closing tag)
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  
  if (lines.length === 0) {
    return '';
  }

  // Find minimum common indentation of all non-empty lines
  let minIndent = Infinity;
  lines.forEach(line => {
    if (line.trim() === '') return; // Skip empty lines for calculating indentation
    const match = line.match(/^([ \t]*)/);
    if (match) {
      const indentLength = match[1].length;
      if (indentLength < minIndent) {
        minIndent = indentLength;
      }
    }
  });

  if (minIndent === Infinity) {
    minIndent = 0;
  }

  // Strip the minimum common indentation from all lines
  const cleanedLines = lines.map(line => {
    if (line.length >= minIndent) {
      const prefix = line.substring(0, minIndent);
      if (/^[ \t]*$/.test(prefix)) {
        return line.substring(minIndent);
      }
    }
    return line.replace(/^[ \t]*/, ''); // Fallback
  });

  return cleanedLines.join('\n');
}

/**
 * Parses an XML string of block elements into Cell objects.
 * If the string is not valid XML or lacks a <document> root, it throws an error.
 */
export function parseXmlToCells(xmlString: string): Cell[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('XML parsing error: ' + parserError[0].textContent);
  }

  const documentElement = xmlDoc.documentElement;
  if (documentElement.nodeName !== 'document') {
    throw new Error('Root element must be <document>');
  }

  const blockNodes = xmlDoc.getElementsByTagName('block');
  const cells: Cell[] = [];

  for (let i = 0; i < blockNodes.length; i++) {
    const node = blockNodes[i];
    const id = node.getAttribute('id') || `cell-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const title = node.getAttribute('name') || undefined;
    const cleanedContent = cleanXmlBlockContent(node.textContent || '');

    cells.push({
      id,
      title,
      content: cleanedContent
    });
  }

  return cells;
}

/**
 * Serializes Cell objects into the XML block format.
 */
export function serializeCellsToXml(cells: Cell[]): string {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<document>\n';
  cells.forEach(cell => {
    const id = cell.id;
    const name = cell.title || '';
    xml += `    <block id="${escapeXml(id)}" name="${escapeXml(name)}">\n`;
    
    const contentLines = cell.content.split(/\r?\n/);
    contentLines.forEach(line => {
      if (line.trim() === '') {
        xml += '\n';
      } else {
        xml += `        ${escapeXml(line)}\n`;
      }
    });
    xml += '    </block>\n';
  });
  xml += '</document>\n';
  return xml;
}
