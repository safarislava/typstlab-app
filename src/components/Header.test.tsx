import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import documentReducer, { setConnectionStatus } from '../store/documentSlice';

vi.mock('@myriaddreamin/typst.ts', () => ({
  $typst: {
    pdf: vi.fn(),
    setCompilerInitOptions: vi.fn(),
    setRendererInitOptions: vi.fn(),
  },
}));

vi.mock('../lsp/compilerQueue', () => ({
  globalCompilerQueue: { run: vi.fn() },
}));

vi.mock('../utils/vfsSync', () => ({
  syncFilesToVfs: vi.fn(),
}));

vi.mock('../utils/api', () => ({
  api: {
    checkHealth: vi.fn(),
  },
}));

import { api } from '../utils/api';
import { Header } from './Header';

const mockedApi = vi.mocked(api);

function createTestStore() {
  return configureStore({ reducer: { document: documentReducer } });
}

function renderHeader(store: ReturnType<typeof createTestStore>) {
  return render(
    <Provider store={store}>
      <Header />
    </Provider>
  );
}

const originalOnLine = window.navigator.onLine;

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setOnline(true);
});

afterEach(() => {
  setOnline(originalOnLine);
});

describe('Header - connection health check', () => {
  it('renders the online indicator when connectionStatus is "connected"', () => {
    const store = createTestStore();
    renderHeader(store);

    expect(screen.getByTitle('Connected (Click to check /health)')).toBeInTheDocument();
  });

  it('renders the offline indicator when connectionStatus is "offline"', () => {
    const store = createTestStore();
    store.dispatch(setConnectionStatus('offline'));
    renderHeader(store);

    expect(screen.getByTitle('Offline Mode (Click to check /health)')).toBeInTheDocument();
  });

  it('sets status to offline without calling api.checkHealth when the browser is offline', async () => {
    setOnline(false);
    const store = createTestStore();
    renderHeader(store);

    fireEvent.click(screen.getByTitle('Connected (Click to check /health)'));

    await waitFor(() => {
      expect(store.getState().document.connectionStatus).toBe('offline');
    });
    expect(mockedApi.checkHealth).not.toHaveBeenCalled();
  });

  it('sets status to connected when api.checkHealth resolves true', async () => {
    mockedApi.checkHealth.mockResolvedValue(true);
    const store = createTestStore();
    store.dispatch(setConnectionStatus('offline'));
    renderHeader(store);

    fireEvent.click(screen.getByTitle('Offline Mode (Click to check /health)'));

    await waitFor(() => {
      expect(store.getState().document.connectionStatus).toBe('connected');
    });
    expect(mockedApi.checkHealth).toHaveBeenCalledTimes(1);
  });

  it('sets status to offline when api.checkHealth resolves false', async () => {
    mockedApi.checkHealth.mockResolvedValue(false);
    const store = createTestStore();
    renderHeader(store);

    fireEvent.click(screen.getByTitle('Connected (Click to check /health)'));

    await waitFor(() => {
      expect(store.getState().document.connectionStatus).toBe('offline');
    });
  });

  it('sets status to offline when api.checkHealth rejects', async () => {
    mockedApi.checkHealth.mockRejectedValue(new Error('network error'));
    const store = createTestStore();
    renderHeader(store);

    fireEvent.click(screen.getByTitle('Connected (Click to check /health)'));

    await waitFor(() => {
      expect(store.getState().document.connectionStatus).toBe('offline');
    });
  });

  it('shows a loading indicator while checking and ignores clicks until the check resolves', async () => {
    let resolveHealth: (value: boolean) => void = () => {};
    mockedApi.checkHealth.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveHealth = resolve;
      })
    );

    const store = createTestStore();
    renderHeader(store);

    fireEvent.click(screen.getByTitle('Connected (Click to check /health)'));

    expect(await screen.findByTitle('Checking connection status...')).toBeInTheDocument();

    // A second click while the check is still pending should be a no-op.
    fireEvent.click(screen.getByTitle('Checking connection status...'));
    expect(mockedApi.checkHealth).toHaveBeenCalledTimes(1);

    resolveHealth(true);

    await waitFor(() => {
      expect(store.getState().document.connectionStatus).toBe('connected');
    });
  });
});