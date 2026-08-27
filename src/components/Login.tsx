import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loginUser, setScreen } from '../store';
import { projectRepository } from '../services';
import { authApi } from '../services';
import { extractUserFromToken } from '../services';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader, LogIn } from 'lucide-react';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector(state => state.network?.connectionStatus || state.document?.connectionStatus);
  const currentProjectId = useAppSelector(state => state.projects?.currentProjectId || state.document?.currentProjectId);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (connectionStatus === 'offline') {
      dispatch(setScreen(currentProjectId ? 'editor' : 'dashboard'));
      if (window.location.hash === '#/login' || window.location.hash === '#/register') {
        window.location.hash = currentProjectId ? `#/project/${currentProjectId}` : '#/';
      }
    }
  }, [connectionStatus, dispatch, currentProjectId]);

  const handleSubmit = async (submitEvent: React.SyntheticEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const cleanInput = username.trim().toLowerCase();
    if (!cleanInput || !password.trim()) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    if (connectionStatus !== 'connected') {
      setError('Вход в аккаунт недоступен в офлайн-режиме. Пожалуйста, подключитесь к сети.');
      return;
    }

    if (!EMAIL_REGEX.test(cleanInput)) {
      setError('Пожалуйста, введите корректный Email (например, user@example.com)');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const cleanEmail = username.trim();
      const loginData = await authApi.login(cleanEmail, password.trim());
      const user = extractUserFromToken(loginData.token, cleanEmail);

      // Migrate any local legacy projects to this user
      await projectRepository.migrateLegacyProjectsToUser(user.username);

      dispatch(loginUser(user));
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Произошла ошибка при входе. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card-wrapper">
        <div className="auth-banner">
          <div className="auth-logo">
            <span className="logo-typst">typst</span>
            <span className="logo-lab">lab</span>
          </div>
          <div className="auth-banner-illustration">
            <div className="equation-badge">
              <code>f(x) = ∫ e^(-x²) dx</code>
            </div>
            <div className="equation-badge secondary">
              <code>#show: doc =&gt; ...</code>
            </div>
          </div>
          <p className="auth-banner-text">
            Создавайте отчеты, статьи и презентации нового поколения на Typst с интерактивными ячейками.
          </p>
        </div>

        <div className="auth-form-side">
          <div className="auth-header">
            <h2>Вход в TypstLab</h2>
            <p>Введите ваш Email и пароль для доступа к облачным проектам</p>
          </div>

          {error && (
            <div className="auth-error-alert animate-shake">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="username">Email</label>
              <div className="input-wrapper">
                <Mail className="input-icon" size={16} />
                <input
                  id="username"
                  type="email"
                  value={username}
                  onChange={(inputEv) => setUsername(inputEv.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={16} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(inputEv) => setPassword(inputEv.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader className="spinner-small" size={16} />
                  <span>Вход...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Войти в аккаунт</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <span>Нет аккаунта?</span>
            <button 
              type="button"
              className="auth-link-btn"
              onClick={() => {
                dispatch(setScreen('register'));
                window.location.hash = '#/register';
              }}
            >
              Зарегистрироваться
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
