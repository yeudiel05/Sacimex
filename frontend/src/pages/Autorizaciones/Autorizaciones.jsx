import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Autorizaciones.css'; 

function Autorizaciones() {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const rolUsuario = (localStorage.getItem('rol') || '').trim().toUpperCase();

  // 1. DETERMINAR LA PESTAÑA INICIAL
  const getInitialTab = () => {
    if (!['ADMIN', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA'].includes(rolUsuario)) return 'VALIDAR';
    if (rolUsuario === 'REVISOR') return 'VALIDAR';
    if (rolUsuario.startsWith('AUTORIZADOR')) return 'AUTORIZAR';
    if (rolUsuario === 'TESORERIA') return 'POR_PAGAR';
    return 'VALIDAR'; 
  };

  const [activeTab, setActiveTab] = useState(getInitialTab()); 
  const [busqueda, setBusqueda] = useState('');
  const [filtroHistorial, setFiltroHistorial] = useState('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [modalConfig, setModalConfig] = useState({ isOpen: false, tipo: '', id_solicitud: null, folio: '' });
  const [comentario, setComentario] = useState('');
  const [archivoFirma, setArchivoFirma] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) { localStorage.clear(); navigate('/'); return true; }
    return false;
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const fetchSolicitudes = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/solicitudes/pendientes', { headers });
      if (handleAuthError(res.status)) return;
      const data = await res.json();
      if (data.success) {
          const resHistorial = await fetch('http://localhost:3001/api/solicitudes/', { headers });
          const dataHistorial = await resHistorial.json();
          
          const todas = [...data.data, ...(dataHistorial.success ? dataHistorial.data.filter(s => s.estatus === 'PAGADO' || s.estatus === 'RECHAZADO') : [])];
          const unicas = Array.from(new Map(todas.map(item => [item.id, item])).values());
          setSolicitudes(unicas);
      }
    } catch (error) { 
      console.error("Error al cargar solicitudes:", error); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchSolicitudes(); }, []);
  useEffect(() => { setCurrentPage(1); }, [activeTab, busqueda, filtroHistorial]);

  const verPDFSeguro = async (id_solicitud) => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const response = await fetch(`http://localhost:3001/api/solicitudes/${id_solicitud}/pdf`, { method: 'GET', headers: headers });
      if (handleAuthError(response.status)) return;
      if (!response.ok) throw new Error("Error al obtener el PDF");
      const blob = await response.blob();
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 10000);
    } catch (error) { console.error(error); alert("Error al intentar abrir el documento PDF."); }
  };

  const abrirModal = (tipo, id_solicitud, folio) => {
    setComentario(''); setArchivoFirma(null); setModalConfig({ isOpen: true, tipo, id_solicitud, folio });
  };

  const cerrarModal = () => {
    setModalConfig({ isOpen: false, tipo: '', id_solicitud: null, folio: '' }); setComentario(''); setArchivoFirma(null);
  };

  const ejecutarAccion = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    setIsProcessing(true);

    try {
      let res;
      if (modalConfig.tipo === 'PAGAR') {
        if (!archivoFirma) { setIsProcessing(false); return alert("Debes adjuntar el comprobante de pago bancario."); }
        const formData = new FormData(); formData.append('comprobante', archivoFirma);
        res = await fetch(`http://localhost:3001/api/solicitudes/comprobante/${modalConfig.id_solicitud}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      } else {
        if (modalConfig.tipo === 'RECHAZAR' && !comentario.trim()) { setIsProcessing(false); return alert("Debes ingresar un motivo para el rechazo."); }
        const endpoint = modalConfig.tipo === 'RECHAZAR' ? `http://localhost:3001/api/solicitudes/rechazar/${modalConfig.id_solicitud}` : `http://localhost:3001/api/solicitudes/autorizar/${modalConfig.id_solicitud}`;
        const payload = modalConfig.tipo === 'RECHAZAR' ? { motivo: comentario } : { comentario: comentario || 'Aprobado' };
        res = await fetch(endpoint, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (data.success) { cerrarModal(); fetchSolicitudes(); } else { alert(data.message || "Error al procesar la solicitud."); }
    } catch (error) { console.error(error); alert('Error de conexión con el servidor.'); } finally { setIsProcessing(false); }
  };

  // 2. REGLAS DE ACCESO (Ahora confiamos 100% en el Backend)
  const esAdmin = rolUsuario === 'ADMIN';
  const esRevisor = rolUsuario === 'REVISOR';
  const esAutorizador = rolUsuario.startsWith('AUTORIZADOR');
  const esTesoreria = rolUsuario === 'TESORERIA';

  // 3. FILTRADO EXTREMADAMENTE SENCILLO (La Verdad Absoluta)
  const porValidar = solicitudes.filter(s => s.me_toca_firmar && (s.estatus === 'PENDIENTE_VOBO' || s.estatus === 'PENDIENTE'));
  const porAutorizar = solicitudes.filter(s => s.me_toca_firmar && (s.estatus === 'AUTORIZADO_1' || s.estatus === 'AUTORIZADO_2' || s.estatus === 'AUTORIZADO_3'));
  const porPagar = solicitudes.filter(s => s.me_toca_firmar && s.estatus === 'AUTORIZADO_FINAL'); 
  const historial = solicitudes.filter(s => s.estatus === 'PAGADO' || s.estatus === 'RECHAZADO');

  // Si el backend dijo "te toca firmar" en el filtro de Validación, mostramos la tarjeta
  const puedeValidar = esAdmin || esRevisor || porValidar.length > 0;
  const puedeAutorizar = esAdmin || esAutorizador;
  const puedePagar = esAdmin || esTesoreria;

  let listaBase = [];
  if (activeTab === 'VALIDAR') listaBase = porValidar;
  else if (activeTab === 'AUTORIZAR') listaBase = porAutorizar;
  else if (activeTab === 'POR_PAGAR') listaBase = porPagar;
  else { listaBase = filtroHistorial === 'TODOS' ? historial : historial.filter(s => s.estatus === filtroHistorial); }

  const listaActual = listaBase.filter(s => {
    if (!busqueda) return true;
    const termino = busqueda.toLowerCase();
    return ((s.folio && s.folio.toLowerCase().includes(termino)) || (s.solicitante_nombre && s.solicitante_nombre.toLowerCase().includes(termino)) || (s.unidad_negocio && s.unidad_negocio.toLowerCase().includes(termino)));
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = listaActual.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(listaActual.length / itemsPerPage);

  const totalMontoValidar = porValidar.reduce((acc, s) => acc + parseFloat(s.monto || 0), 0);
  const totalMontoAutorizar = porAutorizar.reduce((acc, s) => acc + parseFloat(s.monto || 0), 0);
  const totalMontoPorPagar = porPagar.reduce((acc, s) => acc + parseFloat(s.monto || 0), 0);

  const getModalUI = (tipo) => {
    switch(tipo) {
      case 'VALIDAR': return { color: '#d97706', btnText: 'Firmar Validación', title: 'Validar Solicitud' };
      case 'AUTORIZAR': return { color: '#2563eb', btnText: 'Firmar Autorización', title: `Autorizar Solicitud (${rolUsuario})` };
      case 'PAGAR': return { color: '#059669', btnText: 'Subir y Marcar Pagado', title: 'Liquidar Solicitud' };
      case 'RECHAZAR': return { color: '#dc2626', btnText: 'Confirmar Rechazo', title: 'Rechazar Solicitud' };
      default: return { color: '#000', btnText: 'Confirmar', title: 'Procesar' };
    }
  };
  const modalUI = getModalUI(modalConfig.tipo);

  const LeyendaFirma = ({ estatus, areaVobo }) => {
      let texto = ""; let colorBg = "#f1f5f9"; let colorText = "#475569";
      if (estatus === 'PENDIENTE_VOBO') { texto = `Falta VoBo: ${areaVobo || 'Área Solicitada'}`; colorBg = '#fef3c7'; colorText = '#d97706'; } 
      else if (estatus === 'PENDIENTE') { texto = "Falta: REVISOR"; colorBg = '#ffedd5'; colorText = '#dc2626'; } 
      else if (estatus === 'AUTORIZADO_1') { texto = "Falta: AUTORIZADOR 1"; colorBg = '#dbeafe'; colorText = '#2563eb'; } 
      else if (estatus === 'AUTORIZADO_2') { texto = "Falta: AUTORIZADOR 2"; colorBg = '#e0e7ff'; colorText = '#4338ca'; } 
      else if (estatus === 'AUTORIZADO_FINAL') { texto = "Listo para Pago"; colorBg = '#dcfce3'; colorText = '#059669'; }
      if(!texto) return null;
      return (<div style={{ marginTop: '6px' }}><span style={{ backgroundColor: colorBg, color: colorText, fontSize: '10px', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{texto}</span></div>);
  };

  return (
    <div className="autorizar-container" style={{ paddingTop: '0px' }}>
      
      {/* TARJETAS DE MÉTRICAS CONDICIONALES */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: '0px' }}>
        
        {puedeValidar && (
          <div className="metric-card warning" onClick={() => setActiveTab('VALIDAR')} style={{cursor: 'pointer', border: activeTab === 'VALIDAR' ? '2px solid #d97706' : '1px solid transparent'}}>
            <div className="metric-data">
              <span>{esRevisor ? '1. Por Revisar' : 'Visto Bueno Solicitado'}</span>
              <h3>{porValidar.length} <span>({formatMoney(totalMontoValidar)})</span></h3>
            </div>
          </div>
        )}
        
        {puedeAutorizar && (
          <div className="metric-card primary" onClick={() => setActiveTab('AUTORIZAR')} style={{cursor: 'pointer', border: activeTab === 'AUTORIZAR' ? '2px solid #2563eb' : '1px solid transparent'}}>
            <div className="metric-data">
              <span>{esAdmin ? '2. Por Autorizar' : 'Bandeja de Firma'}</span>
              <h3>{porAutorizar.length} <span>({formatMoney(totalMontoAutorizar)})</span></h3>
            </div>
          </div>
        )}

        {puedePagar && (
          <div className="metric-card success" onClick={() => setActiveTab('POR_PAGAR')} style={{cursor: 'pointer', border: activeTab === 'POR_PAGAR' ? '2px solid #059669' : '1px solid transparent', backgroundColor: '#ecfdf5'}}>
            <div className="metric-data">
              <span style={{ color: '#059669' }}>3. Por Pagar (Tesor.)</span>
              <h3 style={{ color: '#047857' }}>{porPagar.length} <span>({formatMoney(totalMontoPorPagar)})</span></h3>
            </div>
          </div>
        )}

        <div className="metric-card" onClick={() => setActiveTab('HISTORIAL')} style={{cursor: 'pointer', border: activeTab === 'HISTORIAL' ? '2px solid #64748b' : '1px solid transparent', backgroundColor: '#f8fafc'}}>
          <div className="metric-data">
            <span>Historial (Mis Firmas)</span>
            <h3>{historial.length} <span>registros</span></h3>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="table-responsive" style={{ marginTop: '24px' }}>
        <div className="list-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
            {activeTab === 'VALIDAR' ? (esRevisor ? 'Bandeja de Validación (Revisor)' : `Bandeja de Visto Bueno`) : 
             activeTab === 'AUTORIZAR' ? `Bandeja de Autorizaciones (${esAdmin ? 'Niveles 1, 2 y 3' : rolUsuario})` : 
             activeTab === 'POR_PAGAR' ? 'Pendientes de Liquidación' : 'Historial General'}
          </h2>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar folio o nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '200px', fontSize: '13px' }} />
            {activeTab === 'HISTORIAL' && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setFiltroHistorial('TODOS')} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', cursor: 'pointer', background: filtroHistorial === 'TODOS' ? '#e2e8f0' : '#fff' }}>Todos</button>
                <button onClick={() => setFiltroHistorial('PAGADO')} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #10b981', color: '#10b981', fontSize: '12px', cursor: 'pointer', background: filtroHistorial === 'PAGADO' ? '#d1fae5' : '#fff' }}>Pagados</button>
                <button onClick={() => setFiltroHistorial('RECHAZADO')} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ef4444', color: '#ef4444', fontSize: '12px', cursor: 'pointer', background: filtroHistorial === 'RECHAZADO' ? '#fee2e2' : '#fff' }}>Rechazados</button>
              </div>
            )}
            <button className="btn-secondary" onClick={fetchSolicitudes} disabled={isLoading} style={{ padding: '6px 12px', fontSize: '13px' }}>Refrescar</button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Folio / Fecha</th>
              <th style={{ width: '25%' }}>Solicitante / Estado</th>
              <th style={{ width: '20%' }}>Unidad de Negocio</th>
              <th style={{ width: '15%' }}>Monto</th>
              <th style={{ width: '25%', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && currentItems.length === 0 ? (
              <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px'}}>Cargando solicitudes...</td></tr>
            ) : currentItems.length > 0 ? (
              currentItems.map(sol => (
                <tr key={sol.id}>
                  <td>
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: '13px' }}>{sol.folio}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(sol.fecha_solicitud).toLocaleDateString('es-MX')}</span>
                  </td>
                  <td>
                      <span style={{ display: 'block', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>{sol.solicitante_nombre}</span>
                      {activeTab !== 'HISTORIAL' && <LeyendaFirma estatus={sol.estatus} areaVobo={sol.area_visto_bueno} />}
                  </td>
                  <td><span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', color: '#475569', fontWeight: '600' }}>{sol.unidad_negocio || 'Corporativo'}</span></td>
                  <td>
                    <strong style={{ fontSize: '15px', color: sol.estatus === 'RECHAZADO' ? '#94a3b8' : '#0f172a' }}>{formatMoney(sol.monto)}</strong>
                    {sol.estatus === 'RECHAZADO' && <span style={{display: 'block', fontSize: '11px', color: '#ef4444', fontWeight: '700'}}>RECHAZADO</span>}
                    {sol.estatus === 'PAGADO' && <span style={{display: 'block', fontSize: '11px', color: '#10b981', fontWeight: '700'}}>PAGADO</span>}
                  </td>
                  
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                      
                      {/* BOTÓN NUEVO: VER COTIZACIÓN ADJUNTA */}
                      {sol.cotizacion_path && (
                          <a href={`http://localhost:3001/${sol.cotizacion_path}`} target="_blank" rel="noreferrer" className="btn-view" style={{ borderColor: '#3b82f6', color: '#3b82f6', backgroundColor: '#eff6ff', textDecoration: 'none' }} title="Ver Cotización/Soporte Adjunto">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '14px', marginRight: '4px' }}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                              Cotización
                          </a>
                      )}

                      <button onClick={() => verPDFSeguro(sol.id)} className="btn-view" style={{borderColor: '#cbd5e1', color: '#475569', backgroundColor: 'transparent', cursor: 'pointer'}}>Ver PDF</button>

                      {activeTab === 'VALIDAR' && sol.me_toca_firmar && (
                        <>
                          <button className="btn-view" onClick={() => abrirModal('RECHAZAR', sol.id, sol.folio)} style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: '#fef2f2' }}>✕</button>
                          <button className="btn-view" onClick={() => abrirModal('VALIDAR', sol.id, sol.folio)} style={{ borderColor: '#d97706', color: '#d97706', backgroundColor: '#fef3c7', fontWeight: 'bold' }}>Firmar</button>
                        </>
                      )}

                      {activeTab === 'AUTORIZAR' && sol.me_toca_firmar && (
                        <>
                          <button className="btn-view" onClick={() => abrirModal('RECHAZAR', sol.id, sol.folio)} style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: '#fef2f2' }}>✕</button>
                          <button className="btn-view" onClick={() => abrirModal('AUTORIZAR', sol.id, sol.folio)} style={{ borderColor: '#2563eb', color: '#ffffff', backgroundColor: '#2563eb', fontWeight: 'bold' }}>Autorizar</button>
                        </>
                      )}

                      {activeTab === 'POR_PAGAR' && sol.me_toca_firmar && (
                        <button className="btn-view" onClick={() => abrirModal('PAGAR', sol.id, sol.folio)} style={{ borderColor: '#059669', color: '#ffffff', backgroundColor: '#059669', fontWeight: 'bold' }}>Liquidar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No hay registros en esta sección.</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
            <div className="pagination-container">
                <button className="btn-page" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>&laquo; Ant</button>
                <span className="page-info">Pág {currentPage} de {totalPages}</span>
                <button className="btn-page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Sig &raquo;</button>
            </div>
        )}
      </div>

      {modalConfig.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', color: modalUI.color }}>{modalUI.title}</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#64748b' }}>Folio: <strong>{modalConfig.folio}</strong></p>
            <form onSubmit={ejecutarAccion}>
              {modalConfig.tipo === 'PAGAR' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Comprobante Bancario (Obligatorio)</label>
                  <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setArchivoFirma(e.target.files[0])} required style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{modalConfig.tipo === 'RECHAZAR' ? 'Motivo de Rechazo' : 'Comentarios (Opcional)'}</label>
                  <textarea rows="3" required={modalConfig.tipo === 'RECHAZAR'} value={comentario} onChange={(e) => setComentario(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={isProcessing} style={{ padding: '8px 16px', backgroundColor: modalUI.color, border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>{isProcessing ? 'Procesando...' : modalUI.btnText}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Autorizaciones;