import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Autorizaciones.css';

function Autorizaciones() {
  const navigate = useNavigate();
  const [pagos, setPagos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('VALIDAR'); // VALIDAR, AUTORIZAR, HISTORIAL

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15; // Muestra 15 solicitudes por página

  const rolUsuario = localStorage.getItem('rol') || 'USER';

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

  const fetchPagosPendientes = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/proveedores/autorizaciones/pendientes', { headers });
      if (handleAuthError(res.status)) return;
      const data = await res.json();
      if (data.success) setPagos(data.data);
    } catch (error) { 
      console.error("Error al cargar pagos:", error); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPagosPendientes(); }, []);

  // Resetea la página a 1 cuando cambias de pestaña
  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  // Usamos el nuevo flujo de 3 niveles del backend
  const procesarPago = async (id_pago, accion) => {
    if (!window.confirm(`¿Estás seguro de ${accion.toLowerCase()} esta solicitud de pago?`)) return;
    
    const headers = getAuthHeaders();
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/proveedores/pagos/${id_pago}/autorizacion`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion })
      });
      const data = await res.json();
      if (data.success) {
        fetchPagosPendientes(); // Recargamos la lista
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error(error); alert('Error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const descargarSolicitud = async (id_pago) => {
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/proveedores/autorizaciones/${id_pago}/pdf`, { headers });
      if (handleAuthError(response.status)) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; 
      link.download = `Solicitud_Recursos_Folio_${id_pago.toString().padStart(4, '0')}.pdf`; 
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
    } catch (error) { 
      alert("Error al generar el documento."); 
    } finally {
      setIsLoading(false);
    }
  };

  // Filtros por pestaña
  const pagosPorValidar = pagos.filter(p => p.estatus === 'PENDIENTE_VALIDACION' || p.estatus === 'PENDIENTE');
  const pagosPorAutorizar = pagos.filter(p => p.estatus === 'PENDIENTE_AUTORIZACION');
  const pagosHistorial = pagos.filter(p => p.estatus === 'PAGADO' || p.estatus === 'RECHAZADO' || p.estatus === 'AUTORIZADO');

  const listaActual = activeTab === 'VALIDAR' ? pagosPorValidar : activeTab === 'AUTORIZAR' ? pagosPorAutorizar : pagosHistorial;

  // Cálculo de Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = listaActual.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(listaActual.length / itemsPerPage);

  // Cálculo de métricas
  const totalMontoValidar = pagosPorValidar.reduce((acc, p) => acc + parseFloat(p.monto_pago), 0);
  const totalMontoAutorizar = pagosPorAutorizar.reduce((acc, p) => acc + parseFloat(p.monto_pago), 0);

  return (
    <div className="autorizar-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Centro de Autorizaciones</h1>
          <p>Firma digital para liberar pagos y transferencias a proveedores</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={fetchPagosPendientes} disabled={isLoading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', marginRight: '6px'}}><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Refrescar
          </button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS (TABS) */}
      <div className="metrics-grid stagger-2 fade-in-up">
        <div className="metric-card warning" onClick={() => setActiveTab('VALIDAR')} style={{cursor: 'pointer', border: activeTab === 'VALIDAR' ? '2px solid #d97706' : '1px solid transparent'}}>
          <div className="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
          <div className="metric-data">
            <span>Requieren Validación</span>
            <h3>{pagosPorValidar.length} <span>({formatMoney(totalMontoValidar)})</span></h3>
          </div>
        </div>
        <div className="metric-card primary" onClick={() => setActiveTab('AUTORIZAR')} style={{cursor: 'pointer', border: activeTab === 'AUTORIZAR' ? '2px solid #2563eb' : '1px solid transparent'}}>
          <div className="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg></div>
          <div className="metric-data">
            <span>Requieren Autorización</span>
            <h3>{pagosPorAutorizar.length} <span>({formatMoney(totalMontoAutorizar)})</span></h3>
          </div>
        </div>
        <div className="metric-card success" onClick={() => setActiveTab('HISTORIAL')} style={{cursor: 'pointer', border: activeTab === 'HISTORIAL' ? '2px solid #10b981' : '1px solid transparent'}}>
          <div className="metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
          <div className="metric-data">
            <span>Historial Reciente</span>
            <h3>{pagosHistorial.length} <span>solicitudes</span></h3>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL PAGINADA */}
      <div className="table-responsive stagger-3 fade-in-up" style={{ marginTop: '24px' }}>
        <div className="list-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
          <h2>
            {activeTab === 'VALIDAR' ? 'Bandeja de Validación (Nivel 1)' : 
             activeTab === 'AUTORIZAR' ? 'Bandeja de Autorización Final (Nivel 2)' : 
             'Historial de Solicitudes Procesadas'}
          </h2>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '8%' }}>Folio</th>
              <th style={{ width: '20%' }}>Solicitante / Fecha</th>
              <th style={{ width: '22%' }}>Proveedor Destino</th>
              <th style={{ width: '20%' }}>Concepto / Factura</th>
              <th style={{ width: '12%' }}>Monto</th>
              <th style={{ width: '18%', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && currentItems.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px'}}>Cargando...</td></tr>
            ) : currentItems.length > 0 ? (
              currentItems.map(pago => (
                <tr key={pago.id}>
                  <td><strong>#{pago.id.toString().padStart(4, '0')}</strong></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>{pago.solicitante}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(pago.fecha_solicitud || pago.fecha_creacion).toLocaleString('es-MX', {dateStyle: 'short', timeStyle: 'short'})}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ color: 'var(--brand-green)', fontSize: '13px' }}>{pago.proveedor || 'N/D'}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {pago.banco || 'Banco N/D'} • Cta: {pago.numero_cuenta || pago.clabe_bancaria || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>{pago.concepto}</span>
                      {pago.num_factura_ref && <span style={{ fontSize: '11px', color: '#64748b' }}>Ref: {pago.num_factura_ref}</span>}
                    </div>
                  </td>
                  <td>
                    <strong style={{ fontSize: '15px', color: pago.estatus === 'RECHAZADO' ? 'var(--text-muted)' : 'var(--text-main)' }}>
                      {formatMoney(pago.monto_pago)}
                    </strong>
                    {pago.estatus === 'RECHAZADO' && <span style={{display: 'block', fontSize: '11px', color: '#ef4444', fontWeight: '700'}}>RECHAZADO</span>}
                    {pago.estatus === 'PAGADO' && <span style={{display: 'block', fontSize: '11px', color: '#10b981', fontWeight: '700'}}>PAGADO</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                      
                      {pago.url_comprobante_pago && (
                        <a href={`http://localhost:3001/${pago.url_comprobante_pago}`} target="_blank" rel="noreferrer" className="btn-view" title="Ver Factura Ajunta" style={{borderColor: '#64748b', color: '#64748b'}}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </a>
                      )}

                      <button className="btn-view" onClick={() => descargarSolicitud(pago.id)} title="Descargar PDF" style={{borderColor: '#64748b', color: '#64748b'}}>
                        PDF
                      </button>

                      {/* BOTONES DE VALIDACIÓN (Nivel 1) */}
                      {activeTab === 'VALIDAR' && (rolUsuario === 'ADMIN' || rolUsuario === 'CONTADOR') && (
                        <>
                          <button className="btn-view" onClick={() => procesarPago(pago.id, 'RECHAZAR')} style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: '#fef2f2' }} title="Rechazar">✕</button>
                          <button className="btn-view" onClick={() => procesarPago(pago.id, 'VALIDAR')} style={{ borderColor: '#d97706', color: '#d97706', backgroundColor: '#fef3c7', fontWeight: 'bold' }}>Validar</button>
                        </>
                      )}

                      {/* BOTONES DE AUTORIZACIÓN (Nivel 2) */}
                      {activeTab === 'AUTORIZAR' && rolUsuario === 'ADMIN' && (
                        <>
                          <button className="btn-view" onClick={() => procesarPago(pago.id, 'RECHAZAR')} style={{ borderColor: '#ef4444', color: '#ef4444', backgroundColor: '#fef2f2' }} title="Rechazar">✕</button>
                          <button className="btn-view" onClick={() => procesarPago(pago.id, 'AUTORIZAR')} style={{ borderColor: '#2563eb', color: '#ffffff', backgroundColor: '#2563eb', fontWeight: 'bold' }}>Autorizar</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="empty-state" style={{ border: 'none', background: 'transparent' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '40px', color: '#cbd5e1', marginBottom: '12px'}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <h3>Bandeja Limpia</h3>
                    <p>No hay solicitudes en esta sección por el momento.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* CONTROLES DE PAGINACIÓN */}
        {totalPages > 1 && (
            <div className="pagination-container">
                <button className="btn-page" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>&laquo; Anterior</button>
                <span className="page-info">Página {currentPage} de {totalPages}</span>
                <button className="btn-page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente &raquo;</button>
            </div>
        )}
      </div>
    </div>
  );
}

export default Autorizaciones;