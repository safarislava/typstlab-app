import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import type { Cell } from '../store/documentSlice';
import {
  getOrCreateFileYDoc,
  encodeCellsToYjsDelta,
  encodeYjsStateVector,
  applyYjsDelta,
  decodeYjsDeltaToCells,
} from './yjsSync';

function makeCell(id: string, title = '', content = ''): Cell {
  return { id, title, content };
}

describe('getOrCreateFileYDoc', () => {
  it('returns a brand new Y.Doc instance every time when no fileId is given', () => {
    const docA = getOrCreateFileYDoc();
    const docB = getOrCreateFileYDoc();
    expect(docA).not.toBe(docB);
  });

  it('returns the same persistent Y.Doc instance for the same fileId', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const docA = getOrCreateFileYDoc(fileId);
    const docB = getOrCreateFileYDoc(fileId);
    expect(docA).toBe(docB);
  });

  it('returns different Y.Doc instances for different fileIds', () => {
    const docA = getOrCreateFileYDoc(`file-${crypto.randomUUID()}`);
    const docB = getOrCreateFileYDoc(`file-${crypto.randomUUID()}`);
    expect(docA).not.toBe(docB);
  });
});

describe('encodeCellsToYjsDelta', () => {
  it('supports the legacy (cells-only) call signature', () => {
    const cells: Cell[] = [makeCell('11111111-1111-1111-1111-111111111111', 'A', 'content-a')];
    const base64 = encodeCellsToYjsDelta(cells);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    const decoded = decodeYjsDeltaToCells(base64);
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toMatchObject({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'A',
      content: 'content-a',
    });
  });

  it('encodes cells for a given fileId and can be decoded back to matching cells', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const cells: Cell[] = [
      makeCell('22222222-2222-2222-2222-222222222222', 'First', 'hello'),
      makeCell('33333333-3333-3333-3333-333333333333', 'Second', 'world'),
    ];

    const base64 = encodeCellsToYjsDelta(fileId, cells);
    const decoded = decodeYjsDeltaToCells(base64);

    expect(decoded.map(c => c.id)).toEqual([
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
    ]);
    expect(decoded.map(c => c.title)).toEqual(['First', 'Second']);
    expect(decoded.map(c => c.content)).toEqual(['hello', 'world']);
  });

  it('updates an existing block in-place instead of appending a duplicate when called twice for the same fileId', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const cellId = '44444444-4444-4444-4444-444444444444';

    encodeCellsToYjsDelta(fileId, [makeCell(cellId, 'Title v1', 'content v1')]);
    encodeCellsToYjsDelta(fileId, [makeCell(cellId, 'Title v2', 'content v2')]);

    const ydoc = getOrCreateFileYDoc(fileId);
    const yarray = ydoc.getArray('blocks');

    expect(yarray.length).toBe(1);
    const ymap = yarray.get(0) as Y.Map<any>;
    expect(ymap.get('name')).toBe('Title v2');
    expect(ymap.get('content')).toBe('content v2');
  });

  it('removes blocks that are no longer present in the cells list', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const idA = '55555555-5555-5555-5555-555555555555';
    const idB = '66666666-6666-6666-6666-666666666666';

    encodeCellsToYjsDelta(fileId, [makeCell(idA, 'A'), makeCell(idB, 'B')]);
    encodeCellsToYjsDelta(fileId, [makeCell(idA, 'A')]);

    const ydoc = getOrCreateFileYDoc(fileId);
    const yarray = ydoc.getArray('blocks');
    expect(yarray.length).toBe(1);
    expect((yarray.get(0) as Y.Map<any>).get('id')).toBe(idA);
  });

  it('reorders existing blocks to match the target cell order', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const idA = '77777777-7777-7777-7777-777777777777';
    const idB = '88888888-8888-8888-8888-888888888888';

    encodeCellsToYjsDelta(fileId, [makeCell(idA, 'A'), makeCell(idB, 'B')]);
    // Reorder: B before A
    encodeCellsToYjsDelta(fileId, [makeCell(idB, 'B'), makeCell(idA, 'A')]);

    const ydoc = getOrCreateFileYDoc(fileId);
    const yarray = ydoc.getArray('blocks');
    const ids = yarray.toArray().map((item: any) => item.get('id'));
    expect(ids).toEqual([idB, idA]);
  });

  it('generates a new random id for cells with invalid ids (no dash, or cell- prefixed)', () => {
    const base64 = encodeCellsToYjsDelta([makeCell('cell-123', 'Bad id')]);
    const decoded = decodeYjsDeltaToCells(base64);
    expect(decoded).toHaveLength(1);
    expect(decoded[0].id).not.toBe('cell-123');
    expect(decoded[0].id.includes('-')).toBe(true);
  });

  it('does not throw and produces empty output when given an empty cells array', () => {
    const base64 = encodeCellsToYjsDelta(`file-${crypto.randomUUID()}`, []);
    expect(typeof base64).toBe('string');
    const decoded = decodeYjsDeltaToCells(base64);
    expect(decoded).toEqual([]);
  });
});

