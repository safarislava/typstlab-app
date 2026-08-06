import * as Y from 'yjs';
import type { Cell } from '../store/documentSlice';

const fileYDocs = new Map<string, Y.Doc>();
const fileYjsStates = new Map<string, string>();

export function getOrCreateFileYDoc(fileId?: string): Y.Doc {
  if (!fileId) return new Y.Doc();
  let doc = fileYDocs.get(fileId);
  if (!doc) {
    doc = new Y.Doc();
    fileYDocs.set(fileId, doc);
  }
  return doc;
}

export function updateFileYjsState(fileId: string, base64State: string) {
  if (fileId && base64State) {
    fileYjsStates.set(fileId, base64State);
  }
}

/**
 * Encodes a list of visual cells into a base64-encoded Yjs state update.
 * Updates existing Y.Map blocks in-place using their cell ID so that Yjs
 * modifies map properties instead of appending duplicate blocks to yarray.
 */
export function encodeCellsToYjsDelta(arg1: string | Cell[], arg2?: Cell[]): string {
  let fileId: string | undefined;
  let cells: Cell[] = [];

  if (typeof arg1 === 'string') {
    fileId = arg1;
    cells = arg2 || [];
  } else {
    cells = arg1 || [];
  }

  const ydoc = getOrCreateFileYDoc(fileId);
  const serverBase64State = fileId ? fileYjsStates.get(fileId) : undefined;

  if (serverBase64State) {
    try {
      const binary = base64ToUint8Array(serverBase64State);
      Y.applyUpdate(ydoc, binary);
    } catch (e) {
      console.warn('Failed to apply server Yjs state vector:', e);
    }
  }

  const stateVectorBefore = Y.encodeStateVector(ydoc);
  const yarray = ydoc.getArray('blocks');

  ydoc.transact(() => {
    // 1. Build a lookup map of existing Y.Map elements in yarray by block ID
    const existingMapsById = new Map<string, Y.Map<any>>();

    for (let i = 0; i < yarray.length; i++) {
      const item = yarray.get(i);
      if (item && typeof (item as any).get === 'function') {
        const id = (item as any).get('id');
        if (id && typeof id === 'string') {
          // Keep the first instance if duplicates exist
          if (!existingMapsById.has(id)) {
            existingMapsById.set(id, item as Y.Map<any>);
          }
        }
      }
    }

    const newCellIds = new Set<string>();

    // 2. Update existing Y.Map elements in-place or insert new ones
    cells.forEach((cell, targetIndex) => {
      const validCellId = (cell.id && cell.id.includes('-') && !cell.id.startsWith('cell-')) ? cell.id : crypto.randomUUID();
      newCellIds.add(validCellId);

      let ymap = existingMapsById.get(validCellId);
      if (ymap) {
        // In-place update of properties (prevents Yjs block duplication)
        if (ymap.get('name') !== (cell.title || '')) {
          ymap.set('name', cell.title || '');
        }
        if (ymap.get('content') !== (cell.content || '')) {
          ymap.set('content', cell.content || '');
        }
      } else {
        // Brand new block insertion
        ymap = new Y.Map();
        ymap.set('id', validCellId);
        ymap.set('name', cell.title || '');
        ymap.set('content', cell.content || '');
        yarray.insert(targetIndex < yarray.length ? targetIndex : yarray.length, [ymap]);
        existingMapsById.set(validCellId, ymap);
      }
    });

    // 3. Remove any Y.Map elements that are no longer in cells or are duplicates
    for (let i = yarray.length - 1; i >= 0; i--) {
      const item = yarray.get(i);
      if (item && typeof (item as any).get === 'function') {
        const id = (item as any).get('id');
        if (!id || !newCellIds.has(id)) {
          yarray.delete(i, 1);
        }
      }
    }
  });

  const update = serverBase64State
    ? Y.encodeStateAsUpdate(ydoc, stateVectorBefore)
    : Y.encodeStateAsUpdate(ydoc);

  return uint8ArrayToBase64(update);
}

/**
 * Decodes a base64-encoded Yjs state update and extracts cells (blocks).
 * Deduplicates blocks by ID in case server state accumulated duplicate blocks.
 */
export function decodeYjsDeltaToCells(base64Update: string): Cell[] {
  try {
    const binary = base64ToUint8Array(base64Update);
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, binary);
    
    const yarray = ydoc.getArray('blocks');
    const cells: Cell[] = [];
    const seenIds = new Set<string>();
    
    for (let i = 0; i < yarray.length; i++) {
      const ymap = yarray.get(i) as Y.Map<any>;
      if (ymap && typeof ymap.get === 'function') {
        const rawId = ymap.get('id');
        const validId = (rawId && typeof rawId === 'string' && rawId.includes('-') && !rawId.startsWith('cell-')) ? rawId : crypto.randomUUID();
        
        if (!seenIds.has(validId)) {
          seenIds.add(validId);
          cells.push({
            id: validId,
            content: ymap.get('content') || '',
            title: ymap.get('name') || ''
          });
        }
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
