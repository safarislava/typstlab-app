import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { User, ScreenType } from '../../core/types';
import { tokenStorage } from '../../services';
import { httpClient } from '../../services';

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
      if (typeof window !== 'undefined') {
        window.location.hash = '#/';
      }
    },
    logoutUser(state) {
      state.currentUser = null;
      tokenStorage.clear();
      httpClient.setToken(null);
      state.screen = 'login';
      if (typeof window !== 'undefined') {
        window.location.hash = '#/login';
      }
    },
    setScreen(state, action: PayloadAction<ScreenType>) {
      state.screen = action.payload;
    }
  }
});

export const { setUser, loginUser, logoutUser, setScreen } = authSlice.actions;
export default authSlice.reducer;
