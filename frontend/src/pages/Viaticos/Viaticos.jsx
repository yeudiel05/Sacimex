import React, { useState, useEffect, useRef } from 'react';
import './Viaticos.css';

// =========================================================
// CATÁLOGOS DEL FORMULARIO
// =========================================================
const UNIDADES_NEGOCIO = [
  '01.CRP - Corporativo', '02.ETL - Etla', '03.ANT - San Antonio', '04.CNT - Centro', 
  '05.RCP - Recuperación', '06.HTL - Huatulco', '07.CCT - Cuicatlán', '08.CNT - Central', 
  '09.CTL - Cuautla', '10.AJL - Ajalpan', '11.TCM - Tecamachalco', '12.HCH - Huauchinango', 
  '13.SLN - Salina Cruz', '14.HJP - Huajuapan', '15.ONL - Virtual', '16.ESC - Puerto Escondido', 
  '17.MHT - Miahutlán', '18.OCT - Ocotlán'
];

const AREAS = ['NORMATIVA', 'OPERATIVA', 'ADMINISTRATIVA'];

const DEPARTAMENTOS = [
  'TESORERIA', 'CONTABILIDAD', 'D.H.O', 'TIC´S', 'INNOVACION Y NUEVOS PROYECTOS TI', 
  'MESA DE CONTROL', 'COMITE DE CREDITO', 'CONTRALORIA', 'JURIDICO', 'COORDINACION PROMOTORIAS', 
  'COORDINACION PRODUCTO COMUNAL', 'COORDINACION PRODUCTO GRUPAL', 'COORDINACION PRODUCTO INDIVIDUAL Y NOMINA', 
  'GERENCIA DE OPERACIONES', 'GERENCIA GENERAL'
];

const AUTORIZADORES = [
  'KENIA VARGAS LOPEZ', 'YEDANI BERENICE SANCHEZ QUINTERO', 'ANDRES ELOY CRUZ CANO', 
  'VERONICA LOPEZ LUIS', 'MARIELA FANNY CRUZ CASTELLANOS', 'JUAN MANUEL RIVERA ORTIGOZA', 
  'EDGAR JAVIER MORALES RAMIREZ', 'LETICIA CRUZ ANGULO', 'ROSA ELIA CORTÉS MARTINEZ', 
  'ELVIRA GARCIA GARZON', 'EBER ZABDIEL ALVAREZ MIRANDA', 'ELIZABETH CRUZ CANO', 'ISAAC CRUZ CANO'
];

const TABULADOR = {
  'Cuicatlán': { hospedaje: 400, urban: 200, bus: 0, alimentos: 250, peaje: 0, gasolina: 700, taxi: 150 },
  'Huatulco': { hospedaje: 550, urban: 680, bus: 0, alimentos: 350, peaje: 0, gasolina: 1000, taxi: 150 },
  'Ajalpan': { hospedaje: 500, urban: 500, bus: 60, alimentos: 300, peaje: 460, gasolina: 1200, taxi: 150 },
  'Tecamachalco': { hospedaje: 500, urban: 500, bus: 140, alimentos: 300, peaje: 562, gasolina: 1200, taxi: 150 },
  'Huauchinango': { hospedaje: 550, urban: 0, bus: 1988, alimentos: 350, peaje: 950, gasolina: 1500, taxi: 150 },
  'Salina Cruz': { hospedaje: 550, urban: 480, bus: 820, alimentos: 300, peaje: 0, gasolina: 1500, taxi: 150 },
  'Huajuapan': { hospedaje: 590, urban: 400, bus: 0, alimentos: 300, peaje: 200, gasolina: 1000, taxi: 150 },
  'Puerto Escondido': { hospedaje: 600, urban: 680, bus: 0, alimentos: 350, peaje: 0, gasolina: 0, taxi: 0 },
  'Ocotlán': { hospedaje: 0, urban: 0, bus: 120, alimentos: 150, peaje: 0, gasolina: 0, taxi: 0 },
  'Corporativo': { hospedaje: 0, urban: 0, bus: 120, alimentos: 150, peaje: 0, gasolina: 0, taxi: 0 }
};

