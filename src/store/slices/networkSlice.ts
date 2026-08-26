import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ConnectionStatus } from '../../core/types';

interface NetworkState {
  connectionStatus: ConnectionStatus;
  lastCheckedAt: number | null;
}

const isInitiallyOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

const initialState: NetworkState = {
  connectionStatus: isInitiallyOffline ? 'offline' : 'connected',
  lastCheckedAt: null
};

export const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setConnectionStatus(state, action: PayloadAction<ConnectionStatus>) {
      state.connectionStatus = action.payload;
      state.lastCheckedAt = Date.now();
    }
  }
});

export const { setConnectionStatus } = networkSlice.actions;
export default networkSlice.reducer;
