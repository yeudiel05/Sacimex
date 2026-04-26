import React, { useState, useEffect, useRef } from 'react';
import './Viaticos.css';

function Viaticos() {
  const [tabActiva, setTabActiva] = useState('NUEVA');
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const fileInputRefs = useRef({});

  const [formData, setFormData] = useState({
    puesto: '', jefe_inmediato: '', departamento: '', ubicacion: '',
    origen: '', destino: '', motivo: '', fecha_salida: '', fecha_regreso: '', dias_comision: 0,
    medio_transporte: '', monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', 
    monto_taxis: '', monto_gasolina: '', monto_otros: '', total_solicitado: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cálculos automáticos de fechas y totales
  useEffect(() => {
    if (formData.fecha_salida && formData.fecha_regreso) {
      const salida = new Date(formData.fecha_salida);
      const regreso = new Date(formData.fecha_regreso);
      const dias = Math.ceil((regreso.getTime() - salida.getTime()) / (1000 * 3600 * 24)) + 1;
      setFormData(prev => ({ ...prev, dias_comision: dias > 0 ? dias : 0 }));
    }
  }, [formData.fecha_salida, formData.fecha_regreso]);

  useEffect(() => {
    const total = ['monto_alimentos', 'monto_hospedaje', 'monto_pasajes', 'monto_taxis', 'monto_gasolina', 'monto_otros']
      .reduce((sum, key) => sum + (parseFloat(formData[key]) || 0), 0);
    setFormData(prev => ({ ...prev, total_solicitado: total }));
  }, [formData.monto_alimentos, formData.monto_hospedaje, formData.monto_pasajes, formData.monto_taxis, formData.monto_gasolina, formData.monto_otros]);

  // Cargar mis solicitudes
  const fetchMisSolicitudes = async () => {
    setCargandoSolicitudes(true);
    try {
      const res = await fetch('http://localhost:3001/api/viaticos/mis-solicitudes', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setMisSolicitudes(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setCargandoSolicitudes(false);
    }
  };

  useEffect(() => {
    if (tabActiva === 'MIS_SOLICITUDES') fetchMisSolicitudes();
  }, [tabActiva]);

  // Manejo del formulario de creación
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.total_solicitado <= 0) return alert("El monto total debe ser mayor a cero.");
    
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:3001/api/viaticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        alert("¡Solicitud enviada a Tesorería con éxito!");
        setFormData({
          puesto: '', jefe_inmediato: '', departamento: '', ubicacion: '', origen: '', destino: '', motivo: '',
          fecha_salida: '', fecha_regreso: '', dias_comision: 0, medio_transporte: '',
          monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', monto_taxis: '', monto_gasolina: '', monto_otros: '', total_solicitado: 0
        });
        setTabActiva('MIS_SOLICITUDES');
      } else alert("Hubo un error: " + data.message);
    } catch (error) {
      alert("Error de conexión al servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejo de subida de comprobantes del empleado
  const handleSubirGastos = async (id_solicitud, event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileData = new FormData();
    fileData.append('comprobante_gastos', file);

    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id_solicitud}/comprobante-gastos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: fileData
      });
      const data = await res.json();
      if (data.success) {
        alert("¡Facturas/Gastos subidos correctamente!");
        fetchMisSolicitudes(); // Recargar la lista
      } else alert(data.message);
    } catch (error) {
      alert('Error al subir el archivo.');
    }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="viaticos-premium-wrapper fade-in-up">
      <div className="viaticos-header-block" style={{ marginBottom: '20px' }}>
        <h1>Mis Viáticos</h1>
        <p>Solicite nuevos viáticos o revise el estatus de sus solicitudes.</p>
      </div>

      {/* --- PESTAÑAS DEL EMPLEADO --- */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button 
          onClick={() => setTabActiva('NUEVA')}
          style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'NUEVA' ? '#10b981' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'NUEVA' ? '3px solid #10b981' : '3px solid transparent', paddingBottom: '8px' }}>
          Nueva Solicitud +
        </button>
        <button 
          onClick={() => setTabActiva('MIS_SOLICITUDES')}
          style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'MIS_SOLICITUDES' ? '#3b82f6' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'MIS_SOLICITUDES' ? '3px solid #3b82f6' : '3px solid transparent', paddingBottom: '8px' }}>
          Historial / Mis Solicitudes
        </button>
      </div>

      {tabActiva === 'NUEVA' ? (
        <form onSubmit={handleSubmit} className="viaticos-grid-layout">
          {/* COLUMNA IZQUIERDA: DATOS LOGÍSTICOS */}
          <div className="viaticos-form-column">
            
            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">1</span>
                <h2>Información del Solicitante</h2>
              </div>
              <div className="input-row-2">
                <div className="form-field">
                  <label>Puesto</label>
                  <input type="text" name="puesto" required value={formData.puesto} onChange={handleChange} placeholder="Ej. Gerente" />
                </div>
                <div className="form-field">
                  <label>Jefe Inmediato</label>
                  <input type="text" name="jefe_inmediato" required value={formData.jefe_inmediato} onChange={handleChange} placeholder="Nombre del Jefe"/>
                </div>
              </div>
              <div className="input-row-2">
                <div className="form-field">
                  <label>Departamento</label>
                  <input type="text" name="departamento" required value={formData.departamento} onChange={handleChange} placeholder="Ej. Ventas"/>
                </div>
                <div className="form-field">
                  <label>Sede / Ubicación</label>
                  <input type="text" name="ubicacion" required placeholder="Ej. Corporativo Oaxaca" value={formData.ubicacion} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">2</span>
                <h2>Logística de la Comisión</h2>
              </div>
              <div className="input-row-2">
                <div className="form-field"><label>Origen</label><input type="text" name="origen" required value={formData.origen} onChange={handleChange} /></div>
                <div className="form-field"><label>Destino</label><input type="text" name="destino" required value={formData.destino} onChange={handleChange} /></div>
              </div>
              <div className="input-row-3 mt-16">
                <div className="form-field"><label>Salida</label><input type="date" name="fecha_salida" required value={formData.fecha_salida} onChange={handleChange} /></div>
                <div className="form-field"><label>Regreso</label><input type="date" name="fecha_regreso" required value={formData.fecha_regreso} onChange={handleChange} /></div>
                <div className="form-field"><label>Transporte</label>
                  <select name="medio_transporte" required value={formData.medio_transporte} onChange={handleChange}>
                    <option value="" disabled>SELECCIONAR</option>
                    <option value="Autobús">Autobús</option><option value="Avión">Avión</option><option value="Auto Empresa">Auto Empresa</option><option value="Auto Propio">Auto Propio</option>
                  </select>
                </div>
              </div>
              <div className="form-field mt-16"><label>Motivo</label><textarea name="motivo" required rows="2" value={formData.motivo} onChange={handleChange}></textarea></div>
            </div>

            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">3</span>
                <h2>Desglose de Gastos</h2>
              </div>
              <div className="gastos-grid-layout">
                {['alimentos', 'hospedaje', 'pasajes', 'taxis', 'gasolina', 'otros'].map(gasto => (
                  <div className="gasto-item" key={gasto}>
                    <label style={{textTransform: 'capitalize'}}>{gasto}</label>
                    <div className="money-box"><i>$</i><input type="number" name={`monto_${gasto}`} min="0" step="0.01" value={formData[`monto_${gasto}`]} onChange={handleChange} placeholder="0.00"/></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: TOTAL */}
          <div className="viaticos-summary-column">
            <div className="summary-sticky-card">
              <div className="summary-header"><h3>Resumen de Solicitud</h3></div>
              <div className="summary-body">
                <div className="summary-row"><span>Días de comisión</span><strong>{formData.dias_comision}</strong></div>
                <div className="summary-divider"></div>
                <div className="total-display"><p>Total Solicitado</p><h2 className={formData.total_solicitado > 0 ? 'has-value' : ''}>{formatMoney(formData.total_solicitado)}</h2></div>
              </div>
              <div className="summary-footer">
                <button type="submit" className="btn-send-request" disabled={isSubmitting || formData.total_solicitado <= 0}>
                  {isSubmitting ? 'Procesando...' : 'Enviar a Tesorería'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* --- VISTA: MIS SOLICITUDES --- */
        <div style={{ display: 'grid', gap: '24px' }}>
          {cargandoSolicitudes ? <p>Cargando su historial...</p> : misSolicitudes.length === 0 ? (
            <div className="premium-card" style={{ textAlign: 'center', padding: '50px' }}><h3 style={{ color: '#64748b' }}>No ha realizado ninguna solicitud aún.</h3></div>
          ) : (
            misSolicitudes.map(sol => (
              <div key={sol.id} className="premium-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
                <div>
                  <span style={{ 
                    fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px',
                    backgroundColor: sol.estatus === 'PENDIENTE' ? '#fef3c7' : sol.estatus === 'AUTORIZADO' ? '#dcfce7' : sol.estatus === 'COMPROBADO' ? '#e0e7ff' : '#fee2e2',
                    color: sol.estatus === 'PENDIENTE' ? '#f59e0b' : sol.estatus === 'AUTORIZADO' ? '#16a34a' : sol.estatus === 'COMPROBADO' ? '#4f46e5' : '#ef4444'
                  }}>
                    {sol.estatus}
                  </span>
                  <h3 style={{ margin: '12px 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{sol.destino} - {sol.motivo}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>{new Date(sol.fecha_salida).toLocaleDateString()} al {new Date(sol.fecha_regreso).toLocaleDateString()}</p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>Monto Autorizado</p>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#10b981', fontWeight: '900' }}>{formatMoney(sol.total_solicitado)}</h2>
                  
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    
                    {/* Botón para descargar transferencia de DHO */}
                    {sol.url_comprobante_transferencia && (
                      <a href={`http://localhost:3001/${sol.url_comprobante_transferencia}`} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', border: '1px solid #cbd5e1', color: '#475569', background: 'white', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>
                        Ver Transferencia
                      </a>
                    )}

                    {/* Botón para subir comprobantes (facturas) si está Autorizado */}
                    {(sol.estatus === 'AUTORIZADO' || sol.estatus === 'COMPROBADO') && (
                      <>
                        <input type="file" accept=".pdf,.zip" style={{ display: 'none' }} ref={el => fileInputRefs.current[sol.id] = el} onChange={(e) => handleSubirGastos(sol.id, e)} />
                        
                        {sol.url_comprobante_gastos ? (
                          <a href={`http://localhost:3001/${sol.url_comprobante_gastos}`} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Mis Gastos</a>
                        ) : (
                          <button onClick={() => fileInputRefs.current[sol.id].click()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Subir Facturas
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Viaticos;