describe('encodeYjsStateVector', () => {
  it('supports the legacy (cells-only) call signature and returns a non-empty base64 string', () => {
    const sv = encodeYjsStateVector([makeCell('99999999-9999-9999-9999-999999999999', 'A')]);
    expect(typeof sv).toBe('string');
    expect(sv.length).toBeGreaterThan(0);
  });

  it('populates the persistent file doc only once for repeated calls with the same fileId', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const cells: Cell[] = [makeCell('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A', 'x')];

    encodeYjsStateVector(fileId, cells);
    const ydoc = getOrCreateFileYDoc(fileId);
    expect(ydoc.getArray('blocks').length).toBe(1);

    // Calling again with different cells should NOT append/duplicate blocks,
    // since the yarray is already populated for this fileId.
    encodeYjsStateVector(fileId, [
      makeCell('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B', 'y'),
    ]);
    expect(ydoc.getArray('blocks').length).toBe(1);
  });

  it('returns an empty string on internal failure without throwing', () => {
    // A non-string cell.id causes `.includes` to throw, exercising the catch block.
    const badCells = [{ id: 12345 as unknown as string, title: '', content: '' }];
    const sv = encodeYjsStateVector(`file-${crypto.randomUUID()}`, badCells);
    expect(sv).toBe('');
  });

  it('produces different state vectors for docs with different fileIds/content', () => {
    const svEmpty = encodeYjsStateVector(`file-${crypto.randomUUID()}`, []);
    const svWithCells = encodeYjsStateVector(`file-${crypto.randomUUID()}`, [
      makeCell('cccccccc-cccc-cccc-cccc-cccccccccccc', 'A', 'x'),
    ]);
    expect(svEmpty).not.toBe(svWithCells);
  });
});

describe('applyYjsDelta', () => {
  it('supports the legacy (cells, base64Update) call signature', () => {
    const cellId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const initialCells: Cell[] = [makeCell(cellId, 'Old', 'old content')];
    const delta = encodeCellsToYjsDelta([makeCell(cellId, 'New', 'new content')]);

    const result = applyYjsDelta(initialCells, delta);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('new content');
  });

  it('supports the new (fileId, base64Update) 2-arg call signature using the persistent doc', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const cellId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    const delta = encodeCellsToYjsDelta(fileId, [makeCell(cellId, 'Hello', 'World')]);
    // Apply the same delta directly to the (now separate/new) persistent doc via 2-arg signature
    const otherFileId = `file-${crypto.randomUUID()}`;
    const result = applyYjsDelta(otherFileId, delta);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(cellId);
    expect(result[0].title).toBe('Hello');
    expect(result[0].content).toBe('World');
  });

  it('supports the new (fileId, cells, base64Update) 3-arg call signature', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const cellId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const localCells: Cell[] = [makeCell(cellId, 'Local', 'local content')];

    const delta = encodeCellsToYjsDelta(fileId, [makeCell(cellId, 'Server', 'server content')]);
    const result = applyYjsDelta(fileId, localCells, delta);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('server content');
  });

  it('deduplicates blocks sharing the same id after applying the update', () => {
    const fileId = `file-${crypto.randomUUID()}`;
    const ydoc = getOrCreateFileYDoc(fileId);
    const yarray = ydoc.getArray('blocks');

    const dupId = 'ab12cd34-0000-0000-0000-000000000000';
    ydoc.transact(() => {
      const map1 = new Y.Map();
      map1.set('id', dupId);
      map1.set('name', 'First');
      map1.set('content', 'first content');

      const map2 = new Y.Map();
      map2.set('id', dupId);
      map2.set('name', 'Second');
      map2.set('content', 'second content');

      yarray.insert(0, [map1, map2]);
    });

    const result = applyYjsDelta(fileId, '');
    expect(result).toHaveLength(1);
    expect(result.filter(c => c.id === dupId)).toHaveLength(1);
  });

  it('returns the original cells unchanged when the base64 update is malformed', () => {
    const cells: Cell[] = [makeCell('11112222-3333-4444-5555-666677778888', 'Keep me', 'unchanged')];
    const result = applyYjsDelta(cells, 'not-valid-base64-!!!');
    expect(result).toEqual(cells);
  });

  it('returns an empty array when applying an empty delta to a fresh doc with no cells', () => {
    const result = applyYjsDelta(`file-${crypto.randomUUID()}`, [], '');
    expect(result).toEqual([]);
  });
});