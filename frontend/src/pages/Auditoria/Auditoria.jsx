import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auditoria.css';

function Auditoria() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fechas y descargas
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // PAGINACIÓN
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchAuditoria = async () => {
      const headers = getAuthHeaders(); if (!headers) return;
      try {
        const res = await fetch('http://localhost:3001/api/auditoria', { headers });
        if (res.status === 401 || res.status === 403) { localStorage.clear(); navigate('/'); return; }
        const data = await res.json();
        if (data.success) setRegistros(data.data);
      } catch (error) { console.error(error); }
    };
    fetchAuditoria();
  }, []);

  const descargarPDF = async () => {
    if ((fechaInicio && !fechaFin) || (!fechaInicio && fechaFin)) {
      return alert("Para filtrar por fecha, debes seleccionar tanto la Fecha de Inicio como la Fecha Fin. O dejar ambas en blanco para el historial completo.");
    }

    const headers = getAuthHeaders(); if (!headers) return;
    setIsDownloading(true);

    let url = 'http://localhost:3001/api/auditoria/reporte/pdf';
    if (fechaInicio && fechaFin) {
      url += `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
    }

    try {
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) throw new Error("Error del servidor");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Auditoria_Sacimex_${fechaInicio || 'Completa'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error(error);
      alert("Hubo un error al descargar el reporte PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getColorPorAccion = (accion) => {
    const act = accion.toUpperCase();
    if (act.includes('ELIMINAR') || act.includes('BORRADO') || act.includes('FALLIDO') || act.includes('RECHAZ')) return 'badge-danger';
    if (act.includes('CREAR') || act.includes('NUEV') || act.includes('LOGIN') || act.includes('EXPORTAR') || act.includes('AUTORIZAD')) return 'badge-success';
    if (act.includes('EDITAR') || act.includes('ESTATUS') || act.includes('VALIDA')) return 'badge-warning';
    return 'badge-neutral';
  };

  // --- FILTROS Y PAGINACIÓN ---
  const registrosFiltrados = registros.filter(r => {
    const coincideTexto = (r.accion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.detalle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.usuario || '').toLowerCase().includes(searchTerm.toLowerCase());

    let coincideFecha = true;
    if (fechaInicio && fechaFin) {
      const fechaRegistro = new Date(r.fecha).toISOString().split('T')[0];
      coincideFecha = fechaRegistro >= fechaInicio && fechaRegistro <= fechaFin;
    }

    return coincideTexto && coincideFecha;
  });

  // Resetea a la primera página si el usuario busca algo o cambia las fechas
  useEffect(() => { setCurrentPage(1); }, [searchTerm, fechaInicio, fechaFin]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = registrosFiltrados.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(registrosFiltrados.length / itemsPerPage);

  return (
    <div className="auditoria-container fade-in-up">
      <div className="page-header stagger-1">
        <div>
          <h1>Auditoría del Sistema</h1>
          <p>Registro inalterable de todos los movimientos realizados en el sistema</p>
        </div>
      </div>

      <div className="table-wrapper stagger-2" style={{ marginTop: '24px' }}>
        
        {/* TOOLBAR: BUSCADOR, FECHAS Y PDF */}
        <div className="auditoria-toolbar" style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
          <div className="search-bar" style={{ margin: 0, maxWidth: '350px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Buscar por usuario o palabra clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="toolbar-actions">
            <div className="date-filters">
              <span className="filtro-label" style={{fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)'}}>RANGO:</span>
              <input type="date" className="date-input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}>-</span>
              <input type="date" className="date-input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />

              {(fechaInicio || fechaFin) && (
                <button className="btn-clear-date" onClick={() => { setFechaInicio(''); setFechaFin(''); }} title="Limpiar Fechas">✕</button>
              )}
            </div>

            <button className="btn-pdf" onClick={descargarPDF} disabled={isDownloading}>
              {isDownloading ? 'Generando...' : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 18 15 15"></polyline></svg>
                  Descargar PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div className="table-responsive" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', boxShadow: 'none', marginTop: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Fecha y Hora</th>
                <th style={{ width: '20%' }}>Usuario</th>
                <th style={{ width: '20%' }}>Acción Realizada</th>
                <th style={{ width: '45%' }}>Detalles del Movimiento</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((registro) => (
                  <tr key={registro.id}>
                    <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                                {new Date(registro.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </strong>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {new Date(registro.fecha).toLocaleTimeString('es-MX')}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar-xs" style={{ backgroundColor: '#e2e8f0', color: '#475569', fontWeight: 'bold' }}>
                                {(registro.usuario || 'S').substring(0, 1).toUpperCase()}
                            </div>
                            <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>{registro.usuario}</strong>
                        </div>
                    </td>
                    <td>
                        <span className={`log-badge ${getColorPorAccion(registro.accion)}`}>
                            {registro.accion.replace(/_/g, ' ')}
                        </span>
                    </td>
                    <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                            {registro.detalle}
                        </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="empty-state" style={{ border: 'none', background: 'transparent' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '40px', color: '#cbd5e1', marginBottom: '12px'}}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        <h3>Sin registros</h3>
                        <p>No se encontraron movimientos que coincidan con la búsqueda o fechas.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* CONTROLES DE PAGINACIÓN */}
          {totalPages > 1 && (
            <div className="pagination-container" style={{ borderTop: '1px solid var(--border-light)' }}>
                <button className="btn-page" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>&laquo; Anterior</button>
                <span className="page-info">Página {currentPage} de {totalPages}</span>
                <button className="btn-page" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente &raquo;</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auditoria;