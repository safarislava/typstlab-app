import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User, ScreenType } from '../../core/types';
import { tokenStorage, httpClient } from '../../services';

interface AuthState {
  currentUser: User | null;
  screen: ScreenType;
}

const storedUser = tokenStorage.getStoredUser<User>();
const isInitiallyOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

const initialState: AuthState = {
  currentUser: storedUser,
  screen: storedUser || isInitiallyOffline ? 'dashboard' : 'login'
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.currentUser = action.payload;
      tokenStorage.setStoredUser(action.payload);
    },
    loginUser(state, action: PayloadAction<User>) {
      state.currentUser = action.payload;
      state.screen = 'dashboard';
      tokenStorage.setStoredUser(action.payload);
    },
    logoutUser(state) {
      state.currentUser = null;
      state.screen = 'login';
      tokenStorage.clear();
      httpClient.setToken(null);
    },
    setScreen(state, action: PayloadAction<ScreenType>) {
      state.screen = action.payload;
    }
  }
});

export const { setUser, loginUser, logoutUser, setScreen } = authSlice.actions;
export default authSlice.reducer;
