import React from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { logoutUser } from '../../../store/slices/authSlice';
import { ConnectionIndicator } from '../../common/ConnectionIndicator';
import { StatusBadge } from '../../common/StatusBadge';
import { ProjectTitleInput } from './ProjectTitleInput';
import { LayoutToggleButtons } from './LayoutToggleButtons';
import { ExportPdfButton } from './ExportPdfButton';

export const EditorHeader: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(state => state.auth?.currentUser || state.document?.currentUser);
  const connectionStatus = useAppSelector(state => state.network?.connectionStatus || state.document?.connectionStatus);

  const handleBackToDashboard = () => {
    window.location.hash = '#/';
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="back-to-dashboard-btn"
          onClick={handleBackToDashboard}
          title="Back to Projects"
        >
          <ArrowLeft size={16} />
          <span>Projects</span>
        </button>

        <div className="breadcrumb-separator">/</div>
        <ProjectTitleInput />
      </div>

      <div className="header-center">
        <StatusBadge />
        <ConnectionIndicator />
      </div>

      <div className="header-right">
        <LayoutToggleButtons />
        <ExportPdfButton />

        {connectionStatus === 'connected' && currentUser && (
          <div className="user-profile-widget header-user-widget">
            <div
              className="user-avatar"
              title={currentUser.fullName || currentUser.username}
            >
              {currentUser.username[0].toUpperCase()}
            </div>
            <button
              className="logout-btn"
              onClick={() => dispatch(logoutUser())}
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
