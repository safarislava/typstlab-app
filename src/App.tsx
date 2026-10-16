import { useTypstCompiler, useNetworkStatus, useHashRouter } from './hooks';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { DashboardView } from './components/dashboard';
import { EditorLayout } from './components/editor/EditorLayout';
import { InviteAcceptView } from './components/InviteAcceptView';

export function App() {
  // Global service hooks
  useTypstCompiler();
  useNetworkStatus();

  // Hash routing
  const { screen, projectId, inviteCode } = useHashRouter();

  if (screen === 'login') {
    return <Login />;
  }

  if (screen === 'register') {
    return <Register />;
  }

  if (screen === 'invite' && inviteCode) {
    return <InviteAcceptView inviteCode={inviteCode} />;
  }

  if (screen === 'editor' && projectId) {
    return <EditorLayout projectId={projectId} />;
  }

  return <DashboardView />;
}

export default App;
