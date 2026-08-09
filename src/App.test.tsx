import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import documentReducer from './store/documentSlice';

vi.mock('@myriaddreamin/typst.ts', () => ({
  $typst: {
    setCompilerInitOptions: vi.fn(),
    setRendererInitOptions: vi.fn(),
  },
}));

vi.mock('./store/db', () => ({
  initDB: vi.fn().mockResolvedValue(undefined),
  getFilesForProjectFromDB: vi.fn().mockResolvedValue([]),
  getProjectsForUserFromDB: vi.fn().mockResolvedValue([]),
  migrateLegacyProjectsToUser: vi.fn().mockResolvedValue([]),
  getAllProjectsFromDB: vi.fn().mockResolvedValue([]),
}));

vi.mock('./utils/api', () => ({
  api: {
    checkHealth: vi.fn().mockResolvedValue(true),
    registerNetworkErrorCallback: vi.fn(),
  },
}));

vi.mock('./utils/syncManager', () => ({
  syncProjectWithServer: vi.fn().mockResolvedValue(true),
}));

vi.mock('./components/Header', () => ({
  Header: () => <div data-testid="header-stub" />,
}));
vi.mock('./components/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar-stub" />,
}));
vi.mock('./components/EditorWorkspace', () => ({
  EditorWorkspace: () => <div data-testid="editor-workspace-stub" />,
}));
vi.mock('./components/PreviewPanel', () => ({
  PreviewPanel: () => <div data-testid="preview-panel-stub" />,
}));
vi.mock('./components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard-stub" />,
}));
vi.mock('./components/Login', () => ({
  Login: () => <div data-testid="login-stub" />,
}));
vi.mock('./components/Register', () => ({
  Register: () => <div data-testid="register-stub" />,
}));

import {
  initDB,
  getFilesForProjectFromDB,
  getProjectsForUserFromDB,
  migrateLegacyProjectsToUser,
  getAllProjectsFromDB,
} from './store/db';
import { syncProjectWithServer } from './utils/syncManager';
import App from './App';

const mockedGetFiles = vi.mocked(getFilesForProjectFromDB);
const mockedGetProjectsForUser = vi.mocked(getProjectsForUserFromDB);
const mockedMigrateLegacy = vi.mocked(migrateLegacyProjectsToUser);
const mockedGetAllProjects = vi.mocked(getAllProjectsFromDB);
const mockedInitDB = vi.mocked(initDB);
const mockedSyncProjectWithServer = vi.mocked(syncProjectWithServer);

function baseState() {
  return documentReducer(undefined, { type: '@@INIT' });
}

function createStore(overrides: Partial<ReturnType<typeof baseState>> = {}) {
  return configureStore({
    reducer: { document: documentReducer },
    preloadedState: { document: { ...baseState(), ...overrides } },
  });
}

const originalHash = window.location.hash;

beforeEach(() => {
  vi.clearAllMocks();
  mockedInitDB.mockResolvedValue(undefined as any);
  mockedGetFiles.mockResolvedValue([]);
  mockedGetProjectsForUser.mockResolvedValue([]);
  mockedMigrateLegacy.mockResolvedValue([]);
  mockedGetAllProjects.mockResolvedValue([]);
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = originalHash;
});

describe('App - project list loading (setProjects fallback)', () => {
  it('dispatches an empty projects array (not a newly-created default project) when the logged-in user has no projects', async () => {
    mockedGetProjectsForUser.mockResolvedValue(undefined as any);
    const store = createStore({
      currentUser: { username: 'alice' },
      connectionStatus: 'connected',
      screen: 'dashboard',
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      expect(mockedGetProjectsForUser).toHaveBeenCalledWith('alice');
    });

    await waitFor(() => {
      expect(store.getState().document.projects).toEqual([]);
    });
  });

  it('dispatches an empty projects array when there is no logged-in user and no local projects exist', async () => {
    mockedGetAllProjects.mockResolvedValue(null as any);
    const store = createStore({
      currentUser: null,
      connectionStatus: 'offline',
      screen: 'dashboard',
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      expect(mockedGetAllProjects).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(store.getState().document.projects).toEqual([]);
    });
  });

  it('preserves projects returned from the database as-is (no synthetic default project appended)', async () => {
    const existing = [{ id: 'p1', name: 'Existing Project', createdAt: 1, updatedAt: 1, ownerId: 'alice' }];
    mockedGetProjectsForUser.mockResolvedValue(existing);
    const store = createStore({
      currentUser: { username: 'alice' },
      connectionStatus: 'connected',
      screen: 'dashboard',
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      expect(store.getState().document.projects).toEqual(existing);
    });
  });
});

describe('App - hash-based project loading (cell de-duplication)', () => {
  it('deduplicates cells by id and drops cells with an empty id when loading a project via the URL hash', async () => {
    window.location.hash = '#/project/proj-1';

    mockedGetAllProjects.mockResolvedValue([
      { id: 'proj-1', name: 'Test Project', createdAt: 1, updatedAt: 1 },
    ]);
    mockedGetFiles.mockResolvedValue([
      {
        id: 'proj-1:doc.typ',
        projectId: 'proj-1',
        path: 'doc.typ',
        isBinary: false,
        fileUuid: 'file-uuid-1',
        cells: [
          { id: 'cell-1', title: 'First', content: 'a' },
          { id: 'cell-1', title: 'Duplicate', content: 'b-dup' },
          { id: '', title: 'No id', content: 'c' },
          { id: 'cell-2', title: 'Second', content: 'd' },
        ],
      } as any,
    ]);

    const store = createStore({
      currentUser: null,
      connectionStatus: 'offline',
      screen: 'dashboard',
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      const file = store.getState().document.files['doc.typ'];
      expect(file).toBeDefined();
    });

    const file = store.getState().document.files['doc.typ'];
    expect(file.isBinary).toBe(false);
    if (!file.isBinary) {
      expect(file.cells.map(c => c.id)).toEqual(['cell-1', 'cell-2']);
      expect(file.cells[0].content).toBe('a');
    }
  });

  it('does not sync with the server while offline, but still loads local files for the project', async () => {
    window.location.hash = '#/project/proj-2';

    mockedGetAllProjects.mockResolvedValue([
      { id: 'proj-2', name: 'Offline Project', createdAt: 1, updatedAt: 1 },
    ]);
    mockedGetFiles.mockResolvedValue([
      {
        id: 'proj-2:doc.typ',
        projectId: 'proj-2',
        path: 'doc.typ',
        isBinary: false,
        fileUuid: 'file-uuid-2',
        cells: [{ id: 'only-cell', content: 'x' }],
      } as any,
    ]);

    const store = createStore({
      currentUser: null,
      connectionStatus: 'offline',
      screen: 'dashboard',
    });

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await waitFor(() => {
      expect(store.getState().document.files['doc.typ']).toBeDefined();
    });

    expect(store.getState().document.currentProjectId).toBe('proj-2');
    expect(mockedSyncProjectWithServer).not.toHaveBeenCalled();
  });
});