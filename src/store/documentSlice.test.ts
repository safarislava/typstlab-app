import { describe, it, expect } from 'vitest';
import reducer, { initializeProject } from './documentSlice';
import type { TypstFile } from './documentSlice';

function getInitialState() {
  return reducer(undefined, { type: '@@INIT' });
}

describe('documentSlice - initializeProject', () => {
  it('deduplicates cells sharing the same id within a text file, keeping the first occurrence', () => {
    const files: TypstFile[] = [
      {
        path: 'doc.typ',
        isBinary: false,
        cells: [
          { id: 'cell-1', title: 'First', content: 'A' },
          { id: 'cell-2', title: 'Second', content: 'B' },
          { id: 'cell-1', title: 'Duplicate', content: 'C' },
        ],
      },
    ];

    const state = reducer(getInitialState(), initializeProject(files));

    const resultFile = state.files['doc.typ'];
    expect(resultFile.isBinary).toBe(false);
    if (!resultFile.isBinary) {
      expect(resultFile.cells).toHaveLength(2);
      expect(resultFile.cells.map(c => c.id)).toEqual(['cell-1', 'cell-2']);
      // The first occurrence's data should be preserved, not overwritten by the duplicate.
      expect(resultFile.cells[0].title).toBe('First');
    }
  });

  it('filters out cells with a falsy/empty id', () => {
    const files: TypstFile[] = [
      {
        path: 'doc.typ',
        isBinary: false,
        cells: [
          { id: '', title: 'No id', content: 'X' },
          { id: 'cell-1', title: 'Valid', content: 'Y' },
        ] as any,
      },
    ];

    const state = reducer(getInitialState(), initializeProject(files));

    const resultFile = state.files['doc.typ'];
    if (!resultFile.isBinary) {
      expect(resultFile.cells).toHaveLength(1);
      expect(resultFile.cells[0].id).toBe('cell-1');
    }
  });

  it('leaves binary files untouched (no cell deduplication applied)', () => {
    const binaryData = new Uint8Array([1, 2, 3]);
    const files: TypstFile[] = [
      {
        path: 'image.png',
        isBinary: true,
        binaryData,
      },
    ];

    const state = reducer(getInitialState(), initializeProject(files));

    const resultFile = state.files['image.png'];
    expect(resultFile.isBinary).toBe(true);
    if (resultFile.isBinary) {
      expect(resultFile.binaryData).toBe(binaryData);
    }
  });

  it('sets activeFilePath and activeCellId based on the first loaded file after deduplication', () => {
    const files: TypstFile[] = [
      {
        path: 'doc.typ',
        isBinary: false,
        cells: [
          { id: 'dup', title: 'A', content: '1' },
          { id: 'dup', title: 'B (dropped)', content: '2' },
        ],
      },
    ];

    const state = reducer(getInitialState(), initializeProject(files));

    expect(state.activeFilePath).toBe('doc.typ');
    expect(state.activeCellId).toBe('dup');
  });

  it('resets files, activeFilePath and activeCellId to empty when given an empty file list', () => {
    const seeded = reducer(
      getInitialState(),
      initializeProject([{ path: 'doc.typ', isBinary: false, cells: [{ id: 'a', content: '' }] }])
    );

    const state = reducer(seeded, initializeProject([]));

    expect(state.files).toEqual({});
    expect(state.activeFilePath).toBe('');
    expect(state.activeCellId).toBeNull();
  });

  it('processes multiple files independently, deduplicating each file\'s cells separately', () => {
    const files: TypstFile[] = [
      {
        path: 'a.typ',
        isBinary: false,
        cells: [
          { id: 'x', content: '1' },
          { id: 'x', content: '2' },
        ],
      },
      {
        path: 'b.typ',
        isBinary: false,
        cells: [
          { id: 'y', content: '3' },
          { id: 'z', content: '4' },
        ],
      },
    ];

    const state = reducer(getInitialState(), initializeProject(files));

    const fileA = state.files['a.typ'];
    const fileB = state.files['b.typ'];
    if (!fileA.isBinary) expect(fileA.cells).toHaveLength(1);
    if (!fileB.isBinary) expect(fileB.cells).toHaveLength(2);
  });
});