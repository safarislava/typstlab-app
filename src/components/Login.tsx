import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, setScreen } from '../store/documentSlice';
import { getUserFromDB, hashPassword, migrateLegacyProjectsToUser } from '../store/db';
import { api } from '../utils/api';
import { Lock, User, Eye, EyeOff, AlertCircle, Loader, Key } from 'lucide-react';

export const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      if (connectionStatus === 'connected') {
        const cleanEmail = username.trim();
        // Online login using Go backend API
        const loginData = await api.login(cleanEmail, password.trim());
        const token = loginData.token;
        
        let decodedPayload: any = {};
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          decodedPayload = JSON.parse(jsonPayload);
        } catch (e) {
          console.error('Failed to decode JWT token:', e);
        }

        const usernameParsed = decodedPayload.email?.split('@')[0] || cleanEmail.split('@')[0] || 'user';
        const user = {
          username: usernameParsed,
          email: decodedPayload.email || cleanEmail,
          fullName: decodedPayload.fullName || decodedPayload.name || usernameParsed
        };

        // Migrate any local legacy projects to this user
        await migrateLegacyProjectsToUser(user.username);

        dispatch(loginUser(user));
      } else {
        // Offline login using local IndexedDB
        const cleanUsername = username.trim().toLowerCase();
        const dbUser = await getUserFromDB(cleanUsername);
        if (!dbUser) {
          setError('Пользователь не найден');
          setIsLoading(false);
          return;
        }

        const passHash = await hashPassword(password.trim());
        if (dbUser.passwordHash !== passHash) {
          setError('Неверный пароль');
          setIsLoading(false);
          return;
        }

        // Successful login - Migrate any legacy projects to this user
        await migrateLegacyProjectsToUser(dbUser.username);

        dispatch(loginUser({
          username: dbUser.username,
          email: dbUser.email,
          fullName: dbUser.fullName
        }));
      }
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
              <code>#let alert(body) = [ ... ]</code>
            </div>
          </div>
          <p className="auth-banner-text">
            Интерактивная среда для компиляции и управления Typst документами.
          </p>
        </div>

        <div className="auth-form-side">
          <div className="auth-header">
            <h2>С возвращением!</h2>
            <p>Войдите в свой аккаунт для продолжения работы</p>
          </div>

          {error && (
            <div className="auth-error-alert animate-shake">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">
                {connectionStatus === 'connected' ? 'Email / Имя пользователя' : 'Имя пользователя'}
              </label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input
                  id="username"
                  type="text"
                  placeholder={connectionStatus === 'connected' ? "Введите email или имя пользователя" : "Введите имя пользователя"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Введите пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader className="spinner-small" size={16} />
                  <span>Вход...</span>
                </>
              ) : (
                <>
                  <Key size={16} />
                  <span>Войти</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <span>Нет аккаунта?</span>
            <button className="auth-link-btn" onClick={() => dispatch(setScreen('register'))}>
              Зарегистрироваться
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
