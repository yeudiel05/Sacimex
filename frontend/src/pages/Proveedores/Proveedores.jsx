import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Proveedores.css';

// ==========================================
// UTILERÍAS GLOBALES Y MATEMÁTICAS
// ==========================================
const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

const parseInputMonto = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/,/g, ''); 
};

function Proveedores() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null); 
  
  // --- ESTADOS GENERALES Y BÚSQUEDA ---
  const [proveedores, setProveedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- ESTADOS DE MODALES Y FORMULARIOS CRUD ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    tipo_persona: 'MORAL', nombre: '', rfc: '', direccion: '', telefono: '', 
    email: '', categoria: 'OTROS', clabe_bancaria: '', numero_cuenta: '', banco: '', dias_credito: 0
  });

  // --- ESTADOS PARA EL FLUJO DE SOLICITUDES DE PAGO (WORKFLOW) ---
  const [panelOpen, setPanelOpen] = useState(false);
  const [provActivo, setProvActivo] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [showNuevoPago, setShowNuevoPago] = useState(false);
  
  // Adaptado al nuevo modelo de la BD: id_concepto, unidad_negocio, justificacion, monto_pago
  const [formPago, setFormPago] = useState({ 
      id_concepto: '1', 
      unidad_negocio: '01.CRP - Corporativo', 
      justificacion: '', 
      monto_pago: '', 
      num_factura_ref: '' 
  });
  const [fileComprobante, setFileComprobante] = useState(null);

  // --- ESTADOS PARA REPORTES Y ALERTAS ---
  const [panelVencimientosOpen, setPanelVencimientosOpen] = useState(false);
  const [pagosPorVencer, setPagosPorVencer] = useState([]);

  // --- FUNCIONES DE RED Y SEGURIDAD ---
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; }
    return false;
  };

  // --- FETCH PRINCIPALES ---
  const fetchProveedores = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const response = await fetch('http://localhost:3001/api/proveedores', { headers });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) setProveedores(data.data);
    } catch (error) { console.error("Error al cargar datos:", error); }
  };

  const fetchPagosPorVencer = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
        const response = await fetch('http://localhost:3001/api/proveedores/reportes/pagos-por-vencer', { headers });
        const data = await response.json();
        if (data.success) {
            setPagosPorVencer(data.data);
            setPanelVencimientosOpen(true);
        }
    } catch (error) { console.error("Error al cargar vencimientos:", error); }
  };

  useEffect(() => { fetchProveedores(); }, []);

  // --- FUNCIONES PARA EXCEL Y DIRECTORIO ---
  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) return alert("Por favor, selecciona un archivo con extensión .xlsx");
    if (!window.confirm(`¿Deseas intentar importar los proveedores del archivo "${file.name}"?`)) { e.target.value = null; return; }

    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    const formDataUpload = new FormData(); formDataUpload.append('archivo_excel', file);

    try {
        const response = await fetch('http://localhost:3001/api/proveedores/importar', { method: 'POST', headers: { Authorization: headers.Authorization }, body: formDataUpload });
        if (handleAuthError(response.status)) return;
        const data = await response.json();
        alert(data.message); 
        if (data.success) fetchProveedores(); 
    } catch (error) { alert("Hubo un problema de conexión al importar."); } finally { setIsLoading(false); e.target.value = null; }
  };

  const openNewModal = () => { setIsEditing(false); setEditId(null); setFormError(''); setFormData({ tipo_persona: 'MORAL', nombre: '', rfc: '', direccion: '', telefono: '', email: '', categoria: 'OTROS', clabe_bancaria: '', numero_cuenta: '', banco: '', dias_credito: 0 }); setIsModalOpen(true); };
  const openEditModal = (prov) => { setIsEditing(true); setEditId(prov.id); setFormError(''); setFormData({ tipo_persona: prov.tipo_persona || 'MORAL', nombre: prov.nombre || '', rfc: prov.rfc || '', direccion: prov.ubicacion || '', telefono: prov.telefono || '', email: prov.email || '', categoria: prov.categoria || 'OTROS', clabe_bancaria: prov.clabe_bancaria || '', numero_cuenta: prov.numero_cuenta || '', banco: prov.banco || '', dias_credito: prov.dias_credito || 0 }); setIsModalOpen(true); };
  const triggerEliminar = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Proveedor', message: `¿Estás seguro de eliminar a ${nombre || 'este proveedor'}? Se ocultará del directorio permanentemente.`, onConfirm: () => ejecutarEliminar(id) }); };
  
  const ejecutarEliminar = async (id) => { 
    const headers = getAuthHeaders(); if (!headers) return; 
    try { const res = await fetch(`http://localhost:3001/api/proveedores/${id}`, { method: 'DELETE', headers }); if (handleAuthError(res.status)) return; if ((await res.json()).success) fetchProveedores(); } catch (error) { console.error(error); } 
  };
  
  const validarFormulario = () => { 
    setFormError(''); 
    if (!formData.nombre.trim()) { setFormError('La Razón Social / Nombre es obligatorio.'); return false; } 
    if (formData.rfc && formData.tipo_persona === 'FISICA' && formData.rfc.length !== 13) { setFormError('El RFC Física debe tener 13 caracteres.'); return false; }
    if (formData.rfc && formData.tipo_persona === 'MORAL' && formData.rfc.length !== 12) { setFormError('El RFC Moral debe tener 12 caracteres.'); return false; }
    return true; 
  };
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); if (!validarFormulario()) return; 
    const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true); 
    const url = isEditing ? `http://localhost:3001/api/proveedores/${editId}` : 'http://localhost:3001/api/proveedores'; 
    const method = isEditing ? 'PUT' : 'POST'; 
    try { 
      const res = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); 
      if (handleAuthError(res.status)) return; 
      const data = await res.json();
      if (data.success) { setIsModalOpen(false); fetchProveedores(); } else setFormError(data.message || "Error al intentar guardar."); 
    } catch (error) { setFormError(`Falla de Red.`); } finally { setIsLoading(false); } 
  };
  
  const cambiarEstatus = async (id_persona, estatus_actual) => { 
    const nuevoEstatus = estatus_actual === 1 ? 0 : 1; const headers = getAuthHeaders(); if (!headers) return; 
    try { const res = await fetch(`http://localhost:3001/api/proveedores/${id_persona}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) }); if ((await res.json()).success) fetchProveedores(); } catch (error) {} 
  };

  // ==========================================
  // FUNCIONES DEL WORKFLOW DE SOLICITUDES
  // ==========================================
  const abrirPanelSolicitudes = (prov) => {
    setProvActivo(prov);
    setShowNuevoPago(false);
    setPanelOpen(true);
    fetchSolicitudes(prov.id);
  };

  const fetchSolicitudes = async (id_proveedor) => {
    const headers = getAuthHeaders();
    const res = await fetch(`http://localhost:3001/api/proveedores/${id_proveedor}/pagos`, { headers });
    const data = await res.json();
    if (data.success) setSolicitudes(data.data);
  };

  const handleCrearSolicitud = async (e) => {
    e.preventDefault();
    if (!formPago.justificacion || !formPago.monto_pago) return alert("Completa la justificación y el monto.");
    
    const headers = getAuthHeaders();
    setIsLoading(true);
    
    const formDataUpload = new FormData();
    formDataUpload.append('id_proveedor', provActivo.id);
    formDataUpload.append('id_concepto', formPago.id_concepto);
    formDataUpload.append('unidad_negocio', formPago.unidad_negocio);
    formDataUpload.append('justificacion', formPago.justificacion);
    formDataUpload.append('monto_pago', formPago.monto_pago);
    formDataUpload.append('num_factura_ref', formPago.num_factura_ref);
    if (fileComprobante) formDataUpload.append('comprobante', fileComprobante);

    try {
      const res = await fetch('http://localhost:3001/api/proveedores/pagos', { method: 'POST', headers: { Authorization: headers.Authorization }, body: formDataUpload });
      const data = await res.json();
      if (data.success) {
        setShowNuevoPago(false);
        setFormPago({ id_concepto: '1', unidad_negocio: '01.CRP - Corporativo', justificacion: '', monto_pago: '', num_factura_ref: '' });
        setFileComprobante(null);
        fetchSolicitudes(provActivo.id);
      } else { alert(data.message); }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const avanzarWorkflowPago = async (id_solicitud, accion) => {
    if (!window.confirm(`¿Estás seguro de ${accion.toLowerCase()} esta solicitud?`)) return;
    const headers = getAuthHeaders();
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/proveedores/pagos/${id_solicitud}/autorizacion`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      });
      const data = await res.json();
      if (data.success) fetchSolicitudes(provActivo.id); 
      else alert(data.message);
    } catch (error) {
      alert('Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTROS Y PAGINACIÓN ---
  const proveedoresFiltrados = proveedores.filter(p => 
    (p.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.categoria || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.rfc || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = proveedoresFiltrados.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(proveedoresFiltrados.length / itemsPerPage);

  return (
    <div className="inversores-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Proveedores y Gastos</h1>
          <p>Directorio, Cuentas por Pagar y Flujo de Autorizaciones</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-view" style={{ borderColor: '#f59e0b', color: '#d97706', fontWeight: 'bold' }} onClick={fetchPagosPorVencer}>
              Pagos por Vencer
          </button>
          <input type="file" accept=".xlsx" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportExcel} />
          <button className="btn-view" style={{ borderColor: 'var(--brand-green)', color: 'var(--brand-green)', fontWeight: 'bold' }} onClick={() => fileInputRef.current.click()} disabled={isLoading}>
              {isLoading ? 'Cargando...' : 'Importar Excel'}
          </button>
          <button className="btn-primary" onClick={openNewModal}>+ Agregar Proveedor</button>
        </div>
      </div>

      {/* --- TABLA PRINCIPAL DE PROVEEDORES --- */}
      <div className="inversores-list-container fade-in-up" style={{ marginTop: '20px' }}>
        <div className="list-header">
            <h2>Catálogo de Proveedores</h2>
            <div className="search-bar" style={{ margin: 0, maxWidth: '350px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" placeholder="Buscar por nombre, RFC o Categoría..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>

        <div className="table-responsive">
            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ width: '35%' }}>Razón Social</th>
                        <th style={{ width: '25%' }}>Contacto / Servicio</th>
                        <th style={{ width: '20%' }}>Datos de Pago</th>
                        <th style={{ width: '10%' }}>Estatus</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {currentItems.map(p => (
                        <tr key={p.id}>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className={`avatar-sm ${p.estatus_activo ? 'avatar-active' : 'avatar-inactive'}`}>
                                        {(p.nombre || 'S/N').substring(0, 2).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <strong style={{ color: 'var(--text-main)' }}>{p.nombre || 'SIN NOMBRE REGISTRADO'}</strong>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>RFC: {p.rfc || 'S/N'}</span>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                                    <strong style={{ color: 'var(--brand-green)' }}>{p.categoria || 'General'}</strong>
                                    <span style={{ color: 'var(--text-muted)' }}>{p.telefono || 'Sin teléfono'}</span>
                                </div>
                            </td>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                                    <strong style={{ color: 'var(--text-main)' }}>{p.banco || 'BANCO NO REG.'}</strong>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Cuenta: {p.numero_cuenta || 'N/D'}</span>
                                    <span style={{ color: 'var(--brand-green)', fontSize: '11px', fontWeight: 'bold' }}>CLABE: {p.clabe_bancaria || 'N/D'}</span>
                                </div>
                            </td>
                            <td>
                                <button className={`badge-estatus ${p.estatus_activo ? 'badge-activo' : 'badge-inactivo'}`} onClick={() => cambiarEstatus(p.id, p.estatus_activo)}>
                                    {p.estatus_activo ? 'Vigente' : 'Suspendido'}
                                </button>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="btn-icon-edit" onClick={() => abrirPanelSolicitudes(p)} title="Solicitudes y Pagos">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                    </button>
                                    <button className="btn-icon-edit" onClick={() => openEditModal(p)} title="Editar Proveedor">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminar(p.id, p.nombre)} title="Eliminar Proveedor">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {currentItems.length === 0 && (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '32px' }}>
                                <div className="empty-state" style={{ border: 'none', background: 'transparent' }}>
                                    No se encontraron proveedores registrados.
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {totalPages > 1 && (
                <div className="pagination-container">
                    <button className="btn-page" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>&laquo; Anterior</button>
                    <span className="page-info">Página {currentPage} de {totalPages}</span>
                    <button className="btn-page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente &raquo;</button>
                </div>
            )}
        </div>
      </div>

      {/* --- MODAL: PAGOS POR VENCER (SEMÁFORO) --- */}
      {panelVencimientosOpen && (
        <div className="modal-overlay" onClick={() => setPanelVencimientosOpen(false)}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header" style={{backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a'}}>
              <div>
                <h2 style={{color: '#d97706'}}> Pagos por Vencer</h2>
                <p className="client-badge" style={{backgroundColor: '#fef3c7', color: '#b45309'}}>Cuentas pendientes organizadas por urgencia</p>
              </div>
              <button className="btn-close" onClick={() => setPanelVencimientosOpen(false)}>×</button>
            </div>
            
            <div className="panel-body">
                {pagosPorVencer.length > 0 ? (
                    <div className="movimientos-list">
                        {pagosPorVencer.map(pago => {
                            let cardStyle = { borderLeft: '4px solid #10b981', background: '#ecfdf5', iconColor: '#059669', badgeBg: '#d1fae5', text: 'En tiempo' }; 
                            
                            if(pago.dias_restantes <= 5 && pago.dias_restantes > 0) {
                                cardStyle = { borderLeft: '4px solid #f59e0b', background: '#fffbeb', iconColor: '#d97706', badgeBg: '#fef3c7', text: 'Próximo a vencer' }; 
                            } else if (pago.dias_restantes <= 0) {
                                cardStyle = { borderLeft: '4px solid #ef4444', background: '#fef2f2', iconColor: '#dc2626', badgeBg: '#fee2e2', text: 'VENCIDO' }; 
                            }

                            return (
                                <div className="movimiento-item" key={pago.id_pago} style={{ borderLeft: cardStyle.borderLeft, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                                    
                                    <div style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                        <div>
                                            <strong style={{fontSize: '15px', color: 'var(--text-main)'}}>{pago.proveedor}</strong>
                                            <p style={{margin: '4px 0', fontSize: '13px', color: 'var(--text-muted)'}}>{pago.concepto}</p>
                                        </div>
                                        <div style={{textAlign: 'right'}}>
                                            <strong style={{color: '#ef4444', fontSize: '16px'}}>{formatMoney(pago.monto_pago)}</strong>
                                        </div>
                                    </div>

                                    <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: '8px', borderTop: '1px dashed var(--border-light)', paddingTop: '8px'}}>
                                        <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>
                                            Solicitado: {new Date(pago.fecha_solicitud).toLocaleDateString()} <br/>
                                            <strong style={{color: 'var(--text-main)'}}>Límite: {new Date(pago.fecha_vencimiento).toLocaleDateString()}</strong>
                                        </div>
                                        <div style={{ backgroundColor: cardStyle.badgeBg, color: cardStyle.iconColor, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                                            {pago.dias_restantes > 0 ? `Faltan ${pago.dias_restantes} días` : `Tiene ${Math.abs(pago.dias_restantes)} días de retraso`}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '32px', marginBottom: '10px', color: '#10b981'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      <p>¡Todo al día! No hay cuentas pendientes por vencer.</p>
                    </div> 
                )}
            </div>
          </div>
        </div>
      )}

      {/* --- PANEL DE FLUJO Y WORKFLOW DEL PROVEEDOR --- */}
      {panelOpen && provActivo && (
        <div className="modal-overlay" onClick={() => setPanelOpen(false)}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Solicitudes de Pago</h2>
                <p className="client-badge" style={{backgroundColor: '#e0f2fe', color: '#1e40af'}}>{provActivo.nombre || 'SIN NOMBRE'}</p>
              </div>
              <button className="btn-close" onClick={() => setPanelOpen(false)}>×</button>
            </div>
            
            <div className="panel-body">
              {!showNuevoPago ? (
                <>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                    <h4 className="section-subtitle" style={{margin: 0, border: 'none'}}>Flujo de Solicitudes</h4>
                    <button className="btn-primary" onClick={() => setShowNuevoPago(true)}>+ Nueva Solicitud</button>
                  </div>
                  
                  {solicitudes.length > 0 ? (
                    <div className="movimientos-list">
                      {solicitudes.map(sol => {
                        // SEMAFORIZACIÓN DE LAS ETAPAS DEL WORKFLOW
                        let estatusColor = '#64748b'; let estatusBg = '#f1f5f9'; let estatusTexto = 'DESCONOCIDO';
                        if (sol.estatus_actual === 'PENDIENTE_REVISION') { estatusColor = '#f59e0b'; estatusBg = '#fef3c7'; estatusTexto = 'En Revisión (Paso 1)'; }
                        if (sol.estatus_actual === 'PENDIENTE_AUT_1') { estatusColor = '#3b82f6'; estatusBg = '#dbeafe'; estatusTexto = 'Autorización Nivel 1'; }
                        if (sol.estatus_actual === 'PENDIENTE_AUT_2') { estatusColor = '#4f46e5'; estatusBg = '#e0e7ff'; estatusTexto = 'Autorización Nivel 2'; }
                        if (sol.estatus_actual === 'PENDIENTE_AUT_3') { estatusColor = '#7c3aed'; estatusBg = '#ede9fe'; estatusTexto = 'Autorización Nivel 3 (Director)'; }
                        if (sol.estatus_actual === 'EN_TESORERIA') { estatusColor = '#0891b2'; estatusBg = '#cffafe'; estatusTexto = 'Aprobado - En Tesorería'; }
                        if (sol.estatus_actual === 'PAGADO') { estatusColor = '#16a34a'; estatusBg = '#dcfce3'; estatusTexto = 'PAGADO Y LIQUIDADO'; }
                        if (sol.estatus_actual === 'RECHAZADO') { estatusColor = '#ef4444'; estatusBg = '#fef2f2'; estatusTexto = 'RECHAZADO'; }

                        const rolUsuario = localStorage.getItem('rol') || 'ADMIN'; // En el futuro lo validas según permisos

                        return (
                          <div className="movimiento-item" key={sol.id} style={{ borderLeft: `4px solid ${estatusColor}` }}>
                            <div className="mov-detalles">
                              <strong>{sol.justificacion}</strong>
                              <span>Folio: {sol.folio} • {new Date(sol.fecha_creacion).toLocaleDateString()}</span>
                              <span style={{ fontSize: '11px', color: estatusColor, backgroundColor: estatusBg, padding: '4px 10px', borderRadius: '12px', width: 'fit-content', fontWeight: '800', marginTop: '6px' }}>
                                {estatusTexto}
                              </span>
                            </div>
                            <div className="mov-monto-accion" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                              <span className="mov-monto" style={{color: sol.estatus_actual === 'PAGADO' ? '#ef4444' : '#64748b'}}>
                                {sol.estatus_actual === 'RECHAZADO' ? '$0.00' : `-${formatMoney(sol.monto_total)}`}
                              </span>
                              
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {/* Botones Dinámicos para el Motor de Flujo */}
                                {sol.estatus_actual !== 'PAGADO' && sol.estatus_actual !== 'RECHAZADO' && (
                                  <button className="btn-view" style={{ borderColor: '#16a34a', color: '#16a34a' }} onClick={() => avanzarWorkflowPago(sol.id, 'APROBAR')} title="Aprobar / Avanzar Etapa">
                                    Aprobar
                                  </button>
                                )}

                                {sol.estatus_actual !== 'PAGADO' && sol.estatus_actual !== 'RECHAZADO' && (
                                  <button className="btn-view" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => avanzarWorkflowPago(sol.id, 'RECHAZAR')} title="Rechazar Solicitud">
                                    ✕
                                  </button>
                                )}

                                {/* Siempre dejar ver el PDF si existe o generarlo */}
                                <button className="btn-view" onClick={() => window.open(`http://localhost:3001/api/proveedores/autorizaciones/${sol.id}/pdf`, '_blank')} title="Descargar Formato SAC-TSR-RCS">
                                    PDF
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : ( <div className="empty-state">No hay solicitudes de pago para este proveedor.</div> )}
                </>
              ) : (
                <form className="modal-form" style={{padding: '0'}} onSubmit={handleCrearSolicitud}>
                  <h4 className="section-subtitle">Nueva Solicitud Universal de Recursos</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                        <label>Unidad de Negocio</label>
                        <select className="custom-select" required value={formPago.unidad_negocio} onChange={e => setFormPago({...formPago, unidad_negocio: e.target.value})}>
                            <option value="01.CRP - Corporativo">01.CRP - Corporativo</option>
                            <option value="02.PCH - Pochutla">02.PCH - Pochutla</option>
                            <option value="13.SLN - Salina Cruz">13.SLN - Salina Cruz</option>
                            <option value="07.CCT - Cuicatlán">07.CCT - Cuicatlán</option>
                            <option value="11.TCM - Tecamachalco">11.TCM - Tecamachalco</option>
                            <option value="04.HTL - Huatulco">04.HTL - Huatulco</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Concepto C-XX</label>
                        <select className="custom-select" required value={formPago.id_concepto} onChange={e => setFormPago({...formPago, id_concepto: e.target.value})}>
                            <option value="1">C-01 Cómputo (Corporativo)</option>
                            <option value="6">C-06 Serv. Empresariales (Moral)</option>
                            <option value="7">C-07 Serv. y Honorarios (Física)</option>
                            <option value="8">C-08 Servicios Públicos</option>
                            <option value="11">C-11 Renta de Inmuebles</option>
                            <option value="16">C-16 Fondo Fijo para Gastos Menores</option>
                            <option value="17">C-17 Gastos a Comprobar</option>
                        </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Justificación del Gasto</label>
                    <input type="text" required placeholder="Ej. Honorarios contables enero, Pago de luz sucursal..." value={formPago.justificacion} onChange={e => setFormPago({...formPago, justificacion: e.target.value})}/>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Monto a Solicitar (MXN)</label>
                      <input type="number" required min="1" placeholder="Ej. 15000" value={formPago.monto_pago} onChange={e => setFormPago({...formPago, monto_pago: e.target.value})}/>
                    </div>
                    <div className="form-group">
                      <label>Folio Factura (Opcional)</label>
                      <input type="text" placeholder="Ej. F-1029" value={formPago.num_factura_ref} onChange={e => setFormPago({...formPago, num_factura_ref: e.target.value})}/>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Adjuntar Cotización, XML o PDF</label>
                    <input type="file" className="file-input" required onChange={e => setFileComprobante(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg,.xml" style={{ padding: '8px', border: '1px dashed var(--border-focus)' }}/>
                  </div>

                  <div className="modal-footer" style={{marginTop: '24px', padding: '0', border: 'none', backgroundColor: 'transparent'}}>
                    <button type="button" className="btn-cancel" onClick={() => setShowNuevoPago(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Procesando...' : 'Enviar Solicitud a Revisión'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL REGISTRAR / EDITAR PROVEEDOR --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', maxHeight: '80vh'}}>
              <div className="modal-form" style={{padding: '24px 32px', overflowY: 'auto'}}>
                <h4 className="section-subtitle">Datos Empresariales</h4>
                <div className="form-group"><label>Razón Social / Nombre Completo</label><input type="text" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} /></div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Entidad</label>
                    <select className="custom-select" value={formData.tipo_persona} onChange={(e) => { setFormData({...formData, tipo_persona: e.target.value, rfc: ''}); setFormError(''); }}>
                      <option value="MORAL">Persona Moral (Empresa)</option>
                      <option value="FISICA">Persona Física</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>RFC</label>
                    <input 
                      type="text" 
                      maxLength="13" 
                      placeholder="Opcional" 
                      value={formData.rfc} 
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().trim();
                        let tipo = formData.tipo_persona;
                        if (val.length === 12) tipo = 'MORAL';
                        if (val.length === 13) tipo = 'FISICA';
                        setFormData({...formData, rfc: val, tipo_persona: tipo});
                        setFormError('');
                      }} 
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Categoría de Servicio</label>
                    <select className="custom-select" value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})}>
                        <option value="AGRICOLA">Agrícola</option>
                        <option value="INSUMOS">Insumos y Papelería</option>
                        <option value="MAQUINARIA">Maquinaria y Equipo</option>
                        <option value="SERVICIOS">Servicios Profesionales</option>
                        <option value="OTROS">Otro General</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Teléfono de Contacto</label>
                    <input type="text" maxLength="10" placeholder="10 dígitos" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value.replace(/[^0-9]/g, '')})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Correo Electrónico</label><input type="email" placeholder="Opcional" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                  <div className="form-group"><label>Dirección Fiscal</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} /></div>
                </div>
                
                <h4 className="section-subtitle" style={{marginTop: '20px'}}>Cuentas y Pagos</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Banco Destino</label>
                    <select className="custom-select" value={formData.banco} onChange={(e) => setFormData({...formData, banco: e.target.value})}>
                      <option value="">Selecciona un banco...</option>
                      <option value="BBVA">BBVA</option>
                      <option value="Santander">Santander</option>
                      <option value="Banamex">Citibanamex</option>
                      <option value="Banorte">Banorte</option>
                      <option value="HSBC">HSBC</option>
                      <option value="Scotiabank">Scotiabank</option>
                      <option value="Inbursa">Inbursa</option>
                      <option value="Banco Azteca">Banco Azteca</option>
                      <option value="Bancoppel">Bancoppel</option>
                      <option value="Afirme">Afirme</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Número de Cuenta</label>
                    <input type="text" maxLength="10" placeholder="10 dígitos" value={formData.numero_cuenta} onChange={(e) => setFormData({...formData, numero_cuenta: e.target.value.replace(/[^0-9]/g, '')})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>CLABE Interbancaria (Opcional)</label>
                    <input type="text" maxLength="18" placeholder="18 dígitos" value={formData.clabe_bancaria} onChange={(e) => setFormData({...formData, clabe_bancaria: e.target.value.replace(/[^0-9]/g, '')})} />
                  </div>
                  <div className="form-group">
                    <label>Días de Crédito Otorgados</label>
                    <input type="number" required min="0" placeholder="Ej. 15, 30, 0 para contado" value={formData.dias_credito} onChange={(e) => setFormData({...formData, dias_credito: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '20px 32px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {formError && ( 
                  <div className="error-message shake-animation" style={{ width: '100%', margin: 0, justifyContent: 'center', backgroundColor: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>{formError}</span>
                  </div> 
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', width: '100%' }}>
                  <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : isEditing ? 'Actualizar Proveedor' : 'Guardar Proveedor'}</button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIRMAR ELIMINACIÓN --- */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{zIndex: 2000}}>
          <div className="confirm-modal-content fade-in-up">
            <div className="confirm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
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

export default Proveedores;