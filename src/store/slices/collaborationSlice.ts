import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WSUserPresence } from '../../core/types';

export interface CollaborationState {
  collaborators: Record<string, WSUserPresence>;
  wsStatus: 'disconnected' | 'connecting' | 'connected';
}

const initialState: CollaborationState = {
  collaborators: {},
  wsStatus: 'disconnected'
};

export const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    setWsStatus(state, action: PayloadAction<'disconnected' | 'connecting' | 'connected'>) {
      state.wsStatus = action.payload;
      if (action.payload === 'disconnected') {
        state.collaborators = {};
      }
    },
    setCollaborators(state, action: PayloadAction<WSUserPresence[]>) {
      state.collaborators = {};
      action.payload.forEach(user => {
        state.collaborators[user.user_id] = user;
      });
    },
    updateCollaborator(state, action: PayloadAction<WSUserPresence>) {
      state.collaborators[action.payload.user_id] = action.payload;
    },
    removeCollaborator(state, action: PayloadAction<string>) {
      delete state.collaborators[action.payload];
    },
    clearCollaboration(state) {
      state.collaborators = {};
      state.wsStatus = 'disconnected';
    }
  }
});

export const {
  setWsStatus,
  setCollaborators,
  updateCollaborator,
  removeCollaborator,
  clearCollaboration
} = collaborationSlice.actions;

export default collaborationSlice.reducer;
