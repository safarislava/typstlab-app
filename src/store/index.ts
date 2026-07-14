import { configureStore } from '@reduxjs/toolkit';
import documentReducer from './documentSlice';
import { dbMiddleware } from './dbMiddleware';

export const store = configureStore({
  reducer: {
    document: documentReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(dbMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
