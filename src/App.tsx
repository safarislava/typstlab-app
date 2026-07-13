import { useAppSelector } from './store/hooks';
import { Sidebar } from './components/Sidebar';
import { EditorWorkspace } from './components/EditorWorkspace';
import { PreviewPanel } from './components/PreviewPanel';

function App() {
  const previewMode = useAppSelector((state) => state.document.previewMode);

  return (
    <div className={`app-layout preview-mode-${previewMode}`}>
      <Sidebar />
      {previewMode !== 'preview-only' && <EditorWorkspace />}
      {previewMode !== 'edit-only' && <PreviewPanel />}
    </div>
  );
}

export default App;
