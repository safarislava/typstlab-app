import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  api: {
    getProjectDetails: vi.fn(),
    createProjectWithId: vi.fn(),
    syncProject: vi.fn(),
    createBinaryFile: vi.fn(),
    createTypstFile: vi.fn(),
    sendTypstFileChanges: vi.fn(),
    createFileWithId: vi.fn(),
  },
}));

vi.mock('../store/db', () => ({
  getAllProjectsFromDB: vi.fn(),
  getFilesForProjectFromDB: vi.fn(),
  saveFileToDB: vi.fn(),
  deleteFileFromDB: vi.fn(),
}));

vi.mock('./yjsSync', () => ({
  encodeCellsToYjsDelta: vi.fn(() => 'encoded-delta'),
  encodeYjsStateVector: vi.fn(() => 'encoded-state-vector'),
  applyYjsDelta: vi.fn(() => []),
  decodeYjsDeltaToCells: vi.fn(() => []),
  uint8ArrayToBase64: vi.fn(() => 'base64-binary'),
}));

import { api } from './api';
import {
  getAllProjectsFromDB,
  getFilesForProjectFromDB,
  saveFileToDB,
  deleteFileFromDB,
} from '../store/db';
import {
  encodeCellsToYjsDelta,
  encodeYjsStateVector,
  applyYjsDelta,
} from './yjsSync';
import { syncProjectWithServer } from './syncManager';

const mockedApi = vi.mocked(api);
const mockedGetAllProjects = vi.mocked(getAllProjectsFromDB);
const mockedGetFiles = vi.mocked(getFilesForProjectFromDB);
const mockedSaveFile = vi.mocked(saveFileToDB);
const mockedDeleteFile = vi.mocked(deleteFileFromDB);
const mockedEncodeCellsToYjsDelta = vi.mocked(encodeCellsToYjsDelta);
const mockedEncodeYjsStateVector = vi.mocked(encodeYjsStateVector);
const mockedApplyYjsDelta = vi.mocked(applyYjsDelta);

const PROJECT_ID = 'project-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.getProjectDetails.mockResolvedValue({ id: PROJECT_ID });
  mockedApi.syncProject.mockResolvedValue({ instructions: [] });
  mockedGetAllProjects.mockResolvedValue([]);
  mockedGetFiles.mockResolvedValue([]);
  mockedSaveFile.mockResolvedValue(undefined);
  mockedDeleteFile.mockResolvedValue(undefined);
  mockedEncodeCellsToYjsDelta.mockReturnValue('encoded-delta');
  mockedEncodeYjsStateVector.mockReturnValue('encoded-state-vector');
  mockedApplyYjsDelta.mockReturnValue([]);
});

