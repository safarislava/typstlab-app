import type { TypstFile } from '../store/documentSlice';
import { serializeCellsToXml } from './xmlSerializer';

/**
 * Initiates a browser download for a Blob with a given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts a TypstFile to its serialized format (XML blocks for .typxml files)
 * and triggers the download.
 */
export function downloadTypstFile(file: TypstFile): void {
  if (file.isBinary) {
    if (!file.binaryData) return;
    const blob = new Blob([file.binaryData as any], { type: 'application/octet-stream' });
    downloadBlob(blob, file.path);
    return;
  }

  let content = '';
  let mimeType = 'text/plain';

  if (file.path.endsWith('.typxml') && file.cells) {
    content = serializeCellsToXml(file.cells);
    mimeType = 'text/xml';
  } else if (file.cells) {
    content = file.cells.map(c => c.content).join('\n\n');
  }

  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, file.path);
}
