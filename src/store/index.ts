import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import networkReducer from './slices/networkSlice';
import projectsReducer from './slices/projectsSlice';
import editorReducer from './slices/editorSlice';
import compilerReducer from './slices/compilerSlice';
import documentReducer from './documentSlice';
import { persistenceMiddleware } from './middleware/persistence.mw';
import { syncDebounceMiddleware } from './middleware/syncDebounce.mw';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    network: networkReducer,
    projects: projectsReducer,
    editor: editorReducer,
    compiler: compilerReducer,
    // Backward compatibility slice
    document: documentReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }).concat(persistenceMiddleware, syncDebounceMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export * from './slices';
export * from './middleware';
export * from './hooks';