function Viaticos() {
  const [tabActiva, setTabActiva] = useState('NUEVA');
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const fileInputRefs = useRef({});

  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [destinoOtro, setDestinoOtro] = useState(''); 

  const [formData, setFormData] = useState({
    solicitante_nombre: '', puesto: '', unidad_negocio: '', area: '', departamento: '', jefe_inmediato: '', 
    origen: '', destino: '', motivo: '', fecha_salida: '', fecha_regreso: '', dias_comision: 0,
    num_acompanantes: '0', nombres_acompanantes: '', medio_transporte: '', 
    monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', monto_taxis: '', monto_gasolina: '', monto_otros: '', 
    observaciones: '', total_solicitado: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. AUTO-LLENADO DEL PERFIL (Extrae el nombre también)
  useEffect(() => {
    const fetchPerfilEmpleado = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/viaticos/perfil', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success && data.perfil) {
          setFormData(prev => ({
            ...prev,
            solicitante_nombre: data.perfil.nombre_completo || localStorage.getItem('username') || '',
            puesto: data.perfil.puesto || prev.puesto,
            departamento: data.perfil.departamento || prev.departamento,
            unidad_negocio: data.perfil.ubicacion || prev.unidad_negocio
          }));
        }
      } catch (error) { console.error("Error al cargar perfil."); }
    };
    if (tabActiva === 'NUEVA') fetchPerfilEmpleado();
  }, [tabActiva]);

  // 2. CÁLCULO DE DÍAS
  useEffect(() => {
    if (formData.fecha_salida && formData.fecha_regreso) {
      const salida = new Date(formData.fecha_salida);
      const regreso = new Date(formData.fecha_regreso);
      const dias = Math.ceil((regreso.getTime() - salida.getTime()) / (1000 * 3600 * 24)) + 1;
      setFormData(prev => ({ ...prev, dias_comision: dias > 0 ? dias : 0 }));
    }
  }, [formData.fecha_salida, formData.fecha_regreso]);

  // 3. AUTO-LLENADO DEL TABULADOR (Multiplica por acompañantes)
  useEffect(() => {
    if (!formData.destino || formData.destino === 'Otro' || formData.dias_comision === 0) return;
    const tab = TABULADOR[formData.destino];
    if (!tab) return;

    const dias = formData.dias_comision;
    const noches = Math.max(0, dias - 1);
    const totalPersonas = 1 + parseInt(formData.num_acompanantes || 0); // Solicitante + Acompañantes

    let calcAlimentos = (tab.alimentos * dias) * totalPersonas;
    let calcHospedaje = (tab.hospedaje * noches) * totalPersonas;
    let calcPasajes = 0;
    let calcGasolina = 0;
    let calcOtros = tab.peaje; 
    let calcTaxis = tab.taxi;

    if (formData.medio_transporte === 'Autobús' || formData.medio_transporte === 'Avión') {
      calcPasajes = (tab.bus + tab.urban) * totalPersonas;
      calcGasolina = 0; calcOtros = 0; 
    } else if (formData.medio_transporte === 'Auto Empresa' || formData.medio_transporte === 'Auto Propio') {
      calcPasajes = 0; 
      calcGasolina = tab.gasolina;
      calcOtros = tab.peaje;
    }

    setFormData(prev => ({
      ...prev,
      monto_alimentos: calcAlimentos > 0 ? calcAlimentos : '',
      monto_hospedaje: calcHospedaje > 0 ? calcHospedaje : '',
      monto_pasajes: calcPasajes > 0 ? calcPasajes : '',
      monto_gasolina: calcGasolina > 0 ? calcGasolina : '',
      monto_taxis: calcTaxis > 0 ? calcTaxis : '',
      // Respetamos lo que el usuario ponga en "otros" (gastos de representación) o ponemos el peaje
      monto_otros: prev.monto_otros ? prev.monto_otros : (calcOtros > 0 ? calcOtros : '')
    }));

  }, [formData.destino, formData.dias_comision, formData.medio_transporte, formData.num_acompanantes]);

  // 4. CÁLCULO DEL TOTAL
  useEffect(() => {
    const total = ['monto_alimentos', 'monto_hospedaje', 'monto_pasajes', 'monto_taxis', 'monto_gasolina', 'monto_otros']
      .reduce((sum, key) => sum + (parseFloat(formData[key]) || 0), 0);
    setFormData(prev => ({ ...prev, total_solicitado: total }));
  }, [formData.monto_alimentos, formData.monto_hospedaje, formData.monto_pasajes, formData.monto_taxis, formData.monto_gasolina, formData.monto_otros]);

  // 5. FUNCIONES DE API
  const fetchMisSolicitudes = async () => {
    setCargandoSolicitudes(true);
    try {
      const res = await fetch('http://localhost:3001/api/viaticos/mis-solicitudes', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) setMisSolicitudes(data.data);
    } catch (error) { console.error(error); } finally { setCargandoSolicitudes(false); }
  };

  useEffect(() => { if (tabActiva === 'MIS_SOLICITUDES') fetchMisSolicitudes(); }, [tabActiva]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.total_solicitado <= 0) return alert("El monto total debe ser mayor a cero.");
    
    const payloadFinal = { ...formData };
    if (payloadFinal.destino === 'Otro') {
      if (!destinoOtro.trim()) return alert("Por favor especifique el destino.");
      payloadFinal.destino = destinoOtro;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:3001/api/viaticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payloadFinal)
      });
      const data = await res.json();
      
      if (data.success) {
        alert("¡Solicitud enviada a D.H.O con éxito!");
        setTabActiva('MIS_SOLICITUDES');
        // Limpiamos parcialmente, dejando sus datos fijos
        setFormData(prev => ({
          ...prev, origen: '', destino: '', motivo: '', fecha_salida: '', fecha_regreso: '', dias_comision: 0,
          num_acompanantes: '0', nombres_acompanantes: '', medio_transporte: '', observaciones: '',
          monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', monto_taxis: '', monto_gasolina: '', monto_otros: '', total_solicitado: 0
        }));
        setDestinoOtro('');
      } else alert("Hubo un error: " + data.message);
    } catch (error) { alert("Error de conexión al servidor."); } finally { setIsSubmitting(false); }
  };

  const handleSubirGastos = async (id_solicitud, event) => {
    const file = event.target.files[0];
    if (!file) return;
    const fileData = new FormData(); fileData.append('comprobante_gastos', file);
    try {
      const res = await fetch(`http://localhost:3001/api/viaticos/${id_solicitud}/comprobante-gastos`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: fileData
      });
      const data = await res.json();
      if (data.success) { alert("¡Comprobantes subidos!"); fetchMisSolicitudes(); } else alert(data.message);
    } catch (error) { alert('Error al subir el archivo.'); }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="viaticos-premium-wrapper fade-in-up">
      <div className="viaticos-header-block" style={{ marginBottom: '20px' }}>
        <h1>Mis Viáticos</h1>
        <p>Complete el formulario oficial de viáticos para procesar su comisión.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button onClick={() => setTabActiva('NUEVA')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'NUEVA' ? '#10b981' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'NUEVA' ? '3px solid #10b981' : '3px solid transparent', paddingBottom: '8px' }}>Nueva Solicitud +</button>
        <button onClick={() => setTabActiva('MIS_SOLICITUDES')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'MIS_SOLICITUDES' ? '#3b82f6' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'MIS_SOLICITUDES' ? '3px solid #3b82f6' : '3px solid transparent', paddingBottom: '8px' }}>Historial / Mis Solicitudes</button>
      </div>

      {tabActiva === 'NUEVA' ? (
        <form onSubmit={handleSubmit} className="viaticos-grid-layout">
          <div className="viaticos-form-column">
            
            {/* ====== PASO 1: SOLICITANTE ====== */}
            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">1</span>
                <h2>Información del Colaborador</h2>
              </div>
              
              <div className="form-field mb-16">
                <label>Nombre del colaborador que requiere viáticos</label>
                <input type="text" name="solicitante_nombre" value={formData.solicitante_nombre} onChange={handleChange} required style={{ backgroundColor: '#f8fafc' }} />
              </div>

              <div className="input-row-2">
                <div className="form-field">
                  <label>Unidad de Negocio</label>
                  <select name="unidad_negocio" required value={formData.unidad_negocio} onChange={handleChange}>
                    <option value="" disabled>Seleccione unidad</option>
                    {UNIDADES_NEGOCIO.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Área a la que pertenece</label>
                  <select name="area" required value={formData.area} onChange={handleChange}>
                    <option value="" disabled>Seleccione área</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="input-row-2 mt-16">
                <div className="form-field">
                  <label>Departamento al que pertenece</label>
                  <select name="departamento" required value={formData.departamento} onChange={handleChange}>
                    <option value="" disabled>Seleccione depto.</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Escriba su Puesto (A mano)</label>
                  <input type="text" name="puesto" required value={formData.puesto} onChange={handleChange} placeholder="Ej. Promotor de crédito" />
                </div>
              </div>

              <div className="form-field mt-16">
                <label>Seleccione quien autorizó su comisión</label>
                <select name="jefe_inmediato" required value={formData.jefe_inmediato} onChange={handleChange}>
                  <option value="" disabled>Seleccione Autorizador</option>
                  {AUTORIZADORES.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>

            {/* ====== PASO 2: LOGÍSTICA ====== */}
            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">2</span>
                <h2>Logística de la Comisión</h2>
              </div>
              
              <div className="input-row-2">
                <div className="form-field">
                  <label>Origen</label>
                  <input type="text" name="origen" required value={formData.origen} onChange={handleChange} placeholder="Ej. Corporativo" />
                </div>
                <div className="form-field">
                  <label>Lugar de Comisión o Ruta (Destino)</label>
                  <select name="destino" required value={formData.destino} onChange={handleChange}>
                    <option value="" disabled>Seleccione ruta</option>
                    {Object.keys(TABULADOR).map(dest => <option key={dest} value={dest}>{dest}</option>)}
                    <option value="Otro">Otro (Especificar manual)</option>
                  </select>
                </div>
              </div>

              {formData.destino === 'Otro' && (
                <div className="form-field mt-16" style={{ animation: 'fadeIn 0.3s' }}>
                  <label>Especifique su Ruta o Destino</label>
                  <input type="text" value={destinoOtro} onChange={(e) => setDestinoOtro(e.target.value)} required placeholder="Ej. Tlacolula" />
                </div>
              )}

              <div className="input-row-2 mt-16">
                <div className="form-field"><label>Fecha Salida</label><input type="date" name="fecha_salida" required value={formData.fecha_salida} onChange={handleChange} /></div>
                <div className="form-field"><label>Fecha Regreso</label><input type="date" name="fecha_regreso" required value={formData.fecha_regreso} onChange={handleChange} /></div>
              </div>

              <div className="input-row-2 mt-16">
                <div className="form-field">
                  <label>¿Cuántas personas lo acompañan?</label>
                  <select name="num_acompanantes" value={formData.num_acompanantes} onChange={handleChange}>
                    {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} persona(s)</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Medio de Transporte</label>
                  <select name="medio_transporte" required value={formData.medio_transporte} onChange={handleChange}>
                    <option value="" disabled>SELECCIONAR</option>
                    <option value="Autobús">Autobús / Público</option>
                    <option value="Auto Empresa">Auto Empresa</option>
                    <option value="Auto Propio">Auto Propio</option>
                  </select>
                </div>
              </div>

              {parseInt(formData.num_acompanantes) > 0 && (
                <div className="form-field mt-16" style={{ animation: 'fadeIn 0.3s' }}>
                  <label>Nombres de los acompañantes</label>
                  <input type="text" name="nombres_acompanantes" required value={formData.nombres_acompanantes} onChange={handleChange} placeholder="Ej. Juan Pérez, María Gómez" />
                </div>
              )}

              <div className="form-field mt-16"><label>Motivo de la comisión</label><textarea name="motivo" required rows="2" value={formData.motivo} onChange={handleChange}></textarea></div>
            </div>

            {/* ====== PASO 3: GASTOS ====== */}
            <div className="premium-card" style={{ borderLeft: formData.destino && formData.destino !== 'Otro' && formData.dias_comision > 0 ? '4px solid #10b981' : 'none' }}>
              <div className="card-title-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="step-number">3</span>
                  <h2>Desglose de Gastos</h2>
                  {formData.destino && formData.destino !== 'Otro' && formData.dias_comision > 0 && (
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>✓ Auto-calculado</span>
                  )}
                </div>
                <button type="button" onClick={() => setMostrarCatalogo(true)} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#3b82f6', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Ver Tabulador
                </button>
              </div>
              
              <div className="gastos-grid-layout">
                {['alimentos', 'hospedaje', 'pasajes', 'taxis', 'gasolina'].map(gasto => (
                  <div className="gasto-item" key={gasto}>
                    <label style={{textTransform: 'capitalize'}}>{gasto}</label>
                    <div className="money-box">
                      <i>$</i>
                      <input type="number" name={`monto_${gasto}`} min="0" step="0.01" value={formData[`monto_${gasto}`]} onChange={handleChange} placeholder="0.00" style={{ backgroundColor: formData.destino && formData.destino !== 'Otro' ? '#f8fafc' : 'white' }}/>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-field mt-16">
                <label>Otros Gastos / Gastos de Representación</label>
                <div className="money-box" style={{ maxWidth: '200px' }}>
                  <i>$</i>
                  <input type="number" name="monto_otros" min="0" step="0.01" value={formData.monto_otros} onChange={handleChange} placeholder="0.00"/>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Manifieste si requiere más recurso para su comisión, como peajes o representación.</span>
              </div>

              <div className="form-field mt-16">
                <label>Observaciones de sus viáticos</label>
                <textarea name="observaciones" rows="2" value={formData.observaciones} onChange={handleChange} placeholder="Anotaciones adicionales para tesorería o D.H.O."></textarea>
              </div>
            </div>
          </div>

          {/* ====== COLUMNA RESUMEN ====== */}
          <div className="viaticos-summary-column">
            <div className="summary-sticky-card">
              <div className="summary-header"><h3>Resumen de Solicitud</h3></div>
              <div className="summary-body">
                <div className="summary-row"><span>Días de comisión</span><strong>{formData.dias_comision}</strong></div>
                <div className="summary-row"><span>Acompañantes</span><strong>{formData.num_acompanantes}</strong></div>
                <div className="summary-row"><span>Ruta</span><strong>{formData.destino === 'Otro' ? (destinoOtro || 'Sin definir') : (formData.destino || 'Sin definir')}</strong></div>
                <div className="summary-divider"></div>
                <div className="total-display"><p>Total Solicitado</p><h2 className={formData.total_solicitado > 0 ? 'has-value' : ''}>{formatMoney(formData.total_solicitado)}</h2></div>
              </div>
              <div className="summary-footer">
                <button type="submit" className="btn-send-request" disabled={isSubmitting || formData.total_solicitado <= 0}>
                  {isSubmitting ? 'Procesando...' : 'Enviar a D.H.O'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {cargandoSolicitudes ? <p>Cargando su historial...</p> : misSolicitudes.length === 0 ? (
            <div className="premium-card" style={{ textAlign: 'center', padding: '50px' }}><h3 style={{ color: '#64748b' }}>No ha realizado ninguna solicitud aún.</h3></div>
          ) : (
            misSolicitudes.map(sol => (
              <div key={sol.id} className="premium-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', backgroundColor: sol.estatus === 'PENDIENTE' ? '#fef3c7' : sol.estatus === 'AUTORIZADO' ? '#dcfce7' : '#e0e7ff', color: sol.estatus === 'PENDIENTE' ? '#f59e0b' : sol.estatus === 'AUTORIZADO' ? '#16a34a' : '#4f46e5' }}>{sol.estatus}</span>
                  <h3 style={{ margin: '12px 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{sol.destino} - {sol.motivo}</h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>{new Date(sol.fecha_salida).toLocaleDateString()} al {new Date(sol.fecha_regreso).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>Monto Solicitado</p>
                  <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#10b981', fontWeight: '900' }}>{formatMoney(sol.total_solicitado)}</h2>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {sol.url_comprobante_transferencia && (<a href={`http://localhost:3001/${sol.url_comprobante_transferencia}`} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', border: '1px solid #cbd5e1', color: '#475569', background: 'white', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Transferencia</a>)}
                    {(sol.estatus === 'AUTORIZADO' || sol.estatus === 'COMPROBADO') && (
                      <>
                        <input type="file" accept=".pdf,.zip,.jpg,.png" style={{ display: 'none' }} ref={el => fileInputRefs.current[sol.id] = el} onChange={(e) => handleSubirGastos(sol.id, e)} />
                        {sol.url_comprobante_gastos ? (<a href={`http://localhost:3001/${sol.url_comprobante_gastos}`} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Mis Gastos</a>) : (<button onClick={() => fileInputRefs.current[sol.id].click()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>Subir Facturas</button>)}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mostrarCatalogo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '95%', maxWidth: '950px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setMostrarCatalogo(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            <h2 style={{ marginTop: 0, color: '#0f172a', fontSize: '20px' }}>Importes Autorizados</h2>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', backgroundColor: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead><tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}><th style={{ padding: '12px', fontSize: '13px' }}>DESTINO</th><th style={{ padding: '12px', fontSize: '13px' }}>HOSPEDAJE</th><th style={{ padding: '12px', fontSize: '13px' }}>ALIMENTOS</th><th style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>URBAN</th><th style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>BUS/TAXI</th><th style={{ padding: '12px', fontSize: '13px' }}>PEAJE</th><th style={{ padding: '12px', fontSize: '13px' }}>GASOLINA</th></tr></thead>
                <tbody>
                  {Object.entries(TABULADOR).map(([destino, fila], idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '13px' }}>{destino}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.hospedaje ? formatMoney(fila.hospedaje) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.alimentos ? formatMoney(fila.alimentos) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>{fila.urban ? formatMoney(fila.urban) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>{fila.bus ? formatMoney(fila.bus) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.peaje ? formatMoney(fila.peaje) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.gasolina ? formatMoney(fila.gasolina) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Viaticos;