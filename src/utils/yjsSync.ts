import * as Y from 'yjs';
import type { Cell } from '../store/documentSlice';

/**
 * Encodes a list of visual cells into a base64-encoded Yjs state update.
 * The backend expects a shared Y.Array named 'blocks' containing Y.Maps of block properties.
 */
export function encodeCellsToYjsDelta(cells: Cell[]): string {
  const ydoc = new Y.Doc();
  const yarray = ydoc.getArray('blocks');

  const ymaps = cells.map(cell => {
    const ymap = new Y.Map();
    const validCellId = (cell.id && cell.id.includes('-') && !cell.id.startsWith('cell-')) ? cell.id : crypto.randomUUID();
    ymap.set('id', validCellId);
    ymap.set('name', cell.title || '');
    ymap.set('content', cell.content || '');
    return ymap;
  });

  yarray.insert(0, ymaps);

  const update = Y.encodeStateAsUpdate(ydoc);
  
  // Safe cross-platform Uint8Array to base64 conversion in browser
  return uint8ArrayToBase64(update);
}

/**
 * Decodes a base64-encoded Yjs state update and extracts cells (blocks).
 */
export function decodeYjsDeltaToCells(base64Update: string): Cell[] {
  try {
    const binary = base64ToUint8Array(base64Update);
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, binary);
    
    const yarray = ydoc.getArray('blocks');
    const cells: Cell[] = [];
    
    for (let i = 0; i < yarray.length; i++) {
      const ymap = yarray.get(i) as Y.Map<any>;
      if (ymap && typeof ymap.get === 'function') {
        const rawId = ymap.get('id');
        const validId = (rawId && typeof rawId === 'string' && rawId.includes('-') && !rawId.startsWith('cell-')) ? rawId : crypto.randomUUID();
        cells.push({
          id: validId,
          content: ymap.get('content') || '',
          title: ymap.get('name') || ''
        });
      }
    }
    
    return cells;
  } catch (err) {
    console.error('Failed to decode Yjs state update:', err);
    return [];
  }
}

// Utility helper: Uint8Array to Base64
export function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return window.btoa(binary);
}

// Utility helper: Base64 to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes the Yjs State Vector of visual cells to base64 string (~10-100 bytes).
 */
export function encodeYjsStateVector(cells: Cell[]): string {
  try {
    const ydoc = new Y.Doc();
    const yarray = ydoc.getArray('blocks');

    const ymaps = cells.map(cell => {
      const ymap = new Y.Map();
      const validCellId = (cell.id && cell.id.includes('-') && !cell.id.startsWith('cell-')) ? cell.id : crypto.randomUUID();
      ymap.set('id', validCellId);
      ymap.set('name', cell.title || '');
      ymap.set('content', cell.content || '');
      return ymap;
    });

    yarray.insert(0, ymaps);

    const sv = Y.encodeStateVector(ydoc);
    return uint8ArrayToBase64(sv);
  } catch (err) {
    console.error('Failed to encode Yjs state vector:', err);
    return '';
  }
}

/**
 * Applies a Yjs update delta to existing cells and returns the updated cells array.
 */
export function applyYjsDelta(cells: Cell[], base64Update: string): Cell[] {
  try {
    const ydoc = new Y.Doc();
    const yarray = ydoc.getArray('blocks');

    // Populate initial state into doc
    const ymaps = cells.map(cell => {
      const ymap = new Y.Map();
      ymap.set('id', cell.id);
      ymap.set('name', cell.title || '');
      ymap.set('content', cell.content || '');
      return ymap;
    });
    yarray.insert(0, ymaps);

    // Apply update from server
    const binary = base64ToUint8Array(base64Update);
    Y.applyUpdate(ydoc, binary);

    // Re-extract updated cells
    const updatedCells: Cell[] = [];
    for (let i = 0; i < yarray.length; i++) {
      const ymap = yarray.get(i) as Y.Map<any>;
      if (ymap && typeof ymap.get === 'function') {
        updatedCells.push({
          id: ymap.get('id') || `cell-${Date.now()}-${i}`,
          content: ymap.get('content') || '',
          title: ymap.get('name') || ''
        });
      }
    }

    return updatedCells;
  } catch (err) {
    console.error('Failed to apply Yjs update:', err);
    return cells;
  }
}
