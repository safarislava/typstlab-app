import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from './store/hooks';
import { setCompilerReady, setCompilerError } from './store/documentSlice';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { EditorWorkspace } from './components/EditorWorkspace';
import { PreviewPanel } from './components/PreviewPanel';
import { $typst } from '@myriaddreamin/typst.ts';

let wasmInitialized = false;

function App() {
  const dispatch = useAppDispatch();
  const previewMode = useAppSelector((state) => state.document.previewMode);

  // Initialize Typst WASM compiler globally on app start
  useEffect(() => {
    const initWasm = async () => {
      if (wasmInitialized) {
        dispatch(setCompilerReady(true));
        return;
      }
      try {
        $typst.setCompilerInitOptions({
          getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
        });
        $typst.setRendererInitOptions({
          getModule: () => 'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm',
        });
        wasmInitialized = true;
        dispatch(setCompilerReady(true));
      } catch (err: any) {
        console.error('Typst WASM initialization error in App:', err);
        dispatch(setCompilerError(err?.message || 'Failed to load WebAssembly modules'));
      }
    };
    initWasm();
  }, [dispatch]);

  return (
    <div className="app-container">
      <Header />
      <div className={`app-layout preview-mode-${previewMode}`}>
        <Sidebar />
        {previewMode !== 'preview-only' && <EditorWorkspace />}
        {previewMode !== 'edit-only' && <PreviewPanel />}
      </div>
    </div>
  );
}

export default App;
