import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Configuracion.css';

// --- LISTAS DE RESPALDO ---
const ROLES_FALLBACK = ["ADMIN", "CONTADOR", "ALMACEN", "AUXILIAR", "DEPARTAMENTO_DE_DHO", "D.H.O", "REVISOR", "AUTORIZADOR_1", "AUTORIZADOR_2", "TESORERIA"];
const DEPARTAMENTOS_FALLBACK = ["CONTABILIDAD", "FINANZAS", "DIRECCION", "GERENCIA GENERAL", "OPERACIONES", "COORDINACION TI", "COORDINACION DHO", "TESORERIA", "NORMATIVIDAD"];

function Configuracion() {
  const navigate = useNavigate();
  const [tasas, setTasas] = useState([]);
  
  // --- ESTADOS GLOBALES ---
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [roles, setRoles] = useState([]); // Para el select de puestos

  // --- ESTADOS PARA PRODUCTOS FINANCIEROS ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [formData, setFormData] = useState({
    nombre_tasa: '', tipo_producto: 'FONDEO', tasa_anual_esperada: '', porcentaje_penalizacion: '', cobra_iva: true, descripcion: ''
  });

  // --- ESTADOS PARA UNIDADES DE NEGOCIO ---
  const [unidades, setUnidades] = useState([]);
  const [isUnidadModalOpen, setIsUnidadModalOpen] = useState(false);
  const [isEditingUnidad, setIsEditingUnidad] = useState(false);
  const [editUnidadId, setEditUnidadId] = useState(null);
  const [unidadFormData, setUnidadFormData] = useState({ nombre: '' });

  // --- ESTADOS PARA CATÁLOGO DE GASTOS ---
  const [conceptos, setConceptos] = useState([]);
  const [isConceptoModalOpen, setIsConceptoModalOpen] = useState(false);
  const [isEditingConcepto, setIsEditingConcepto] = useState(false);
  const [formConcepto, setFormConcepto] = useState({ clave: '', descripcion: '', requiere_vobo: false, area_visto_bueno: '' });

  // --- ESTADOS PARA CATÁLOGO DE BANCOS ---
  const [bancos, setBancos] = useState([]);
  const [isBancoModalOpen, setIsBancoModalOpen] = useState(false);
  const [isEditingBanco, setIsEditingBanco] = useState(false);
  const [editBancoId, setEditBancoId] = useState(null);
  const [bancoFormData, setBancoFormData] = useState({ nombre: '' });

  // --- ESTADOS PARA CATÁLOGO DE CATEGORÍAS (NUEVO) ---
  const [categorias, setCategorias] = useState([]);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isEditingCategoria, setIsEditingCategoria] = useState(false);
  const [editCategoriaId, setEditCategoriaId] = useState(null);
  const [categoriaFormData, setCategoriaFormData] = useState({ nombre: '' });

  // --- ESTADOS PARA CATÁLOGO DE PUESTOS ---
  const [puestos, setPuestos] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [isPuestoModalOpen, setIsPuestoModalOpen] = useState(false);
  const [isEditingPuesto, setIsEditingPuesto] = useState(false);
  const [editPuestoId, setEditPuestoId] = useState(null);
  const [puestoFormData, setPuestoFormData] = useState({
      nombre: '', departamento_default: '', nivel_default: 0, rol_default: 'AUXILIAR', puede_solicitar_default: false
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  // ==========================================
  // APIS (FETCH DE TODOS LOS DATOS)
  // ==========================================
  const fetchAllData = async () => {
      const headers = getAuthHeaders(); if (!headers) return;
      try {
          const [resTasas, resUnidades, resConceptos, resBancos, resDeptos, resPuestos, resRoles, resCategorias] = await Promise.all([
              fetch('http://localhost:3001/api/tasas', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/unidades', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/configuracion/conceptos', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/configuracion/bancos', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/configuracion/departamentos', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/configuracion/puestos', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/roles', { headers }).catch(()=>null),
              fetch('http://localhost:3001/api/configuracion/categorias', { headers }).catch(()=>null) 
          ]);

          if (resTasas && resTasas.ok) { const d = await resTasas.json(); if(d.success) setTasas(d.data); }
          if (resUnidades && resUnidades.ok) { const d = await resUnidades.json(); if(d.success) setUnidades(d.data); }
          if (resConceptos && resConceptos.ok) { const d = await resConceptos.json(); if(d.success) setConceptos(d.data); }
          if (resBancos && resBancos.ok) { const d = await resBancos.json(); if(d.success) setBancos(d.data); }
          if (resDeptos && resDeptos.ok) { const d = await resDeptos.json(); if(d.success) setDepartamentos(d.data); }
          if (resPuestos && resPuestos.ok) { const d = await resPuestos.json(); if(d.success) setPuestos(d.data); }
          if (resRoles && resRoles.ok) { const d = await resRoles.json(); if(d.success) setRoles(d.data); }
          if (resCategorias && resCategorias.ok) { const d = await resCategorias.json(); if(d.success) setCategorias(d.data); }
      } catch (error) { console.error("Error cargando configuraciones", error); }
  };

  useEffect(() => { fetchAllData(); }, []);

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
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
    } catch (error) { alert('Error al generar el respaldo. Verifica la consola.'); } 
    finally { setIsBackingUp(false); }
  };

  // ==========================================
  // CONTROLADORES DE MODALES (PRODUCTOS/TASAS)
  // ==========================================
  const openNewModal = () => {
    setIsEditing(false); setEditId(null); setFormError('');
    setFormData({ nombre_tasa: '', tipo_producto: 'FONDEO', tasa_anual_esperada: '', porcentaje_penalizacion: '', cobra_iva: true, descripcion: '' });
    setIsModalOpen(true);
  };
  const openEditModal = (tasa) => {
    setIsEditing(true); setEditId(tasa.id); setFormError('');
    setFormData({ nombre_tasa: tasa.nombre_tasa, tipo_producto: tasa.tipo_producto || 'FONDEO', tasa_anual_esperada: tasa.tasa_anual_esperada, porcentaje_penalizacion: tasa.porcentaje_penalizacion || '', cobra_iva: tasa.cobra_iva === 1, descripcion: tasa.descripcion || '' });
    setIsModalOpen(true);
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    if (Number(formData.tasa_anual_esperada) <= 0) return setFormError('El porcentaje debe ser mayor a 0.');
    const headers = getAuthHeaders(); setIsLoading(true);
    const url = isEditing ? `http://localhost:3001/api/tasas/${editId}` : 'http://localhost:3001/api/tasas';
    const method = isEditing ? 'PUT' : 'POST';
    const payload = { ...formData, cobra_iva: formData.cobra_iva ? 1 : 0 };
    try {
      const res = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { setIsModalOpen(false); fetchAllData(); } else setFormError(data.message);
    } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
  };
  const cambiarEstatus = async (id, estatus_actual) => {
    const headers = getAuthHeaders();
    await fetch(`http://localhost:3001/api/tasas/${id}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: estatus_actual === 1 ? 0 : 1 }) });
    fetchAllData();
  };
  const triggerEliminar = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Producto', message: `¿Estás seguro de eliminar "${nombre}"?`, onConfirm: async () => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/tasas/${id}`, { method: 'DELETE', headers }); fetchAllData(); } }); };

  // ==========================================
  // CONTROLADORES DE MODALES (UNIDADES)
  // ==========================================
  const openNewUnidadModal = () => { setIsEditingUnidad(false); setEditUnidadId(null); setUnidadFormData({ nombre: '' }); setIsUnidadModalOpen(true); };
  const openEditUnidadModal = (u) => { setIsEditingUnidad(true); setEditUnidadId(u.id); setUnidadFormData({ nombre: u.nombre }); setIsUnidadModalOpen(true); };
  const handleUnidadSubmit = async (e) => {
    e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true);
    const url = isEditingUnidad ? `http://localhost:3001/api/unidades/${editUnidadId}` : 'http://localhost:3001/api/unidades';
    try {
      const res = await fetch(url, { method: isEditingUnidad ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(unidadFormData) });
      const data = await res.json();
      if (data.success) { setIsUnidadModalOpen(false); fetchAllData(); } else alert(data.message);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };
  const cambiarEstatusUnidad = async (id, estatus_actual) => {
    const headers = getAuthHeaders();
    await fetch(`http://localhost:3001/api/unidades/${id}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: estatus_actual ? 0 : 1 }) });
    fetchAllData();
  };
  const triggerEliminarUnidad = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Unidad', message: `¿Estás seguro de eliminar "${nombre}"?`, onConfirm: async () => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/unidades/${id}`, { method: 'DELETE', headers }); fetchAllData(); } }); };

  // ==========================================
  // CONTROLADORES DE MODALES (CONCEPTOS)
  // ==========================================
  const openNewConceptoModal = () => { setIsEditingConcepto(false); setFormConcepto({ clave: '', descripcion: '', requiere_vobo: false, area_visto_bueno: '' }); setIsConceptoModalOpen(true); };
  const openEditConceptoModal = (c) => { setIsEditingConcepto(true); setFormConcepto({ clave: c.clave, descripcion: c.descripcion, requiere_vobo: c.requiere_vobo === 1, area_visto_bueno: c.area_visto_bueno || '' }); setIsConceptoModalOpen(true); };
  const handleConceptoSubmit = async (e) => {
      e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true);
      const url = isEditingConcepto ? `http://localhost:3001/api/configuracion/conceptos/${formConcepto.clave}` : 'http://localhost:3001/api/configuracion/conceptos';
      try {
          const res = await fetch(url, { method: isEditingConcepto ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formConcepto) });
          const data = await res.json();
          if (data.success) { setIsConceptoModalOpen(false); fetchAllData(); } else alert(data.message);
      } catch (error) { alert("Error al guardar"); } finally { setIsLoading(false); }
  };
  const cambiarEstatusConcepto = async (clave, estatus_actual) => {
    const headers = getAuthHeaders();
    await fetch(`http://localhost:3001/api/configuracion/conceptos/${clave}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: estatus_actual ? 0 : 1 }) });
    fetchAllData();
  };
  const triggerEliminarConcepto = (clave, descripcion) => { setConfirmModal({ isOpen: true, title: 'Eliminar Concepto', message: `¿Estás seguro de eliminar "${descripcion}"?`, onConfirm: async () => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/configuracion/conceptos/${clave}`, { method: 'DELETE', headers }); fetchAllData(); } }); };

  // ==========================================
  // CONTROLADORES DE MODALES (BANCOS)
  // ==========================================
  const openNewBancoModal = () => { setIsEditingBanco(false); setEditBancoId(null); setBancoFormData({ nombre: '' }); setIsBancoModalOpen(true); };
  const openEditBancoModal = (b) => { setIsEditingBanco(true); setEditBancoId(b.id); setBancoFormData({ nombre: b.nombre }); setIsBancoModalOpen(true); };
  const handleBancoSubmit = async (e) => {
      e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true);
      const url = isEditingBanco ? `http://localhost:3001/api/configuracion/bancos/${editBancoId}` : 'http://localhost:3001/api/configuracion/bancos';
      try {
          const res = await fetch(url, { method: isEditingBanco ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(bancoFormData) });
          const data = await res.json();
          if (data.success) { setIsBancoModalOpen(false); fetchAllData(); } else alert(data.message);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };
  const cambiarEstatusBanco = async (id, estatus_actual) => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/configuracion/bancos/${id}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: estatus_actual ? 0 : 1 }) }); fetchAllData(); };
  const triggerEliminarBanco = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Banco', message: `¿Estás seguro de eliminar "${nombre}"?`, onConfirm: async () => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/configuracion/bancos/${id}`, { method: 'DELETE', headers }); fetchAllData(); } }); };

  // ==========================================
  // CONTROLADORES DE MODALES (CATEGORÍAS)
  // ==========================================
  const openNewCategoriaModal = () => { setIsEditingCategoria(false); setEditCategoriaId(null); setCategoriaFormData({ nombre: '' }); setIsCategoriaModalOpen(true); };
  const openEditCategoriaModal = (c) => { setIsEditingCategoria(true); setEditCategoriaId(c.id); setCategoriaFormData({ nombre: c.nombre }); setIsCategoriaModalOpen(true); };
  const handleCategoriaSubmit = async (e) => {
      e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true);
      const url = isEditingCategoria ? `http://localhost:3001/api/configuracion/categorias/${editCategoriaId}` : 'http://localhost:3001/api/configuracion/categorias';
      try {
          const res = await fetch(url, { method: isEditingCategoria ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(categoriaFormData) });
          const data = await res.json();
          if (data.success) { setIsCategoriaModalOpen(false); fetchAllData(); } else alert(data.message);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };
  const cambiarEstatusCategoria = async (id, estatus_actual) => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/configuracion/categorias/${id}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: estatus_actual ? 0 : 1 }) }); fetchAllData(); };
  const triggerEliminarCategoria = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Categoría', message: `¿Estás seguro de eliminar "${nombre}"?`, onConfirm: async () => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/configuracion/categorias/${id}`, { method: 'DELETE', headers }); fetchAllData(); } }); };

  // ==========================================
  // CONTROLADORES DE MODALES (PUESTOS)
  // ==========================================
  const openNewPuestoModal = () => { 
      setIsEditingPuesto(false); setEditPuestoId(null); 
      setPuestoFormData({ nombre: '', departamento_default: '', nivel_default: 0, rol_default: 'AUXILIAR', puede_solicitar_default: false }); 
      setIsPuestoModalOpen(true); 
  };
  const openEditPuestoModal = (p) => { 
      setIsEditingPuesto(true); setEditPuestoId(p.id); 
      setPuestoFormData({ 
          nombre: p.nombre, departamento_default: p.departamento_default || '', 
          nivel_default: p.nivel_default || 0, rol_default: p.rol_default || 'AUXILIAR', 
          puede_solicitar_default: p.puede_solicitar_default === 1 || p.puede_solicitar_default === true 
      }); 
      setIsPuestoModalOpen(true); 
  };
  const handlePuestoSubmit = async (e) => {
      e.preventDefault(); 
      if(!puestoFormData.nombre.trim()) return alert("El nombre es requerido.");
      const headers = getAuthHeaders(); setIsLoading(true);
      const url = isEditingPuesto ? `http://localhost:3001/api/configuracion/puestos/${editPuestoId}` : 'http://localhost:3001/api/configuracion/puestos';
      const payload = { ...puestoFormData, puede_solicitar_default: puestoFormData.puede_solicitar_default ? 1 : 0 };
      try {
          const res = await fetch(url, { method: isEditingPuesto ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const data = await res.json();
          if (data.success) { setIsPuestoModalOpen(false); fetchAllData(); } else alert(data.message);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };
  const cambiarEstatusPuesto = async (id, estatus_actual) => { const headers = getAuthHeaders(); await fetch(`http://localhost:3001/api/configuracion/puestos/${id}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: estatus_actual ? 0 : 1 }) }); fetchAllData(); };
  const triggerEliminarPuesto = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Puesto', message: `¿Estás seguro de eliminar el cargo "${nombre}"?`, onConfirm: async () => { const headers = getAuthHeaders(); const res = await fetch(`http://localhost:3001/api/configuracion/puestos/${id}`, { method: 'DELETE', headers }); const data = await res.json(); if(data.success) fetchAllData(); else alert(data.message); } }); };


  return (
    <div className="config-container">
      {/* SECCIÓN TASAS / PRODUCTOS */}
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

      {/* SECCIÓN PUESTOS */}
      <div className="bancos-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Catálogo de Puestos (Cargos)</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Cargos de la empresa y sus reglas de automatización al crear usuarios.</p>
          </div>
          <button className="btn-primary" onClick={openNewPuestoModal} style={{ backgroundColor: '#f59e0b' }}>+ Añadir Puesto</button>
        </div>

        <div className="table-responsive" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px' }}>CARGO / PUESTO</th>
                        <th style={{ padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px' }}>DEPTO. AUTOMÁTICO</th>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>ROL DE ACCESO</th>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>PERMISO SOLICITAR</th>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>ESTATUS</th>
                        <th style={{ padding: '16px', textAlign: 'right', color: '#475569', fontSize: '12px' }}>ACCIONES</th>
                    </tr>
                </thead>
                <tbody>
                    {puestos.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: p.estatus_activo ? 1 : 0.6 }}>
                            <td style={{ padding: '16px', fontWeight: 'bold', color: p.estatus_activo ? '#0f172a' : '#ef4444', fontSize: '13px' }}>
                                {p.nombre}
                                <div style={{fontSize: '11px', color: '#64748b', fontWeight: 'normal', marginTop: '2px'}}>Nivel: {p.nivel_default}</div>
                            </td>
                            <td style={{ padding: '16px', color: '#334155', fontSize: '13px' }}>{p.departamento_default || '- Sin asignar -'}</td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>{p.rol_default}</span>
                            </td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                {p.puede_solicitar_default ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" style={{width: '18px'}}><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="3" style={{width: '18px'}}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                )}
                            </td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                <button onClick={() => cambiarEstatusPuesto(p.id, p.estatus_activo)} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: p.estatus_activo ? '#dcfce3' : '#fef2f2', color: p.estatus_activo ? '#166534' : '#ef4444' }}>
                                    {p.estatus_activo ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="btn-icon-edit" onClick={() => openEditPuestoModal(p)} title="Editar Puesto">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarPuesto(p.id, p.nombre)} title="Eliminar Puesto">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {puestos.length === 0 && (
                        <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No hay puestos registrados.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* SECCIÓN UNIDADES DE NEGOCIO */}
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
              <div key={unidad.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-focus)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)', opacity: (unidad.estatus_activo !== false && unidad.estatus_activo !== 0) ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px' }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-main)' }}>{unidad.nombre}</span>
                      <button onClick={() => cambiarEstatusUnidad(unidad.id, unidad.estatus_activo !== false && unidad.estatus_activo !== 0 ? 1 : 0)} style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: '4px', alignSelf: 'flex-start', backgroundColor: (unidad.estatus_activo !== false && unidad.estatus_activo !== 0) ? '#dcfce3' : '#fef2f2', color: (unidad.estatus_activo !== false && unidad.estatus_activo !== 0) ? '#166534' : '#ef4444' }}>
                          {(unidad.estatus_activo !== false && unidad.estatus_activo !== 0) ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-icon-edit" onClick={() => openEditUnidadModal(unidad)} title="Editar Unidad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                  <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarUnidad(unidad.id, unidad.nombre)} title="Eliminar Unidad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}><p style={{ color: '#64748b', margin: 0, fontWeight: '500' }}>No hay unidades de negocio registradas.</p></div>
          )}
        </div>
      </div>

      {/* SECCIÓN CONCEPTOS DE GASTO */}
      <div className="conceptos-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                  <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Catálogo de Cuentas de Gastos</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Administración del catálogo maestro y reglas de Visto Bueno.</p>
              </div>
              <button className="btn-primary" onClick={openNewConceptoModal} style={{ backgroundColor: '#8b5cf6' }}>+ Añadir Concepto</button>
          </div>
          <div className="table-responsive" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px' }}>CLAVE</th>
                          <th style={{ padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px' }}>DESCRIPCIÓN DEL GASTO</th>
                          <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>FLUJO DE AUTORIZACIÓN</th>
                          <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>ESTATUS</th>
                          <th style={{ padding: '16px', textAlign: 'right', color: '#475569', fontSize: '12px' }}>ACCIONES</th>
                      </tr>
                  </thead>
                  <tbody>
                      {conceptos.map(c => (
                          <tr key={c.clave} style={{ borderBottom: '1px solid #f1f5f9', opacity: (c.estatus_activo !== false && c.estatus_activo !== 0) ? 1 : 0.6 }}>
                              <td style={{ padding: '16px', fontWeight: 'bold', color: '#0f172a', fontSize: '13px' }}>{c.clave}</td>
                              <td style={{ padding: '16px', color: '#334155', fontSize: '13px', fontWeight: '500' }}>{c.descripcion}</td>
                              <td style={{ padding: '16px', textAlign: 'center' }}>
                                  {c.requiere_vobo ? (
                                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                          <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>REQUIERE VISTO BUENO</span>
                                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', marginTop: '4px' }}>{c.area_visto_bueno}</span>
                                      </div>
                                  ) : (
                                      <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>DIRECTO A CONTABILIDAD</span>
                                  )}
                              </td>
                              <td style={{ padding: '16px', textAlign: 'center' }}>
                                  <button onClick={() => cambiarEstatusConcepto(c.clave, c.estatus_activo !== false && c.estatus_activo !== 0 ? 1 : 0)} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: (c.estatus_activo !== false && c.estatus_activo !== 0) ? '#dcfce3' : '#fef2f2', color: (c.estatus_activo !== false && c.estatus_activo !== 0) ? '#166534' : '#ef4444' }}>
                                      {(c.estatus_activo !== false && c.estatus_activo !== 0) ? 'ACTIVO' : 'INACTIVO'}
                                  </button>
                              </td>
                              <td style={{ padding: '16px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                      <button className="btn-icon-edit" onClick={() => openEditConceptoModal(c)} title="Editar Concepto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                      <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarConcepto(c.clave, c.descripcion)} title="Eliminar Concepto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {conceptos.length === 0 && (<tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No hay conceptos de gasto registrados.</td></tr>)}
                  </tbody>
              </table>
          </div>
      </div>

      {/* SECCIÓN BANCOS */}
      <div className="bancos-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Catálogo de Bancos e Instituciones</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Bancos disponibles para transferencias y cuentas de clientes/proveedores.</p>
          </div>
          <button className="btn-primary" onClick={openNewBancoModal} style={{ backgroundColor: '#0ea5e9' }}>+ Añadir Banco</button>
        </div>

        <div className="table-responsive" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px', width: '80px' }}>ID</th>
                        <th style={{ padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px' }}>NOMBRE DE LA INSTITUCIÓN</th>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>ESTATUS</th>
                        <th style={{ padding: '16px', textAlign: 'right', color: '#475569', fontSize: '12px' }}>ACCIONES</th>
                    </tr>
                </thead>
                <tbody>
                    {bancos.map(banco => (
                        <tr key={banco.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: banco.estatus_activo ? 1 : 0.6 }}>
                            <td style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>{banco.id}</td>
                            <td style={{ padding: '16px', fontWeight: 'bold', color: banco.estatus_activo ? '#0f172a' : '#ef4444', fontSize: '13px' }}>{banco.nombre}</td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                <button onClick={() => cambiarEstatusBanco(banco.id, banco.estatus_activo)} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: banco.estatus_activo ? '#dcfce3' : '#fef2f2', color: banco.estatus_activo ? '#166534' : '#ef4444' }}>
                                    {banco.estatus_activo ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="btn-icon-edit" onClick={() => openEditBancoModal(banco)} title="Editar Banco"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                    <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarBanco(banco.id, banco.nombre)} title="Eliminar Banco"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {bancos.length === 0 && (<tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No hay bancos registrados.</td></tr>)}
                </tbody>
            </table>
        </div>
      </div>

      {/* SECCIÓN CATEGORÍAS DE PROVEEDORES */}
      <div className="categorias-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Catálogo de Categorías de Proveedores</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Administra los giros o categorías asignables a tus proveedores.</p>
          </div>
          <button className="btn-primary" onClick={openNewCategoriaModal} style={{ backgroundColor: '#10b981' }}>+ Añadir Categoría</button>
        </div>

        <div className="table-responsive" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px', width: '80px' }}>ID</th>
                        <th style={{ padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px' }}>NOMBRE DE LA CATEGORÍA</th>
                        <th style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '12px' }}>ESTATUS</th>
                        <th style={{ padding: '16px', textAlign: 'right', color: '#475569', fontSize: '12px' }}>ACCIONES</th>
                    </tr>
                </thead>
                <tbody>
                    {categorias.map(cat => (
                        <tr key={cat.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: cat.estatus_activo ? 1 : 0.6 }}>
                            <td style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>{cat.id}</td>
                            <td style={{ padding: '16px', fontWeight: 'bold', color: cat.estatus_activo ? '#0f172a' : '#ef4444', fontSize: '13px' }}>{cat.nombre}</td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                                <button onClick={() => cambiarEstatusCategoria(cat.id, cat.estatus_activo)} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: cat.estatus_activo ? '#dcfce3' : '#fef2f2', color: cat.estatus_activo ? '#166534' : '#ef4444' }}>
                                    {cat.estatus_activo ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="btn-icon-edit" onClick={() => openEditCategoriaModal(cat)} title="Editar Categoría"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                    <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarCategoria(cat.id, cat.nombre)} title="Eliminar Categoría"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {categorias.length === 0 && (<tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No hay categorías registradas.</td></tr>)}
                </tbody>
            </table>
        </div>
      </div>

      {/* SECCIÓN DE RESPALDO */}
      <div className="backup-section stagger-3 fade-in-up" style={{ marginTop: '48px', borderTop: '1px solid var(--border-light)', paddingTop: '32px' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--text-main)', marginBottom: '8px' }}>Seguridad y Respaldo</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>Genera copias locales de la información del sistema.</p>
        <div className="backup-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-focus)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f0fdf4', color: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '24px', height: '24px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></div>
              <div>
                 <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-main)' }}>Respaldo de Base de Datos (.sql)</h4>
                 <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Descarga clientes, contratos, pagos, expedientes y bitácora de auditoría.</p>
              </div>
           </div>
           <button onClick={handleBackup} disabled={isBackingUp} style={{ background: '#1e293b', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: isBackingUp ? 'wait' : 'pointer', transition: 'all 0.3s' }}>
              {isBackingUp ? 'Descargando...' : 'Generar Backup'}
           </button>
        </div>
      </div>

      {/* ======================= MODALES ======================= */}

      {/* MODAL PRODUCTOS */}
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
                  <div className="form-group"><label>Nombre del Producto Comercial</label><input type="text" required value={formData.nombre_tasa} onChange={(e) => setFormData({...formData, nombre_tasa: e.target.value})} /></div>
                  <div className="form-group">
                    <label>Tipo de Operación</label>
                    <select style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-focus)', fontSize: '14px', outline: 'none', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }} value={formData.tipo_producto} onChange={(e) => setFormData({...formData, tipo_producto: e.target.value})}>
                      <option value="FONDEO">Pasivo (Para Fondeadores)</option><option value="CREDITO">Activo (Para Acreditados)</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Rendimiento Anual (%)</label><input type="number" step="0.01" required value={formData.tasa_anual_esperada} onChange={(e) => setFormData({...formData, tasa_anual_esperada: e.target.value})} /></div>
                  <div className="form-group"><label>Penalización por retiro (%)</label><input type="number" step="0.01" value={formData.porcentaje_penalizacion} onChange={(e) => setFormData({...formData, porcentaje_penalizacion: e.target.value})} /></div>
                </div>
                <div className="form-group" style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, color: '#0f172a', fontWeight: '600' }}>
                    <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#10d440', cursor: 'pointer' }} checked={formData.cobra_iva} onChange={(e) => setFormData({...formData, cobra_iva: e.target.checked})} />
                    Calcular 16% de IVA sobre el interés en la amortización.
                  </label>
                </div>
                <div className="form-group"><label>Descripción / Condiciones</label><textarea className="custom-textarea" rows="3" style={{width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-light)', outline: 'none', resize: 'vertical', backgroundColor: 'var(--bg-main)'}} value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} /></div>
              </div>
              <div className="modal-footer" style={{padding: '20px 24px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-card)', flexShrink: 0}}><button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : (isEditing ? 'Actualizar Producto' : 'Guardar Producto')}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PUESTOS */}
      {isPuestoModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 1050 }}>
              <div className="modal-content fade-in-down" style={{ maxWidth: '600px', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden' }}>
                  <div className="modal-header" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '20px 24px' }}>
                      <h2 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>{isEditingPuesto ? 'Editar Puesto' : 'Nuevo Puesto (Cargo)'}</h2>
                      <button className="btn-close" onClick={() => setIsPuestoModalOpen(false)}>×</button>
                  </div>
                  <form onSubmit={handlePuestoSubmit} style={{ padding: '24px' }}>
                      
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Nombre del Puesto / Cargo <span style={{ color: 'red' }}>*</span></label>
                          <input type="text" required value={puestoFormData.nombre} onChange={e => setPuestoFormData({...puestoFormData, nombre: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Ej. GERENTE DE ZONA" />
                      </div>

                      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                          <div className="form-group">
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Depto. Automático (Opcional)</label>
                              <select value={puestoFormData.departamento_default} onChange={e => setPuestoFormData({...puestoFormData, departamento_default: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}>
                                  <option value="">-- No autocompletar --</option>
                                  {departamentos.length > 0 ? departamentos.map(d => (
                                      <option key={d.id} value={d.nombre}>{d.nombre}</option>
                                  )) : DEPARTAMENTOS_FALLBACK.map((dep, i) => (
                                      <option key={i} value={dep}>{dep}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="form-group">
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Nivel de Jerarquía</label>
                              <input type="number" min="0" value={puestoFormData.nivel_default} onChange={e => setPuestoFormData({...puestoFormData, nivel_default: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                          </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Rol de Acceso al Sistema (Por defecto)</label>
                          <select value={puestoFormData.rol_default} onChange={e => setPuestoFormData({...puestoFormData, rol_default: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: 'bold' }}>
                              {roles.length > 0 ? roles.map(r => (
                                  <option key={r.id} value={r.nombre_rol}>{r.nombre_rol}</option>
                              )) : ROLES_FALLBACK.map((rol, i) => (
                                  <option key={i} value={rol}>{rol}</option>
                              ))}
                          </select>
                      </div>

                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', fontSize: '14px' }}>
                              <input type="checkbox" checked={puestoFormData.puede_solicitar_default} onChange={e => setPuestoFormData({...puestoFormData, puede_solicitar_default: e.target.checked})} style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }} />
                              ¿Este puesto puede crear solicitudes de Viáticos/Recursos?
                          </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                          <button type="button" className="btn-cancel" onClick={() => setIsPuestoModalOpen(false)}>Cancelar</button>
                          <button type="submit" disabled={isLoading} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#f59e0b', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                              {isLoading ? 'Guardando...' : 'Guardar Puesto'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL UNIDADES */}
      {isUnidadModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content fade-in-down" style={{maxWidth: '500px', borderRadius: '16px'}}>
            <div className="modal-header"><h2>{isEditingUnidad ? 'Editar Unidad' : 'Nueva Unidad de Negocio'}</h2><button className="btn-close" onClick={() => setIsUnidadModalOpen(false)}>×</button></div>
            <form onSubmit={handleUnidadSubmit} style={{ padding: '24px' }}>
              <div className="form-group"><label>Nombre de la Unidad (Clave - Sede)</label><input type="text" required value={unidadFormData.nombre} onChange={(e) => setUnidadFormData({ nombre: e.target.value })} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}><button type="button" className="btn-cancel" onClick={() => setIsUnidadModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" style={{ backgroundColor: '#3b82f6' }} disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar Unidad'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONCEPTOS */}
      {isConceptoModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 1050 }}>
              <div className="modal-content fade-in-down" style={{ maxWidth: '500px', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden' }}>
                  <div className="modal-header" style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '20px 24px' }}>
                      <h2 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>{isEditingConcepto ? 'Editar Concepto de Gasto' : 'Nuevo Concepto de Gasto'}</h2>
                      <button className="btn-close" onClick={() => setIsConceptoModalOpen(false)}>×</button>
                  </div>
                  <form onSubmit={handleConceptoSubmit} style={{ padding: '24px' }}>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Clave Contable <span style={{ color: 'red' }}>*</span></label>
                          <input type="text" required disabled={isEditingConcepto} value={formConcepto.clave} onChange={e => setFormConcepto({...formConcepto, clave: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Descripción del Gasto <span style={{ color: 'red' }}>*</span></label>
                          <input type="text" required value={formConcepto.descripcion} onChange={e => setFormConcepto({...formConcepto, descripcion: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#0f172a', cursor: 'pointer', fontSize: '14px' }}>
                              <input type="checkbox" checked={formConcepto.requiere_vobo} onChange={e => setFormConcepto({...formConcepto, requiere_vobo: e.target.checked, area_visto_bueno: e.target.checked ? formConcepto.area_visto_bueno : ''})} style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }} />
                              ¿Este gasto requiere Visto Bueno (VoBo)?
                          </label>
                          {formConcepto.requiere_vobo && (
                              <div style={{ marginTop: '16px' }}>
                                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>¿Qué área debe autorizar? <span style={{ color: 'red' }}>*</span></label>
                                  <select required={formConcepto.requiere_vobo} value={formConcepto.area_visto_bueno} onChange={e => setFormConcepto({...formConcepto, area_visto_bueno: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}>
                                      <option value="">Seleccionar Área...</option>
                                      {departamentos.length > 0 ? departamentos.map(d => ( <option key={d.id} value={d.nombre}>{d.nombre}</option> )) : DEPARTAMENTOS_FALLBACK.map((dep, i) => ( <option key={i} value={dep}>{dep}</option> ))}
                                      <option value="GERENCIA GENERAL">GERENCIA GENERAL</option>
                                      <option value="AUTORIZA">Solo Finanzas / Contabilidad</option>
                                  </select>
                              </div>
                          )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                          <button type="button" className="btn-cancel" onClick={() => setIsConceptoModalOpen(false)}>Cancelar</button>
                          <button type="submit" disabled={isLoading} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#8b5cf6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>{isLoading ? 'Guardando...' : 'Guardar Concepto'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL BANCOS */}
      {isBancoModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content fade-in-down" style={{maxWidth: '450px', borderRadius: '16px'}}>
            <div className="modal-header"><h2>{isEditingBanco ? 'Editar Banco' : 'Nuevo Banco'}</h2><button className="btn-close" onClick={() => setIsBancoModalOpen(false)}>×</button></div>
            <form onSubmit={handleBancoSubmit} style={{ padding: '24px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Nombre de la Institución <span style={{ color: 'red' }}>*</span></label>
                <input type="text" required value={bancoFormData.nombre} onChange={(e) => setBancoFormData({ nombre: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}><button type="button" className="btn-cancel" onClick={() => setIsBancoModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" style={{ backgroundColor: '#0ea5e9' }} disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar Banco'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CATEGORÍAS */}
      {isCategoriaModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content fade-in-down" style={{maxWidth: '450px', borderRadius: '16px'}}>
            <div className="modal-header"><h2>{isEditingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}</h2><button className="btn-close" onClick={() => setIsCategoriaModalOpen(false)}>×</button></div>
            <form onSubmit={handleCategoriaSubmit} style={{ padding: '24px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Nombre de la Categoría <span style={{ color: 'red' }}>*</span></label>
                <input type="text" required value={categoriaFormData.nombre} onChange={(e) => setCategoriaFormData({ nombre: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}><button type="button" className="btn-cancel" onClick={() => setIsCategoriaModalOpen(false)}>Cancelar</button><button type="submit" className="btn-primary" style={{ backgroundColor: '#10b981' }} disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar Categoría'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN GLOBAL */}
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