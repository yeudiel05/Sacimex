import React, { useState, useEffect, useRef } from 'react';
import './Viaticos.css';

function RevisionViaticos() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState('PENDIENTES');
  const fileInputRefs = useRef({});

  // Nuevo estado para controlar qué tarjetas están expandidas (para ver el detalle)
  const [expandidos, setExpandidos] = useState({});

  const fetchSolicitudes = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('http://localhost:3001/api/viaticos/todas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
  }, []);

  const cambiarEstatus = async (id, nuevoEstatus) => {
    if (!window.confirm(`¿Estás seguro de ${nuevoEstatus.toLowerCase()} esta solicitud?`)) return;
    
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id}/estatus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ estatus: nuevoEstatus })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchSolicitudes(); 
      }
    } catch (error) {
      alert('Error al procesar la solicitud.');
    }
  };

  const handleSubirComprobante = async (id_solicitud, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('comprobante', file);

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id_solicitud}/comprobante`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        alert("Comprobante adjuntado correctamente.");
        fetchSolicitudes();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Error al subir el archivo.');
    }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  // Función para alternar el detalle de una solicitud
  const toggleDetalle = (id) => {
    setExpandidos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const solicitudesFiltradas = solicitudes.filter(sol => {
    if (tabActiva === 'PENDIENTES') return sol.estatus === 'PENDIENTE';
    if (tabActiva === 'AUTORIZADOS') return sol.estatus === 'AUTORIZADO' || sol.estatus === 'COMPROBADO' || sol.estatus === 'RECHAZADO';
    return true;
  });

  return (
    <div className="viaticos-premium-wrapper fade-in-up">
      <div className="viaticos-header-block" style={{ marginBottom: '20px' }}>
        <h1>Bandeja D.H.O.</h1>
        <p>Revisión y gestión de viáticos empresariales.</p>
      </div>

      {/* --- PESTAÑAS (TABS) --- */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button 
          onClick={() => setTabActiva('PENDIENTES')}
          style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'PENDIENTES' ? '#10b981' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'PENDIENTES' ? '3px solid #10b981' : '3px solid transparent', paddingBottom: '8px' }}>
          En Revisión
        </button>
        <button 
          onClick={() => setTabActiva('AUTORIZADOS')}
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
          {solicitudesFiltradas.map(sol => (
            <div key={sol.id} className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
              
              {/* --- ENCABEZADO DE LA TARJETA (Siempre visible) --- */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
                <div>
                  <span style={{ 
                    fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', display: 'inline-block', marginBottom: '8px',
                    backgroundColor: sol.estatus === 'PENDIENTE' ? '#fef3c7' : sol.estatus === 'RECHAZADO' ? '#fee2e2' : '#dcfce7',
                    color: sol.estatus === 'PENDIENTE' ? '#f59e0b' : sol.estatus === 'RECHAZADO' ? '#ef4444' : '#16a34a'
                  }}>
                    {sol.estatus}
                  </span>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{sol.destino}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.4' }}>
                    <strong>Solicitante:</strong> {sol.solicitante_usuario} ({sol.departamento}) <br/>
                    <strong>Fechas:</strong> {new Date(sol.fecha_salida).toLocaleDateString()} al {new Date(sol.fecha_regreso).toLocaleDateString()}
                  </p>
                </div>

                <div style={{ textAlign: 'right', minWidth: '220px' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b' }}>Monto Solicitado</p>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#10b981', fontWeight: '900' }}>{formatMoney(sol.total_solicitado)}</h2>
                  
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {/* Botón para abrir/cerrar detalles */}
                    <button 
                      onClick={() => toggleDetalle(sol.id)} 
                      style={{ padding: '6px 12px', border: '1px solid #cbd5e1', color: '#475569', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      {expandidos[sol.id] ? '▲ Ocultar Detalle' : '▼ Ver Detalle'}
                    </button>

                    {/* --- BOTONES DE ACCIÓN PRINCIPALES --- */}
                    {tabActiva === 'PENDIENTES' && (
                      <>
                        <button onClick={() => cambiarEstatus(sol.id, 'RECHAZADO')} style={{ padding: '6px 12px', border: '1px solid #ef4444', color: '#ef4444', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Rechazar</button>
                        <button onClick={() => cambiarEstatus(sol.id, 'AUTORIZADO')} style={{ padding: '6px 12px', border: 'none', color: 'white', background: '#10b981', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Autorizar</button>
                      </>
                    )}

                    {tabActiva === 'AUTORIZADOS' && sol.estatus !== 'RECHAZADO' && (
                      <>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} ref={el => fileInputRefs.current[sol.id] = el} onChange={(e) => handleSubirComprobante(sol.id, e)} />
                        
                        {sol.url_comprobante_transferencia ? (
                          <a href={`http://localhost:3001/${sol.url_comprobante_transferencia}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '6px 12px', border: '1px solid #cbd5e1', color: '#3b82f6', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none', fontSize: '12px' }}>
                            Ver Comprobante
                          </a>
                        ) : (
                          <button onClick={() => fileInputRefs.current[sol.id].click()} style={{ padding: '6px 12px', border: '1px dashed #3b82f6', color: '#3b82f6', background: '#eff6ff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                            + Transferencia
                          </button>
                        )}

                        {/* Si el empleado ya subió sus facturas de gastos */}
                        {sol.url_comprobante_gastos && (
                          <a href={`http://localhost:3001/${sol.url_comprobante_gastos}`} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block' }}>
                            Ver Facturas
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* --- SECCIÓN DE DETALLE EXPANSIBLE --- */}
              {expandidos[sol.id] && (
                <div style={{ padding: '20px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'fadeIn 0.2s' }}>
                  
                  {/* Bloque Logística */}
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

                  {/* Bloque Financiero */}
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Desglose de Gastos Solicitados</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Alimentos</span> <strong style={{ color: '#0f172a' }}>{formatMoney(sol.monto_alimentos)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Hospedaje</span> <strong style={{ color: '#0f172a' }}>{formatMoney(sol.monto_hospedaje)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Pasajes/Urban</span> <strong style={{ color: '#0f172a' }}>{formatMoney(sol.monto_pasajes)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Gasolina</span> <strong style={{ color: '#0f172a' }}>{formatMoney(sol.monto_gasolina)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Taxis</span> <strong style={{ color: '#0f172a' }}>{formatMoney(sol.monto_taxis)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#64748b' }}>Peajes/Otros</span> <strong style={{ color: '#0f172a' }}>{formatMoney(sol.monto_otros)}</strong>
                      </div>
                    </div>
                  </div>

                </div>
              )}
              {/* --- FIN SECCIÓN DETALLE --- */}

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RevisionViaticos;