describe('syncProjectWithServer', () => {
  it('creates the project on the server when it does not exist remotely', async () => {
    mockedApi.getProjectDetails.mockRejectedValue(new Error('404 not found'));
    mockedGetAllProjects.mockResolvedValue([
      { id: PROJECT_ID, name: 'My Project', createdAt: 1, updatedAt: 1 },
    ]);

    const result = await syncProjectWithServer(PROJECT_ID);

    expect(result).toBe(true);
    expect(mockedApi.createProjectWithId).toHaveBeenCalledWith(PROJECT_ID, 'My Project');
  });

  it('assigns and persists a new fileUuid for local files missing one, then builds the manifest with it', async () => {
    const localFile = {
      id: `${PROJECT_ID}:doc.typ`,
      projectId: PROJECT_ID,
      path: 'doc.typ',
      isBinary: false,
      cells: [{ id: 'cell-1', content: 'hello' }],
    };
    mockedGetFiles.mockResolvedValue([localFile as any]);

    await syncProjectWithServer(PROJECT_ID);

    // A new fileUuid should have been generated and persisted.
    expect(mockedSaveFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'doc.typ', fileUuid: expect.stringContaining('-') })
    );

    const generatedUuid = mockedSaveFile.mock.calls[0][0].fileUuid;
    expect(mockedEncodeYjsStateVector).toHaveBeenCalledWith(generatedUuid, localFile.cells);
    expect(mockedApi.syncProject).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.arrayContaining([
        expect.objectContaining({ id: generatedUuid, name: 'doc.typ', type: 'typst' }),
      ])
    );
  });

  it('uses encodeYjsStateVector(fileUuid, cells) argument order for files that already have a fileUuid', async () => {
    const localFile = {
      id: `${PROJECT_ID}:doc.typ`,
      projectId: PROJECT_ID,
      path: 'doc.typ',
      isBinary: false,
      fileUuid: 'existing-uuid-1234',
      cells: [{ id: 'a-1', content: 'x' }],
    };
    mockedGetFiles.mockResolvedValue([localFile as any]);

    await syncProjectWithServer(PROJECT_ID);

    expect(mockedEncodeYjsStateVector).toHaveBeenCalledWith('existing-uuid-1234', localFile.cells);
    expect(mockedSaveFile).not.toHaveBeenCalled();
  });

  it('falls back to per-file upload with encodeCellsToYjsDelta(fileUuid, cells) when the sync endpoint fails', async () => {
    mockedApi.syncProject.mockRejectedValue(new Error('sync endpoint unavailable'));
    const localFile = {
      id: `${PROJECT_ID}:doc.typ`,
      projectId: PROJECT_ID,
      path: 'doc.typ',
      isBinary: false,
      fileUuid: 'existing-uuid-5678',
      cells: [{ id: 'a-1', content: 'x' }],
    };
    mockedGetFiles.mockResolvedValue([localFile as any]);
    mockedApi.createTypstFile.mockResolvedValue({ id: 'server-file-id' });

    const result = await syncProjectWithServer(PROJECT_ID);

    expect(result).toBe(true);
    expect(mockedApi.createTypstFile).toHaveBeenCalledWith(PROJECT_ID, 'doc.typ');
    expect(mockedEncodeCellsToYjsDelta).toHaveBeenCalledWith('existing-uuid-5678', localFile.cells);
    expect(mockedApi.sendTypstFileChanges).toHaveBeenCalledWith('server-file-id', 'encoded-delta');
  });

  it('processes an "upload" instruction using encodeCellsToYjsDelta(fileId, cells)', async () => {
    const localFile = {
      id: `${PROJECT_ID}:doc.typ`,
      projectId: PROJECT_ID,
      path: 'doc.typ',
      isBinary: false,
      fileUuid: 'file-uuid-upload',
      cells: [{ id: 'a-1', content: 'x' }],
    };
    mockedGetFiles.mockResolvedValue([localFile as any]);
    mockedApi.syncProject.mockResolvedValue({
      instructions: [{ action: 'upload', file_id: 'file-uuid-upload' }],
    });
    mockedApi.createFileWithId.mockResolvedValue({ id: 'file-uuid-upload' });

    await syncProjectWithServer(PROJECT_ID);

    expect(mockedApi.createFileWithId).toHaveBeenCalledWith(PROJECT_ID, {
      id: 'file-uuid-upload',
      name: 'doc.typ',
      type: 'typst',
    });
    expect(mockedEncodeCellsToYjsDelta).toHaveBeenCalledWith('file-uuid-upload', localFile.cells);
  });

  it('processes a "download" instruction and saves the file tagged with the instruction fileUuid', async () => {
    mockedApi.syncProject.mockResolvedValue({
      instructions: [{ action: 'download', file_id: 'remote-file-id', payload: 'some-payload' }],
    });

    await syncProjectWithServer(PROJECT_ID);

    expect(mockedSaveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'remote-file-id',
        isBinary: false,
        fileUuid: 'remote-file-id',
      })
    );
  });

  it('processes an "apply_changes" instruction using applyYjsDelta(fileId, cells, payload) and persists fileUuid', async () => {
    const localFile = {
      id: `${PROJECT_ID}:doc.typ`,
      projectId: PROJECT_ID,
      path: 'doc.typ',
      isBinary: false,
      fileUuid: 'file-uuid-apply',
      cells: [{ id: 'a-1', content: 'x' }],
    };
    mockedGetFiles.mockResolvedValue([localFile as any]);
    mockedApi.syncProject.mockResolvedValue({
      instructions: [{ action: 'apply_changes', file_id: 'file-uuid-apply', payload: 'delta-payload' }],
    });
    mockedApplyYjsDelta.mockReturnValue([{ id: 'a-1', content: 'updated' }]);

    await syncProjectWithServer(PROJECT_ID);

    expect(mockedApplyYjsDelta).toHaveBeenCalledWith('file-uuid-apply', localFile.cells, 'delta-payload');
    expect(mockedSaveFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'doc.typ',
        cells: [{ id: 'a-1', content: 'updated' }],
        fileUuid: 'file-uuid-apply',
      })
    );
  });

  it('processes a "delete" instruction by removing the local file', async () => {
    mockedApi.syncProject.mockResolvedValue({
      instructions: [{ action: 'delete', file_id: 'doc.typ' }],
    });

    await syncProjectWithServer(PROJECT_ID);

    expect(mockedDeleteFile).toHaveBeenCalledWith(PROJECT_ID, 'doc.typ');
  });

  it('returns false and does not throw when an unexpected error occurs', async () => {
    mockedGetFiles.mockRejectedValue(new Error('unexpected DB failure'));

    const result = await syncProjectWithServer(PROJECT_ID);

    expect(result).toBe(false);
  });

  it('deduplicates concurrent calls for the same projectId into a single in-flight promise', async () => {
    let resolveDetails: (value: any) => void = () => {};
    mockedApi.getProjectDetails.mockReturnValue(
      new Promise((resolve) => {
        resolveDetails = resolve;
      })
    );

    const p1 = syncProjectWithServer(PROJECT_ID);
    const p2 = syncProjectWithServer(PROJECT_ID);

    expect(p1).toBe(p2);
    expect(mockedApi.getProjectDetails).toHaveBeenCalledTimes(1);

    resolveDetails({ id: PROJECT_ID });
    await Promise.all([p1, p2]);
  });
});