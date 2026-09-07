import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ConnectionStatus } from '../../core/types';

interface NetworkState {
  connectionStatus: ConnectionStatus;
  lastCheckedAt: number | null;
}

const initialState: NetworkState = {
  connectionStatus: 'connecting',
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
