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

  const [formData, setFormData] = useState({
    tipo_persona: 'FISICA', nombre: '', rfc: '', direccion: '',
    telefono: '', email: '', credito: '', tipo_garantia: 'Ninguna', nombre_aval: ''
  });

  const [isExpedienteOpen, setIsExpedienteOpen] = useState(false);
  const [clienteActivo, setClienteActivo] = useState(null);
  const [archivosCliente, setArchivosCliente] = useState([]);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [tipoDocumento, setTipoDocumento] = useState('INE');

  // --- OBTENER TOKEN ---
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return null;
    }
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('rol');
      navigate('/');
      return true;
    }
    return false;
  };

  const fetchClientes = async () => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const response = await fetch('http://localhost:3001/api/clientes', { headers });
      if (handleAuthError(response.status)) return;

      const data = await response.json();
      if (data.success) setClientes(data.data);
    } catch (error) { console.error("Error:", error); }
  };

  useEffect(() => { fetchClientes(); }, []);

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

  const validarFormulario = () => {
    setFormError('');
    if (!/^\d{10}$/.test(formData.telefono)) { setFormError('El teléfono debe contener 10 números.'); return false; }
    if (Number(formData.credito) <= 0) { setFormError('El crédito debe ser mayor a $0.'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

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
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    try {
      const response = await fetch(`http://localhost:3001/api/clientes/${id_persona}/estatus`, {
        method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus: nuevoEstatus })
      });
      if (handleAuthError(response.status)) return;

      if ((await response.json()).success) fetchClientes();
    } catch (error) { console.error(error); }
  };

  const eliminarCliente = async (id_persona, nombre) => {
    if (!window.confirm(`¿Eliminar a ${nombre}? Acción irreversible.`)) return;
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    try {
      const response = await fetch(`http://localhost:3001/api/clientes/${id_persona}`, { method: 'DELETE', headers: authHeaders });
      if (handleAuthError(response.status)) return;
      if ((await response.json()).success) fetchClientes();
    } catch (error) { console.error(error); }
  };

  const fetchExpedientes = async (id_persona) => {
    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    try {
      const response = await fetch(`http://localhost:3001/api/expedientes/${id_persona}`, { headers: authHeaders });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) setArchivosCliente(data.data);
    } catch (error) { console.error(error); }
  };

  const openExpediente = (cliente) => { setClienteActivo(cliente); fetchExpedientes(cliente.id); setIsExpedienteOpen(true); };
  const closeExpediente = () => { setIsExpedienteOpen(false); setFileToUpload(null); setClienteActivo(null); };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return alert("Selecciona un archivo");

    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    const formDataUpload = new FormData();
    formDataUpload.append('archivo', fileToUpload); formDataUpload.append('id_persona', clienteActivo.id); formDataUpload.append('tipo_documento', tipoDocumento);

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/expedientes/upload', { method: 'POST', headers: authHeaders, body: formDataUpload });
      if (handleAuthError(response.status)) return;

      const data = await response.json();
      if (data.success) { setFileToUpload(null); document.getElementById('file-upload-input').value = ""; fetchExpedientes(clienteActivo.id); }
      else alert(data.message);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  // --- NUEVA FUNCIÓN: ELIMINAR ARCHIVO FÍSICO ---
  const eliminarArchivo = async (id_archivo) => {
    if (!window.confirm("¿Seguro que deseas eliminar este documento del servidor permanentemente?")) return;

    const authHeaders = getAuthHeaders();
    if (!authHeaders) return;

    try {
      const response = await fetch(`http://localhost:3001/api/expedientes/${id_archivo}`, { method: 'DELETE', headers: authHeaders });
      if (handleAuthError(response.status)) return;

      const data = await response.json();
      if (data.success) fetchExpedientes(clienteActivo.id);
      else alert(data.message);
    } catch (error) { console.error(error); }
  };

  const clientesFiltrados = clientes.filter(c => c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || c.ubicacion.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="clientes-container">
      <div className="page-header stagger-1">
        <div><h1>Directorio de Clientes</h1><p>Gestión de expedientes y líneas de crédito vigentes</p></div>
        <button className="btn-primary" onClick={openNewModal}>+ Agregar Cliente</button>
      </div>

      <div className="clientes-toolbar stagger-2">
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="clientes-grid">
        {clientesFiltrados.length > 0 ? (
          clientesFiltrados.map((cliente, index) => (
            <div className="cliente-card" key={cliente.id} style={{ animationDelay: `${(index + 3) * 0.1}s` }}>
              <div className="cliente-card-header">
                <div className="cliente-info-top">
                  <div className={`avatar ${cliente.estatus === 'Activo' ? 'avatar-active' : 'avatar-inactive'}`}>{cliente.nombre.substring(0, 2).toUpperCase()}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4>{cliente.nombre}</h4>
                      <button className="btn-icon-edit" onClick={() => openEditModal(cliente)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                      <button className="btn-icon-edit" onClick={() => eliminarCliente(cliente.id, cliente.nombre)} style={{ color: '#ef4444' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                    <span>{cliente.ubicacion}</span>
                  </div>
                </div>
                <select className={`badge-estatus-select ${cliente.estatus === 'Activo' ? 'badge-activo' : cliente.estatus === 'En revision' ? 'badge-revision' : 'badge-inactivo'}`} value={cliente.estatus} onChange={(e) => cambiarEstatus(cliente.id, e.target.value)}>
                  <option value="En revision">En revisión</option><option value="Activo">Activo</option><option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div className="cliente-card-body">
                <div className="contact-row"><div className="contact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></div><span>{cliente.telefono}</span></div>
                <div className="contact-row"><div className="contact-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg></div><span>{cliente.email}</span></div>
              </div>
              <div className="cliente-card-footer">
                <div className="credito-info"><span>Línea de Crédito</span><strong>${Number(cliente.credito).toLocaleString()}</strong></div>
                <button className="btn-expediente" onClick={() => openExpediente(cliente)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> Expediente</button>
              </div>
            </div>
          ))
        ) : (<div className="no-results stagger-3"><h3>No se encontraron clientes</h3><p>Comienza agregando un cliente nuevo.</p></div>)}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down">
            <div className="modal-header"><h2>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2><button className="btn-close" onClick={() => { setIsModalOpen(false); setFormError(''); }}>×</button></div>
            <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {formError && (<div className="error-message shake-animation" style={{ marginBottom: '10px' }}> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> {formError} </div>)}
              <div className="form-row">
                <div className="form-group"><label>Tipo de Persona</label><select value={formData.tipo_persona} onChange={(e) => { setFormData({ ...formData, tipo_persona: e.target.value, rfc: '' }); setFormError(''); }}><option value="FISICA">Física</option><option value="MORAL">Moral</option></select></div>
                <div className="form-group"><label>RFC</label><input type="text" required maxLength={formData.tipo_persona === 'FISICA' ? 13 : 12} value={formData.rfc} onChange={(e) => { setFormData({ ...formData, rfc: e.target.value.toUpperCase() }); setFormError(''); }} /></div>
              </div>
              <div className="form-group"><label>Nombre Completo o Razón Social</label><input type="text" required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} /></div>
              <div className="form-row">
                <div className="form-group"><label>Teléfono (10 dígitos)</label><input type="text" required maxLength="10" value={formData.telefono} onChange={(e) => { const soloNumeros = e.target.value.replace(/[^0-9]/g, ''); setFormData({ ...formData, telefono: soloNumeros }); setFormError(''); }} /></div>
                <div className="form-group"><label>Correo Electrónico</label><input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Dirección</label><input type="text" required value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} /></div>
              <div className="form-row">
                <div className="form-group"><label>Crédito (MXN)</label><input type="number" required min="1" value={formData.credito} onChange={(e) => setFormData({ ...formData, credito: e.target.value })} /></div>
                <div className="form-group"><label>Garantía</label><select value={formData.tipo_garantia} onChange={(e) => setFormData({ ...formData, tipo_garantia: e.target.value })}><option value="Ninguna">Sin Garantía</option><option value="Aval">Aval</option><option value="Prendaria">Prendaria</option><option value="Hipotecaria">Hipotecaria</option></select></div>
              </div>
              {formData.tipo_garantia === 'Aval' && (<div className="form-group fade-in-down"><label>Nombre del Aval</label><input type="text" required value={formData.nombre_aval} onChange={(e) => setFormData({ ...formData, nombre_aval: e.target.value })} /></div>)}
              <div className="modal-footer" style={{ paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}><button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar Cliente'}</button></div>
            </form>
          </div>
        </div>
      )}

      {isExpedienteOpen && clienteActivo && (
        <div className="modal-overlay" onClick={closeExpediente}>
          <div className="expediente-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header"><div><h2>Expediente Digital</h2><p className="client-badge">{clienteActivo.nombre}</p></div><button className="btn-close" onClick={closeExpediente}>×</button></div>
            <div className="panel-body">
              <form onSubmit={handleFileUpload} className="upload-box">
                <h4>Subir documento</h4>
                <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className="doc-select"><option value="INE">INE</option><option value="COMPROBANTE_DOMICILIO">Comprobante</option><option value="CONTRATO">Contrato</option><option value="PAGARE">Pagaré</option><option value="OTRO">Otro</option></select>
                <input type="file" id="file-upload-input" onChange={(e) => setFileToUpload(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" className="file-input" />
                <button type="submit" className="btn-primary" disabled={isLoading || !fileToUpload} style={{ width: '100%' }}>{isLoading ? 'Subiendo...' : 'Guardar'}</button>
              </form>
              <div className="documentos-list">
                <h4 data-count={archivosCliente.length}>Documentos</h4>
                {archivosCliente.length > 0 ? (
                  archivosCliente.map(archivo => (
                    <div className="doc-item" key={archivo.id}>
                      <div className="doc-info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg><div><strong>{archivo.tipo_documento}</strong><span>{archivo.nombre_archivo}</span></div></div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`http://localhost:3001/${archivo.ruta_archivo}`} target="_blank" rel="noreferrer" className="btn-view">Ver</a>
                        <button type="button" className="btn-delete-file" onClick={() => eliminarArchivo(archivo.id)} title="Eliminar documento"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                      </div>
                    </div>
                  ))
                ) : (<p className="empty-state">No hay documentos.</p>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;