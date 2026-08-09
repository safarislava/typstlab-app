import '@testing-library/jest-dom/vitest';

// jsdom does not implement ResizeObserver; App.tsx relies on it for layout responsiveness.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  (globalThis as any).ResizeObserver = ResizeObserverMock;
}