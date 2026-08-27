import { useEffect, useCallback } from 'react';
import { 
  useAppDispatch, 
  useAppSelector, 
  setCompilerReady, 
  setCompilerError, 
  setIsCompiling 
} from '../store';
import { wasmLoader, syncFilesToVfs, exportProjectToPdf } from '../services';

export function useTypstCompiler() {
  const dispatch = useAppDispatch();
  const { compilerReady, isCompiling, compilerError } = useAppSelector(
    state => state.compiler
  );
  const { files, activeFilePath } = useAppSelector(
    state => state.editor
  );
  const currentProjectId = useAppSelector(
    state => state.projects.currentProjectId
  );
  const projects = useAppSelector(
    state => state.projects.projects
  );

  // Initialize WASM compiler globally
  useEffect(() => {
    let isMounted = true;

    async function initCompiler() {
      if (wasmLoader.isReady()) {
        dispatch(setCompilerReady(true));
        return;
      }

      try {
        await wasmLoader.init();
        if (isMounted) {
          dispatch(setCompilerReady(true));
        }
      } catch (err: any) {
        if (isMounted) {
          dispatch(setCompilerError(err?.message || 'Failed to initialize Typst compiler'));
        }
      }
    }

    void initCompiler();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // PDF Export action
  const exportPdf = useCallback(async () => {
    if (!compilerReady || !activeFilePath) return;
    const project = projects.find(p => p.id === currentProjectId);
    const projectName = project?.name || 'document';

    dispatch(setIsCompiling(true));
    try {
      await syncFilesToVfs(files);
      await exportProjectToPdf(files, activeFilePath, projectName);
    } catch (err: any) {
      alert(`Error exporting PDF: ${err?.message || err}`);
    } finally {
      dispatch(setIsCompiling(false));
    }
  }, [compilerReady, activeFilePath, files, currentProjectId, projects, dispatch]);

  return {
    compilerReady,
    isCompiling,
    compilerError,
    exportPdf
  };
}
