import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Usuarios.css';

// ==========================================
// CONFIGURACIÓN DE PUESTOS Y DEPARTAMENTOS
// ==========================================
const MAPA_PUESTOS = {
  "DIRECTOR GENERAL": "Director",
  "COORDINADOR DE CRÉDITO": "Operaciones",
  "COORDINADOR DE SUCURSAL": "Sucursales",
  "CAJERO": "Sucursales",
  "CAPACITADOR": "Desarrollo Humano y Organizacional",
  "ENCARGADO DE TI": "TECNOLOGÍA, INFORMÁTICA Y COMUNICACIONES (TIC)",
  "AUXILIAR DE SISTEMAS": "TECNOLOGÍA, INFORMÁTICA Y COMUNICACIONES (TIC)",
  "ASISTENTE DE SISTEMAS": "TECNOLOGÍA, INFORMÁTICA Y COMUNICACIONES (TIC)",
  "CONTADOR GENERAL": "Contabilidad y Finanzas",
  "ENCARGADO DE SUCURSAL": "Sucursales",
  "ASESOR DE CRÉDITO": "Sucursales",
  "AUXILIAR CONTABLE": "Contabilidad y Finanzas",
  "GESTOR DE COBRANZA": "Operaciones",
  "ENCARGADO DE ALMACEN": "Operaciones",
  "ENCARGADO DE NORMATIVIDAD": "Normativo",
  "COORDINADOR DE D.H.O.": "Desarrollo Humano y Organizacional",
  "ASISTENTE DE D.H.O.": "Desarrollo Humano y Organizacional",
};

function Usuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [nuevoRol, setNuevoRol] = useState({ 
    nombre_rol: '', 
    descripcion: '',
    perm_usuarios: false,
    perm_proveedores: false,
    perm_viaticos: false,
    perm_pagos: false,
    perm_reportes: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [formData, setFormData] = useState({
    nombre: '', rfc: '', telefono: '', email: '', 
    puesto: '', departamento: '', username: '', password: '', rol: 'AUXILIAR', id_persona: null
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const rolUsuarioActual = localStorage.getItem('rol');

  const fetchUsuarios = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/usuarios', { headers });
      const data = await res.json();
      if (data.success) setUsuarios(data.data);
    } catch (error) { console.error(error); }
  };

  const fetchRoles = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/roles', { headers });
      const data = await res.json();
      if (data.success) setRoles(data.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { 
    fetchUsuarios(); 
    fetchRoles();
  }, []);

  const openNewModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormError('');
    setFormData({ nombre: '', rfc: '', telefono: '', email: '', puesto: '', departamento: departamentoSeleccionado || '', username: '', password: '', rol: '', id_persona: null });
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setIsEditing(true);
    setEditId(user.id_usuario);
    setFormError('');
    setFormData({ 
      nombre: user.nombre, rfc: user.rfc || '', telefono: user.telefono || '', email: user.email || '', 
      puesto: user.puesto, departamento: user.departamento, username: user.username, 
      password: '',
      rol: user.rol, id_persona: user.id_persona
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);

    const url = isEditing ? `http://localhost:3001/api/usuarios/${editId}` : 'http://localhost:3001/api/usuarios';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { 
        method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) 
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchUsuarios();
      } else {
        setFormError(data.message);
      }
    } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
  };

  const cambiarEstatus = async (id, estatus_actual) => {
    const nuevoEstatus = estatus_actual === 1 ? 0 : 1;
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch(`http://localhost:3001/api/usuarios/${id}/estatus`, { 
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) 
      });
      if ((await res.json()).success) fetchUsuarios();
    } catch (error) { console.error(error); }
  };

  const triggerEliminar = (id_persona, nombre) => {
    setConfirmModal({
      isOpen: true, title: 'Revocar Acceso y Eliminar',
      message: `¿Estás seguro de eliminar al usuario ${nombre}? Perderá el acceso inmediatamente.`,
      onConfirm: async () => {
        const headers = getAuthHeaders();
        await fetch(`http://localhost:3001/api/usuarios/${id_persona}`, { method: 'DELETE', headers });
        fetchUsuarios();
      }
    });
  };

  const handleCrearRol = async (e) => {
    e.preventDefault();
    if (!nuevoRol.nombre_rol) return alert("Ingresa un nombre para el rol");
    const headers = getAuthHeaders();
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/roles', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoRol)
      });
      const data = await res.json();
      if (data.success) {
        setNuevoRol({ nombre_rol: '', descripcion: '', perm_usuarios: false, perm_proveedores: false, perm_viaticos: false, perm_pagos: false, perm_reportes: false });
        fetchRoles(); 
      } else {
        alert(data.message);
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleEliminarRol = async (id_rol) => {
    if(!window.confirm("¿Seguro que deseas desactivar este rol? Ningún usuario nuevo podrá asignárselo.")) return;
    const headers = getAuthHeaders();
    try {
      const res = await fetch(`http://localhost:3001/api/roles/${id_rol}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) fetchRoles(); else alert(data.message);
    } catch (error) { console.error(error); }
  };

  const usuariosFiltradosGeneral = usuarios.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.rol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.departamento && u.departamento.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const departamentosUnicos = Array.from(new Set(
    usuariosFiltradosGeneral.map(u => (u.departamento || 'Sin Departamento').toUpperCase().trim())
  ));

  const usuariosDelDepartamento = usuariosFiltradosGeneral.filter(u => {
    const depUsuario = (u.departamento || 'Sin Departamento').toUpperCase().trim();
    return depUsuario === departamentoSeleccionado;
  });

  return (
    <div className="usuarios-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Usuarios y Control de Acceso</h1>
          <p>Gestiona los permisos y roles de tus empleados</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {rolUsuarioActual === 'ADMIN' && (
            <button className="btn-cancel" onClick={() => setIsRoleModalOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px', display: 'inline'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Gestionar Roles
            </button>
          )}
          <button className="btn-primary" onClick={openNewModal}>+ Nuevo Usuario</button>
        </div>
      </div>

      <div className="usuarios-toolbar stagger-2 fade-in-up">
        <div className="search-bar" style={{ flexGrow: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Buscar por nombre, rol o departamento..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setDepartamentoSeleccionado(null); }} />
        </div>
        {departamentoSeleccionado && (
            <button className="btn-cancel" style={{ marginLeft: '16px' }} onClick={() => setDepartamentoSeleccionado(null)}>
                &laquo; Volver a Departamentos
            </button>
        )}
      </div>

      {!departamentoSeleccionado && (
        <div className="usuarios-grid stagger-2 fade-in-up">
          {departamentosUnicos.map((dep, index) => {
            const totalUsuarios = usuariosFiltradosGeneral.filter(u => (u.departamento || 'Sin Departamento').toUpperCase().trim() === dep).length;
            return (
              <div className="user-card" key={index} onClick={() => setDepartamentoSeleccionado(dep)} style={{ animationDelay: `${(index + 2) * 0.1}s`, cursor: 'pointer', borderTop: '4px solid var(--brand-green)' }}>
                <div className="user-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px' }}>
                  <div style={{ backgroundColor: 'var(--brand-green-light)', color: 'var(--brand-green)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '36px', height: '36px'}}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>{dep}</h3>
                  <span className="badge-estatus badge-activo-dark" style={{ backgroundColor: '#f1f5f9', color: 'var(--text-muted)' }}>
                    {totalUsuarios} {totalUsuarios === 1 ? 'Usuario' : 'Usuarios'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {departamentoSeleccionado && (
        <>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-main)', borderBottom: '2px solid var(--brand-green-light)', paddingBottom: '10px' }}>
                Usuarios en: <span style={{ color: 'var(--brand-green)' }}>{departamentoSeleccionado}</span>
            </h2>
            <div className="usuarios-grid fade-in-up">
            {usuariosDelDepartamento.map((user, index) => (
                <div className="user-card" key={user.id_usuario} style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="user-card-header">
                    <div className="user-avatar-large">
                    {user.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="user-status">
                    <button className={`badge-estatus ${user.estatus_activo ? 'badge-activo-dark' : 'badge-inactivo'}`} onClick={() => cambiarEstatus(user.id_usuario, user.estatus_activo)}>
                        {user.estatus_activo ? 'Acceso Permitido' : 'Bloqueado'}
                    </button>
                    </div>
                </div>
                
                <div className="user-card-body">
                    <h3>{user.nombre}</h3>
                    <p className="user-role-text">{user.puesto}</p>
                    <div className="user-credentials">
                    <div className="cred-box">
                        <span>Usuario</span>
                        <strong>{user.username}</strong>
                    </div>
                    <div className="cred-box role-box">
                        <span>Rol Asignado</span>
                        <strong>{user.rol}</strong>
                    </div>
                    </div>
                </div>

                <div className="user-card-footer">
                    <div className="user-contact">
                    <span>{user.email}</span>
                    <span>+52 {user.telefono}</span>
                    </div>
                    <div className="user-actions" style={{display: 'flex', gap: '8px'}}>
                    <button className="btn-icon-edit" onClick={() => openEditModal(user)} title="Editar Usuario">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminar(user.id_persona, user.nombre)} title="Eliminar Usuario">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    </div>
                </div>
                </div>
            ))}
            </div>
        </>
      )}

      {/* --- MODAL ALTA/EDICIÓN --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down" style={{maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Empleado y Accesos' : 'Alta de Personal y Accesos'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}>
              <div className="modal-form" style={{overflowY: 'auto', padding: '32px'}}>
                {formError && ( <div className="error-message shake-animation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>{formError}</span></div> )}
                
                <div className="form-grid-2-col">
                  <div>
                    <h4 className="section-subtitle">Datos del Empleado</h4>
                    <div className="form-group"><label>Nombre Completo</label><input type="text" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} /></div>
                    <div className="form-group"><label>RFC</label><input type="text" required maxLength="13" value={formData.rfc} onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})} /></div>
                    <div className="form-group"><label>Teléfono</label><input type="text" required maxLength="10" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value.replace(/[^0-9]/g, '')})} /></div>
                    <div className="form-group"><label>Correo Institucional</label><input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                  </div>

                  <div>
                    <h4 className="section-subtitle">Puesto y Accesos</h4>
                    
                    {/* MODIFICACIÓN: SELECT DE PUESTOS AUTOMÁTICO */}
                    <div className="form-group">
                      <label>Puesto</label>
                      <select 
                        className="custom-select" 
                        required 
                        value={formData.puesto} 
                        onChange={(e) => {
                          const puestoSelected = e.target.value;
                          const deptoAuto = MAPA_PUESTOS[puestoSelected] || '';
                          setFormData({...formData, puesto: puestoSelected, departamento: deptoAuto});
                        }}
                      >
                        <option value="">Selecciona un puesto...</option>
                        {Object.keys(MAPA_PUESTOS).map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Departamento</label>
                      <input 
                        type="text" 
                        readOnly 
                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 'bold', color: 'var(--brand-green)' }} 
                        value={formData.departamento} 
                        placeholder="Se llenará solo al elegir puesto" 
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Rol de Acceso en Sistema</label>
                      <select className="custom-select" style={{borderColor: 'var(--brand-green)', backgroundColor: 'var(--brand-green-light)', fontWeight: '700', color: 'var(--brand-green-hover)'}} required value={formData.rol} onChange={(e) => setFormData({...formData, rol: e.target.value})}>
                        <option value="">Selecciona un rol...</option>
                        {roles.map(rol => (
                          <option key={rol.id} value={rol.nombre_rol}>{rol.nombre_rol} - {rol.descripcion}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group"><label>Usuario (Login)</label><input type="text" required placeholder="Ej. jhernandez" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} /></div>
                    <div className="form-group">
                      <label>{isEditing ? 'Nueva Contraseña (Vacío = No cambiar)' : 'Contraseña Temporal'}</label>
                      <input type="text" placeholder={isEditing ? '******' : 'Asigne una contraseña'} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required={!isEditing} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{padding: '20px 32px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0}}>
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : (isEditing ? 'Actualizar Usuario' : 'Crear Usuario')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ROLES --- */}
      {isRoleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRoleModalOpen(false)}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Catálogo de Roles</h2>
                <p className="client-badge" style={{backgroundColor: '#e0f2fe', color: '#1e40af'}}>Matriz de Permisos</p>
              </div>
              <button className="btn-close" onClick={() => setIsRoleModalOpen(false)}>×</button>
            </div>
            
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <form className="modal-form" style={{ padding: '20px', backgroundColor: 'var(--bg-main)', borderRadius: '12px', border: '1px dashed var(--border-focus)' }} onSubmit={handleCrearRol}>
                <h4 className="section-subtitle" style={{ marginTop: 0 }}>Crear Nuevo Rol</h4>
                <div className="form-group">
                  <label>Nombre del Rol</label>
                  <input type="text" required style={{textTransform: 'uppercase'}} placeholder="EJ. AUDITOR" value={nuevoRol.nombre_rol} onChange={e => setNuevoRol({...nuevoRol, nombre_rol: e.target.value.toUpperCase()})} />
                </div>
                <div className="form-group">
                  <label>Descripción / Función</label>
                  <input type="text" placeholder="Ej. Solo lectura de reportes" value={nuevoRol.descripcion} onChange={e => setNuevoRol({...nuevoRol, descripcion: e.target.value})} />
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Módulos Permitidos</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px', padding: '12px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: '600' }}>
                      <input type="checkbox" checked={nuevoRol.perm_usuarios} onChange={e => setNuevoRol({...nuevoRol, perm_usuarios: e.target.checked})} /> Usuarios
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: '600' }}>
                      <input type="checkbox" checked={nuevoRol.perm_proveedores} onChange={e => setNuevoRol({...nuevoRol, perm_proveedores: e.target.checked})} /> Proveedores
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: '600' }}>
                      <input type="checkbox" checked={nuevoRol.perm_viaticos} onChange={e => setNuevoRol({...nuevoRol, perm_viaticos: e.target.checked})} /> Viáticos
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)', fontWeight: '600' }}>
                      <input type="checkbox" checked={nuevoRol.perm_pagos} onChange={e => setNuevoRol({...nuevoRol, perm_pagos: e.target.checked})} /> Pagos
                    </label>
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                  {isLoading ? 'Creando...' : '+ Agregar Rol'}
                </button>
              </form>

              <div>
                <h4 className="section-subtitle">Roles Activos</h4>
                <div className="movimientos-list">
                  {roles.map(rol => (
                    <div className="movimiento-item" key={rol.id} style={{ borderLeft: `4px solid var(--brand-green)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="mov-detalles" style={{ width: '100%' }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                            <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{rol.nombre_rol}</strong>
                            {rol.nombre_rol !== 'ADMIN' ? (
                                <button className="btn-view" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '4px 8px' }} onClick={() => handleEliminarRol(rol.id)}>✕</button>
                            ) : (
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>Protegido</span>
                            )}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rol.descripcion || 'Sin descripción'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{zIndex: 2000}}>
          <div className="confirm-modal-content fade-in-up">
            <div className="confirm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
            <h3>{confirmModal.title}</h3><p>{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancelar</button>
              <button className="btn-confirm-delete" onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;