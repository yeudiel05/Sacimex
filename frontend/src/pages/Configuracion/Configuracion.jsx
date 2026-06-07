import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Configuracion.css';

function Configuracion() {
  const navigate = useNavigate();
  const [tasas, setTasas] = useState([]);
  
  // --- ESTADOS PARA PRODUCTOS FINANCIEROS ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [formData, setFormData] = useState({
    nombre_tasa: '', 
    tipo_producto: 'FONDEO', 
    tasa_anual_esperada: '', 
    porcentaje_penalizacion: '', 
    cobra_iva: true, 
    descripcion: ''
  });

  // --- ESTADOS PARA UNIDADES DE NEGOCIO ---
  const [unidades, setUnidades] = useState([]);
  const [isUnidadModalOpen, setIsUnidadModalOpen] = useState(false);
  const [isEditingUnidad, setIsEditingUnidad] = useState(false);
  const [editUnidadId, setEditUnidadId] = useState(null);
  const [unidadFormData, setUnidadFormData] = useState({ nombre: '' });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isBackingUp, setIsBackingUp] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  // ==========================================
  // APIS DE PRODUCTOS (TASAS)
  // ==========================================
  const fetchTasas = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/tasas', { headers });
      const data = await res.json();
      if (data.success) setTasas(data.data);
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // APIS DE UNIDADES DE NEGOCIO
  // ==========================================
  const fetchUnidades = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/unidades', { headers });
      const data = await res.json();
      if (data.success) {
        setUnidades(data.data);
      }
    } catch (error) { console.error("Falta endpoint de unidades", error); }
  };

  useEffect(() => { 
    fetchTasas(); 
    fetchUnidades();
  }, []);

  const handleBackup = async () => {
    if (!window.confirm('¿Deseas generar una copia de seguridad de toda la base de datos? Esto puede tardar unos segundos.')) return;
    
    const headers = getAuthHeaders(); if (!headers) return;
    setIsBackingUp(true);

    try {
      const res = await fetch('http://localhost:3001/api/backup', { method: 'GET', headers });
      if (!res.ok) throw new Error("Error al generar respaldo");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Sacimex_Backup_BD_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error al generar el respaldo. Verifica la consola y asegúrate de que el backend esté corriendo correctamente.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // ==========================================
  // CONTROLADORES DE MODALES (PRODUCTOS)
  // ==========================================
  const openNewModal = () => {
    setIsEditing(false); setEditId(null); setFormError('');
    setFormData({ 
      nombre_tasa: '', tipo_producto: 'FONDEO', tasa_anual_esperada: '', 
      porcentaje_penalizacion: '', cobra_iva: true, descripcion: '' 
    });
    setIsModalOpen(true);
  };

  const openEditModal = (tasa) => {
    setIsEditing(true); setEditId(tasa.id); setFormError('');
    setFormData({ 
      nombre_tasa: tasa.nombre_tasa, tipo_producto: tasa.tipo_producto || 'FONDEO',
      tasa_anual_esperada: tasa.tasa_anual_esperada, porcentaje_penalizacion: tasa.porcentaje_penalizacion || '', 
      cobra_iva: tasa.cobra_iva === 1 || tasa.cobra_iva === true, descripcion: tasa.descripcion || '' 
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (Number(formData.tasa_anual_esperada) <= 0) return setFormError('El porcentaje de rendimiento debe ser mayor a 0.');

    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);

    const url = isEditing ? `http://localhost:3001/api/tasas/${editId}` : 'http://localhost:3001/api/tasas';
    const method = isEditing ? 'PUT' : 'POST';
    const payload = { ...formData, cobra_iva: formData.cobra_iva ? 1 : 0 };

    try {
      const res = await fetch(url, { method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { setIsModalOpen(false); fetchTasas(); } else { setFormError(data.message); }
    } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
  };

  const cambiarEstatus = async (id, estatus_actual) => {
    const nuevoEstatus = estatus_actual === 1 ? 0 : 1;
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch(`http://localhost:3001/api/tasas/${id}/estatus`, { 
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) 
      });
      if ((await res.json()).success) fetchTasas();
    } catch (error) { console.error(error); }
  };

  const triggerEliminar = (id, nombre) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar Producto Financiero', 
      message: `¿Estás seguro de eliminar "${nombre}"? Esta acción no se puede deshacer.`, 
      onConfirm: () => eliminarTasa(id)
    });
  };

  const eliminarTasa = async (id) => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch(`http://localhost:3001/api/tasas/${id}`, { method: 'DELETE', headers });
      if ((await res.json()).success) fetchTasas();
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // CONTROLADORES DE MODALES (UNIDADES)
  // ==========================================
  const openNewUnidadModal = () => {
    setIsEditingUnidad(false); setEditUnidadId(null);
    setUnidadFormData({ nombre: '' });
    setIsUnidadModalOpen(true);
  };

  const openEditUnidadModal = (unidad) => {
    setIsEditingUnidad(true); setEditUnidadId(unidad.id);
    setUnidadFormData({ nombre: unidad.nombre });
    setIsUnidadModalOpen(true);
  };

  const handleUnidadSubmit = async (e) => {
    e.preventDefault();
    if(!unidadFormData.nombre.trim()) return alert("El nombre es requerido.");

    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);

    const url = isEditingUnidad ? `http://localhost:3001/api/unidades/${editUnidadId}` : 'http://localhost:3001/api/unidades';
    const method = isEditingUnidad ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(unidadFormData) });
      const data = await res.json();
      if (data.success) {
        setIsUnidadModalOpen(false);
        fetchUnidades();
      } else alert(data.message);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const triggerEliminarUnidad = (id, nombre) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar Unidad de Negocio', 
      message: `¿Estás seguro de eliminar "${nombre}"? Afectará a los usuarios asignados a ella.`, 
      onConfirm: () => eliminarUnidad(id)
    });
  };

  const eliminarUnidad = async (id) => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch(`http://localhost:3001/api/unidades/${id}`, { method: 'DELETE', headers });
      if ((await res.json()).success) fetchUnidades();
    } catch (error) { console.error(error); }
  };


  return (
    <div className="config-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Catálogo de Productos</h1>
          <p>Configura las tasas de rendimiento para los contratos de inversión</p>
        </div>
        <button className="btn-primary" onClick={openNewModal}>+ Nuevo Producto</button>
      </div>

      <div className="tasas-grid stagger-2 fade-in-up">
        {tasas.length > 0 ? (
          tasas.map((tasa, index) => (
            <div className={`tasa-card ${!tasa.estatus_activo ? 'tasa-inactiva' : ''}`} key={tasa.id} style={{ animationDelay: `${(index + 1) * 0.1}s` }}>
              <div className="tasa-card-header">
                <div>
                  <h3 className="tasa-titulo">{tasa.nombre_tasa}</h3>
                  <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '10px', backgroundColor: tasa.tipo_producto === 'FONDEO' ? '#ecfdf5' : '#eff6ff', color: tasa.tipo_producto === 'FONDEO' ? '#059669' : '#2563eb' }}>
                      {tasa.tipo_producto === 'FONDEO' ? 'Producto de Fondeo' : 'Producto de Crédito'}
                  </span>
                </div>
                <button className={`badge-estatus ${tasa.estatus_activo ? 'badge-activo-dark' : 'badge-inactivo'}`} onClick={() => cambiarEstatus(tasa.id, tasa.estatus_activo)}>
                  {tasa.estatus_activo ? 'Activo (Público)' : 'Desactivado'}
                </button>
              </div>
              
              <div className="tasa-card-body">
                <div className="rendimiento-box">
                  <span className="rendimiento-valor">{tasa.tasa_anual_esperada}%</span>
                  <span className="rendimiento-label">Rendimiento Anual</span>
                </div>
                <p className="tasa-descripcion">{tasa.descripcion || 'Sin descripción detallada.'}</p>
              </div>

              <div className="tasa-card-footer">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className="penalizacion-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>Penalización por retiro: <strong>{tasa.porcentaje_penalizacion || '0'}%</strong></span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'14px'}}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>{tasa.cobra_iva === 1 ? 'Aplica 16% de IVA sobre interés' : 'Tasa exenta de IVA'}</span>
                  </div>
                </div>
                
                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <button className="btn-icon-edit" onClick={() => openEditModal(tasa)} title="Editar Producto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminar(tasa.id, tasa.nombre_tasa)} title="Eliminar Producto">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results" style={{gridColumn: '1 / -1'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg>
            <h3>No hay productos configurados</h3>
            <p>Crea tu primera tasa de inversión para empezar.</p>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* NUEVA SECCIÓN: UNIDADES DE NEGOCIO                                */}
      {/* ================================================================= */}
      <div className="backup-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Catálogo de Unidades de Negocio</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Gestiona las sucursales, sedes corporativas y áreas operativas.</p>
          </div>
          <button className="btn-primary" onClick={openNewUnidadModal} style={{ backgroundColor: '#3b82f6' }}>+ Añadir Unidad</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {unidades.length > 0 ? (
            unidades.map((unidad) => (
              <div key={unidad.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-focus)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </div>
                  <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)' }}>{unidad.nombre}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon-edit" onClick={() => openEditUnidadModal(unidad)} title="Editar Unidad">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarUnidad(unidad.id, unidad.nombre)} title="Eliminar Unidad">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
              <p style={{ color: '#64748b', margin: 0, fontWeight: '500' }}>No hay unidades de negocio registradas en la base de datos.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- SECCIÓN DE RESPALDO --- */}
      <div className="backup-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Seguridad y Respaldo</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>Genera copias locales de la información del sistema.</p>
        
        <div className="backup-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-focus)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', color: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                   <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                   <polyline points="7 10 12 15 17 10"></polyline>
                   <line x1="12" y1="15" x2="12" y2="3"></line>
                 </svg>
              </div>
              <div>
                 <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-main)' }}>Respaldo de Base de Datos (.sql)</h4>
                 <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Descarga clientes, contratos, pagos, expedientes y bitácora de auditoría.</p>
              </div>
           </div>
           
           <button 
              onClick={handleBackup} 
              disabled={isBackingUp}
              style={{ background: '#1e293b', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: isBackingUp ? 'wait' : 'pointer', transition: 'all 0.3s' }}
           >
              {isBackingUp ? 'Descargando...' : 'Generar Backup'}
           </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODAL DE TASAS / PRODUCTOS                                        */}
      {/* ================================================================= */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down" style={{maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Producto' : 'Crear Producto Financiero'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}>
              <div className="modal-form" style={{overflowY: 'auto', padding: '24px'}}>
                {formError && ( <div className="error-message shake-animation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>{formError}</span></div> )}
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre del Producto Comercial</label>
                    <input type="text" required placeholder="Ej. Inversión Clásica 12 Meses" value={formData.nombre_tasa} onChange={(e) => setFormData({...formData, nombre_tasa: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Tipo de Operación</label>
                    <select 
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-focus)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}
                      value={formData.tipo_producto} 
                      onChange={(e) => setFormData({...formData, tipo_producto: e.target.value})}
                    >
                      <option value="FONDEO">Pasivo (Para Fondeadores)</option>
                      <option value="CREDITO">Activo (Para Acreditados)</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Rendimiento Anual (%)</label>
                    <input type="number" step="0.01" required placeholder="Ej. 12.5" value={formData.tasa_anual_esperada} onChange={(e) => setFormData({...formData, tasa_anual_esperada: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Penalización por retiro (%)</label>
                    <input type="number" step="0.01" placeholder="Ej. 2.0" value={formData.porcentaje_penalizacion} onChange={(e) => setFormData({...formData, porcentaje_penalizacion: e.target.value})} />
                  </div>
                </div>

                <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, color: '#0f172a', textTransform: 'none', letterSpacing: 'normal', fontWeight: '600' }}>
                    <input 
                      type="checkbox" 
                      style={{ width: '20px', height: '20px', accentColor: '#10d440', cursor: 'pointer' }}
                      checked={formData.cobra_iva}
                      onChange={(e) => setFormData({...formData, cobra_iva: e.target.checked})}
                    />
                    Calcular 16% de IVA sobre el interés en la amortización.
                  </label>
                </div>

                <div className="form-group">
                  <label>Descripción / Condiciones (Opcional)</label>
                  <textarea 
                    className="custom-textarea"
                    rows="3" 
                    placeholder="Detalles sobre pagos de intereses, montos mínimos, etc."
                    style={{width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-light)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', backgroundColor: 'var(--bg-main)'}}
                    value={formData.descripcion} 
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                  />
                </div>
              </div>

              <div className="modal-footer" style={{padding: '20px 24px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0}}>
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : (isEditing ? 'Actualizar Producto' : 'Guardar Producto')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL DE UNIDADES DE NEGOCIO                                      */}
      {/* ================================================================= */}
      {isUnidadModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content fade-in-down" style={{maxWidth: '500px', borderRadius: '16px'}}>
            <div className="modal-header">
              <h2>{isEditingUnidad ? 'Editar Unidad' : 'Nueva Unidad de Negocio'}</h2>
              <button className="btn-close" onClick={() => setIsUnidadModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleUnidadSubmit} style={{ padding: '24px' }}>
              <div className="form-group">
                <label>Nombre de la Unidad (Clave - Sede)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej. 19.OAX - Oaxaca Centro" 
                  value={unidadFormData.nombre} 
                  onChange={(e) => setUnidadFormData({ nombre: e.target.value })} 
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn-cancel" onClick={() => setIsUnidadModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#3b82f6' }} disabled={isLoading}>
                  {isLoading ? 'Guardando...' : 'Guardar Unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL CONFIRMACIÓN GLOBAL                                         */}
      {/* ================================================================= */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{zIndex: 2000}}>
          <div className="confirm-modal-content fade-in-up" style={{ backgroundColor: 'var(--bg-card)', padding: '32px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px' }}>
            <div className="confirm-icon" style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '28px', height: '28px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h3 style={{ margin: '0 0 12px 0' }}>{confirmModal.title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{confirmModal.message}</p>
            <div className="confirm-actions" style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-cancel" style={{ flex: 1 }} onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1, backgroundColor: '#ef4444', justifyContent: 'center' }} onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Configuracion;