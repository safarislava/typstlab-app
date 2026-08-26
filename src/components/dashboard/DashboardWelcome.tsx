import React from 'react';
import { LogOut } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logoutUser } from '../../store/slices/authSlice';

export const DashboardWelcome: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(state => state.auth?.currentUser || state.document?.currentUser);
  const connectionStatus = useAppSelector(state => state.network?.connectionStatus || state.document?.connectionStatus);

  return (
    <section className="dashboard-welcome">
      <div className="welcome-content-wrapper">
        <div className="welcome-text">
          <h1>
            Welcome to <span>TypstLab</span>
          </h1>
          <p>Create, compile, and manage Typst documents with interactive markup cells.</p>
        </div>

        {connectionStatus === 'connected' && currentUser && (
          <div className="dashboard-user-card">
            <div className="user-card-avatar">
              {currentUser.username[0].toUpperCase()}
            </div>
            <div className="user-card-details">
              <div className="user-card-name">
                {currentUser.fullName || currentUser.username}
              </div>
              <div className="user-card-username">@{currentUser.username}</div>
            </div>
            <button
              className="btn-switch-user"
              onClick={() => dispatch(logoutUser())}
              title="Сменить пользователя"
            >
              <LogOut size={16} />
              <span>Сменить пользователя</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
