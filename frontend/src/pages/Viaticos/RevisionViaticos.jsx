import React, { useState, useEffect, useRef } from 'react';
import './Viaticos.css';

function RevisionViaticos() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [tabActiva, setTabActiva] = useState('PENDIENTES');
  const fileInputRefs = useRef({});

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

  // Función para manejar la subida del PDF de transferencia
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

  // Filtramos los datos según la pestaña activa
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
            <div key={sol.id} className="premium-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
              
              <div>
                <span style={{ 
                  fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px',
                  backgroundColor: sol.estatus === 'PENDIENTE' ? '#fef3c7' : sol.estatus === 'RECHAZADO' ? '#fee2e2' : '#dcfce7',
                  color: sol.estatus === 'PENDIENTE' ? '#f59e0b' : sol.estatus === 'RECHAZADO' ? '#ef4444' : '#16a34a'
                }}>
                  {sol.estatus}
                </span>
                <h3 style={{ margin: '12px 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{sol.destino} - {sol.motivo}</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                  <strong>Solicitante:</strong> {sol.solicitante_usuario} ({sol.departamento}) <br/>
                  <strong>Fechas:</strong> {new Date(sol.fecha_salida).toLocaleDateString()} al {new Date(sol.fecha_regreso).toLocaleDateString()}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>Monto Solicitado</p>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#10b981', fontWeight: '900' }}>{formatMoney(sol.total_solicitado)}</h2>
                
                {/* --- BOTONES SI ESTÁ PENDIENTE --- */}
                {tabActiva === 'PENDIENTES' && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => cambiarEstatus(sol.id, 'RECHAZADO')} style={{ padding: '8px 16px', border: '1px solid #ef4444', color: '#ef4444', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Rechazar</button>
                    <button onClick={() => cambiarEstatus(sol.id, 'AUTORIZADO')} style={{ padding: '8px 16px', border: 'none', color: 'white', background: '#10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Autorizar</button>
                  </div>
                )}

                {/* --- BOTONES SI ESTÁ AUTORIZADO (SUBIR PDF DE TRANSFERENCIA) --- */}
                {tabActiva === 'AUTORIZADOS' && sol.estatus !== 'RECHAZADO' && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    
                    {/* Input de archivo oculto */}
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      ref={el => fileInputRefs.current[sol.id] = el}
                      onChange={(e) => handleSubirComprobante(sol.id, e)}
                    />
                    
                    {sol.url_comprobante_transferencia ? (
                      <a 
                        href={`http://localhost:3001/${sol.url_comprobante_transferencia}`} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{ display: 'inline-block', padding: '8px 16px', border: '1px solid #cbd5e1', color: '#3b82f6', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}>
                        Ver Comprobante
                      </a>
                    ) : (
                      <button 
                        onClick={() => fileInputRefs.current[sol.id].click()} 
                        style={{ padding: '8px 16px', border: '1px dashed #3b82f6', color: '#3b82f6', background: '#eff6ff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        + Subir Transferencia
                      </button>
                    )}
                  </div>
                )}

              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RevisionViaticos;