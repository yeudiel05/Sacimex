import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Usuarios.css';

// --- LISTAS DE RESPALDO ---
const ROLES_FALLBACK = ["ADMIN", "CONTADOR", "ALMACEN", "AUXILIAR", "DEPARTAMENTO_DE_DHO", "D.H.O", "REVISOR", "AUTORIZADOR_1", "AUTORIZADOR_2", "TESORERIA"];
const DEPARTAMENTOS_FALLBACK = ["CONTABILIDAD", "FINANZAS", "DIRECCION", "GERENCIA GENERAL", "OPERACIONES", "COORDINACION TI", "COORDINACION DHO", "TESORERIA", "NORMATIVIDAD"];
const SUCURSALES_FALLBACK = ["01.CRP - Corporativo", "02.ETL - Etla", "03.ANT - San Antonio", "04.CNT - Centro", "05.RCP - Recuperación", "06.HTL - Huatulco", "07.CCT - Cuicatlán", "08.CNT - Central", "09.CTL - Cuautla", "10.AJL - Ajalpan", "11.TCM - Tecamachalco", "12.HCH - Huauchinango", "13.SLN - Salina Cruz", "14.HJP - Huajuapan", "15.ONL - Virtual", "16.ESC - Puerto Escondido", "17.MHT - Miahutlán", "18.OCT - Ocotlán"];
const BANCOS_FALLBACK = ["BBVA", "BANAMEX", "SANTANDER", "BANORTE", "HSBC", "SCOTIABANK"];
const PUESTOS_FALLBACK = [{nombre: "DIRECTOR GENERAL"}, {nombre: "AUXILIAR CONTABLE"}, {nombre: "GERENTE DE SUCURSAL"}];

function Usuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [bancosDb, setBancosDb] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [puestosDb, setPuestosDb] = useState([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  
  // ESTADOS PARA ROLES
  const [nuevoRol, setNuevoRol] = useState({ nombre_rol: '', descripcion: '' });
  const [isEditingRol, setIsEditingRol] = useState(false);
  const [editRolId, setEditRolId] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // ESTADO PARA LA FIRMA
  const [archivoFirma, setArchivoFirma] = useState(null);

  // ESTADO COMPLETO DEL EXPEDIENTE
  const [formData, setFormData] = useState({
    username: '', password: '', rol: 'AUXILIAR', puede_solicitar: 0, nivel_autorizacion: 0, id_persona: null,
    titulo: '', nombre_completo: '', iniciales: '', telefono: '', correo_electronico: '',
    no_empleado: '', empresa_maestra: '', puesto: '', clave_puesto: '', nivel: '', area_departamento: '', sucursal_unidad: '', zona: '', jefe_inmediato: '',
    banco: '', cuenta_bancaria: ''
  });

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box', fontSize: '13px' };

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

  const fetchUnidades = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/unidades', { headers });
      const data = await res.json();
      if (data.success) setUnidades(data.data);
    } catch (error) { console.error("Error al obtener unidades:", error); }
  };

  const fetchBancos = async () => {
      const headers = getAuthHeaders(); if (!headers) return;
      try {
          const res = await fetch('http://localhost:3001/api/configuracion/bancos', { headers });
          const data = await res.json();
          if (data.success) setBancosDb(data.data);
      } catch (error) { console.error(error); }
  };

  const fetchDepartamentos = async () => {
      const headers = getAuthHeaders(); if (!headers) return;
      try {
          const res = await fetch('http://localhost:3001/api/configuracion/departamentos', { headers });
          const data = await res.json();
          if (data.success) setDepartamentos(data.data);
      } catch (error) { console.error(error); }
  };

  const fetchPuestos = async () => {
      const headers = getAuthHeaders(); if (!headers) return;
      try {
          const res = await fetch('http://localhost:3001/api/configuracion/puestos', { headers });
          const data = await res.json();
          if (data.success) setPuestosDb(data.data.filter(p => p.estatus_activo === 1 || p.estatus_activo === true));
      } catch (error) { console.error(error); }
  };

  useEffect(() => { 
    fetchUsuarios(); 
    fetchRoles();
    fetchUnidades();
    fetchBancos();
    fetchDepartamentos();
    fetchPuestos();
  }, []);

  const openNewModal = () => {
    setIsEditing(false);
    setEditId(null);
    setFormError('');
    setArchivoFirma(null);
    setFormData({ 
        username: '', password: '', rol: '', puede_solicitar: 0, nivel_autorizacion: 0, id_persona: null,
        titulo: '', nombre_completo: '', iniciales: '', telefono: '', correo_electronico: '',
        no_empleado: '', empresa_maestra: '', puesto: '', clave_puesto: '', nivel: '', area_departamento: departamentoSeleccionado || '', sucursal_unidad: '', zona: '', jefe_inmediato: '',
        banco: '', cuenta_bancaria: '' 
    });
    setIsModalOpen(true);
  };

  // --- NUEVA LÓGICA PARA TRAER EXPEDIENTE COMPLETO AL EDITAR ---
  const fetchExpedienteCompleto = async (id) => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch(`http://localhost:3001/api/usuarios/${id}`, { headers });
      const data = await res.json();
      if (data.success) {
        const u = data.data; // Aquí vienen todos los campos de la BD cruzados
        setFormData({
            username: u.username || '',
            password: '', // Por seguridad, siempre vacío
            rol: u.rol || 'AUXILIAR',
            puede_solicitar: u.puede_solicitar || 0,
            nivel_autorizacion: u.nivel_autorizacion || 0,
            id_persona: u.id_persona || null,
            titulo: u.titulo || '',
            nombre_completo: u.nombre_razon_social || u.nombre || '',
            iniciales: u.iniciales || '',
            telefono: u.telefono || '',
            correo_electronico: u.email_contacto || u.correo_electronico || u.email || '',
            no_empleado: u.no_empleado || '',
            empresa_maestra: u.empresa_maestra || '',
            puesto: u.puesto || '',
            clave_puesto: u.clave_puesto || '',
            nivel: u.nivel || '',
            area_departamento: u.departamento || u.area_departamento || '',
            sucursal_unidad: u.unidad_negocio || u.sucursal_unidad || '',
            zona: u.zona || '',
            jefe_inmediato: u.jefe_inmediato || '',
            banco: u.banco || '',
            cuenta_bancaria: u.cuenta_bancaria || ''
        });
      }
    } catch (error) {
      console.error("Error al cargar expediente completo:", error);
    }
  };

  const openEditModal = (user) => {
    setIsEditing(true);
    const userId = user.id_usuario || user.id;
    setEditId(userId);
    setFormError('');
    setArchivoFirma(null);
    
    // Abrimos el modal rápido
    setIsModalOpen(true);
    
    // Llamamos a la API para rellenar los datos completos del empleado
    fetchExpedienteCompleto(userId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);

    const url = isEditing ? `http://localhost:3001/api/usuarios/${editId}` : 'http://localhost:3001/api/usuarios';
    const method = isEditing ? 'PUT' : 'POST';

    const formPayload = new FormData();
    formPayload.append('nombre', formData.nombre_completo);
    formPayload.append('nombre_razon_social', formData.nombre_completo); 
    formPayload.append('email', formData.correo_electronico);
    formPayload.append('departamento', formData.area_departamento);
    formPayload.append('unidad_negocio', formData.sucursal_unidad);

    for (const key in formData) {
      if (formData[key] !== null && formData[key] !== undefined) {
        formPayload.append(key, formData[key]);
      }
    }
    
    if (archivoFirma) {
      formPayload.append('firma', archivoFirma);
    }

    try {
      const res = await fetch(url, { method: method, headers: { ...headers }, body: formPayload });
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

  // --- LÓGICA DE ROLES (CREAR / EDITAR) ---
  const handleGuardarRol = async (e) => {
    e.preventDefault();
    if (!nuevoRol.nombre_rol) return alert("Ingresa un nombre para el rol");
    const headers = getAuthHeaders();
    setIsLoading(true);
    
    const url = isEditingRol ? `http://localhost:3001/api/roles/${editRolId}` : 'http://localhost:3001/api/roles';
    const method = isEditingRol ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoRol)
      });
      const data = await res.json();
      if (data.success) {
        setNuevoRol({ nombre_rol: '', descripcion: '' });
        setIsEditingRol(false);
        setEditRolId(null);
        fetchRoles(); 
      } else {
        alert(data.message);
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const iniciarEdicionRol = (rol) => {
      setIsEditingRol(true);
      setEditRolId(rol.id);
      setNuevoRol({ nombre_rol: rol.nombre_rol, descripcion: rol.descripcion || '' });
  };

  const cancelarEdicionRol = () => {
      setIsEditingRol(false);
      setEditRolId(null);
      setNuevoRol({ nombre_rol: '', descripcion: '' });
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

  const manejarCambioPuesto = (e) => {
    const puestoElegido = e.target.value.toUpperCase();
    
    // Buscar en la base de datos de Puestos para rellenar inteligentemente
    const puestoInfo = puestosDb.find(p => p.nombre === puestoElegido);
    
    let deptoAuto = puestoInfo && puestoInfo.departamento_default ? puestoInfo.departamento_default : formData.area_departamento;
    let nivelAuto = puestoInfo ? (puestoInfo.nivel_default || 0) : 0; 
    let rolAuto = puestoInfo && puestoInfo.rol_default ? puestoInfo.rol_default : formData.rol;
    let puedeSoli = puestoInfo ? (puestoInfo.puede_solicitar_default || 0) : 0;

    setFormData({
        ...formData, 
        puesto: puestoElegido, 
        area_departamento: deptoAuto, 
        nivel_autorizacion: nivelAuto, 
        rol: rolAuto,
        puede_solicitar: puedeSoli
    });
  };

  const usuariosFiltradosGeneral = usuarios.filter(u => 
    (u.nombre_completo || u.nombre_razon_social || u.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.rol || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.area_departamento || u.departamento || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const departamentosUnicos = Array.from(new Set(
    usuariosFiltradosGeneral.map(u => (u.area_departamento || u.departamento || 'Sin Área Asignada').toUpperCase().trim())
  ));

  const usuariosDelDepartamento = usuariosFiltradosGeneral.filter(u => {
    const depUsuario = (u.area_departamento || u.departamento || 'Sin Área Asignada').toUpperCase().trim();
    return depUsuario === departamentoSeleccionado;
  });

  return (
    <div className="usuarios-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Directorio Institucional y Accesos</h1>
          <p>Expedientes de colaboradores, permisos y firmas autorizadas</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {rolUsuarioActual === 'ADMIN' && (
            <button className="btn-cancel" onClick={() => setIsRoleModalOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px', display: 'inline'}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Gestionar Roles
            </button>
          )}
          <button className="btn-primary" onClick={openNewModal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px', display: 'inline'}}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo Colaborador
          </button>
        </div>
      </div>

      <div className="usuarios-toolbar stagger-2 fade-in-up">
        <div className="search-bar" style={{ flexGrow: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Buscar por nombre, rol o área..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setDepartamentoSeleccionado(null); }} />
        </div>
        {departamentoSeleccionado && (
            <button className="btn-cancel" style={{ marginLeft: '16px' }} onClick={() => setDepartamentoSeleccionado(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px', display: 'inline'}}><polyline points="15 18 9 12 15 6"></polyline></svg>
                Volver a Departamentos
            </button>
        )}
      </div>

      {!departamentoSeleccionado && (
        <div className="usuarios-grid stagger-2 fade-in-up">
          {departamentosUnicos.map((dep, index) => {
            const totalUsuarios = usuariosFiltradosGeneral.filter(u => (u.area_departamento || u.departamento || 'Sin Área Asignada').toUpperCase().trim() === dep).length;
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

      {/* VISTA DE TABLA CORPORATIVA AL SELECCIONAR DEPARTAMENTO */}
      {departamentoSeleccionado && (
        <div className="fade-in-up" style={{ marginTop: '16px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-main)', borderBottom: '2px solid var(--brand-green-light)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-green)" strokeWidth="2" style={{width: '24px'}}><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                Directorio: <span style={{ color: 'var(--brand-green)' }}>{departamentoSeleccionado}</span>
            </h2>
            
            <div className="table-responsive" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        <tr>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>COLABORADOR</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>PUESTO Y SUCURSAL</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>CONTRATANTE / DEPÓSITO</th>
                            <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>ACCESO / FIRMA</th>
                            <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuariosDelDepartamento.map(user => {
                            const nombreMostrar = user.nombre_completo || user.nombre_razon_social || user.nombre || 'SIN NOMBRE REGISTRADO';
                            const iniciales = user.iniciales || nombreMostrar.substring(0, 2).toUpperCase();

                            return (
                            <tr key={user.id_usuario || user.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: user.estatus_activo === 0 ? 0.6 : 1 }}>
                                
                                {/* 1. COLABORADOR */}
                                <td style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: user.estatus_activo === 1 ? '#dcfce3' : '#f1f5f9', color: user.estatus_activo === 1 ? '#166534' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {iniciales}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <strong style={{ color: user.estatus_activo === 1 ? '#0f172a' : '#ef4444', fontSize: '14px' }}>
                                                {user.titulo ? `${user.titulo} ` : ''}{nombreMostrar}
                                            </strong>
                                            <span style={{ fontSize: '12px', color: '#64748b' }}>Usuario: <strong>{user.username}</strong></span>
                                        </div>
                                    </div>
                                </td>

                                {/* 2. PUESTO Y SUCURSAL */}
                                <td style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <strong style={{ color: '#334155', fontSize: '13px' }}>{user.puesto || 'Puesto no asignado'}</strong>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '12px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                            <span style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 'bold' }}>{user.sucursal_unidad || user.unidad_negocio || 'Corporativo'}</span>
                                        </div>
                                    </div>
                                </td>

                                {/* 3. EMPRESA PATRONA Y BANCO */}
                                <td style={{ padding: '16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <strong style={{ color: '#0f172a', fontSize: '11px', whiteSpace: 'nowrap' }}>{user.empresa_maestra || 'Empresa No Especificada'}</strong>
                                        {user.banco ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '12px'}}><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                                                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>{user.banco} ({user.cuenta_bancaria ? `...${user.cuenta_bancaria.slice(-4)}` : 'S/N'})</span>
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Sin cuenta bancaria</span>
                                        )}
                                    </div>
                                </td>

                                {/* 4. ACCESO AL SISTEMA Y FIRMA */}
                                <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                                            ROL: {user.rol}
                                        </span>
                                        {user.firma ? (
                                            <img src={`http://localhost:3001/${user.firma}`} alt="Firma" style={{ height: '24px', objectFit: 'contain', border: '1px dashed #cbd5e1', padding: '2px', borderRadius: '4px' }} />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '12px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                <span style={{ fontSize: '10px', color: '#ef4444' }}>Sin firma</span>
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* 5. ACCIONES */}
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                            className="btn-icon-edit" 
                                            onClick={() => cambiarEstatus(user.id_usuario || user.id, user.estatus_activo)} 
                                            title={user.estatus_activo ? "Bloquear Acceso" : "Permitir Acceso"}
                                        >
                                            {user.estatus_activo ? (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px'}}>
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '16px'}}>
                                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                                </svg>
                                            )}
                                        </button>
                                        
                                        <button className="btn-icon-edit" onClick={() => openEditModal(user)} title="Editar Expediente">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
                                        
                                        <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminar(user.id_persona, nombreMostrar)} title="Eliminar Colaborador">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            );
                        })}
                        {usuariosDelDepartamento.length === 0 && (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No hay usuarios en este departamento.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* --- MODAL DE ALTA Y EDICIÓN DE EXPEDIENTE COMPLETO --- */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content fade-in-down" style={{maxWidth: '950px', maxHeight: '95vh', display: 'flex', flexDirection: 'column'}}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Expediente y Accesos' : 'Alta de Colaborador y Accesos'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}>
              <div className="modal-form" style={{overflowY: 'auto', padding: '32px', backgroundColor: '#f8fafc'}}>
                {formError && ( <div className="error-message shake-animation" style={{marginBottom: '16px'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>{formError}</span></div> )}
                
                {/* --- SECCIÓN 1: ACCESO AL SISTEMA --- */}
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '16px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <h4 style={{ margin: 0, color: '#0f172a' }}>Acceso al Sistema y Permisos</h4>
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Usuario (Login) <span style={{color:'red'}}>*</span></label>
                            <input type="text" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Contraseña {isEditing && '(Vacío = No cambiar)'} <span style={{color:'red'}}>*</span></label>
                            <input type="password" required={!isEditing} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Rol de Acceso <span style={{color:'red'}}>*</span></label>
                            <select className="custom-select" required value={formData.rol} onChange={(e) => setFormData({...formData, rol: e.target.value})} style={{...inputStyle, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 'bold'}}>
                                <option value="">Selecciona un rol...</option>
                                {roles.length > 0 ? roles.map(rol => (
                                    <option key={rol.id} value={rol.nombre_rol}>{rol.nombre_rol}</option>
                                )) : ROLES_FALLBACK.map((rol, i) => (
                                    <option key={`fb-rol-${i}`} value={rol}>{rol}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-group" style={{marginTop: '16px'}}>
                        <label style={{color: '#92400e', fontWeight: 'bold'}}>Firma Autorizada (Imagen .png / .jpg)</label>
                        <input type="file" accept="image/png, image/jpeg" onChange={(e) => setArchivoFirma(e.target.files[0])} style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '8px', width: '100%', cursor: 'pointer', backgroundColor: '#fffbeb', fontSize: '13px' }} />
                        <small style={{color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px'}}>Sube la firma solo si el usuario autorizará solicitudes de recursos.</small>
                    </div>
                </div>

                {/* --- SECCIÓN 2: INFORMACIÓN PERSONAL --- */}
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '16px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <h4 style={{ margin: 0, color: '#0f172a' }}>Información Personal</h4>
                    </div>
                    
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label>Título <span style={{color:'red'}}>*</span></label>
                            <input type="text" placeholder="Ej. Ing." required value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value.toUpperCase()})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Nombre Completo <span style={{color:'red'}}>*</span></label>
                            <input type="text" required value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value.toUpperCase()})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label>Iniciales <span style={{color:'red'}}>*</span></label>
                            <input type="text" placeholder="Ej. JPC" required value={formData.iniciales} onChange={e => setFormData({...formData, iniciales: e.target.value.toUpperCase()})} style={inputStyle} />
                        </div>
                    </div>
                    
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Teléfono Celular <span style={{color:'red'}}>*</span></label>
                            <input type="text" required maxLength="10" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value.replace(/[^0-9]/g, '')})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label>Correo Electrónico Institucional <span style={{color:'red'}}>*</span></label>
                            <input type="email" required value={formData.correo_electronico} onChange={e => setFormData({...formData, correo_electronico: e.target.value})} style={inputStyle} />
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN 3: DATOS LABORALES --- */}
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '16px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px'}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <h4 style={{ margin: 0, color: '#0f172a' }}>Datos Laborales y de Contratación</h4>
                    </div>
                    
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label>No. Empleado <span style={{color:'red'}}>*</span></label>
                            <input type="text" required value={formData.no_empleado} onChange={e => setFormData({...formData, no_empleado: e.target.value})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Empresa Patrona (Razón Social) <span style={{color:'red'}}>*</span></label>
                            <select required value={formData.empresa_maestra} onChange={e => setFormData({...formData, empresa_maestra: e.target.value})} style={inputStyle}>
                                <option value="">Seleccione el patrón...</option>
                                <option value="Opciones Sacimex SA de CV SOFOM ENR">Opciones Sacimex SA de CV SOFOM ENR</option>
                                <option value="Servicios integrados EXDAN SA DE CV">Servicios integrados EXDAN SA DE CV</option>
                                <option value="Integración Activa Especializada Ragar SA de CV">Integración Activa Especializada Ragar SA de CV</option>
                                <option value="Technological Human Provision SA de CV">Technological Human Provision SA de CV</option>
                                <option value="Consultoría en Desarrollo Integral Empresarial CODIEM SA de CV">Consultoría en Desarrollo Integral Empresarial CODIEM SA de CV</option>
                                <option value="MI PRIMERA CHAMBA">MI PRIMERA CHAMBA</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Puesto o Cargo <span style={{color:'red'}}>*</span></label>
                            <select className="custom-select" required value={formData.puesto} onChange={manejarCambioPuesto} style={inputStyle}>
                                <option value="">Selecciona un puesto...</option>
                                {puestosDb.length > 0 ? puestosDb.map(p => (
                                    <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                )) : PUESTOS_FALLBACK.map((p, i) => (
                                    <option key={`fb-puesto-${i}`} value={p.nombre}>{p.nombre}</option>
                                ))}
                            </select>
                            <input type="text" placeholder="O escribe el puesto manualmente..." value={formData.puesto} onChange={e => setFormData({...formData, puesto: e.target.value.toUpperCase()})} style={{...inputStyle, marginTop: '8px', display: formData.puesto && !puestosDb.some(p => p.nombre === formData.puesto) ? 'block' : 'none'}} />
                        </div>
                        <div className="form-group">
                            <label>Clave de Puesto</label>
                            <input type="text" placeholder="Ej. GSCR" value={formData.clave_puesto} onChange={e => setFormData({...formData, clave_puesto: e.target.value.toUpperCase()})} style={inputStyle} />
                        </div>
                        <div className="form-group">
                            <label>Nivel de Puesto</label>
                            <input type="text" placeholder="Ej. A, B, C..." value={formData.nivel} onChange={e => setFormData({...formData, nivel: e.target.value.toUpperCase()})} style={inputStyle} />
                        </div>
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Área / Departamento <span style={{color:'red'}}>*</span></label>
                            <select required value={formData.area_departamento} onChange={e => setFormData({...formData, area_departamento: e.target.value})} style={inputStyle}>
                                <option value="">Selecciona el departamento...</option>
                                {departamentos.length > 0 ? departamentos.map(d => (
                                    <option key={d.id} value={d.nombre}>{d.nombre}</option>
                                )) : DEPARTAMENTOS_FALLBACK.map((dep, i) => (
                                    <option key={`fb-dep-${i}`} value={dep}>{dep}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={{fontWeight:'bold'}}>Sucursal / Unidad <span style={{color:'red'}}>*</span></label>
                            <select className="custom-select" required value={formData.sucursal_unidad} onChange={(e) => setFormData({...formData, sucursal_unidad: e.target.value})} style={inputStyle}>
                                <option value="">Selecciona una unidad...</option>
                                {unidades.length > 0 ? unidades.map(unidad => (
                                    <option key={unidad.id} value={unidad.nombre}>{unidad.nombre}</option>
                                )) : SUCURSALES_FALLBACK.map((suc, i) => (
                                    <option key={`fb-suc-${i}`} value={suc}>{suc}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Zona</label>
                            <input type="text" placeholder="Ej. Norte, Valles..." value={formData.zona} onChange={e => setFormData({...formData, zona: e.target.value.toUpperCase()})} style={inputStyle} />
                        </div>
                    </div>

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label>Jefe Inmediato</label>
                            <select value={formData.jefe_inmediato} onChange={e => setFormData({...formData, jefe_inmediato: e.target.value})} style={inputStyle}>
                                <option value="">Selecciona al Jefe Directo...</option>
                                {usuarios.map(u => {
                                    const nombreMostrar = u.nombre_completo || u.nombre_razon_social || u.nombre;
                                    if (!nombreMostrar) return null;
                                    return (
                                        <option key={u.id_usuario || u.id} value={nombreMostrar}>
                                            {nombreMostrar} ({u.puesto || 'Sin puesto'})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                </div>

                {/* --- SECCIÓN 4: DATOS BANCARIOS PARA VIÁTICOS --- */}
                <div style={{ backgroundColor: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #dcfce3', paddingBottom: '8px', marginBottom: '16px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: '18px'}}><rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                        <h4 style={{ margin: 0, color: '#166534' }}>Cuenta para Depósito de Viáticos</h4>
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label style={{fontWeight:'bold', color: '#15803d'}}>Banco Destino <span style={{color:'red'}}>*</span></label>
                            <select required value={formData.banco} onChange={e => setFormData({...formData, banco: e.target.value})} style={{...inputStyle, borderColor: '#86efac'}}>
                                <option value="">Seleccione banco...</option>
                                {bancosDb.length > 0 ? bancosDb.map(b => (
                                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                )) : BANCOS_FALLBACK.map((banco, i) => (
                                    <option key={`fb-ban-${i}`} value={banco}>{banco}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={{fontWeight:'bold', color: '#15803d'}}>Número de Cuenta o CLABE <span style={{color:'red'}}>*</span></label>
                            <input type="text" required placeholder="Ingresa los dígitos sin espacios" value={formData.cuenta_bancaria} onChange={e => setFormData({...formData, cuenta_bancaria: e.target.value.replace(/[^0-9]/g, '')})} style={{...inputStyle, borderColor: '#86efac'}} />
                        </div>
                    </div>
                </div>

              </div>

              <div className="modal-footer" style={{padding: '20px 32px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: '12px'}}>
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isLoading} style={{backgroundColor: '#0f172a'}}>
                    {isLoading ? 'Guardando...' : (isEditing ? 'Actualizar Expediente' : 'Crear Expediente')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL ROLES CON EDICIÓN --- */}
      {isRoleModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRoleModalOpen(false)} style={{zIndex: 4000}}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Catálogo de Roles</h2>
                <p className="client-badge" style={{backgroundColor: '#e0f2fe', color: '#1e40af'}}>Niveles de Acceso</p>
              </div>
              <button className="btn-close" onClick={() => setIsRoleModalOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <form className="modal-form" style={{ padding: '20px', backgroundColor: isEditingRol ? '#f0fdf4' : 'var(--bg-main)', borderRadius: '12px', border: isEditingRol ? '1px solid #10b981' : '1px dashed var(--border-focus)' }} onSubmit={handleGuardarRol}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 className="section-subtitle" style={{ margin: 0 }}>{isEditingRol ? 'Editar Rol' : 'Crear Nuevo Rol'}</h4>
                    {isEditingRol && (
                        <button type="button" onClick={cancelarEdicionRol} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Cancelar Edición
                        </button>
                    )}
                </div>
                <div className="form-group">
                  <label>Nombre del Rol</label>
                  <input type="text" required disabled={isEditingRol && nuevoRol.nombre_rol === 'ADMIN'} style={{textTransform: 'uppercase', backgroundColor: (isEditingRol && nuevoRol.nombre_rol === 'ADMIN') ? '#f1f5f9' : 'white'}} placeholder="EJ. AUDITOR" value={nuevoRol.nombre_rol} onChange={e => setNuevoRol({...nuevoRol, nombre_rol: e.target.value.toUpperCase()})} />
                </div>
                <div className="form-group">
                  <label>Descripción / Función</label>
                  <input type="text" placeholder="Ej. Solo lectura de reportes" value={nuevoRol.descripcion} onChange={e => setNuevoRol({...nuevoRol, descripcion: e.target.value})} />
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: '16px', width: '100%', justifyContent: 'center', backgroundColor: isEditingRol ? '#10b981' : '#0f172a' }} disabled={isLoading}>
                  {isLoading ? 'Procesando...' : (isEditingRol ? 'Guardar Cambios' : '+ Agregar Rol')}
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
                            
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-view" style={{ borderColor: '#3b82f6', color: '#3b82f6', padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => iniciarEdicionRol(rol)} title="Editar Rol">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>

                                {rol.nombre_rol !== 'ADMIN' ? (
                                    <button className="btn-view" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '4px 8px', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => handleEliminarRol(rol.id)} title="Eliminar Rol">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>Protegido</span>
                                )}
                            </div>
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

      {/* --- CONFIRM MODAL --- */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{zIndex: 5000}}>
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