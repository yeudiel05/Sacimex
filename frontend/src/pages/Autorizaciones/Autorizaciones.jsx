import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Autorizaciones.css';

function Autorizaciones() {
  const navigate = useNavigate();
  const [pagosPendientes, setPagosPendientes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchPendientes = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const res = await fetch('http://localhost:3001/api/proveedores/autorizaciones/pendientes', { headers });
      if (res.status === 401 || res.status === 403) { localStorage.clear(); navigate('/'); return; }
      const data = await res.json();
      if (data.success) setPagosPendientes(data.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchPendientes(); }, []);

  const handleAccion = async (id, accion) => {
    if (!window.confirm(`¿Estás seguro de ${accion === 'aprobar' ? 'APROBAR' : 'RECHAZAR'} la salida de este dinero?`)) return;
    
    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);
    
    try {
      const res = await fetch(`http://localhost:3001/api/proveedores/autorizaciones/${id}/${accion}`, { 
        method: 'PUT', headers 
      });
      if (res.ok) fetchPendientes();
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="auth-container fade-in-up">
      <div className="page-header stagger-1">
        <div>
          <h1>Centro de Autorizaciones</h1>
          <p>Firma digital para liberar pagos y transferencias a proveedores</p>
        </div>
      </div>

      <div className="auth-grid stagger-2">
        {pagosPendientes.length > 0 ? (
          pagosPendientes.map((pago, index) => (
            <div className="auth-card" key={pago.id} style={{ animationDelay: `${(index + 1) * 0.1}s` }}>
              <div className="auth-card-header">
                <div>
                  <span className="auth-solicitante">Solicitado por: <strong>{pago.solicitante}</strong></span>
                  <span className="auth-fecha">{new Date(pago.fecha_solicitud).toLocaleString('es-MX')}</span>
                </div>
                <div className="auth-monto">{formatMoney(pago.monto_pago)}</div>
              </div>

              <div className="auth-card-body">
                <h4>{pago.proveedor}</h4>
                <p><strong>Concepto:</strong> {pago.concepto}</p>
                {pago.num_factura_ref && <p><strong>Factura:</strong> {pago.num_factura_ref}</p>}
                
                {pago.url_comprobante_pago && (
                  <a href={`http://localhost:3001/${pago.url_comprobante_pago}`} target="_blank" rel="noreferrer" className="btn-view-invoice">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    Ver Factura Adjunta
                  </a>
                )}
              </div>

              <div className="auth-card-footer">
                <button className="btn-rechazar" disabled={isLoading} onClick={() => handleAccion(pago.id, 'rechazar')}>Rechazar</button>
                <button className="btn-aprobar" disabled={isLoading} onClick={() => handleAccion(pago.id, 'aprobar')}>Aprobar Pago</button>
              </div>
            </div>
          ))
        ) : (
          <div className="auth-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <h3>No hay pagos pendientes</h3>
            <p>Tu bandeja de autorizaciones está limpia.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Autorizaciones;