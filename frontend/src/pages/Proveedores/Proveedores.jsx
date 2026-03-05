import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Proveedores.css';

function Proveedores() {
  const navigate = useNavigate();
  const [proveedores, setProveedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  const [formData, setFormData] = useState({
    tipo_persona: 'MORAL', nombre: '', rfc: '', direccion: '', telefono: '', 
    email: '', categoria: 'SERVICIOS', cuenta_bancaria: '', banco: '', dias_credito: 0
  });

  // --- ESTADOS DEL PANEL MAESTRO Y PAGOS ---
  const [panelOpen, setPanelOpen] = useState(false);
  const [provActivo, setProvActivo] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [showNuevoPago, setShowNuevoPago] = useState(false);
  const [formPago, setFormPago] = useState({ concepto: '', monto_pago: '', num_factura_ref: '' });
  const [fileComprobante, setFileComprobante] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; }
    return false;
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const fetchProveedores = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const response = await fetch('http://localhost:3001/api/proveedores', { headers });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) setProveedores(data.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchProveedores(); }, []);

  // --- CRUD DE PROVEEDORES ---
  const openNewModal = () => { setIsEditing(false); setEditId(null); setFormError(''); setFormData({ tipo_persona: 'MORAL', nombre: '', rfc: '', direccion: '', telefono: '', email: '', categoria: 'SERVICIOS', cuenta_bancaria: '', banco: '', dias_credito: 0 }); setIsModalOpen(true); };
  const openEditModal = (prov) => { setIsEditing(true); setEditId(prov.id); setFormError(''); setFormData({ tipo_persona: prov.tipo_persona || 'MORAL', nombre: prov.nombre, rfc: prov.rfc || '', direccion: prov.ubicacion, telefono: prov.telefono, email: prov.email, categoria: prov.categoria || 'SERVICIOS', cuenta_bancaria: prov.cuenta_bancaria || '', banco: prov.banco || '', dias_credito: prov.dias_credito || 0 }); setIsModalOpen(true); };
  const triggerEliminar = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Proveedor', message: `¿Estás seguro de eliminar a ${nombre}? Se ocultará del directorio permanentemente.`, onConfirm: () => ejecutarEliminar(id) }); };
  const ejecutarEliminar = async (id) => { const headers = getAuthHeaders(); if (!headers) return; try { const res = await fetch(`http://localhost:3001/api/proveedores/${id}`, { method: 'DELETE', headers }); if (handleAuthError(res.status)) return; if ((await res.json()).success) fetchProveedores(); } catch (error) { console.error(error); } };
  
  const validarFormulario = () => { setFormError(''); if (!formData.nombre.trim()) { setFormError('La Razón Social / Nombre es obligatorio.'); return false; } if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setFormError('Correo Electrónico inválido.'); return false; } if (!/^\d{10}$/.test(formData.telefono)) { setFormError('El teléfono debe tener 10 dígitos exactos.'); return false; } if (formData.tipo_persona === 'FISICA' && !/^([A-ZÑ&]{4})(\d{6})([A-Z0-9]{3})$/i.test(formData.rfc)) { setFormError('RFC Física inválido.'); return false; } if (formData.tipo_persona === 'MORAL' && !/^([A-ZÑ&]{3})(\d{6})([A-Z0-9]{3})$/i.test(formData.rfc)) { setFormError('RFC Moral inválido.'); return false; } return true; };
  
  const handleSubmit = async (e) => { e.preventDefault(); if (!validarFormulario()) return; const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true); const url = isEditing ? `http://localhost:3001/api/proveedores/${editId}` : 'http://localhost:3001/api/proveedores'; const method = isEditing ? 'PUT' : 'POST'; try { const res = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); if (handleAuthError(res.status)) return; const data = await res.json(); if (data.success) { setIsModalOpen(false); fetchProveedores(); } else setFormError(data.message); } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); } };
  
  const cambiarEstatus = async (id_persona, estatus_actual) => { const nuevoEstatus = estatus_actual === 1 ? 0 : 1; const headers = getAuthHeaders(); if (!headers) return; try { const res = await fetch(`http://localhost:3001/api/proveedores/${id_persona}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) }); if ((await res.json()).success) fetchProveedores(); } catch (error) { console.error(error); } };

  // --- LÓGICA DEL PANEL DE PAGOS ---
  const abrirPanelPagos = (prov) => {
    setProvActivo(prov);
    setShowNuevoPago(false);
    setPanelOpen(true);
    fetchPagos(prov.id);
  };

  const fetchPagos = async (id_proveedor) => {
    const headers = getAuthHeaders();
    const res = await fetch(`http://localhost:3001/api/proveedores/${id_proveedor}/pagos`, { headers });
    const data = await res.json();
    if (data.success) setPagos(data.data);
  };

  const handleGuardarPago = async (e) => {
    e.preventDefault();
    if (!formPago.concepto || !formPago.monto_pago) return alert("Completa el concepto y el monto a pagar.");
    
    const headers = getAuthHeaders();
    setIsLoading(true);
    
    const formDataUpload = new FormData();
    formDataUpload.append('id_proveedor', provActivo.id);
    formDataUpload.append('concepto', formPago.concepto);
    formDataUpload.append('monto_pago', formPago.monto_pago);
    formDataUpload.append('num_factura_ref', formPago.num_factura_ref);
    if (fileComprobante) formDataUpload.append('comprobante', fileComprobante);

    try {
      const res = await fetch('http://localhost:3001/api/proveedores/pagos', { method: 'POST', headers, body: formDataUpload });
      const data = await res.json();
      if (data.success) {
        setShowNuevoPago(false);
        setFormPago({ concepto: '', monto_pago: '', num_factura_ref: '' });
        setFileComprobante(null);
        fetchPagos(provActivo.id);
      } else { alert(data.message); }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const proveedoresFiltrados = proveedores.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || p.categoria.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="proveedores-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Proveedores</h1>
          <p>Directorio de proveedores y servicios contratados</p>
        </div>
        <button className="btn-primary" onClick={openNewModal}>+ Agregar Proveedor</button>
      </div>

      <div className="proveedores-toolbar stagger-2 fade-in-up">
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Buscar proveedor o servicio..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="proveedores-grid stagger-2 fade-in-up">
        {proveedoresFiltrados.length > 0 ? (
          proveedoresFiltrados.map((prov, index) => (
            <div className="prov-card" key={prov.id} style={{ animationDelay: `${(index + 2) * 0.1}s` }}>
              <div className="prov-card-header">
                <div className="prov-info-top">
                  <div className="prov-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
                  </div>
                  <div>
                    <h4 title={prov.nombre}>{prov.nombre}</h4>
                    <span>{prov.categoria.replace('_', ' ')}</span>
                  </div>
                </div>
                <button className={`badge-estatus ${prov.estatus_activo ? 'badge-activo-dark' : 'badge-inactivo'}`} onClick={() => cambiarEstatus(prov.id, prov.estatus_activo)}>
                  {prov.estatus_activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              <div className="prov-card-body">
                <div className="prov-contact-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <span>+52 {prov.telefono.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')}</span>
                </div>
                <div className="prov-contact-row">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  <span>{prov.email}</span>
                </div>
              </div>

              {/* FOOTER ACTUALIZADO PARA COINCIDIR CON FIGMA */}
              <div className="prov-card-footer">
                <div className="prov-actions">
                  <button className="btn-icon-edit" onClick={() => abrirPanelPagos(prov)} title="Pagos y CXC">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                  </button>
                  <button className="btn-icon-edit" onClick={() => openEditModal(prov)} title="Editar Proveedor">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminar(prov.id, prov.nombre)} title="Eliminar Proveedor">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
                {prov.dias_credito > 0 && <span className="credito-tag">{prov.dias_credito} Días de Crédito</span>}
              </div>
            </div>
          ))
        ) : (
          <div className="no-results" style={{gridColumn: '1 / -1'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path></svg>
            <h3>No hay proveedores registrados</h3>
            <p>Agrega el primer proveedor para empezar el directorio.</p>
          </div>
        )}
      </div>

      {/* --- PANEL MAESTRO DE PAGOS A PROVEEDOR --- */}
      {panelOpen && provActivo && (
        <div className="modal-overlay" onClick={() => setPanelOpen(false)}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Cuentas por Pagar</h2>
                <p className="client-badge" style={{backgroundColor: '#e0f2fe', color: '#1e40af'}}>{provActivo.nombre}</p>
              </div>
              <button className="btn-close" onClick={() => setPanelOpen(false)}>×</button>
            </div>
            
            <div className="panel-body">
              {!showNuevoPago ? (
                <>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
                    <h4 className="section-subtitle" style={{margin: 0, border: 'none'}}>Historial de Egresos</h4>
                    <button className="btn-primary" style={{padding: '8px 16px', fontSize: '13px'}} onClick={() => setShowNuevoPago(true)}>+ Registrar Pago</button>
                  </div>
                  
                  {pagos.length > 0 ? (
                    <div className="movimientos-list">
                      {pagos.map(pago => (
                        <div className="movimiento-item" key={pago.id}>
                          <div className="mov-icon" style={{backgroundColor: '#fee2e2', color: '#ef4444'}}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                          </div>
                          <div className="mov-detalles">
                            <strong>{pago.concepto}</strong>
                            <span>Factura: {pago.num_factura_ref || 'S/N'} • {new Date(pago.fecha_solicitud).toLocaleDateString()}</span>
                            <span style={{fontSize: '11px', color: '#1e40af', fontWeight: '800', marginTop: '2px'}}>{pago.estatus}</span>
                          </div>
                          <div className="mov-monto-accion">
                            <span className="mov-monto" style={{color: '#ef4444'}}>-{formatMoney(pago.monto_pago)}</span>
                            {pago.url_comprobante_pago && ( 
                              <a href={`http://localhost:3001/${pago.url_comprobante_pago}`} target="_blank" rel="noreferrer" className="btn-view" title="Ver Factura/XML">Doc</a> 
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( 
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '32px', marginBottom: '10px'}}><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                      <p>No hay pagos registrados para este proveedor.</p>
                    </div> 
                  )}
                </>
              ) : (
                <form className="modal-form" style={{padding: '0'}} onSubmit={handleGuardarPago}>
                  <h4 className="section-subtitle">Emitir Pago / Registrar Factura</h4>
                  
                  <div className="form-group">
                    <label>Concepto del Servicio</label>
                    <input type="text" required placeholder="Ej. Honorarios contables enero, Compra material..." value={formPago.concepto} onChange={e => setFormPago({...formPago, concepto: e.target.value})}/>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Monto a Pagar (MXN)</label>
                      <input type="number" required min="1" placeholder="Ej. 15000" value={formPago.monto_pago} onChange={e => setFormPago({...formPago, monto_pago: e.target.value})}/>
                    </div>
                    <div className="form-group">
                      <label>Folio Factura (Opcional)</label>
                      <input type="text" placeholder="Ej. F-1029" value={formPago.num_factura_ref} onChange={e => setFormPago({...formPago, num_factura_ref: e.target.value})}/>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Comprobante o Factura (PDF, XML, JPG)</label>
                    <input type="file" className="file-input" required onChange={e => setFileComprobante(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg,.xml"/>
                  </div>

                  <div className="modal-footer" style={{marginTop: '24px', padding: '0', border: 'none'}}>
                    <button type="button" className="btn-cancel" onClick={() => setShowNuevoPago(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Registrando...' : 'Registrar Salida de Dinero'}</button>
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
          <div className="modal-content fade-in-down">
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}>
              <div className="modal-form">
                {formError && ( <div className="error-message shake-animation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>{formError}</span></div> )}
                
                <h4 className="section-subtitle">Datos de la Empresa</h4>
                <div className="form-row">
                  <div className="form-group"><label>Tipo de Persona</label><select className="custom-select" value={formData.tipo_persona} onChange={(e) => { setFormData({...formData, tipo_persona: e.target.value, rfc: ''}); setFormError(''); }}><option value="MORAL">Moral (Empresa)</option><option value="FISICA">Física</option></select></div>
                  <div className="form-group"><label>RFC</label><input type="text" required maxLength={formData.tipo_persona === 'FISICA' ? 13 : 12} value={formData.rfc} onChange={(e) => setFormData({...formData, rfc: e.target.value.toUpperCase()})} /></div>
                </div>
                <div className="form-group"><label>Razón Social / Nombre Comercial</label><input type="text" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Teléfono de Contacto</label><input type="text" required maxLength="10" placeholder="10 dígitos" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value.replace(/[^0-9]/g, '')})} /></div>
                  <div className="form-group"><label>Correo Electrónico</label><input type="email" required placeholder="correo@empresa.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                </div>
                <div className="form-group"><label>Dirección de Facturación</label><input type="text" required value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} /></div>
                
                <h4 className="section-subtitle" style={{marginTop: '10px'}}>Datos Comerciales y de Pago</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Categoría de Servicio</label>
                    <select className="custom-select" required value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})}>
                      <option value="AGRICOLA">Agrícola</option><option value="INSUMOS">Insumos / Materiales</option><option value="MAQUINARIA">Maquinaria / Equipo</option><option value="SERVICIOS">Servicios Profesionales</option><option value="OTROS">Otros</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Días de Crédito Otorgados</label><input type="number" required min="0" placeholder="Ej. 15, 30, 0 para contado" value={formData.dias_credito} onChange={(e) => setFormData({...formData, dias_credito: e.target.value})} /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Banco Receptor</label><input type="text" placeholder="Ej. Banorte, BBVA..." value={formData.banco} onChange={(e) => setFormData({...formData, banco: e.target.value})} /></div>
                  <div className="form-group"><label>Cuenta Bancaria / CLABE</label><input type="text" placeholder="Número de cuenta para pagos" value={formData.cuenta_bancaria} onChange={(e) => setFormData({...formData, cuenta_bancaria: e.target.value.replace(/[^0-9]/g, '')})} /></div>
                </div>
              </div>

              <div className="modal-footer" style={{padding: '20px 32px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0}}>
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : isEditing ? 'Actualizar Proveedor' : 'Registrar Proveedor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL CONFIRMACIÓN DE ELIMINAR --- */}
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