import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

import logoSacimex from '../../assets/logo.png';

function Login() {
  const [formData, setFormData] = useState({
    usuario: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const navigate = useNavigate();
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const validateField = (name, value) => {
    if (name === 'usuario' && value.length > 0 && value.length < 3) return 'El usuario debe tener al menos 3 caracteres';
    if (name === 'password' && value.length > 0 && value.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    return '';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');

    const fieldError = validateField(name, value);
    if (fieldError) setError(fieldError);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.usuario.trim() || !formData.password.trim()) { setError('Todos los campos son obligatorios'); return; }
    if (formData.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }

    setError('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('rol', data.rol);

        if (rememberMe) {
          localStorage.setItem('rememberedUser', formData.usuario);
        } else {
          localStorage.removeItem('rememberedUser');
        }

        setTimeout(() => {
          navigate('/dashboard');
        }, 800);
      } else {
        setError(data.message || 'Credenciales incorrectas');
        passwordInputRef.current?.focus();
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error en la petición:', error);
      setError('Error al conectar con el servidor. Verifica tu conexión.');
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) handleSubmit(e);
  };

  useEffect(() => {
    const rememberedUser = localStorage.getItem('rememberedUser');
    if (rememberedUser) {
      setFormData(prev => ({ ...prev, usuario: rememberedUser }));
      setRememberMe(true);
      passwordInputRef.current?.focus();
    }
  }, []);

  const ErrorIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>);
  const UserIcon = () => (<svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
  const PasswordIcon = () => (<svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>);
  const EyeIcon = ({ show }) => (<svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{show ? (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>) : (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>)}</svg>);
  const LoadingSpinner = () => (<span className="loading-content"><span className="spinner"></span>Verificando...</span>);

  return (
    <div className="login-container">
      <div className="login-card fade-in-up">
        <div className="login-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img 
              src={logoSacimex} 
              alt="Logo Opciones Sacimex" 
              style={{ width: '90px', height: 'auto', objectFit: 'contain' }} 
            />
          </div>

          <h1>Opciones <br /><span className="brand-name">Sacimex</span></h1>
          <h2 className="welcome-text">Bienvenido</h2>
          <p className="subtitle-text">Inicia Sesión para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {error && (<div className="error-message shake-animation" role="alert"><ErrorIcon /><span>{error}</span></div>)}
          <div className="input-group">
            <label htmlFor="usuario">Usuario {formData.usuario && formData.usuario.length < 3 && (<span className="validation-hint">Mínimo 3 caracteres</span>)}</label>
            <div className={`input-wrapper ${error && error.includes('usuario') ? 'input-error' : ''}`}>
              <input ref={usernameInputRef} id="usuario" name="usuario" type="text" placeholder="Ej. admin" value={formData.usuario} onChange={handleInputChange} onKeyPress={handleKeyPress} required disabled={isLoading} autoComplete="username" aria-label="Usuario" aria-invalid={error ? 'true' : 'false'} />
              <UserIcon />
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="password">Contraseña {formData.password && formData.password.length < 6 && (<span className="validation-hint">Mínimo 6 caracteres</span>)}</label>
            <div className={`input-wrapper ${error && error.includes('contraseña') ? 'input-error' : ''}`}>
              <input ref={passwordInputRef} id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="********" value={formData.password} onChange={handleInputChange} onKeyPress={handleKeyPress} required disabled={isLoading} autoComplete="current-password" aria-label="Contraseña" aria-invalid={error ? 'true' : 'false'} />
              <PasswordIcon />
              <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} disabled={isLoading}><EyeIcon show={showPassword} /></button>
            </div>
          </div>
          <div className="form-options">
            <label className="checkbox-container"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={isLoading} /><span className="checkbox-label">Recordarme</span></label>
          </div>
          <button type="submit" className="login-button" disabled={isLoading} aria-busy={isLoading}>{isLoading ? <LoadingSpinner /> : 'Ingresar al Sistema'}</button>
        </form>
        <div className="login-footer"><a href="/forgot-password" className="forgot-password" onClick={(e) => { e.preventDefault(); alert('Funcionalidad de recuperación de contraseña'); }}>¿Olvidaste tu contraseña?</a></div>
      </div>
    </div>
  );
}

export default Login;