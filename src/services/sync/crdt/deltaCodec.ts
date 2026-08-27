import * as Y from 'yjs';
import type { Cell } from '../../../core/types';
import { yjsDocManager } from './yjsDocManager';

export function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return window.btoa(binary);
}

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
 * Encodes visual cells into a base64 Yjs update delta.
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

  const ydoc = yjsDocManager.getOrCreateDoc(fileId);
  const serverBase64State = fileId ? yjsDocManager.getServerState(fileId) : undefined;

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
    const existingMapsById = new Map<string, Y.Map<any>>();

    for (let i = 0; i < yarray.length; i++) {
      const item = yarray.get(i);
      if (item && typeof (item as any).get === 'function') {
        const id = (item as any).get('id');
        if (id && typeof id === 'string') {
          if (!existingMapsById.has(id)) {
            existingMapsById.set(id, item as Y.Map<any>);
          }
        }
      }
    }

    const newCellIds = new Set<string>();

    cells.forEach((cell, targetIndex) => {
      const validCellId = (cell.id && cell.id.includes('-') && !cell.id.startsWith('cell-'))
        ? cell.id
        : crypto.randomUUID();
      newCellIds.add(validCellId);

      let ymap = existingMapsById.get(validCellId);
      if (ymap) {
        if (ymap.get('name') !== (cell.title || '')) {
          ymap.set('name', cell.title || '');
        }
        if (ymap.get('content') !== (cell.content || '')) {
          ymap.set('content', cell.content || '');
        }
      } else {
        ymap = new Y.Map();
        ymap.set('id', validCellId);
        ymap.set('name', cell.title || '');
        ymap.set('content', cell.content || '');
        yarray.insert(targetIndex < yarray.length ? targetIndex : yarray.length, [ymap]);
        existingMapsById.set(validCellId, ymap);
      }
    });

    for (let i = yarray.length - 1; i >= 0; i--) {
      const item = yarray.get(i);
      if (item && typeof (item as any).get === 'function') {
        const id = (item as any).get('id');
        if (!id || !newCellIds.has(id)) {
          yarray.delete(i, 1);
        }
      }
    }

    const currentArray = yarray.toArray() as Y.Map<any>[];
    const targetYMaps: Y.Map<any>[] = [];
    cells.forEach(cell => {
      const validCellId = (cell.id && cell.id.includes('-') && !cell.id.startsWith('cell-'))
        ? cell.id
        : crypto.randomUUID();
      const map = existingMapsById.get(validCellId);
      if (map) targetYMaps.push(map);
    });

    let needsReorder = currentArray.length !== targetYMaps.length;
    if (!needsReorder) {
      for (let i = 0; i < targetYMaps.length; i++) {
        if (currentArray[i] !== targetYMaps[i]) {
          needsReorder = true;
          break;
        }
      }
    }

    if (needsReorder) {
      yarray.delete(0, yarray.length);
      yarray.insert(0, targetYMaps);
    }
  });

  const update = serverBase64State
    ? Y.encodeStateAsUpdate(ydoc, stateVectorBefore)
    : Y.encodeStateAsUpdate(ydoc);

  return uint8ArrayToBase64(update);
}

/**
 * Decodes base64 Yjs delta into cell structures.
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
        const validId = (rawId && typeof rawId === 'string' && rawId.includes('-') && !rawId.startsWith('cell-'))
          ? rawId
          : crypto.randomUUID();

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

/**
 * Encodes the Yjs State Vector into base64.
 */
export function encodeYjsStateVector(fileIdOrCells: string | Cell[], maybeCells?: Cell[]): string {
  try {
    let fileId: string | undefined;
    let cells: Cell[] = [];

    if (typeof fileIdOrCells === 'string') {
      fileId = fileIdOrCells;
      cells = maybeCells || [];
    } else {
      cells = fileIdOrCells || [];
    }

    const ydoc = yjsDocManager.getOrCreateDoc(fileId);

    if (cells.length > 0) {
      const yarray = ydoc.getArray('blocks');
      if (yarray.length === 0) {
        ydoc.transact(() => {
          const ymaps = cells.map(cell => {
            const ymap = new Y.Map();
            const validCellId = (cell.id && cell.id.includes('-') && !cell.id.startsWith('cell-'))
              ? cell.id
              : crypto.randomUUID();
            ymap.set('id', validCellId);
            ymap.set('name', cell.title || '');
            ymap.set('content', cell.content || '');
            return ymap;
          });
          yarray.insert(0, ymaps);
        });
      }
    }

    const sv = Y.encodeStateVector(ydoc);
    return uint8ArrayToBase64(sv);
  } catch (err) {
    console.error('Failed to encode Yjs state vector:', err);
    return '';
  }
}

/**
 * Applies a Yjs delta and returns updated cell models.
 */
export function applyYjsDelta(
  fileIdOrCells: string | Cell[],
  base64UpdateOrCells?: string | Cell[],
  maybeBase64Update?: string
): Cell[] {
  let fileId: string | undefined;
  let cells: Cell[] = [];
  let base64Update: string;

  if (typeof fileIdOrCells === 'string') {
    fileId = fileIdOrCells;
    if (Array.isArray(base64UpdateOrCells)) {
      cells = base64UpdateOrCells;
      base64Update = maybeBase64Update || '';
    } else {
      base64Update = (base64UpdateOrCells as string) || '';
    }
  } else {
    cells = fileIdOrCells || [];
    base64Update = (base64UpdateOrCells as string) || '';
  }

  try {
    const ydoc = yjsDocManager.getOrCreateDoc(fileId);
    if (base64Update) {
      const binary = base64ToUint8Array(base64Update);
      Y.applyUpdate(ydoc, binary);
    }

    const yarray = ydoc.getArray('blocks');
    const updatedCells: Cell[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < yarray.length; i++) {
      const ymap = yarray.get(i) as Y.Map<any>;
      if (ymap && typeof ymap.get === 'function') {
        const id = ymap.get('id') || `cell-${Date.now()}-${i}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          updatedCells.push({
            id,
            content: ymap.get('content') || '',
            title: ymap.get('name') || ''
          });
        }
      }
    }

    return updatedCells;
  } catch (err) {
    console.error('Failed to apply Yjs update:', err);
    return cells;
  }
}
