import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Proveedores.css';

function Proveedores() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null); 
  
  const [proveedores, setProveedores] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const [panelOpen, setPanelOpen] = useState(false);
  const [provActivo, setProvActivo] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [showNuevoPago, setShowNuevoPago] = useState(false);
  const [formPago, setFormPago] = useState({ concepto: '', monto_pago: '', num_factura_ref: '' });
  const [fileComprobante, setFileComprobante] = useState(null);

  // --- ESTADOS PARA REPORTE MAESTRO DE EGRESOS ---
  const [panelReporteOpen, setPanelReporteOpen] = useState(false);
  const [datosReporte, setDatosReporte] = useState([]);
  const [resumenReporte, setResumenReporte] = useState({ total_pagado: 0, total_pendiente: 0, gran_total: 0, presupuesto_ingreso: 0 });
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  
  // --- ESTADOS PARA LISTA DE GASTOS ---
  const [panelListaGastosOpen, setPanelListaGastosOpen] = useState(false);
  const [listaGastos, setListaGastos] = useState([]);
  const [mesListaGastos, setMesListaGastos] = useState(new Date().getMonth() + 1);
  const [anioListaGastos, setAnioListaGastos] = useState(new Date().getFullYear());
  const [resumenListaGastos, setResumenListaGastos] = useState({ total_pendiente: 0, total_arrastrado: 0 });
  const [currentPageLista, setCurrentPageLista] = useState(1);
  const itemsPerPageLista = 10;

  // ESTADOS PARA PAGINACIÓN DEL REPORTE
  const [currentPageReporte, setCurrentPageReporte] = useState(1);
  const itemsPerPageReporte = 5;

  // --- ESTADOS PAGO FONDEADOR RÁPIDO ---
  const [pagoFondeadorModal, setPagoFondeadorModal] = useState({ isOpen: false, id_contrato: null, proveedor: '', concepto: '', monto: '' });
  const [fileFondeador, setFileFondeador] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; }
    return false;
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

  const fetchProveedores = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const response = await fetch('http://localhost:3001/api/proveedores', { headers });
      if (handleAuthError(response.status)) return;
      const data = await response.json();
      if (data.success) {
        setProveedores(data.data);
      }
    } catch (error) { console.error("Error al cargar datos:", error); }
  };

  const fetchReporteMaestro = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    try {
        const response = await fetch(`http://localhost:3001/api/proveedores/reportes/pagos-del-mes?mes=${mesFiltro}&anio=${anioFiltro}`, { headers });
        const data = await response.json();
        if (data.success) {
            setDatosReporte(data.data);
            setResumenReporte(prev => ({ ...data.resumen, presupuesto_ingreso: prev.presupuesto_ingreso }));
            setCurrentPageReporte(1);
            setPanelReporteOpen(true);
        }
    } catch (error) { 
        console.error("Error al cargar reporte maestro:", error); 
    } finally {
        setIsLoading(false);
    }
  };

  // Función para traer lista de gastos filtrada por mes
  const fetchListaGastos = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    try {
        const response = await fetch(`http://localhost:3001/api/proveedores/reportes/lista-gastos?mes=${mesListaGastos}&anio=${anioListaGastos}`, { headers });
        const data = await response.json();
        if (data.success) {
            setListaGastos(data.data);
            setResumenListaGastos({
                total_pendiente: data.resumen?.total_pendiente || 0,
                total_arrastrado: data.resumen?.total_arrastrado || 0
            });
            setCurrentPageLista(1);
            setPanelListaGastosOpen(true);
        }
    } catch (error) { 
        console.error("Error al cargar lista de gastos:", error); 
        alert("Error al cargar la lista de gastos");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
      if (panelReporteOpen) {
          fetchReporteMaestro();
      }
  }, [mesFiltro, anioFiltro]);

  useEffect(() => { fetchProveedores(); }, []);

  const handlePagarFondeador = async (e) => {
      e.preventDefault();
      const headers = getAuthHeaders();
      setIsLoading(true);

      const formDataUpload = new FormData();
      formDataUpload.append('id_contrato', pagoFondeadorModal.id_contrato);
      formDataUpload.append('monto', pagoFondeadorModal.monto);
      if (fileFondeador) formDataUpload.append('comprobante', fileFondeador);

      try {
          const res = await fetch('http://localhost:3001/api/proveedores/pagos-fondeador', {
              method: 'POST',
              headers: { 'Authorization': headers.Authorization },
              body: formDataUpload
          });
          const data = await res.json();
          if (data.success) {
              setPagoFondeadorModal({ isOpen: false, id_contrato: null, proveedor: '', concepto: '', monto: '' });
              setFileFondeador(null);
              fetchReporteMaestro();
              if (panelListaGastosOpen) fetchListaGastos();
          } else {
              alert(data.message);
          }
      } catch (err) { console.error(err); } 
      finally { setIsLoading(false); }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
        alert("Por favor, selecciona un archivo con extensión .xlsx");
        return;
    }

    if (!window.confirm(`¿Deseas intentar importar los proveedores del archivo "${file.name}"?`)) {
        e.target.value = null;
        return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;
    const { Authorization } = headers;
    
    setIsLoading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('archivo_excel', file);

    try {
        const response = await fetch('http://localhost:3001/api/proveedores/importar', {
            method: 'POST',
            headers: { Authorization },
            body: formDataUpload
        });

        if (handleAuthError(response.status)) return;
        
        const data = await response.json();
        alert(data.message); 
        
        if (data.success) fetchProveedores(); 
    } catch (error) {
        alert("Hubo un problema de conexión al importar.");
    } finally {
        setIsLoading(false);
        e.target.value = null; 
    }
  };

  const openNewModal = () => { 
    setIsEditing(false); setEditId(null); setFormError(''); 
    setFormData({ tipo_persona: 'MORAL', nombre: '', rfc: '', direccion: '', telefono: '', email: '', categoria: 'OTROS', clabe_bancaria: '', numero_cuenta: '', banco: '', dias_credito: 0 }); 
    setIsModalOpen(true); 
  };
  
  const openEditModal = (prov) => { 
    setIsEditing(true); setEditId(prov.id); setFormError(''); 
    setFormData({ 
      tipo_persona: prov.tipo_persona || 'MORAL', nombre: prov.nombre || '', rfc: prov.rfc || '', direccion: prov.ubicacion || '', 
      telefono: prov.telefono || '', email: prov.email || '', categoria: prov.categoria || 'OTROS', 
      clabe_bancaria: prov.clabe_bancaria || '', numero_cuenta: prov.numero_cuenta || '', banco: prov.banco || '', dias_credito: prov.dias_credito || 0 
    }); 
    setIsModalOpen(true); 
  };
  
  const triggerEliminar = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Proveedor', message: `¿Estás seguro de eliminar a ${nombre || 'este proveedor'}? Se ocultará del directorio permanentemente.`, onConfirm: () => ejecutarEliminar(id) }); };
  
  const ejecutarEliminar = async (id) => { 
    const headers = getAuthHeaders(); if (!headers) return; 
    try { 
        const res = await fetch(`http://localhost:3001/api/proveedores/${id}`, { method: 'DELETE', headers }); 
        if (handleAuthError(res.status)) return; 
        if ((await res.json()).success) fetchProveedores(); 
    } catch (error) { console.error(error); } 
  };
  
  const validarFormulario = () => { 
    setFormError(''); 
    if (!formData.nombre.trim()) { setFormError('La Razón Social / Nombre es obligatorio.'); return false; } 
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setFormError('Correo Electrónico inválido. Verifica el formato.'); return false; } 
    if (formData.telefono && formData.telefono.length !== 10) { setFormError('El teléfono debe tener exactamente 10 dígitos.'); return false; } 
    
    if (formData.rfc) {
      if (formData.tipo_persona === 'FISICA' && formData.rfc.length !== 13) { setFormError('Persona Física: RFC de 13 caracteres.'); return false; }
      if (formData.tipo_persona === 'MORAL' && formData.rfc.length !== 12) { setFormError('Persona Moral: RFC de 12 caracteres.'); return false; }
    }

    if (formData.numero_cuenta && formData.numero_cuenta.length !== 10) { setFormError('El Número de Cuenta debe tener exactamente 10 dígitos.'); return false; }
    if (formData.clabe_bancaria && formData.clabe_bancaria.length !== 18) { setFormError('La CLABE Interbancaria debe tener exactamente 18 dígitos.'); return false; }
    if ((formData.numero_cuenta || formData.clabe_bancaria) && !formData.banco) { setFormError('Debes seleccionar un Banco Destino si ingresas una cuenta o CLABE.'); return false; }

    return true; 
  };
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if (!validarFormulario()) return; 
    const headers = getAuthHeaders(); if (!headers) return; 
    setIsLoading(true); 
    const url = isEditing ? `http://localhost:3001/api/proveedores/${editId}` : 'http://localhost:3001/api/proveedores'; 
    const method = isEditing ? 'PUT' : 'POST'; 
    
    try { 
      const res = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) }); 
      if (handleAuthError(res.status)) return; 
      const data = await res.json();
      if (data.success) { setIsModalOpen(false); fetchProveedores(); } 
      else { setFormError(data.message || "Error al intentar guardar en la base de datos."); } 
    } catch (error) { setFormError(`Falla de Red. Asegúrate de que el backend en el puerto 3001 esté encendido.`); } 
    finally { setIsLoading(false); } 
  };
  
  const cambiarEstatus = async (id_persona, estatus_actual) => { 
    const nuevoEstatus = estatus_actual === 1 ? 0 : 1; 
    const headers = getAuthHeaders(); if (!headers) return; 
    try { 
        const res = await fetch(`http://localhost:3001/api/proveedores/${id_persona}/estatus`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) }); 
        if ((await res.json()).success) fetchProveedores(); 
    } catch (error) { console.error(error); } 
  };

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

  const avanzarWorkflowPago = async (id_pago, accion) => {
    if (!window.confirm(`¿Estás seguro de ${accion.toLowerCase()} este pago?`)) return;
    const headers = getAuthHeaders();
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/proveedores/pagos/${id_pago}/autorizacion`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      });
      const data = await res.json();
      if (data.success) fetchPagos(provActivo.id); 
      else alert(data.message);
    } catch (error) { alert('Error de conexión con el servidor.'); } 
    finally { setIsLoading(false); }
  };

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

  const indexOfLastReporte = currentPageReporte * itemsPerPageReporte;
  const indexOfFirstReporte = indexOfLastReporte - itemsPerPageReporte;
  const currentReportes = datosReporte.slice(indexOfFirstReporte, indexOfLastReporte);
  const totalPagesReporte = Math.ceil(datosReporte.length / itemsPerPageReporte);

  const indexOfLastLista = currentPageLista * itemsPerPageLista;
  const indexOfFirstLista = indexOfLastLista - itemsPerPageLista;
  const currentListaGastos = listaGastos.slice(indexOfFirstLista, indexOfLastLista);
  const totalPagesLista = Math.ceil(listaGastos.length / itemsPerPageLista);

  const getNombreMes = (mes) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes - 1];
  };

  return (
    <div className="inversores-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Proveedores y Egresos</h1>
          <p>Directorio de proveedores y reporte maestro de flujos de efectivo</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          
          <button 
             className="btn-view" 
             style={{ borderColor: '#2563eb', color: '#2563eb', fontWeight: 'bold' }}
             onClick={() => { setMesFiltro(new Date().getMonth() + 1); setAnioFiltro(new Date().getFullYear()); fetchReporteMaestro(); }}
          >
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
             Reporte de Egresos
          </button>

          <button 
             className="btn-view" 
             style={{ borderColor: '#8b5cf6', color: '#8b5cf6', fontWeight: 'bold', backgroundColor: '#f5f3ff' }}
             onClick={() => { setMesListaGastos(new Date().getMonth() + 1); setAnioListaGastos(new Date().getFullYear()); fetchListaGastos(); }}
          >
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px'}}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>
             </svg>
             Lista de Gastos
          </button>

          <input 
            type="file" 
            accept=".xlsx" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleImportExcel} 
          />
          <button 
             className="btn-view" 
             style={{ borderColor: 'var(--brand-green)', color: 'var(--brand-green)', fontWeight: 'bold' }}
             onClick={() => fileInputRef.current.click()}
             disabled={isLoading}
          >
             {isLoading ? 'Cargando...' : 'Importar Excel'}
          </button>
          
          <button className="btn-primary" onClick={openNewModal}>+ Agregar Proveedor</button>
        </div>
      </div>

      <div className="inversores-list-container fade-in-up" style={{ marginTop: '20px' }}>
        <div className="list-header">
            <h2>Catalogo de Proveedores</h2>
            <div className="search-bar" style={{ margin: 0, maxWidth: '350px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" placeholder="Buscar por nombre, RFC o Categoria..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>

        <div className="table-responsive">
            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{ width: '30%' }}>Razon Social</th>
                        <th style={{ width: '20%' }}>Contacto / Servicio</th>
                        <th style={{ width: '22%' }}>Datos de Pago</th>
                        <th style={{ width: '13%' }}>Estatus</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Acciones</th>
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
                                    <span style={{ color: 'var(--text-muted)' }}>{p.telefono || 'Sin telefono'}</span>
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
                                <button className={`badge-estatus-select ${p.estatus_activo ? 'badge-activo' : 'badge-inactivo'}`} onClick={() => cambiarEstatus(p.id, p.estatus_activo)} style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                                    {p.estatus_activo ? 'Vigente' : 'Suspendido'}
                                </button>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'nowrap' }}>
                                    <button className="btn-icon-edit" onClick={() => abrirPanelPagos(p)} title="Pagos y CXC">
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
                    <span className="page-info">Pagina {currentPage} de {totalPages}</span>
                    <button className="btn-page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente &raquo;</button>
                </div>
            )}
        </div>
      </div>

      {/* PANEL: LISTA DE GASTOS CON DISEÑO MEJORADO */}
      {panelListaGastosOpen && (
        <div className="modal-overlay" onClick={() => setPanelListaGastosOpen(false)}>
          <div className="master-panel fade-in-right" style={{ maxWidth: '1300px', width: '90vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            
            <div className="panel-header" style={{backgroundColor: '#f5f3ff', borderBottom: '1px solid #ddd6fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h2 style={{color: '#6d28d9'}}>Lista de Gastos</h2>
                <p className="client-badge" style={{backgroundColor: '#ede9fe', color: '#5b21b6'}}>
                  Pagos pendientes por mes - {getNombreMes(mesListaGastos)} {anioListaGastos}
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select className="custom-select" style={{ width: 'auto', minWidth: '120px' }} value={mesListaGastos} onChange={(e) => { setMesListaGastos(parseInt(e.target.value)); setCurrentPageLista(1); }}>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
                <select className="custom-select" style={{ width: 'auto' }} value={anioListaGastos} onChange={(e) => { setAnioListaGastos(parseInt(e.target.value)); setCurrentPageLista(1); }}>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                </select>
                <button className="btn-view" style={{ borderColor: '#6d28d9', color: '#6d28d9', padding: '6px 12px' }} onClick={fetchListaGastos}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px'}}><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Actualizar
                </button>
                <button className="btn-close" onClick={() => setPanelListaGastosOpen(false)}>×</button>
              </div>
            </div>
            
            <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f8fafc' }}>
                
                {/* Tarjetas de resumen */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ backgroundColor: '#fef3c7', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #f59e0b' }}>
                        <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 'bold' }}>TOTAL PENDIENTE DEL MES</span>
                        <div style={{ fontSize: '28px', color: '#d97706', fontWeight: '800', marginTop: '4px' }}>{formatMoney(resumenListaGastos.total_pendiente)}</div>
                        <span style={{ fontSize: '11px', color: '#92400e' }}>Pagos por vencer este mes</span>
                    </div>
                    <div style={{ backgroundColor: '#fce7f3', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #ec4899' }}>
                        <span style={{ fontSize: '13px', color: '#9d174d', fontWeight: 'bold' }}>GASTOS ARRASTRADOS</span>
                        <div style={{ fontSize: '28px', color: '#db2777', fontWeight: '800', marginTop: '4px' }}>{formatMoney(resumenListaGastos.total_arrastrado)}</div>
                        <span style={{ fontSize: '11px', color: '#9d174d' }}>Pagos pendientes de meses anteriores</span>
                    </div>
                </div>

                {/* Tabla rediseñada con mejor distribución */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ width: '15%', padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>FECHA / MES</th>
                                <th style={{ width: '15%', padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>TIPO / ORIGEN</th>
                                <th style={{ width: '25%', padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>PROVEEDOR</th>
                                <th style={{ width: '20%', padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>CONCEPTO</th>
                                <th style={{ width: '12%', padding: '14px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>MONTO</th>
                                <th style={{ width: '13%', padding: '14px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentListaGastos.length > 0 ? currentListaGastos.map((item, index) => {
                                const esArrastrado = item.mes_origen && item.mes_origen !== mesListaGastos;
                                
                                let statusColor = '';
                                let statusText = '';
                                let timeText = '';

                                if (item.fecha_recepcion) {
                                    const today = new Date();
                                    today.setHours(0,0,0,0);
                                    const target = new Date(item.fecha_recepcion);
                                    target.setHours(0,0,0,0);
                                    const diasRestantes = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

                                    if (diasRestantes > 5) {
                                        statusColor = '#059669';
                                        statusText = 'Pendiente';
                                    } else if (diasRestantes > 0 && diasRestantes <= 5) {
                                        statusColor = '#d97706';
                                        statusText = 'Por vencer';
                                        timeText = `Faltan ${diasRestantes} dias`;
                                    } else if (diasRestantes === 0) {
                                        statusColor = '#dc2626';
                                        statusText = 'Vence hoy';
                                    } else {
                                        statusColor = '#dc2626';
                                        statusText = 'Atrasado';
                                        timeText = `${Math.abs(diasRestantes)} dias`;
                                    }
                                }

                                return (
                                    <tr 
                                        key={index} 
                                        style={{ 
                                            borderBottom: '1px solid #f1f5f9',
                                            borderLeft: esArrastrado ? '4px solid #ec4899' : '4px solid transparent',
                                            backgroundColor: 'white'
                                        }}
                                    >
                                        {/* Columna Fecha - Stack vertical */}
                                        <td style={{ padding: '16px' }}>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#0f172a' }}>
                                                    {item.fecha_recepcion ? new Date(item.fecha_recepcion).toLocaleDateString('es-MX') : 'S/N'}
                                                </div>
                                                <div style={{ fontSize: '11px', color: esArrastrado ? '#db2777' : '#64748b', marginTop: '4px' }}>
                                                    {item.mes_origen && item.anio_origen 
                                                        ? `${getNombreMes(item.mes_origen)} ${item.anio_origen}`
                                                        : 'Mes actual'}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Columna Tipo/Origen */}
                                        <td style={{ padding: '16px' }}>
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '13px', color: '#334155' }}>{item.tipo_gasto || 'Otros'}</div>
                                                <div style={{ fontSize: '10px', color: item.origen_dato === 'FONDEADOR' ? '#2563eb' : '#8b5cf6', fontWeight: 'bold', marginTop: '4px' }}>
                                                    {item.origen_dato}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Columna Proveedor */}
                                        <td style={{ padding: '16px' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', color: '#0f172a' }}>{item.proveedor}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                                                    {statusText}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        {/* Columna Concepto */}
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontSize: '12px', color: '#475569' }}>{item.concepto}</div>
                                            {timeText && (
                                                <div style={{ fontSize: '10px', color: statusColor, marginTop: '4px', fontWeight: '500' }}>
                                                    {timeText}
                                                </div>
                                            )}
                                        </td>
                                        
                                        {/* Columna Monto - Alineado a la derecha */}
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px', whiteSpace: 'nowrap' }}>
                                                {formatMoney(item.monto)}
                                            </div>
                                        </td>
                                        
                                        {/* Columna Acciones */}
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                                {item.origen_dato === 'FONDEADOR' && item.estatus_pago !== 'PAGADO' && (
                                                    <button 
                                                        className="btn-view" 
                                                        style={{ borderColor: '#10b981', color: '#10b981', fontSize: '11px', padding: '4px 12px', cursor: 'pointer' }}
                                                        onClick={() => setPagoFondeadorModal({ 
                                                            isOpen: true, 
                                                            id_contrato: item.id_contrato, 
                                                            proveedor: item.proveedor, 
                                                            concepto: item.concepto, 
                                                            monto: item.monto 
                                                        })}
                                                    >
                                                        Pagar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                                        No hay gastos pendientes para este mes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Paginación */}
                    {totalPagesLista > 1 && (
                        <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button className="btn-page" onClick={() => setCurrentPageLista(prev => Math.max(prev - 1, 1))} disabled={currentPageLista === 1}>&laquo; Anterior</button>
                            <span style={{ alignSelf: 'center', fontSize: '13px', color: '#64748b' }}>Pagina {currentPageLista} de {totalPagesLista}</span>
                            <button className="btn-page" onClick={() => setCurrentPageLista(prev => Math.min(prev + 1, totalPagesLista))} disabled={currentPageLista === totalPagesLista}>Siguiente &raquo;</button>
                        </div>
                    )}
                </div>

                {/* Leyenda explicativa */}
                <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                    <strong>¿Como funciona la lista de gastos?</strong>
                    <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                        <li>Los pagos que no se liquidaron en el mes correspondiente se <strong style={{ color: '#db2777' }}>arrastran automaticamente</strong> al siguiente mes.</li>
                        <li>En la columna "FECHA / MES" puedes identificar si un gasto viene de meses anteriores (borde rosa).</li>
                        <li>Selecciona un mes especifico para ver solo los pagos que vencen en ese periodo.</li>
                        <li>Los pagos de Fondeadores pueden liquidarse directamente con el boton <strong style={{ color: '#10b981' }}>"Pagar"</strong>.</li>
                    </ul>
                </div>

            </div>
          </div>
        </div>
      )}

      {/* --- PANEL ANCHO: REPORTE MAESTRO DE EGRESOS --- */}
      {panelReporteOpen && (
        <div className="modal-overlay" onClick={() => setPanelReporteOpen(false)}>
          <div className="master-panel fade-in-right" style={{ maxWidth: '1100px', width: '90vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            
            <div className="panel-header" style={{backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h2 style={{color: '#1e40af'}}>Reporte Maestro de Egresos</h2>
                <p className="client-badge" style={{backgroundColor: '#dbeafe', color: '#1e3a8a'}}>Visualizacion de pagos operativos, inversores y vencimientos</p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select className="custom-select" style={{ width: 'auto', minWidth: '120px' }} value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
                <select className="custom-select" style={{ width: 'auto' }} value={anioFiltro} onChange={(e) => setAnioFiltro(e.target.value)}>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                </select>
                <button className="btn-close" onClick={() => setPanelReporteOpen(false)}>×</button>
              </div>
            </div>
            
            <div className="panel-body" style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f8fafc' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #f59e0b', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>PENDIENTE DE PAGO</span>
                        <div style={{ fontSize: '24px', color: '#d97706', fontWeight: '800', marginTop: '4px' }}>{formatMoney(resumenReporte.total_pendiente)}</div>
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #10b981', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>PAGADO</span>
                        <div style={{ fontSize: '24px', color: '#059669', fontWeight: '800', marginTop: '4px' }}>{formatMoney(resumenReporte.total_pagado)}</div>
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', borderLeft: '4px solid #3b82f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 'bold' }}>GRAN TOTAL DEL MES</span>
                        <div style={{ fontSize: '24px', color: '#1d4ed8', fontWeight: '900', marginTop: '4px' }}>{formatMoney(resumenReporte.gran_total)}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ width: '15%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>FECHA LIMITE</th>
                                <th style={{ width: '15%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>TIPO GASTO</th>
                                <th style={{ width: '25%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>PROVEEDOR</th>
                                <th style={{ width: '25%', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>CONCEPTO</th>
                                <th style={{ width: '10%', padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>MONTO</th>
                                <th style={{ width: '10%', padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>ESTATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentReportes.length > 0 ? currentReportes.map((fila, index) => {
                                const isPagado = fila.estatus_pago === 'PAGADO';
                                
                                let badgeBg = '#f1f5f9';
                                let badgeColor = '#64748b';
                                let statusText = fila.estatus_pago;
                                let timeText = '';

                                if (isPagado) {
                                    badgeBg = '#dcfce3'; 
                                    badgeColor = '#16a34a';
                                    statusText = 'Pagado';
                                } else if (fila.fecha_recepcion) {
                                    const today = new Date();
                                    today.setHours(0,0,0,0);
                                    const target = new Date(fila.fecha_recepcion);
                                    target.setHours(0,0,0,0);
                                    const diasRestantes = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

                                    if (diasRestantes > 5) {
                                        badgeBg = '#d1fae5'; badgeColor = '#059669'; statusText = 'Pendiente';
                                    } else if (diasRestantes > 0 && diasRestantes <= 5) {
                                        badgeBg = '#fef3c7'; badgeColor = '#d97706'; statusText = 'Por vencer';
                                        timeText = `Faltan ${diasRestantes} dias`;
                                    } else if (diasRestantes === 0) {
                                        badgeBg = '#fee2e2'; badgeColor = '#dc2626'; statusText = 'Vence hoy';
                                    } else {
                                        badgeBg = '#fee2e2'; badgeColor = '#dc2626'; statusText = 'Vencido';
                                        timeText = `Retraso ${Math.abs(diasRestantes)} dias`;
                                    }
                                }

                                return (
                                    <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: '500', color: '#475569' }}>
                                            {fila.fecha_recepcion ? new Date(fila.fecha_recepcion).toLocaleDateString('es-MX') : 'S/N'}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>{fila.tipo_gasto || 'Otros'}</span>
                                                <span style={{ fontSize: '10px', color: fila.origen_dato === 'FONDEADOR' ? '#2563eb' : '#8b5cf6', fontWeight: 'bold' }}>{fila.origen_dato}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>{fila.proveedor}</td>
                                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{fila.concepto}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatMoney(fila.monto)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: badgeBg, color: badgeColor, whiteSpace: 'nowrap' }}>
                                                    {statusText}
                                                </span>
                                                {!isPagado && timeText && (
                                                    <span style={{ fontSize: '10px', color: badgeColor, fontWeight: '500', whiteSpace: 'nowrap' }}>{timeText}</span>
                                                )}
                                                {!isPagado && fila.origen_dato === 'FONDEADOR' && (
                                                    <button 
                                                        className="btn-view" 
                                                        style={{ borderColor: '#10b981', color: '#10b981', fontSize: '10px', padding: '2px 8px', marginTop: '4px', cursor: 'pointer' }}
                                                        onClick={() => setPagoFondeadorModal({ isOpen: true, id_contrato: fila.id_contrato, proveedor: fila.proveedor, concepto: fila.concepto, monto: fila.monto })}
                                                    >
                                                        Pagar
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                                        No hay movimientos programados para este mes.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {totalPagesReporte > 1 && (
                        <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                            <button className="btn-page" onClick={() => setCurrentPageReporte(prev => Math.max(prev - 1, 1))} disabled={currentPageReporte === 1}>&laquo; Anterior</button>
                            <span style={{ alignSelf: 'center', fontSize: '13px', color: '#64748b' }}>Pagina {currentPageReporte} de {totalPagesReporte}</span>
                            <button className="btn-page" onClick={() => setCurrentPageReporte(prev => Math.min(prev + 1, totalPagesReporte))} disabled={currentPageReporte === totalPagesReporte}>Siguiente &raquo;</button>
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <tbody>
                                <tr>
                                    <td style={{ backgroundColor: '#93c5fd', padding: '8px', fontWeight: 'bold', width: '120px' }}>{new Date(anioFiltro, mesFiltro, 0).toLocaleDateString('es-MX')}</td>
                                    <td style={{ backgroundColor: '#bbf7d0', padding: '8px', fontWeight: 'bold' }}>PRESUPUESTO DE INGRESOS</td>
                                    <td style={{ backgroundColor: '#fca5a5', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>PRESUPUESTO DE GASTOS</td>
                                </tr>
                                <tr>
                                    <td style={{ backgroundColor: '#bfdbfe', padding: '8px' }}></td>
                                    <td style={{ backgroundColor: '#bfdbfe', padding: '8px', fontWeight: 'bold' }}>GASTOS PROYECTADOS</td>
                                    <td style={{ backgroundColor: '#fecaca', padding: '8px', textAlign: 'right' }}>{formatMoney(resumenReporte.gran_total)}</td>
                                </tr>
                                <tr>
                                    <td style={{ backgroundColor: '#bfdbfe', padding: '8px' }}></td>
                                    <td style={{ backgroundColor: '#bfdbfe', padding: '8px', fontWeight: 'bold' }}>GASTOS REALIZADOS "PAGADOS"</td>
                                    <td style={{ backgroundColor: '#fecaca', padding: '8px', textAlign: 'right' }}>{formatMoney(resumenReporte.total_pagado)}</td>
                                </tr>
                                <tr>
                                    <td style={{ backgroundColor: '#d1fae5', padding: '8px', fontWeight: 'bold' }}>{new Date(anioFiltro, mesFiltro, 0).toLocaleDateString('es-MX')}</td>
                                    <td style={{ backgroundColor: '#d1fae5', padding: '8px', fontWeight: 'bold' }}>TOTAL INGRESO</td>
                                    <td style={{ backgroundColor: '#a5f3fc', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                                        <input 
                                            type="number" 
                                            placeholder="Ingresa Presupuesto" 
                                            style={{width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontWeight: 'bold', outline: 'none'}}
                                            value={resumenReporte.presupuesto_ingreso || ''}
                                            onChange={(e) => setResumenReporte({...resumenReporte, presupuesto_ingreso: parseFloat(e.target.value) || 0})}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: '#9ca3af', color: 'black' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px' }}>Margen ingresos vs gastos</td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: '#991b1b', fontWeight: 'bold' }}>
                                        {formatMoney((resumenReporte.presupuesto_ingreso || 0) - resumenReporte.gran_total)}
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px' }}>Margen ingresos vs gastos pagados</td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: '#1e3a8a', fontWeight: 'bold' }}>
                                        {formatMoney((resumenReporte.presupuesto_ingreso || 0) - resumenReporte.total_pagado)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}>
                            <tbody>
                                {datosReporte.length > 0 ? Array.from(new Set(datosReporte.map(item => item.tipo_gasto || 'OTROS'))).map((categoria, idx) => {
                                    let bg = '#93c5fd'; 
                                    if(categoria.includes('ADMINISTRACION')) bg = '#bbf7d0'; 
                                    if(categoria.includes('CAPITAL')) bg = '#fef08a'; 
                                    if(categoria.includes('PASIVOS')) bg = '#fdba74'; 
                                    if(categoria.includes('INTERES')) bg = '#e879f9'; 

                                    const sumaCat = datosReporte.filter(d => d.tipo_gasto === categoria).reduce((s, item) => s + parseFloat(item.monto), 0);
                                    return (
                                        <tr key={idx}>
                                            <td style={{ backgroundColor: bg, padding: '6px 12px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{categoria}</td>
                                            <td style={{ padding: '6px 12px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(sumaCat)}</td>
                                        </tr>
                                    )
                                }) : (
                                    <tr><td colSpan="2" style={{padding: '10px', textAlign: 'center'}}>Sin datos</td></tr>
                                )}
                                <tr>
                                    <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1' }}>TOTAL</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatMoney(resumenReporte.gran_total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal Pago Rápido de Fondeadores */}
      {pagoFondeadorModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 1050 }}>
          <div className="modal-content fade-in-down" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Registrar Pago a Fondeador</h2>
              <button className="btn-close" onClick={() => setPagoFondeadorModal({ isOpen: false, id_contrato: null, proveedor: '', concepto: '', monto: '' })}>×</button>
            </div>
            <form onSubmit={handlePagarFondeador} className="modal-form" style={{ padding: '24px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Estas a punto de registrar el pago de rendimiento para: <br/>
                    <strong style={{ color: 'var(--text-main)' }}>{pagoFondeadorModal.proveedor}</strong>
                </p>
                <div className="form-group">
                    <label>Concepto</label>
                    <input type="text" value={pagoFondeadorModal.concepto} readOnly disabled className="form-input-disabled" style={{ backgroundColor: '#f1f5f9' }} />
                </div>
                <div className="form-group">
                    <label>Monto a Pagar (MXN)</label>
                    <input type="text" value={formatMoney(pagoFondeadorModal.monto)} readOnly disabled className="form-input-disabled" style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#dc2626' }} />
                </div>
                <div className="form-group">
                    <label>Comprobante de Transferencia (Opcional)</label>
                    <input type="file" className="file-input" onChange={e => setFileFondeador(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button type="button" className="btn-cancel" onClick={() => setPagoFondeadorModal({ isOpen: false, id_contrato: null, proveedor: '', concepto: '', monto: '' })}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Registrando...' : 'Confirmar Pago'}</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Panel de Historial del Proveedor */}
      {panelOpen && provActivo && (
        <div className="modal-overlay" onClick={() => setPanelOpen(false)}>
          <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div>
                <h2>Cuentas por Pagar</h2>
                <p className="client-badge" style={{backgroundColor: '#e0f2fe', color: '#1e40af'}}>{provActivo.nombre || 'SIN NOMBRE'}</p>
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
                    <div className="movimientos-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {pagos.map(pago => {
                        let estatusColor = '#64748b'; 
                        let estatusBg = '#f1f5f9';
                        if (pago.estatus === 'PENDIENTE_VALIDACION' || pago.estatus === 'PENDIENTE') { estatusColor = '#d97706'; estatusBg = '#fef3c7'; }
                        if (pago.estatus === 'PENDIENTE_AUTORIZACION') { estatusColor = '#2563eb'; estatusBg = '#dbeafe'; }
                        if (pago.estatus === 'AUTORIZADO' || pago.estatus === 'PAGADO') { estatusColor = '#16a34a'; estatusBg = '#dcfce3'; }
                        if (pago.estatus === 'RECHAZADO') { estatusColor = '#ef4444'; estatusBg = '#fef2f2'; }

                        const rolUsuario = localStorage.getItem('rol'); 

                        return (
                          <div className="movimiento-item" key={pago.id} style={{ 
                              borderLeft: `4px solid ${estatusColor}`,
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              padding: '16px', 
                              backgroundColor: 'white', 
                              borderRadius: '8px', 
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              gap: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                <div className="mov-icon" style={{
                                    backgroundColor: estatusBg, color: estatusColor,
                                    minWidth: '42px', height: '42px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                                </div>
                                
                                <div className="mov-detalles" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{pago.concepto}</strong>
                                      {pago.origen_movimiento === 'SOLICITUD DE RECURSO' && (
                                          <span style={{ fontSize: '9px', backgroundColor: '#e0e7ff', color: '#1d4ed8', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #bfdbfe', letterSpacing: '0.5px' }}>SOLICITUD UNIVERSAL</span>
                                      )}
                                      {pago.origen_movimiento === 'PAGO DIRECTO' && (
                                          <span style={{ fontSize: '9px', backgroundColor: '#f3e8ff', color: '#6d28d9', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid #ddd6fe', letterSpacing: '0.5px' }}>PAGO RÁPIDO</span>
                                      )}
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>Factura: {pago.num_factura_ref || 'S/N'} • {new Date(pago.fecha_solicitud || pago.fecha_creacion).toLocaleDateString()}</span>
                                  <span style={{
                                    fontSize: '11px', color: estatusColor, backgroundColor: estatusBg, 
                                    padding: '4px 10px', borderRadius: '12px', width: 'fit-content', fontWeight: '800', marginTop: '2px'
                                  }}>
                                    {pago.estatus ? pago.estatus.replace(/_/g, ' ') : 'PENDIENTE VALIDACION'}
                                  </span>
                                </div>
                            </div>

                            <div className="mov-monto-accion" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                              <span className="mov-monto" style={{
                                  color: (pago.estatus === 'AUTORIZADO' || pago.estatus === 'PAGADO') ? '#ef4444' : '#64748b',
                                  fontSize: '16px', fontWeight: 'bold'
                              }}>
                                {pago.estatus === 'RECHAZADO' ? '$0.00' : `-${formatMoney(pago.monto_pago)}`}
                              </span>
                              
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {(pago.estatus === 'PENDIENTE_VALIDACION' || pago.estatus === 'PENDIENTE') && (rolUsuario === 'CONTADOR' || rolUsuario === 'ADMIN') && (
                                  <button className="btn-view" style={{ borderColor: '#d97706', color: '#d97706', padding: '4px 10px', fontSize: '12px' }} onClick={() => avanzarWorkflowPago(pago.id, 'VALIDAR')} title="Validar Factura">
                                    Validar
                                  </button>
                                )}
                                
                                {pago.estatus === 'PENDIENTE_AUTORIZACION' && rolUsuario === 'ADMIN' && (
                                  <button className="btn-view" style={{ borderColor: '#2563eb', color: '#2563eb', padding: '4px 10px', fontSize: '12px' }} onClick={() => avanzarWorkflowPago(pago.id, 'AUTORIZAR')} title="Autorizar Pago">
                                    Autorizar
                                  </button>
                                )}

                                {pago.estatus !== 'AUTORIZADO' && pago.estatus !== 'PAGADO' && pago.estatus !== 'RECHAZADO' && (rolUsuario === 'CONTADOR' || rolUsuario === 'ADMIN') && (
                                  <button className="btn-view" style={{ borderColor: '#ef4444', color: '#ef4444', padding: '4px 10px', fontSize: '12px' }} onClick={() => avanzarWorkflowPago(pago.id, 'RECHAZAR')} title="Rechazar Pago">
                                    ✕
                                  </button>
                                )}

                                {pago.url_comprobante_pago && ( 
                                  <a href={`http://localhost:3001/${pago.url_comprobante_pago}`} target="_blank" rel="noreferrer" className="btn-view" style={{ padding: '4px 10px', fontSize: '12px' }} title="Ver Factura/XML">Doc</a> 
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

                  <div className="modal-footer" style={{marginTop: '24px', padding: '0', border: 'none', backgroundColor: 'transparent'}}>
                    <button type="button" className="btn-cancel" onClick={() => setShowNuevoPago(false)}>Cancelar</button>
                    <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Registrando...' : 'Registrar Salida de Dinero'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar/Editar Proveedor */}
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
                <div className="form-group"><label>Razon Social / Nombre Completo</label><input type="text" required value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} /></div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Entidad</label>
                    <select className="custom-select" value={formData.tipo_persona} onChange={(e) => { setFormData({...formData, tipo_persona: e.target.value, rfc: ''}); setFormError(''); }}>
                      <option value="MORAL">Persona Moral (Empresa)</option>
                      <option value="FISICA">Persona Fisica</option>
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
                    <label>Categoria de Servicio</label>
                    <select className="custom-select" value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})}>
                      <option value="EQUIPO_TRANSPORTE">Equipo de Transporte</option>
                      <option value="LIMPIEZA">Limpieza</option>
                      <option value="SEGUROS_VEHICULOS">Seguros de Vehiculos</option>
                      <option value="SEGUROS_EMPRESARIALES">Seguros Empresariales</option>
                      <option value="INTERESES_CREDITOS">Intereses de Creditos</option>
                      <option value="MANTENIMIENTO">Mantenimiento</option>
                      <option value="ACCESORIOS_COMPUTO">Accesorios de Computo</option>
                      <option value="EQUIPO_COMPUTO">Equipo de Computo</option>
                      <option value="ADQUISICION_MOBILIARIO">Adquisicion de Mobiliario</option>
                      <option value="INSUMOS">Insumos y Papeleria</option>
                      <option value="OTROS">Otro General</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Telefono de Contacto</label>
                    <input type="text" maxLength="10" placeholder="10 digitos" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value.replace(/[^0-9]/g, '')})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Correo Electronico</label><input type="email" placeholder="Opcional" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
                  <div className="form-group"><label>Direccion Fiscal</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} /></div>
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
                    <label>Numero de Cuenta</label>
                    <input type="text" maxLength="10" placeholder="10 digitos" value={formData.numero_cuenta} onChange={(e) => setFormData({...formData, numero_cuenta: e.target.value.replace(/[^0-9]/g, '')})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>CLABE Interbancaria (Opcional)</label>
                    <input type="text" maxLength="18" placeholder="18 digitos" value={formData.clabe_bancaria} onChange={(e) => setFormData({...formData, clabe_bancaria: e.target.value.replace(/[^0-9]/g, '')})} />
                  </div>
                  <div className="form-group">
                    <label>Dias de Credito Otorgados</label>
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

      {confirmModal.isOpen && (
        <div className="modal-overlay" style={{zIndex: 2000}}>
          <div className="confirm-modal-content fade-in-up">
            <div className="confirm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
            <h3>{confirmModal.title}</h3><p>{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancelar</button>
              <button className="btn-confirm-delete" onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}>Si, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Proveedores;