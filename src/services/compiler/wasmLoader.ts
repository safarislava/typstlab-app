import { $typst } from '@myriaddreamin/typst.ts';

let wasmInitPromise: Promise<void> | null = null;
let isInitialized = false;

export const wasmLoader = {
  isReady(): boolean {
    return isInitialized;
  },

  async init(): Promise<void> {
    if (isInitialized) return;
    if (wasmInitPromise) return wasmInitPromise;

    wasmInitPromise = (async () => {
      try {
        $typst.setCompilerInitOptions({
          getModule: () =>
            'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm'
        });
        $typst.setRendererInitOptions({
          getModule: () =>
            'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'
        });
        isInitialized = true;
      } catch (err) {
        wasmInitPromise = null;
        console.error('WASM Compiler init error:', err);
        throw err;
      }
    })();

    return wasmInitPromise;
  }
};
