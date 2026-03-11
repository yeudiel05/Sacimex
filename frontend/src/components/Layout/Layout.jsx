import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import './Layout.css';

// --- IMPORTACIÓN DEL LOGO OFICIAL ---
import logoSacimex from '../../assets/logo.png'; 

function Layout() {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const userRole = localStorage.getItem('rol') || 'AUXILIAR'; 
  const username = localStorage.getItem('username') || 'Usuario'; 

  const fetchNotificaciones = async () => {
    if (userRole !== 'ADMIN') return;
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const res = await fetch('http://localhost:3001/api/notificaciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setNotificaciones(data.data);
    } catch (error) { 
      console.error("Error al cargar notificaciones:", error); 
    }
  };

  useEffect(() => {
    fetchNotificaciones();
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleNotifClick = (notif) => {
    setShowNotifMenu(false);

    if (notif.id === 'auth_pagos') {
      navigate('/autorizaciones');
    } else if (notif.id.startsWith('cont_')) {
      navigate('/inversores');
    } else if (notif.id.startsWith('cli_')) {
      navigate('/clientes');
    }
  };

  // --- 4. MATRIZ DE PERMISOS POR ROL ---
  const menuItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      rolesPermitidos: ['ADMIN', 'CONTADOR', 'ALMACEN', 'AUXILIAR'],
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        </svg>
      )
    },
    {
      path: '/usuarios',
      label: 'Usuarios y Roles',
      rolesPermitidos: ['ADMIN'], // SOLO EL DIRECTOR
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      )
    },
    {
      path: '/clientes',
      label: 'Clientes',
      rolesPermitidos: ['ADMIN', 'CONTADOR', 'AUXILIAR'], // Almacén no necesita ver clientes
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    {
      path: '/inversores',
      label: 'Inversores',
      rolesPermitidos: ['ADMIN', 'CONTADOR'], // Información muy sensible
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      )
    },
    {
      path: '/proveedores',
      label: 'Proveedores',
      rolesPermitidos: ['ADMIN', 'CONTADOR', 'ALMACEN'], 
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2"></rect>
          <polygon points="16 8 20 8 23 11 23 16 16 8"></polygon>
          <circle cx="5.5" cy="18.5" r="2.5"></circle>
          <circle cx="18.5" cy="18.5" r="2.5"></circle>
        </svg>
      )
    },
    {
      path: '/autorizaciones',
      label: 'Autorizar Pagos',
      rolesPermitidos: ['ADMIN'], // SOLO EL DIRECTOR FIRMA
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
      )
    },
    {
      path: '/configuracion',
      label: 'Configuraciones',
      rolesPermitidos: ['ADMIN'], // SOLO DIRECTOR
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      )
    },
    {
      path: '/reportes',
      label: 'Reportes y Export.',
      rolesPermitidos: ['ADMIN', 'CONTADOR'],
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      path: '/auditoria',
      label: 'Auditoría (Log)',
      rolesPermitidos: ['ADMIN'], // SOLO DIRECTOR
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      )
    }
  ];

  // FILTRAMOS EL ROL ACTUAL
  const menusPermitidos = menuItems.filter(item => item.rolesPermitidos.includes(userRole));

  const getPageTitle = () => {
    const currentItem = menuItems.find(item => item.path === location.pathname);
    return currentItem ? currentItem.label : 'Opciones Sacimex';
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar fade-in-left">
        <div className="sidebar-brand">
          <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '10px', padding: '4px', flexShrink: 0 }}>
            <img src={logoSacimex} alt="Logo Sacimex" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="brand-text">
            <h2>Sacimex</h2>
            <span>Panel de control</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-title">Navegación Principal</p>
          <ul>
            {/* RENDERIZAMOS SOLO LOS MENÚS PERMITIDOS */}
            {menusPermitidos.map((item) => (
              <li
                key={item.path}
                className={location.pathname === item.path ? 'active' : ''}
                onClick={() => navigate(item.path)}
              >
                {item.icon}
                {item.label}
              </li>
            ))}
          </ul>
        </nav>

        {/* INFO DEL USUARIO EN EL SIDEBAR */}
        <div className="sidebar-footer">
          <div className="user-avatar">{userRole.substring(0, 2)}</div>
          <div className="user-info">
            <p className="user-name" style={{textTransform: 'capitalize'}}>{username}</p>
            <p className="user-email">{userRole}</p>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header fade-in-down">
          
          <div className="header-left">
            <h2 className="current-page-title" style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>
              {getPageTitle()}
            </h2>
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div className="header-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" placeholder="Buscar movimientos, clientes..." />
              <span className="search-shortcut">/</span>
            </div>

            <div className="header-actions">
              
              {/* --- CAMPANA DE NOTIFICACIONES --- */}
              <div className="notification-wrapper" ref={notifRef} style={{ position: 'relative' }}>
                <button className="icon-button notification-bell" onClick={() => setShowNotifMenu(!showNotifMenu)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                  </svg>
                  {userRole === 'ADMIN' && notificaciones.length > 0 && (
                    <span className="badge pulse-animation" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '9px', width: '14px', height: '14px', top: '-4px', right: '-4px' }}>
                      {notificaciones.length}
                    </span>
                  )}
                </button>

                {/* DESPLEGABLE DE NOTIFICACIONES */}
                {showNotifMenu && (
                  <div className="dropdown-menu notif-menu fade-in-down" style={{ position: 'absolute', top: '50px', right: '-60px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', width: '340px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden' }}>
                    <div className="dropdown-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: 0, fontWeight: '800', color: '#0f172a' }}>Notificaciones</p>
                      <span style={{ fontSize: '11px', background: '#1e293b', color: 'white', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>{notificaciones.length} Pendientes</span>
                    </div>
                    
                    <div className="notif-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {notificaciones.length > 0 ? (
                        notificaciones.map((notif) => (
                          <div 
                            key={notif.id} 
                            className="notif-item" 
                            style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.2s' }} 
                            onClick={() => handleNotifClick(notif)}
                          >
                            <strong style={{ display: 'block', fontSize: '13px', color: notif.tipo === 'urgente' ? '#ef4444' : '#d97706', marginBottom: '6px' }}>{notif.titulo}</strong>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>{notif.mensaje}</p>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '32px', marginBottom: '10px', opacity: 0.5 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Todo está al día.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* --- PERFIL DE USUARIO --- */}
              <div
                className="header-profile"
                ref={menuRef}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{ position: 'relative', cursor: 'pointer' }}
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${userRole}&background=10d440&color=fff&rounded=true&bold=true`}
                  alt="Avatar"
                  style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                />
                
                {/* MENÚ DESPLEGABLE DEL PERFIL */}
                {showProfileMenu && (
                  <div className="dropdown-menu fade-in-up-fast" style={{ position: 'absolute', top: '50px', right: '0', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', width: '220px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100 }}>
                    <div className="dropdown-header" style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                      <p className="dropdown-name" style={{ margin: 0, fontWeight: 'bold' }}>{username}</p>
                      <p className="dropdown-email" style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Rol: {userRole}</p>
                    </div>
                    <button onClick={handleLogout} className="dropdown-item logout" style={{ width: '100%', padding: '16px', background: 'none', border: 'none', textAlign: 'left', color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;