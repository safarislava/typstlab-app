import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface CompilerState {
  compilerReady: boolean;
  isCompiling: boolean;
  compilerError: string | null;
}

const initialState: CompilerState = {
  compilerReady: false,
  isCompiling: false,
  compilerError: null
};

export const compilerSlice = createSlice({
  name: 'compiler',
  initialState,
  reducers: {
    setCompilerReady(state, action: PayloadAction<boolean>) {
      state.compilerReady = action.payload;
    },
    setIsCompiling(state, action: PayloadAction<boolean>) {
      state.isCompiling = action.payload;
    },
    setCompilerError(state, action: PayloadAction<string | null>) {
      state.compilerError = action.payload;
    }
  }
});

export const { setCompilerReady, setIsCompiling, setCompilerError } = compilerSlice.actions;
export default compilerSlice.reducer;
