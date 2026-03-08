import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Configuracion.css';

function Configuracion() {
  const navigate = useNavigate();
  const [tasas, setTasas] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // --- NUEVO ESTADO PARA EL RESPALDO ---
  const [isBackingUp, setIsBackingUp] = useState(false);

  const [formData, setFormData] = useState({
    nombre_tasa: '', tasa_anual_esperada: '', porcentaje_penalizacion: '', descripcion: ''
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchTasas = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/tasas', { headers });
      const data = await res.json();
      if (data.success) setTasas(data.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchTasas(); }, []);

  // --- NUEVA FUNCIÓN DE RESPALDO ---
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

  const openNewModal = () => {
    setIsEditing(false); setEditId(null); setFormError('');
    setFormData({ nombre_tasa: '', tasa_anual_esperada: '', porcentaje_penalizacion: '', descripcion: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (tasa) => {
    setIsEditing(true); setEditId(tasa.id); setFormError('');
    setFormData({ 
      nombre_tasa: tasa.nombre_tasa, 
      tasa_anual_esperada: tasa.tasa_anual_esperada, 
      porcentaje_penalizacion: tasa.porcentaje_penalizacion || '', 
      descripcion: tasa.descripcion || '' 
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (Number(formData.tasa_anual_esperada) <= 0) {
      return setFormError('El porcentaje de rendimiento debe ser mayor a 0.');
    }

    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);

    const url = isEditing ? `http://localhost:3001/api/tasas/${editId}` : 'http://localhost:3001/api/tasas';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { 
        method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) 
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false); fetchTasas();
      } else { setFormError(data.message); }
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
      isOpen: true, 
      title: 'Eliminar Producto Financiero', 
      message: `¿Estás seguro de eliminar "${nombre}"? Esta acción no se puede deshacer.`, 
      onConfirm: () => eliminarTasa(id)
    });
  };

  const eliminarTasa = async (id) => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch(`http://localhost:3001/api/tasas/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        fetchTasas();
      } else {
        alert(data.message);
      }
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
                <h3 className="tasa-titulo">{tasa.nombre_tasa}</h3>
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
                <div className="penalizacion-info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  <span>Penalización por retiro: <strong>{tasa.porcentaje_penalizacion || '0'}%</strong></span>
                </div>
                
                <div style={{display: 'flex', gap: '8px'}}>
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

      {/* --- SECCIÓN DE RESPALDO (NUEVO) --- */}
      <div className="backup-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Seguridad y Respaldo</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>Genera copias locales de la información del sistema.</p>
        
        <div className="backup-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-focus)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down" style={{maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Producto' : 'Crear Producto Financiero'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', overflow: 'hidden', flexGrow: 1}}>
              <div className="modal-form" style={{overflowY: 'auto', padding: '24px'}}>
                {formError && ( <div className="error-message shake-animation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>{formError}</span></div> )}
                
                <div className="form-group">
                  <label>Nombre del Producto Comercial</label>
                  <input type="text" required placeholder="Ej. Inversión Clásica 12 Meses" value={formData.nombre_tasa} onChange={(e) => setFormData({...formData, nombre_tasa: e.target.value})} />
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

export default Configuracion;