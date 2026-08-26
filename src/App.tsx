import { useTypstCompiler } from './hooks/useTypstCompiler';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useHashRouter } from './hooks/useHashRouter';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { DashboardView } from './components/dashboard/DashboardView';
import { EditorLayout } from './components/editor/EditorLayout';

export function App() {
  // Global service hooks
  useTypstCompiler();
  useNetworkStatus();

  // Hash routing
  const { screen, projectId } = useHashRouter();

  if (screen === 'login') {
    return <Login />;
  }

  if (screen === 'register') {
    return <Register />;
  }

  if (screen === 'editor' && projectId) {
    return <EditorLayout projectId={projectId} />;
  }

  return <DashboardView />;
}

export default App;
