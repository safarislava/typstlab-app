import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, setScreen } from '../store/documentSlice';
import { getUserFromDB, saveUserToDB, hashPassword, migrateLegacyProjectsToUser } from '../store/db';
import { api } from '../utils/api';
import { Lock, User, Mail, Eye, EyeOff, AlertCircle, Loader, UserPlus, CheckCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const dispatch = useAppDispatch();
  const connectionStatus = useAppSelector((state) => state.document.connectionStatus);
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validations
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Пожалуйста, заполните все обязательные поля');
      return;
    }

    if (username.trim().length < 3) {
      setError('Имя пользователя должно содержать не менее 3 символов');
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
      if (connectionStatus === 'connected') {
        let registerEmail = email.trim();
        if (!registerEmail) {
          registerEmail = `${username.trim().toLowerCase()}@typstlab.local`;
        }

        // 1. Register with Go backend
        await api.register(registerEmail, password.trim(), 'user');
        
        // 2. Log in with Go backend
        await api.login(registerEmail, password.trim());

        const usernameParsed = username.trim().toLowerCase();
        const user = {
          username: usernameParsed,
          email: registerEmail,
          fullName: fullName.trim() || usernameParsed
        };

        // Migrate legacy projects to the new user automatically
        await migrateLegacyProjectsToUser(user.username);

        // Login user
        dispatch(loginUser(user));
      } else {
        const cleanUsername = username.trim().toLowerCase();
        // Check if user exists
        const existingUser = await getUserFromDB(cleanUsername);
        if (existingUser) {
          setError('Имя пользователя уже занято');
          setIsLoading(false);
          return;
        }

        // Hash password and save to DB
        const passwordHash = await hashPassword(password.trim());
        const newUser = {
          username: cleanUsername,
          passwordHash,
          email: email.trim() || undefined,
          fullName: fullName.trim() || undefined,
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
              <label htmlFor="username">Имя пользователя *</label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input
                  id="username"
                  type="text"
                  placeholder="Минимум 3 символа"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="fullName">ФИО / Полное имя</label>
              <div className="input-wrapper">
                <CheckCircle size={16} className="input-icon" />
                <input
                  id="fullName"
                  type="text"
                  placeholder="Иван Иванов"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
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
            <button className="auth-link-btn" onClick={() => dispatch(setScreen('login'))}>
              Войти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
