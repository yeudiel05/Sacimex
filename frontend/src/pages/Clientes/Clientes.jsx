import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Clientes.css';

function Clientes() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clientes, setClientes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // PAGINACIÓN
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    tipo_persona: 'FISICA', nombre: '', rfc: '', direccion: '',
    telefono: '', email: '', credito: '', tipo_garantia: 'Ninguna', nombre_aval: ''
  });

  // ESTADOS DEL PANEL LATERAL
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('expediente');
  const [clienteActivo, setClienteActivo] = useState(null);
  const [archivosCliente, setArchivosCliente] = useState([]);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [tipoDocumento, setTipoDocumento] = useState('INE');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true;
    }
    return false;
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const fetchClientes = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const response = await fetch('http://localhost:3001/api/clientes', { headers });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) setClientes(data.data);
    } catch (error) { console.error("Error:", error); }
  };

  useEffect(() => { fetchClientes(); }, []);

  // --- CRUD CLIENTES ---
  const openNewModal = () => {
    setIsEditing(false); setEditId(null);
    setFormData({ tipo_persona: 'FISICA', nombre: '', rfc: '', direccion: '', telefono: '', email: '', credito: '', tipo_garantia: 'Ninguna', nombre_aval: '' });
    setFormError(''); setIsModalOpen(true);
  };

  const openEditModal = (cliente) => {
    setIsEditing(true); setEditId(cliente.id);
    setFormData({
      tipo_persona: cliente.tipo_persona || 'FISICA', nombre: cliente.nombre, rfc: cliente.rfc || '',
      direccion: cliente.ubicacion, telefono: cliente.telefono, email: cliente.email,
      credito: cliente.credito, tipo_garantia: cliente.tipo_garantia || 'Ninguna', nombre_aval: cliente.nombre_aval || ''
    });
    setFormError(''); setIsModalOpen(true);
  };

  const triggerEliminar = (id, nombre) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar Cliente',
      message: `¿Estás seguro de eliminar el expediente de ${nombre}? Esta acción es irreversible.`,
      onConfirm: () => ejecutarEliminar(id)
    });
  };

  const ejecutarEliminar = async (id_persona) => {
    const authHeaders = getAuthHeaders(); if (!authHeaders) return;
    try {
      const response = await fetch(`http://localhost:3001/api/clientes/${id_persona}`, { method: 'DELETE', headers: authHeaders });
      if (handleAuthError(response.status)) return;
      if ((await response.json()).success) fetchClientes();
    } catch (error) { console.error(error); }
  };

  const validarFormulario = () => {
    setFormError('');
    if (!formData.nombre.trim()) { setFormError('El nombre o razón social es obligatorio.'); return false; }
    if (formData.tipo_persona === 'FISICA' && formData.rfc && formData.rfc.length !== 13) { setFormError('El RFC para Persona Física debe tener 13 caracteres.'); return false; }
    if (formData.tipo_persona === 'MORAL' && formData.rfc && formData.rfc.length !== 12) { setFormError('El RFC para Persona Moral debe tener 12 caracteres.'); return false; }
    if (!/^\d{10}$/.test(formData.telefono)) { setFormError('El teléfono debe contener exactamente 10 números.'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) { setFormError('El formato del correo electrónico no es válido.'); return false; }
    if (!formData.direccion.trim()) { setFormError('La dirección es obligatoria.'); return false; }
    if (Number(formData.credito) <= 0) { setFormError('El crédito debe ser mayor a $0.'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;
    const authHeaders = getAuthHeaders(); if (!authHeaders) return;
    setIsLoading(true);
    const url = isEditing ? `http://localhost:3001/api/clientes/${editId}` : 'http://localhost:3001/api/clientes';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method, headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
      });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) { setIsModalOpen(false); fetchClientes(); } else setFormError(data.message);
    } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
  };

  const cambiarEstatus = async (id_persona, nuevoEstatus) => {
    const authHeaders = getAuthHeaders(); if (!authHeaders) return;
    try {
      const response = await fetch(`http://localhost:3001/api/clientes/${id_persona}/estatus`, {
        method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus: nuevoEstatus })
      });
      if (handleAuthError(response.status)) return;
      if ((await response.json()).success) fetchClientes();
    } catch (error) { console.error(error); }
  };

  // --- LÓGICA DEL EXPEDIENTE ---
  const fetchExpedientes = async (id_persona) => {
    const authHeaders = getAuthHeaders(); if (!authHeaders) return;
    try {
      const response = await fetch(`http://localhost:3001/api/clientes/expedientes/${id_persona}`, { headers: authHeaders });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) setArchivosCliente(data.data);
    } catch (error) { console.error(error); }
  };

  const openExpediente = (cliente) => {
    setClienteActivo(cliente);
    setActiveTab('expediente');
    fetchExpedientes(cliente.id);
    setPanelOpen(true);
  };

  const closeExpediente = () => {
    setPanelOpen(false);
    setFileToUpload(null);
    setClienteActivo(null);
    setArchivosCliente([]);
    // Resetear input file
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) fileInput.value = '';
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return alert("Selecciona un archivo");
    const authHeaders = getAuthHeaders(); if (!authHeaders) return;

    const formDataUpload = new FormData();
    formDataUpload.append('id_persona', clienteActivo.id);
    formDataUpload.append('tipo_documento', tipoDocumento);
    formDataUpload.append('archivo', fileToUpload);

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/clientes/expedientes/upload', { 
        method: 'POST', 
        headers: authHeaders, 
        body: formDataUpload 
      });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) {
        setFileToUpload(null);
        const fileInput = document.getElementById('file-upload-input');
        if (fileInput) fileInput.value = "";
        fetchExpedientes(clienteActivo.id);
      } else alert(data.message);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const eliminarArchivo = async (id_archivo) => {
    if (!window.confirm("¿Seguro que deseas eliminar este documento del servidor permanentemente?")) return;
    const authHeaders = getAuthHeaders(); if (!authHeaders) return;
    try {
      const response = await fetch(`http://localhost:3001/api/clientes/expedientes/${id_archivo}`, { method: 'DELETE', headers: authHeaders });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) fetchExpedientes(clienteActivo.id);
      else alert(data.message);
    } catch (error) { console.error(error); }
  };

  // --- FILTROS Y PAGINACIÓN ---
  const clientesFiltrados = clientes.filter(c =>
    (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.rfc || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = clientesFiltrados.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(clientesFiltrados.length / itemsPerPage);

  return (
    <div className="clientes-container">
      <div className="page-header">
        <div>
          <h1>Directorio de Clientes</h1>
          <p>Gestión de acreditados, expedientes y líneas de crédito</p>
        </div>
        <button className="btn-primary" onClick={openNewModal}>+ Agregar Cliente</button>
      </div>

      <div className="clientes-list-container">
        <div className="list-header">
          <h2>Cartera de Acreditados</h2>
          <div className="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Buscar cliente por nombre o RFC..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Acreditado</th>
                <th style={{ width: '20%' }}>Contacto</th>
                <th style={{ width: '25%' }}>Crédito y Garantía</th>
                <th style={{ width: '15%' }}>Estatus</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map(c => {
                let badgeClass = 'badge-inactivo';
                let avatarColor = '#cbd5e1';
                if (c.estatus === 'Activo') { badgeClass = 'badge-activo'; avatarColor = '#8b5cf6'; }
                if (c.estatus === 'En revision') { badgeClass = 'badge-revision'; avatarColor = '#f59e0b'; }

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar-sm" style={{ backgroundColor: avatarColor }}>
                          {(c.nombre || 'S/N').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: 'var(--text-main)' }}>{c.nombre || 'SIN NOMBRE REGISTRADO'}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RFC: {c.rfc || 'S/N'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                        <span style={{ fontWeight: '500' }}>{c.telefono || 'Sin teléfono'}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{c.email || 'Sin correo'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                        <strong style={{ color: '#4f46e5' }}>{formatMoney(c.credito || 0)}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Garantía: {c.tipo_garantia} {c.tipo_garantia === 'Aval' && `- ${c.nombre_aval}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <select
                        className={`badge-estatus-select ${badgeClass}`}
                        value={c.estatus}
                        onChange={(e) => cambiarEstatus(c.id, e.target.value)}
                      >
                        <option value="En revision">En revisión</option>
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button className="btn-icon-edit" onClick={() => openExpediente(c)} title="Abrir Expediente y Créditos">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                          </svg>
                        </button>
                        <button className="btn-icon-edit" onClick={() => openEditModal(c)} title="Editar Cliente">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminar(c.id, c.nombre)} title="Eliminar Cliente">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}>
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="empty-state" style={{ border: 'none', background: 'transparent' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '40px', color: '#cbd5e1', marginBottom: '12px' }}>
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <h3>Sin clientes registrados</h3>
                      <p>Registra a tu primer acreditado para comenzar a operar.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* CONTROLES DE PAGINACIÓN */}
          {totalPages > 1 && (
            <div className="pagination-container">
              <button className="btn-page" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                &laquo; Anterior
              </button>
              <span className="page-info">Página {currentPage} de {totalPages}</span>
              <button className="btn-page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                Siguiente &raquo;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL: REGISTRAR / EDITAR CLIENTE --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-pop" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button className="btn-close" onClick={() => { setIsModalOpen(false); setFormError(''); }}>×</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              <div className="modal-form" style={{ padding: '24px 32px', overflowY: 'auto' }}>
                {formError && (
                  <div className="error-message shake-animation" style={{ marginBottom: '16px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                <h4 className="section-subtitle">Identidad del Acreditado</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Persona</label>
                    <select className="custom-select" value={formData.tipo_persona} onChange={(e) => { setFormData({ ...formData, tipo_persona: e.target.value, rfc: '' }); setFormError(''); }}>
                      <option value="FISICA">Física</option>
                      <option value="MORAL">Moral</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>RFC</label>
                    <input 
                      type="text" 
                      maxLength={formData.tipo_persona === 'FISICA' ? 13 : 12} 
                      placeholder="Opcional si no factura" 
                      value={formData.rfc} 
                      onChange={(e) => { setFormData({ ...formData, rfc: e.target.value.toUpperCase() }); setFormError(''); }} 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Nombre Completo o Razón Social</label>
                  <input type="text" required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
                </div>

                <h4 className="section-subtitle" style={{ marginTop: '20px' }}>Contacto y Ubicación</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Teléfono (10 dígitos)</label>
                    <input 
                      type="text" 
                      required 
                      maxLength="10" 
                      value={formData.telefono} 
                      onChange={(e) => { const soloNumeros = e.target.value.replace(/[^0-9]/g, ''); setFormData({ ...formData, telefono: soloNumeros }); setFormError(''); }} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Correo Electrónico</label>
                    <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Dirección Física</label>
                  <input type="text" required value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} />
                </div>

                <h4 className="section-subtitle" style={{ marginTop: '20px' }}>Datos de Crédito</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Línea de Crédito Solicitada (MXN)</label>
                    <div className="input-with-prefix">
                      <span className="prefix">$</span>
                      <input 
                        type="number" 
                        required 
                        min="1" 
                        placeholder="Ej. 50000" 
                        value={formData.credito} 
                        onChange={(e) => setFormData({ ...formData, credito: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Tipo de Garantía</label>
                    <select className="custom-select" value={formData.tipo_garantia} onChange={(e) => setFormData({ ...formData, tipo_garantia: e.target.value })}>
                      <option value="Ninguna">Sin Garantía</option>
                      <option value="Aval">Aval (Fiador)</option>
                      <option value="Prendaria">Prendaria (Autos, Bienes)</option>
                      <option value="Hipotecaria">Hipotecaria (Inmuebles)</option>
                    </select>
                  </div>
                </div>
                {formData.tipo_garantia === 'Aval' && (
                  <div className="form-group fade-in-down">
                    <label>Nombre Completo del Aval</label>
                    <input type="text" required placeholder="Persona que respalda la deuda" value={formData.nombre_aval} onChange={(e) => setFormData({ ...formData, nombre_aval: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ padding: '20px 32px', borderTop: '1px solid var(--border-light)' }}>
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isLoading} style={{ backgroundColor: '#4f46e5' }}>
                  {isLoading ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PANEL MAESTRO: EXPEDIENTE, CRÉDITOS Y PAGOS --- */}
      {panelOpen && clienteActivo && (
        <div className="modal-overlay" onClick={closeExpediente}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Expediente del Acreditado</h2>
                <span className="client-badge">{clienteActivo.nombre}</span>
              </div>
              <button className="btn-close" onClick={closeExpediente}>×</button>
            </div>
            <div className="panel-tabs">
              <button className={`tab-btn ${activeTab === 'expediente' ? 'active' : ''}`} onClick={() => setActiveTab('expediente')}>
                Documentación
              </button>
              <button className={`tab-btn ${activeTab === 'creditos' ? 'active' : ''}`} onClick={() => setActiveTab('creditos')}>
                Créditos Activos
              </button>
              <button className={`tab-btn ${activeTab === 'pagos' ? 'active' : ''}`} onClick={() => setActiveTab('pagos')}>
                Cobranza
              </button>
            </div>

            <div className="panel-body">
              {activeTab === 'expediente' && (
                <>
                  {/* FORMULARIO DE CARGA MODERNO */}
                  <form onSubmit={handleFileUpload} className="upload-card">
                    <div className="form-row">
                      <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                          Tipo de Documento
                        </label>
                        <select 
                          value={tipoDocumento} 
                          onChange={(e) => setTipoDocumento(e.target.value)} 
                          className="custom-select"
                        >
                          <option value="INE">Identificación Oficial</option>
                          <option value="COMPROBANTE_DOMICILIO">Comprobante de Domicilio</option>
                          <option value="CONTRATO">Contrato Firmado</option>
                          <option value="PAGARE">Pagaré</option>
                          <option value="SITUACION_FISCAL">Constancia de Sit. Fiscal</option>
                          <option value="OTRO">Otro Documento</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                          Seleccionar Archivo
                        </label>
                        <div className="upload-zone">
                          <input
                            type="file"
                            id="file-upload-input"
                            onChange={(e) => setFileToUpload(e.target.files[0])}
                            accept=".pdf,.png,.jpg,.jpeg"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              opacity: 0,
                              cursor: 'pointer',
                              width: '100%',
                              height: '100%'
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '28px', color: '#94a3b8' }}>
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                              {fileToUpload ? fileToUpload.name : 'Haz clic para seleccionar un PDF o Imagen'}
                            </p>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Formatos: PDF, PNG, JPG</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="btn-upload"
                      disabled={isLoading || !fileToUpload}
                    >
                      {isLoading ? 'Subiendo Archivo...' : 'Guardar Archivo'}
                    </button>
                  </form>

                  {/* LISTA DE DOCUMENTOS */}
                  <div style={{ marginTop: '30px' }}>
                    <h4 style={{ fontSize: '16px', color: '#1e293b', marginBottom: '16px' }}>
                      Documentos Resguardados ({archivosCliente.length})
                    </h4>
                    {archivosCliente.length > 0 ? (
                      archivosCliente.map(archivo => (
                        <div className="document-card" key={archivo.id}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '40px', 
                              height: '40px', 
                              borderRadius: '10px',
                              backgroundColor: '#ede9fe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#7c6cf8'
                            }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px' }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                            <div>
                              <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                {archivo.tipo_documento.replace(/_/g, ' ')}
                              </strong>
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{archivo.nombre_archivo}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <a 
                              href={`http://localhost:3001/${archivo.ruta_archivo}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              style={{
                                padding: '6px 16px',
                                borderRadius: '8px',
                                background: '#7c6cf8',
                                color: 'white',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = '#5b5ce9'}
                              onMouseLeave={(e) => e.target.style.background = '#7c6cf8'}
                            >
                              Ver
                            </a>
                            <button 
                              type="button"
                              onClick={() => eliminarArchivo(archivo.id)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid #fca5a5',
                                background: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = '#fef2f2';
                                e.target.style.borderColor = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'transparent';
                                e.target.style.borderColor = '#fca5a5';
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '40px', color: '#94a3b8', marginBottom: '12px' }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                        <h3 style={{ color: '#1e293b', fontSize: '16px', margin: '0 0 4px 0' }}>Expediente vacío</h3>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Aún no hay documentos cargados</p>
                      </div>
                    )}
                  </div>
                </>
              )}
              {activeTab === 'creditos' && (
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '48px', color: '#94a3b8', marginBottom: '12px' }}>
                    <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                  </svg>
                  <h3 style={{ color: '#1e293b', fontSize: '18px', margin: '0 0 4px 0' }}>Módulo en Construcción</h3>
                  <p style={{ margin: 0, color: '#94a3b8' }}>La simulación y otorgamiento de créditos estará disponible en la próxima actualización.</p>
                </div>
              )}
              {activeTab === 'pagos' && (
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '48px', color: '#94a3b8', marginBottom: '12px' }}>
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <h3 style={{ color: '#1e293b', fontSize: '18px', margin: '0 0 4px 0' }}>Sin Historial</h3>
                  <p style={{ margin: 0, color: '#94a3b8' }}>No hay registro de cobranza o amortizaciones para este cliente.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIRMACIÓN DE ELIMINAR --- */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="confirm-modal-content modal-pop">
            <div className="confirm-icon danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                Cancelar
              </button>
              <button className="btn-confirm-delete" onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}>
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;