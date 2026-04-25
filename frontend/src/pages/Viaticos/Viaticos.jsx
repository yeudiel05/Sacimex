import React, { useState, useEffect } from 'react';
import './Viaticos.css';

function Viaticos() {
  const [formData, setFormData] = useState({
    puesto: '', jefe_inmediato: '', departamento: '', ubicacion: '',
    origen: '', destino: '', motivo: '',
    fecha_salida: '', fecha_regreso: '', dias_comision: 0,
    medio_transporte: '',
    monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', 
    monto_taxis: '', monto_gasolina: '', monto_otros: '',
    total_solicitado: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcular Días de Comisión Automáticamente
  useEffect(() => {
    if (formData.fecha_salida && formData.fecha_regreso) {
      const salida = new Date(formData.fecha_salida);
      const regreso = new Date(formData.fecha_regreso);
      const diferenciaTiempo = regreso.getTime() - salida.getTime();
      const dias = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24)) + 1;
      setFormData(prev => ({ ...prev, dias_comision: dias > 0 ? dias : 0 }));
    }
  }, [formData.fecha_salida, formData.fecha_regreso]);

  // Calcular Total Automáticamente
  useEffect(() => {
    const total = 
      (parseFloat(formData.monto_alimentos) || 0) +
      (parseFloat(formData.monto_hospedaje) || 0) +
      (parseFloat(formData.monto_pasajes) || 0) +
      (parseFloat(formData.monto_taxis) || 0) +
      (parseFloat(formData.monto_gasolina) || 0) +
      (parseFloat(formData.monto_otros) || 0);
    setFormData(prev => ({ ...prev, total_solicitado: total }));
  }, [
    formData.monto_alimentos, formData.monto_hospedaje, formData.monto_pasajes, 
    formData.monto_taxis, formData.monto_gasolina, formData.monto_otros
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.total_solicitado <= 0) return alert("El monto total debe ser mayor a cero.");
    
    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const res = await fetch('http://localhost:3001/api/viaticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
      } else alert("Hubo un error: " + data.message);
    } catch (error) {
      alert("Error de conexión al servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="viaticos-premium-wrapper fade-in-up">
      <div className="viaticos-header-block">
        <h1>Solicitud de Viáticos</h1>
        <p>Complete los datos de la comisión y los gastos estimados.</p>
      </div>

      <form onSubmit={handleSubmit} className="viaticos-grid-layout">
        
        {/* --- COLUMNA IZQUIERDA: FORMULARIOS --- */}
        <div className="viaticos-form-column">
          
          {/* TARJETA 1: DATOS GENERALES */}
          <div className="premium-card">
            <div className="card-title-box">
              <span className="step-number">1</span>
              <h2>Información del Solicitante</h2>
            </div>
            
            <div className="input-row-2">
              <div className="form-field">
                <label>Puesto</label>
                <div className="select-wrapper">
                  <select name="puesto" required value={formData.puesto} onChange={handleChange}>
                    <option value="" disabled>SELECCIONE PUESTO</option>
                    <option value="ASISTENTE CONTABLE">ASISTENTE CONTABLE</option>
                    <option value="ASISTENTE DE SISTEMAS">ASISTENTE DE SISTEMAS</option>
                    <option value="ASISTENTE DIRECCION GENERAL">ASISTENTE DIRECCION GENERAL</option>
                    <option value="AUXILIAR ADMINISTRATIVO">AUXILIAR ADMINISTRATIVO</option>
                    <option value="CAPACITADOR">CAPACITADOR</option>
                    <option value="CONTADOR">CONTADOR</option>
                    <option value="DIRECTOR GENERAL">DIRECTOR GENERAL</option>
                    <option value="EJECUTIVO DE VENTAS">EJECUTIVO DE VENTAS</option>
                    <option value="ENCARGADO DE TI">ENCARGADO DE TI</option>
                    <option value="GERENTE DE OPERACIONES">GERENTE DE OPERACIONES</option>
                    <option value="GERENTE DE SUCURSAL">GERENTE DE SUCURSAL</option>
                    <option value="GERENTE REGIONAL">GERENTE REGIONAL</option>
                    <option value="SUBDIRECTOR GENERAL">SUBDIRECTOR GENERAL</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Jefe Inmediato</label>
                <div className="select-wrapper">
                  <select name="jefe_inmediato" required value={formData.jefe_inmediato} onChange={handleChange}>
                    <option value="" disabled>SELECCIONE JEFE</option>
                    <option value="C. BEATRIZ CRUZ CANO">C. BEATRIZ CRUZ CANO</option>
                    <option value="C. LILIANA DE LOS ANGELES GARCIA">C. LILIANA DE LOS ANGELES GARCIA</option>
                    <option value="C.P MARIAM ITZEL RAMIREZ CARRASCO">C.P MARIAM ITZEL RAMIREZ CARRASCO</option>
                    <option value="ING GUILLERMO SALINAS ZUÑIGA">ING GUILLERMO SALINAS ZUÑIGA</option>
                    <option value="LIC ERANDI YARETZI RUIZ ALONSO">LIC ERANDI YARETZI RUIZ ALONSO</option>
                    <option value="LIC. JUAN ALBERTO OAXACA GONZALEZ">LIC. JUAN ALBERTO OAXACA GONZALEZ</option>
                    <option value="LIC MARIBEL ROBLES MENDOZA">LIC MARIBEL ROBLES MENDOZA</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="input-row-2">
              <div className="form-field">
                <label>Departamento o Sucursal</label>
                <div className="select-wrapper">
                  <select name="departamento" required value={formData.departamento} onChange={handleChange}>
                    <option value="" disabled>SELECCIONE DEPARTAMENTO</option>
                    <option value="AREA JURIDICA">AREA JURIDICA</option>
                    <option value="COMERCIALIZACION">COMERCIALIZACION</option>
                    <option value="CONTABILIDAD E IMPUESTOS">CONTABILIDAD E IMPUESTOS</option>
                    <option value="DIRECCION GENERAL">DIRECCION GENERAL</option>
                    <option value="FINANZAS Y TESORERIA">FINANZAS Y TESORERIA</option>
                    <option value="MESA DE CONTROL">MESA DE CONTROL</option>
                    <option value="RECURSOS HUMANOS">RECURSOS HUMANOS</option>
                    <option value="SISTEMAS">SISTEMAS</option>
                    <option value="SUCURSALES">SUCURSALES</option>
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label>Sede / Ubicación Física</label>
                <input type="text" name="ubicacion" required placeholder="Ej. Corporativo Oaxaca" value={formData.ubicacion} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* TARJETA 2: LOGÍSTICA */}
          <div className="premium-card">
            <div className="card-title-box">
              <span className="step-number">2</span>
              <h2>Logística de la Comisión</h2>
            </div>

            <div className="input-row-2">
              <div className="form-field">
                <label>Ciudad de Origen</label>
                <input type="text" name="origen" required placeholder="De donde sale" value={formData.origen} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label>Ciudad Destino</label>
                <input type="text" name="destino" required placeholder="A donde va" value={formData.destino} onChange={handleChange} />
              </div>
            </div>
            
            <div className="input-row-3 mt-16">
              <div className="form-field">
                <label>Fecha Salida</label>
                <input type="date" name="fecha_salida" required value={formData.fecha_salida} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label>Fecha Regreso</label>
                <input type="date" name="fecha_regreso" required value={formData.fecha_regreso} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label>Transporte</label>
                <div className="select-wrapper">
                  <select name="medio_transporte" required value={formData.medio_transporte} onChange={handleChange}>
                    <option value="" disabled>SELECCIONA TIPO</option>
                    <option value="Autobús">Autobús</option>
                    <option value="Avión">Avión</option>
                    <option value="Vehículo de la empresa">Vehículo de la empresa</option>
                    <option value="Vehículo propio">Vehículo propio</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-field mt-16">
              <label>Motivo y Objetivo de la Comisión</label>
              <textarea name="motivo" required placeholder="Explique brevemente el propósito del viaje..." rows="3" value={formData.motivo} onChange={handleChange}></textarea>
            </div>
          </div>

          {/* TARJETA 3: GASTOS */}
          <div className="premium-card">
            <div className="card-title-box">
              <span className="step-number">3</span>
              <h2>Desglose de Gastos</h2>
            </div>
            
            <div className="gastos-grid-layout">
              <div className="gasto-item">
                <label>Alimentos</label>
                <div className="money-box">
                  <i>$</i><input type="number" name="monto_alimentos" min="0" step="0.01" value={formData.monto_alimentos} onChange={handleChange} placeholder="0.00"/>
                </div>
              </div>
              <div className="gasto-item">
                <label>Hospedaje</label>
                <div className="money-box">
                  <i>$</i><input type="number" name="monto_hospedaje" min="0" step="0.01" value={formData.monto_hospedaje} onChange={handleChange} placeholder="0.00"/>
                </div>
              </div>
              <div className="gasto-item">
                <label>Pasajes (Vuelo/Bus)</label>
                <div className="money-box">
                  <i>$</i><input type="number" name="monto_pasajes" min="0" step="0.01" value={formData.monto_pasajes} onChange={handleChange} placeholder="0.00"/>
                </div>
              </div>
              <div className="gasto-item">
                <label>Taxis / Uber</label>
                <div className="money-box">
                  <i>$</i><input type="number" name="monto_taxis" min="0" step="0.01" value={formData.monto_taxis} onChange={handleChange} placeholder="0.00"/>
                </div>
              </div>
              <div className="gasto-item">
                <label>Gasolina / Casetas</label>
                <div className="money-box">
                  <i>$</i><input type="number" name="monto_gasolina" min="0" step="0.01" value={formData.monto_gasolina} onChange={handleChange} placeholder="0.00"/>
                </div>
              </div>
              <div className="gasto-item">
                <label>Otros Gastos</label>
                <div className="money-box">
                  <i>$</i><input type="number" name="monto_otros" min="0" step="0.01" value={formData.monto_otros} onChange={handleChange} placeholder="0.00"/>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* --- COLUMNA DERECHA: STICKY SUMMARY --- */}
        <div className="viaticos-summary-column">
          <div className="summary-sticky-card">
            
            <div className="summary-header">
              <h3>Resumen de Solicitud</h3>
            </div>
            
            <div className="summary-body">
              <div className="summary-row">
                <span>Días de comisión calculados</span>
                <strong>{formData.dias_comision} {formData.dias_comision === 1 ? 'Día' : 'Días'}</strong>
              </div>
              
              <div className="summary-divider"></div>

              <div className="total-display">
                <p>Monto Total Solicitado</p>
                <h2 className={formData.total_solicitado > 0 ? 'has-value' : ''}>
                  {formatMoney(formData.total_solicitado)}
                </h2>
              </div>
            </div>

            <div className="summary-footer">
              <button type="submit" className="btn-send-request" disabled={isSubmitting || formData.total_solicitado <= 0}>
                {isSubmitting ? (
                  <span className="loader-text">Procesando...</span>
                ) : (
                  <>
                    Enviar a Tesorería
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </>
                )}
              </button>
              <p className="help-text">Al enviar, la solicitud pasará a revisión de su jefe inmediato.</p>
            </div>

          </div>
        </div>

      </form>
    </div>
  );
}

export default Viaticos;