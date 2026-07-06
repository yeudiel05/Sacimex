import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Viaticos.css';

function RevisionViaticos() {
  const navigate = useNavigate();
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState('PENDIENTES');
  const fileInputRefs = useRef({});
  const [expandidos, setExpandidos] = useState({});
  const [mesReporte, setMesReporte] = useState('');

  const fetchSolicitudes = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:3001/api/viaticos/todas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) { localStorage.clear(); navigate('/'); return; }
      const data = await res.json();
      if (data.success) setSolicitudes(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchSolicitudes();
    const hoy = new Date();
    setMesReporte(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`);
  }, []);

  const handleVerPDF = async (id_solicitud) => {
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id_solicitud}/pdf`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error("Error al obtener el PDF");
      const blob = await res.blob();
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 10000);
    } catch (error) {
      console.error(error);
      alert("Error al intentar abrir el Formato PDF de Comisión.");
    }
  };

  const cambiarEstatus = async (id, nuevoEstatus) => {
    if (!window.confirm(`¿Estás seguro de marcar esta solicitud como ${nuevoEstatus}?`)) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id}/estatus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ estatus: nuevoEstatus })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `Solicitud marcada como ${nuevoEstatus}`);
        setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estatus: nuevoEstatus } : s));
        fetch('http://localhost:3001/api/viaticos/todas?t=' + Date.now(), {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(d => { if (d.success) setSolicitudes(d.data); });
      } else {
        alert("No se pudo actualizar: " + data.message);
      }
    } catch (error) {
      alert('Error al procesar la solicitud con el servidor.');
    }
  };

  const handleSubirComprobante = async (id_solicitud, event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('comprobante', file);
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id_solicitud}/comprobante`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: formData
      });
      const data = await res.json();
      if (data.success) { alert("Comprobante adjuntado correctamente."); fetchSolicitudes(); }
      else alert(data.message);
    } catch (error) { alert('Error al subir el archivo.'); }
  };

  // ============================================================
  // VER/DESCARGAR COMPROBACIÓN UNIVERSAL DE GASTOS (D.H.O.) EN PDF
  // ============================================================
  const descargarComprobacionDHO = async (sol) => {
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${sol.id}/comprobacion-universal/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return alert(data?.message || 'Este viático aún no tiene comprobación de gastos registrada por el empleado.');
      }
      const blob = await res.blob();
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 10000);
    } catch (e) {
      alert('Error al generar el PDF de la comprobación.');
    }
  };

  const generarReporteMensual = () => {
    if (!mesReporte) return alert("Seleccione un mes para el reporte.");
    const solicitudesMes = solicitudes.filter(sol => {
      const fecha = new Date(sol.fecha_salida);
      const strMes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      return strMes === mesReporte;
    });
    if (solicitudesMes.length === 0) return alert("No hay solicitudes registradas en este mes.");
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Estatus,Solicitante,Departamento,Destino,Motivo,Transporte,Fecha Salida,Fecha Regreso,Alimentos,Hospedaje,Pasajes,Gasolina,Taxis,Otros,Total\n";
    solicitudesMes.forEach(sol => {
      const row = [
        sol.id, sol.estatus, `"${sol.solicitante_usuario}"`, `"${sol.departamento}"`, `"${sol.destino}"`,
        `"${sol.motivo.replace(/\n/g, " ")}"`, sol.medio_transporte,
        new Date(sol.fecha_salida).toLocaleDateString(), new Date(sol.fecha_regreso).toLocaleDateString(),
        sol.monto_alimentos || 0, sol.monto_hospedaje || 0, sol.monto_pasajes || 0,
        sol.monto_gasolina || 0, sol.monto_taxis || 0, sol.monto_otros || 0, sol.total_solicitado || 0
      ].join(",");
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Viaticos_${mesReporte}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  const toggleDetalle = (id) => setExpandidos(prev => ({ ...prev, [id]: !prev[id] }));

  const solicitudesFiltradas = solicitudes.filter(sol => {
    if (tabActiva === 'PENDIENTES') return sol.estatus === 'PENDIENTE' || sol.estatus === 'PENDIENTE_VOBO';
    if (tabActiva === 'AUTORIZADOS') return sol.estatus === 'PAGADO' || sol.estatus === 'RECIBIDO' || sol.estatus === 'COMPROBADO' || sol.estatus === 'RECHAZADO' || sol.estatus === 'AUTORIZADO';
    return true;
  });

  const getBadgeStyle = (estatus) => {
    switch(estatus) {
      case 'PENDIENTE': return { bg: '#fef3c7', text: '#f59e0b' };
      case 'PAGADO':    return { bg: '#eff6ff', text: '#3b82f6' };
      case 'RECIBIDO':  return { bg: '#ccfbf1', text: '#0d9488' };
      case 'COMPROBADO':return { bg: '#dcfce7', text: '#16a34a' };
      case 'RECHAZADO': return { bg: '#fee2e2', text: '#ef4444' };
      default:          return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <div className="viaticos-premium-wrapper fade-in-up">
      <div className="viaticos-header-block" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Bandeja D.H.O.</h1>
          <p>Revisión y gestión de viáticos empresariales.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Exportar Reporte</label>
            <input type="month" value={mesReporte} onChange={(e) => setMesReporte(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }} />
          </div>
          <button onClick={generarReporteMensual}
            style={{ marginTop: '18px', padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '14px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button onClick={() => setTabActiva('PENDIENTES')}
          style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'PENDIENTES' ? '#10b981' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'PENDIENTES' ? '3px solid #10b981' : '3px solid transparent', paddingBottom: '8px' }}>
          En Revisión
        </button>
        <button onClick={() => setTabActiva('AUTORIZADOS')}
          style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'AUTORIZADOS' ? '#3b82f6' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'AUTORIZADOS' ? '3px solid #3b82f6' : '3px solid transparent', paddingBottom: '8px' }}>
          Historial / Autorizados
        </button>
      </div>

      {cargando ? (
        <p>Cargando solicitudes...</p>
      ) : solicitudesFiltradas.length === 0 ? (
        <div className="premium-card" style={{ textAlign: 'center', padding: '50px' }}>
          <h3 style={{ color: '#64748b' }}>No hay solicitudes {tabActiva === 'PENDIENTES' ? 'pendientes' : 'en el historial'} en este momento.</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {solicitudesFiltradas.map(sol => {
            const badge = getBadgeStyle(sol.estatus);
            return (
              <div key={sol.id} className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '8px', backgroundColor: badge.bg, color: badge.text }}>
                      {sol.estatus}
                    </span>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{sol.destino}</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.4' }}>
                      <strong>Solicitante:</strong> {sol.solicitante_usuario} ({sol.departamento})<br/>
                      <strong>Fechas:</strong> {new Date(sol.fecha_salida).toLocaleDateString()} al {new Date(sol.fecha_regreso).toLocaleDateString()}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '220px' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b' }}>Monto Solicitado</p>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#10b981', fontWeight: '900' }}>{formatMoney(sol.total_solicitado)}</h2>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button onClick={() => toggleDetalle(sol.id)}
                        style={{ padding: '6px 12px', border: '1px solid #cbd5e1', color: '#475569', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        {expandidos[sol.id] ? '▲ Ocultar Detalle' : '▼ Ver Detalle'}
                      </button>

                      <button onClick={() => handleVerPDF(sol.id)}
                        style={{ padding: '6px 12px', background: 'white', color: '#dc2626', border: '1px solid #dc2626', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Ver PDF
                      </button>

                      {tabActiva === 'PENDIENTES' && (
                        <>
                          <button onClick={() => cambiarEstatus(sol.id, 'RECHAZADO')} style={{ padding: '6px 12px', border: '1px solid #ef4444', color: '#ef4444', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Rechazar</button>
                          <button onClick={() => cambiarEstatus(sol.id, 'PAGADO')} style={{ padding: '6px 12px', border: 'none', color: 'white', background: '#10b981', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Autorizar y Marcar Pagado</button>
                        </>
                      )}

                      {tabActiva === 'AUTORIZADOS' && sol.estatus !== 'RECHAZADO' && (
                        <>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} ref={el => fileInputRefs.current[sol.id] = el} onChange={(e) => handleSubirComprobante(sol.id, e)} />

                          {sol.url_comprobante_transferencia ? (
                            <a href={`http://localhost:3001/${sol.url_comprobante_transferencia}`} target="_blank" rel="noreferrer"
                              style={{ display: 'inline-block', padding: '6px 12px', border: '1px solid #cbd5e1', color: '#3b82f6', background: 'white', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none', fontSize: '12px' }}>
                              Ver Transferencia
                            </a>
                          ) : (
                            <button onClick={() => fileInputRefs.current[sol.id].click()}
                              style={{ padding: '6px 12px', border: '1px dashed #3b82f6', color: '#3b82f6', background: '#eff6ff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                              + Transferencia
                            </button>
                          )}

                          {sol.comprobante_recepcion_path && (
                            <a href={`http://localhost:3001/${sol.comprobante_recepcion_path}`} target="_blank" rel="noreferrer"
                              style={{ display: 'inline-block', padding: '6px 12px', border: '1px solid #14b8a6', color: '#14b8a6', background: '#ccfbf1', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none', fontSize: '12px' }}>
                              Ver Acuse
                            </a>
                          )}

                          {sol.url_comprobante_gastos && (
                            <a href={`http://localhost:3001/${sol.url_comprobante_gastos}`} target="_blank" rel="noreferrer"
                              style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block' }}>
                              Ver Facturas de Gasto
                            </a>
                          )}

                          {/* BOTÓN: VER COMPROBACIÓN UNIVERSAL EN PDF (lo que llenó el empleado) */}
                          {(sol.estatus === 'RECIBIDO' || sol.estatus === 'COMPROBADO') && (
                            <button onClick={() => descargarComprobacionDHO(sol)}
                              style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '13px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Comprobación
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* DETALLE EXPANSIBLE */}
                {expandidos[sol.id] && (
                  <div style={{ padding: '20px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'fadeIn 0.2s' }}>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Logística de la Comisión</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div><span style={{ color: '#64748b' }}>Origen:</span> <strong style={{ display: 'block', color: '#334155' }}>{sol.origen}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Transporte:</span> <strong style={{ display: 'block', color: '#334155' }}>{sol.medio_transporte}</strong></div>
                        <div><span style={{ color: '#64748b' }}>Días de Comisión:</span> <strong style={{ display: 'block', color: '#334155' }}>{sol.dias_comision} días</strong></div>
                        <div><span style={{ color: '#64748b' }}>Sede del Empleado:</span> <strong style={{ display: 'block', color: '#334155' }}>{sol.ubicacion}</strong></div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: '#64748b' }}>Motivo de la visita:</span>
                          <p style={{ margin: '4px 0 0 0', padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#334155' }}>{sol.motivo}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Desglose de Gastos Solicitados</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                        {[
                          ['Alimentos', sol.monto_alimentos], ['Hospedaje', sol.monto_hospedaje],
                          ['Pasajes/Urban', sol.monto_pasajes], ['Gasolina', sol.monto_gasolina],
                          ['Taxis', sol.monto_taxis], ['Peajes/Otros', sol.monto_otros]
                        ].map(([label, monto]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            <span style={{ color: '#64748b' }}>{label}</span>
                            <strong style={{ color: '#0f172a' }}>{formatMoney(monto)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RevisionViaticos;