import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuario, password })
      });

      const data = await response.json();

      if (data.success) {
        navigate('/dashboard'); 
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error("Error en la petición:", error);
      alert("Error al conectar con el servidor.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        
        <div className="login-header">
          <h1>Opciones <br/><span className="brand-name">Sacimex</span></h1>
          <h2 className="welcome-text">Bienvenido</h2>
          <p className="subtitle-text">Inicia Sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Usuario</label>
            <div className="input-wrapper">
              <input 
                type="text" 
                placeholder="Ej. admin_yeudi" 
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                required
              />
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <input 
                type="password" 
                placeholder="••••••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
          </div>

          <button type="submit" className="login-button">
            Ingresar al Sistema
          </button>
        </form>

        <div className="login-footer">
          <a href="#" className="forgot-password">¿Olvidaste tu contraseña?</a>
        </div>

      </div>
    </div>
  );
}

export default Login;