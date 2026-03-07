import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Auditoria.css';

function Auditoria() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Nuevos estados para fechas
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

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

  const registrosFiltrados = registros.filter(r => {
    const coincideTexto = r.accion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.detalle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.usuario.toLowerCase().includes(searchTerm.toLowerCase());

    let coincideFecha = true;
    if (fechaInicio && fechaFin) {
      const fechaRegistro = new Date(r.fecha).toISOString().split('T')[0];
      coincideFecha = fechaRegistro >= fechaInicio && fechaRegistro <= fechaFin;
    }

    return coincideTexto && coincideFecha;
  });

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
    if (accion.includes('ELIMINAR') || accion.includes('BORRADO') || accion.includes('FALLIDO')) return 'badge-danger';
    if (accion.includes('CREAR') || accion.includes('NUEV') || accion.includes('LOGIN') || accion.includes('EXPORTAR')) return 'badge-success';
    if (accion.includes('EDITAR') || accion.includes('ESTATUS')) return 'badge-warning';
    return 'badge-info';
  };

  return (
    <div className="auditoria-container fade-in-up">
      <div className="page-header stagger-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Bitácora de Auditoría</h1>
          <p>Registro inalterable de todos los movimientos realizados en el sistema</p>
        </div>

        <button className="btn-pdf" onClick={descargarPDF} disabled={isDownloading}>
          {isDownloading ? 'Generando...' : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><polyline points="9 15 12 18 15 15"></polyline></svg>
              Descargar PDF
            </>
          )}
        </button>
      </div>

      <div className="auditoria-toolbar stagger-2" style={{ flexDirection: 'column', gap: '16px', alignItems: 'stretch' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div className="search-bar" style={{ maxWidth: '400px', flexGrow: 1 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="Buscar por usuario o palabra clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="filtros-fecha">
            <span className="filtro-label">Filtrar por fecha:</span>
            <input type="date" className="date-input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            <span style={{ color: '#64748b', fontWeight: 'bold' }}>-</span>
            <input type="date" className="date-input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />

            {(fechaInicio || fechaFin) && (
              <button className="btn-clear-date" onClick={() => { setFechaInicio(''); setFechaFin(''); }}>Limpiar</button>
            )}
          </div>
        </div>

        <div className="record-count" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          Mostrando <strong>{registrosFiltrados.length}</strong> movimientos
        </div>
      </div>

      <div className="auditoria-tabla-container stagger-3">
        <table className="auditoria-tabla">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Acción Realizada</th>
              <th>Detalles del Movimiento</th>
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.length > 0 ? (
              registrosFiltrados.map((registro) => (
                <tr key={registro.id}>
                  <td className="col-fecha">
                    {new Date(registro.fecha).toLocaleDateString('es-MX')} <br />
                    <span className="hora-text">{new Date(registro.fecha).toLocaleTimeString('es-MX')}</span>
                  </td>
                  <td className="col-usuario">
                    <span className="user-pill">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      {registro.usuario}
                    </span>
                  </td>
                  <td className="col-accion">
                    <span className={`accion-badge ${getColorPorAccion(registro.accion)}`}>
                      {registro.accion.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="col-detalle">{registro.detalle}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="empty-state-table">
                  No se encontraron registros que coincidan con la búsqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Auditoria;