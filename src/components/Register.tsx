import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, setScreen } from '../store/documentSlice';
import { getUserFromDB, saveUserToDB, hashPassword, migrateLegacyProjectsToUser } from '../store/db';
import { api } from '../utils/api';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Loader, UserPlus } from 'lucide-react';

export const Register: React.FC = () => {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const cleanEmail = email.trim().toLowerCase();

    // Validations
    if (!cleanEmail || !password.trim() || !confirmPassword.trim()) {
      setError('Пожалуйста, заполните все обязательные поля');
      return;
    }

    if (!cleanEmail.includes('@')) {
      setError('Пожалуйста, введите корректный Email');
      return;
    }

    if (password.trim().length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const usernameFromEmail = cleanEmail.split('@')[0] || 'user';

      if (connectionStatus === 'connected') {
        // 1. Register with Go backend
        await api.register(cleanEmail, password.trim(), 'user');
        
        // 2. Log in with Go backend
        await api.login(cleanEmail, password.trim());

        const user = {
          username: usernameFromEmail,
          email: cleanEmail,
          fullName: usernameFromEmail
        };

        // Migrate legacy projects to the new user automatically
        await migrateLegacyProjectsToUser(user.username);

        // Login user
        dispatch(loginUser(user));
      } else {
        // Check if user exists locally
        const existingUser = await getUserFromDB(usernameFromEmail);
        if (existingUser) {
          setError('Пользователь с таким email уже зарегистрирован локально');
          setIsLoading(false);
          return;
        }

        // Hash password and save to DB
        const passwordHash = await hashPassword(password.trim());
        const newUser = {
          username: usernameFromEmail,
          passwordHash,
          email: cleanEmail,
          fullName: usernameFromEmail,
          createdAt: Date.now(),
        };

        await saveUserToDB(newUser);

        // Migrate legacy projects to the new user automatically
        await migrateLegacyProjectsToUser(newUser.username);

        // Login user
        dispatch(loginUser({
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.fullName
        }));
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err?.message || 'Произошла ошибка при регистрации. Попробуйте еще раз.');
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
              <code>E = mc²</code>
            </div>
            <div className="equation-badge secondary">
              <code>#show math.equation: ...</code>
            </div>
          </div>
          <p className="auth-banner-text">
            Интерактивная среда для компиляции и управления Typst документами.
          </p>
        </div>

        <div className="auth-form-side">
          <div className="auth-header">
            <h2>Регистрация</h2>
            <p>Создайте новый аккаунт для сохранения ваших проектов</p>
          </div>

          {error && (
            <div className="auth-error-alert animate-shake">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль *</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Минимум 6 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
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

            <div className="form-group">
              <label htmlFor="confirmPassword">Подтвердите пароль *</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader className="spinner-small" size={16} />
                  <span>Регистрация...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Создать аккаунт</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <span>Уже есть аккаунт?</span>
            <button
              className="auth-link-btn"
              onClick={() => {
                window.location.hash = '#/login';
                dispatch(setScreen('login'));
              }}
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
