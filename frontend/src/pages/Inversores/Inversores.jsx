import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Inversores.css';

// --- UTILERÍAS GLOBALES Y MATEMÁTICAS ---
const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

const formatInputMonto = (val) => {
    if (val === null || val === undefined || val === '') return '';
    let strVal = String(val);
    let raw = strVal.replace(/[^0-9.]/g, ''); 
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); 
    if (parts[1] && parts[1].length > 2) parts[1] = parts[1].substring(0, 2); 
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
};

const parseInputMonto = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/,/g, ''); 
};

// Limpiador robusto de fechas
const cleanDateStr = (dateVal) => {
    if (!dateVal) return new Date().toISOString().split('T')[0];
    try {
        if (typeof dateVal === 'string') return dateVal.split('T')[0];
        if (dateVal instanceof Date) {
            if (isNaN(dateVal.getTime())) return new Date().toISOString().split('T')[0];
            return dateVal.toISOString().split('T')[0];
        }
        return new Date().toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
};

// --- ESTILOS CONSTANTES PARA SIMETRÍA ---
const inputStyle = { width: '100%', height: '42px', padding: '0 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'white', boxSizing: 'border-box' };
const inputStyleBg = { ...inputStyle, backgroundColor: '#f8fafc' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };

// --- COMPONENTE: CONSTRUCTOR DE PLAN PERSONALIZADO ---
const PlanPersonalizadoBuilder = ({ plan, setPlan, montoAsignado, plazo, fechaInicio }) => {
    const totalCapital = plan.reduce((acc, curr) => acc + (parseFloat(parseInputMonto(curr.abono)) || 0) + (parseFloat(parseInputMonto(curr.anticipo)) || 0), 0);
    
    useEffect(() => {
        if (plan.length === 0 && plazo && fechaInicio) {
            const arr = [];
            let f = new Date(`${cleanDateStr(fechaInicio)}T12:00:00`);
            const p = parseInt(plazo) || 12;
            for(let i = 1; i <= p; i++) {
                f.setMonth(f.getMonth() + 1);
                arr.push({ id: Date.now() + i, numero: i.toString(), fecha: f.toISOString().split('T')[0], abono: '', anticipo: '' });
            }
            setPlan(arr);
        }
    }, [plan.length, plazo, fechaInicio, setPlan]);

    const regenerarPlan = () => {
        if(window.confirm("¿Regenerar filas base? Perderás lo que hayas escrito.")) {
            const arr = [];
            let f = new Date(`${cleanDateStr(fechaInicio)}T12:00:00`);
            const p = parseInt(plazo) || 12;
            for(let i = 1; i <= p; i++) {
                f.setMonth(f.getMonth() + 1);
                arr.push({ id: Date.now() + i, numero: i.toString(), fecha: f.toISOString().split('T')[0], abono: '', anticipo: '' });
            }
            setPlan(arr);
        }
    };

    const handleAddAnticipo = () => { setPlan([...plan, { id: Date.now(), numero: 'N/A', fecha: '', abono: '', anticipo: '' }]); };
    const handleAddNormal = () => {
        const nextNum = plan.filter(p => p.numero !== 'N/A' && p.numero !== '').length + 1;
        setPlan([...plan, { id: Date.now(), numero: nextNum.toString(), fecha: '', abono: '', anticipo: '' }]);
    };
    const handleRemove = (index) => { setPlan(plan.filter((_, i) => i !== index)); };
    const handleUpdate = (index, field, val) => { const newPlan = [...plan]; newPlan[index][field] = val; setPlan(newPlan); };

    return (
        <div style={{ marginTop: '16px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>Ajuste Manual Institucional</h4>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: totalCapital > parseFloat(montoAsignado || 0) ? '#ef4444' : totalCapital === parseFloat(montoAsignado || 0) ? 'var(--brand-green)' : '#f59e0b', backgroundColor: 'white', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                    Capital Distribuido: {formatMoney(totalCapital)} / {formatMoney(montoAsignado || 0)}
                </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '60px 140px 1fr 1fr 40px', gap: '12px', marginBottom: '8px', padding: '0 4px' }}>
                <div style={labelStyle}>No.</div>
                <div style={labelStyle}>Fecha Exacta</div>
                <div style={labelStyle}>Abono Principal</div>
                <div style={labelStyle}>Anticipo Extra</div>
                <div></div>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '8px' }}>
                {plan.map((p, idx) => (
                    <div key={p.id || idx} style={{ display: 'grid', gridTemplateColumns: '60px 140px 1fr 1fr 40px', gap: '12px', marginBottom: '8px', alignItems: 'center' }}>
                        <input type="text" placeholder="N/A" value={p.numero} onChange={e => handleUpdate(idx, 'numero', e.target.value)} style={{ ...inputStyle, textAlign: 'center', backgroundColor: p.numero === 'N/A' ? '#fef9c3' : 'white', fontWeight: 'bold', color: p.numero === 'N/A' ? '#854d0e' : '#1e293b' }} />
                        <input type="date" value={p.fecha} onChange={e => handleUpdate(idx, 'fecha', e.target.value)} style={inputStyle} />
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>$</span>
                            <input type="text" placeholder="0.00" value={formatInputMonto(p.abono)} onChange={e => handleUpdate(idx, 'abono', parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px', textAlign: 'right' }} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: parseFloat(p.anticipo) > 0 ? '#166534' : '#94a3b8', fontSize: '14px' }}>$</span>
                            <input type="text" placeholder="0.00" value={formatInputMonto(p.anticipo)} onChange={e => handleUpdate(idx, 'anticipo', parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px', textAlign: 'right', backgroundColor: parseFloat(p.anticipo) > 0 ? '#dcfce3' : 'white', borderColor: parseFloat(p.anticipo) > 0 ? '#86efac' : '#cbd5e1' }} />
                        </div>
                        <button type="button" onClick={() => handleRemove(idx)} style={{ height: '42px', width: '100%', color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>✖</button>
                    </div>
                ))}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={handleAddNormal} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', color: '#334155', cursor: 'pointer' }}>+ Fila Normal</button>
                    <button type="button" onClick={handleAddAnticipo} style={{ padding: '8px 16px', backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', color: '#854d0e', cursor: 'pointer' }}>+ Inyección Sorpresa</button>
                </div>
                <button type="button" onClick={regenerarPlan} style={{ padding: '8px 16px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', color: '#991b1b', cursor: 'pointer' }}>↻ Restaurar Calendario</button>
            </div>
        </div>
    );
};

function Inversores() {
    const navigate = useNavigate();
    
    const [monto, setMonto] = useState('');
    const [tasa, setTasa] = useState(0); 
    const [plazo, setPlazo] = useState(12);
    const [tipoAmortizacion, setTipoAmortizacion] = useState('frances');
    const [anticipoMontoSim, setAnticipoMontoSim] = useState('');
    const [anticipoMesSim, setAnticipoMesSim] = useState('');
    const [fechaInicioSim, setFechaInicioSim] = useState(new Date().toISOString().split('T')[0]);
    const [fechaPrimerPagoSim, setFechaPrimerPagoSim] = useState('');
    const [abonoCapitalLibre, setAbonoCapitalLibre] = useState('');
    const [planPersonalizadoSim, setPlanPersonalizadoSim] = useState([]); 
    
    const [gananciaNeta, setGananciaNeta] = useState(0);
    const [totalRecibir, setTotalRecibir] = useState(0);
    const [tablaAmortizacion, setTablaAmortizacion] = useState([]);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [inversores, setInversores] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [formData, setFormData] = useState({ 
        tipo_persona: 'FISICA', nombre: '', apellidos: '', rfc: '', direccion: '', telefono: '', email: '', 
        clabe_bancaria: '', numero_cuenta: '', banco: '', origen_fondos: 'Ahorros Personales / Salario',
        limite_credito: '', ben_nombre: '', ben_parentesco: '', ben_telefono: ''
    });
    
    const [isFondeoModalOpen, setIsFondeoModalOpen] = useState(false);
    const [filtroFondeador, setFiltroFondeador] = useState(''); 
    const [dropdownFondeadorOpen, setDropdownFondeadorOpen] = useState(false); 
    const [formFondeo, setFormFondeo] = useState({ 
        id_inversor: '', monto_inicial: '', id_tasa: '', plazo_meses: '12', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', 
        fecha_inicio: new Date().toISOString().split('T')[0], plan_personalizado: []
    });

    const [panelOpen, setPanelOpen] = useState(false);
    const [inversorActivo, setInversorActivo] = useState(null);
    const [activeTab, setActiveTab] = useState('contratos');
    const [tasas, setTasas] = useState([]); 
    const [contratos, setContratos] = useState([]);
    const [showNuevoContrato, setShowNuevoContrato] = useState(false);
    const [formContrato, setFormContrato] = useState({ 
        id_tasa: '', monto_inicial: '', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', reinversion_automatica: 0, fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '', plan_personalizado: [] 
    });
    
    const [beneficiarios, setBeneficiarios] = useState([]);
    const [formBeneficiario, setFormBeneficiario] = useState({ nombre_completo: '', parentesco: '', telefono: '', porcentaje: '', fecha_nacimiento: '' });
    const [movimientos, setMovimientos] = useState([]);
    const [showNuevoMovimiento, setShowNuevoMovimiento] = useState(false);
    const [formMovimiento, setFormMovimiento] = useState({ id_contrato: '', tipo: 'PAGO_INTERES', monto: '' });
    const [fileComprobante, setFileComprobante] = useState(null);

    const [showVisorAmortizacion, setShowVisorAmortizacion] = useState(false);
    const [contratoParaAmortizacion, setContratoParaAmortizacion] = useState(null);
    const [anticiposInteractivos, setAnticiposInteractivos] = useState({});
    const [pagosIrregulares, setPagosIrregulares] = useState([]); 
    const [tablaInteractivaRender, setTablaInteractivaRender] = useState([]);
    const [totalesInteractivos, setTotalesInteractivos] = useState({ interes: 0, total: 0 });

    const getAuthHeaders = () => { const token = localStorage.getItem('token'); if (!token) { navigate('/'); return null; } return { 'Authorization': `Bearer ${token}` }; };
    const handleAuthError = (status) => { if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; } return false; };

    const fetchTasasActivas = async () => { const headers = getAuthHeaders(); if (!headers) return; try { const res = await fetch('http://localhost:3001/api/tasas', { headers }); const data = await res.json(); if (data.success) setTasas(data.data.filter(t => t.estatus_activo === 1 && (!t.tipo_producto || t.tipo_producto === 'FONDEO'))); } catch (error) { console.error(error); } };
    const fetchInversores = async () => { const headers = getAuthHeaders(); if (!headers) return; try { const response = await fetch('http://localhost:3001/api/inversores', { headers }); if (handleAuthError(response.status)) return; const data = await response.json(); if (data.success) setInversores(data.data); } catch (error) { console.error(error); } };

    useEffect(() => { fetchInversores(); fetchTasasActivas(); }, []);

    useEffect(() => {
        const m = parseFloat(monto) || 0;
        const t = parseFloat(tasa) || 0;
        const p = parseInt(plazo) || 0;
        const aMonto = parseFloat(anticipoMontoSim) || 0;
        const aMes = parseInt(anticipoMesSim) || 0;

        if (m <= 0 || t <= 0 || p <= 0) { setTablaAmortizacion([]); setGananciaNeta(0); setTotalRecibir(0); return; }

        const tasaAnual = t / 100; const tasaMensual = tasaAnual / 12;
        let saldo = m; let tabla = []; let totalInteres = 0; let totalGeneral = 0;
        const cuotaPuraFrances = m * (tasaMensual / (1 - Math.pow(1 + tasaMensual, -p)));
        const capitalFijoAleman = m / p;
        const capLibre = parseFloat(abonoCapitalLibre) || 0;
        const tasaSeleccionadaObj = tasas.find(item => parseFloat(item.tasa_anual_esperada) === t);
        const cobraIva = tasaSeleccionadaObj ? (tasaSeleccionadaObj.cobra_iva === 1) : false; 

        if (tipoAmortizacion === 'personalizado') {
            let fechaAnterior = new Date(`${cleanDateStr(fechaInicioSim)}T12:00:00`);
            let planOrdenado = [...planPersonalizadoSim].filter(r => r.fecha).sort((a,b) => new Date(cleanDateStr(a.fecha)) - new Date(cleanDateStr(b.fecha)));
            
            planOrdenado.forEach(row => {
                let fechaActual = new Date(`${cleanDateStr(row.fecha)}T12:00:00`);
                if(isNaN(fechaActual.getTime())) fechaActual = new Date(fechaAnterior);
                
                let diffTime = Math.abs(Date.UTC(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate()) - Date.UTC(fechaAnterior.getFullYear(), fechaAnterior.getMonth(), fechaAnterior.getDate()));
                let diasTranscurridos = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
                
                let interes = (saldo * tasaAnual / 360) * diasTranscurridos;
                let abonoReal = parseFloat(parseInputMonto(row.abono)) || 0;
                let anticipoReal = parseFloat(parseInputMonto(row.anticipo)) || 0;
                let capital = abonoReal + anticipoReal;
                
                if (capital > saldo) {
                    capital = saldo;
                    if (abonoReal > saldo) { abonoReal = saldo; anticipoReal = 0; } else { anticipoReal = saldo - abonoReal; }
                }
                
                let iva = cobraIva ? (interes * 0.16) : 0;
                let totalPago = capital + interes + iva;
                saldo -= capital; if (saldo < 0.01) saldo = 0;

                tabla.push({ numero: row.numero || 'N/A', abono: abonoReal, anticipo: anticipoReal, interes: interes, iva: iva, pagoTotal: totalPago, saldoFinal: saldo, dias: diasTranscurridos, fechaStr: fechaActual.toLocaleDateString('es-MX') });
                totalInteres += interes; totalGeneral += totalPago;
                fechaAnterior = new Date(fechaActual);
            });
        } else {
            let fechaAnterior = new Date(`${cleanDateStr(fechaInicioSim)}T12:00:00`);
            let fechaActual = new Date(`${cleanDateStr(fechaPrimerPagoSim || fechaInicioSim)}T12:00:00`);
            if (!fechaPrimerPagoSim && tipoAmortizacion !== 'personalizado') fechaActual.setMonth(fechaActual.getMonth() + 1);

            for (let i = 1; i <= p; i++) {
                let interes = 0; let capital = 0; let diasTranscurridos = 30; let abonoReal = 0; let anticipoReal = 0;

                if (tipoAmortizacion === 'diario') {
                    let diffTime = Math.abs(Date.UTC(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate()) - Date.UTC(fechaAnterior.getFullYear(), fechaAnterior.getMonth(), fechaAnterior.getDate()));
                    diasTranscurridos = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
                    interes = (saldo * tasaAnual / 360) * diasTranscurridos;
                    capital = capLibre;
                } else {
                    interes = saldo * tasaMensual;
                    capital = tipoAmortizacion === 'frances' ? (cuotaPuraFrances - interes) : capitalFijoAleman;
                }

                abonoReal = capital;
                if (i === aMes && aMonto > 0) { anticipoReal = aMonto; capital += aMonto; }
                if (i === p && saldo > capital) { abonoReal += (saldo - capital); capital = saldo; } else if (capital > saldo) { capital = saldo; abonoReal = saldo; anticipoReal = 0; }

                let iva = cobraIva ? (interes * 0.16) : 0;
                let totalPago = capital + interes + iva;
                saldo -= capital; if (saldo < 0.01) saldo = 0;

                tabla.push({ numero: i.toString(), abono: abonoReal, anticipo: anticipoReal, interes: interes, iva: iva, pagoTotal: totalPago, saldoFinal: saldo, dias: diasTranscurridos, fechaStr: tipoAmortizacion === 'diario' ? fechaActual.toLocaleDateString('es-MX') : '-' });
                totalInteres += interes; totalGeneral += totalPago;
                if (saldo === 0) break;
                if (tipoAmortizacion === 'diario') { fechaAnterior = new Date(fechaActual); fechaActual.setMonth(fechaActual.getMonth() + 1); }
            }
        }
        setTablaAmortizacion(tabla); setGananciaNeta(totalInteres); setTotalRecibir(totalGeneral); 
    }, [monto, tasa, plazo, anticipoMontoSim, anticipoMesSim, tipoAmortizacion, fechaInicioSim, fechaPrimerPagoSim, abonoCapitalLibre, tasas, planPersonalizadoSim]);

    useEffect(() => {
        if (!contratoParaAmortizacion || !showVisorAmortizacion) return;

        try {
            const c = contratoParaAmortizacion;
            const m = parseFloat(c.monto_inicial) || 0;
            const t = parseFloat(c.tasa_anual_esperada) || 0;
            const tipoReal = String(c.tipo_amortizacion || 'frances').toLowerCase().trim();
            
            let planBaseGuardado = [];
            if (c.plan_json) {
                try {
                    let temp = c.plan_json;
                    while (typeof temp === 'string') { temp = JSON.parse(temp); }
                    if (Array.isArray(temp)) { planBaseGuardado = temp; }
                } catch (e) { console.error("[VISOR] Error parseando plan_json:", e); }
            }

            const tasaAnual = t / 100; const tasaMensual = tasaAnual / 12;
            let saldo = m; let tabla = []; let totalInteres = 0; let totalGeneral = 0;
            
            const tasaConfig = tasas.find(item => item.id === c.id_tasa);
            const cobraIva = tasaConfig ? (tasaConfig.cobra_iva === 1) : false; 

            const fInicioStr = cleanDateStr(c.fecha_inicio);
            let fechaAnterior = new Date(`${fInicioStr}T12:00:00`);
            if (isNaN(fechaAnterior.getTime())) fechaAnterior = new Date();

            let timelineUnificado = [];

            if (tipoReal === 'personalizado' && planBaseGuardado.length > 0) {
                timelineUnificado = planBaseGuardado.map((row, i) => ({
                    indexUI: `base_${i}`,
                    numero: row.numero || (i + 1).toString(),
                    fechaStr: cleanDateStr(row.fecha),
                    abonoFijo: parseFloat(parseInputMonto(row.abono)) || 0,
                    anticipoFijo: parseFloat(parseInputMonto(row.anticipo)) || 0,
                    esIrregular: false
                }));
            } else {
                const fFinStr = cleanDateStr(c.fecha_fin);
                let fFin = new Date(`${fFinStr}T12:00:00`);
                if(isNaN(fFin.getTime())) { fFin = new Date(fechaAnterior); fFin.setMonth(fechaAnterior.getMonth() + 12); }
                let plazoMeses = Math.max(1, Math.round((fFin - fechaAnterior) / (1000 * 60 * 60 * 24 * 30.44)));
                if (isNaN(plazoMeses) || plazoMeses < 1) plazoMeses = 12;
                
                let fTemp = new Date(fechaAnterior);
                for(let i=1; i<=plazoMeses; i++){
                    fTemp.setMonth(fTemp.getMonth() + 1);
                    let capFijo = 0;
                    if(tipoReal === 'aleman') capFijo = m / plazoMeses;
                    
                    timelineUnificado.push({
                        indexUI: `base_${i}`,
                        numero: i.toString(),
                        fechaStr: fTemp.toISOString().split('T')[0],
                        abonoFijo: capFijo, 
                        anticipoFijo: 0,
                        esIrregular: false
                    });
                }
            }

            pagosIrregulares.forEach(pago => {
                if (pago.fecha && parseFloat(parseInputMonto(pago.monto)) > 0) {
                    timelineUnificado.push({
                        indexUI: `irreg_${pago.id}`,
                        numero: 'N/A',
                        fechaStr: cleanDateStr(pago.fecha),
                        abonoFijo: 0,
                        anticipoFijo: parseFloat(parseInputMonto(pago.monto)),
                        esIrregular: true
                    });
                }
            });

            timelineUnificado.sort((a,b) => new Date(`${a.fechaStr}T12:00:00`) - new Date(`${b.fechaStr}T12:00:00`));

            let p_frances_meses_restantes = timelineUnificado.filter(r => !r.esIrregular).length;

            timelineUnificado.forEach((row) => {
                let fechaActual = new Date(`${row.fechaStr}T12:00:00`);
                if(isNaN(fechaActual.getTime())) fechaActual = new Date(fechaAnterior);
                
                let diffTime = Math.abs(Date.UTC(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate()) - Date.UTC(fechaAnterior.getFullYear(), fechaAnterior.getMonth(), fechaAnterior.getDate()));
                let diasTranscurridos = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
                
                let interes = (saldo * tasaAnual / 360) * diasTranscurridos;
                let abonoReal = row.abonoFijo;
                
                if (tipoReal === 'frances' && !row.esIrregular && p_frances_meses_restantes > 0) {
                    let cuotaPura = (saldo * (tasaMensual / (1 - Math.pow(1 + tasaMensual, -p_frances_meses_restantes))));
                    abonoReal = cuotaPura - interes;
                    p_frances_meses_restantes--;
                }

                let anticipoExtraUI = parseFloat(parseInputMonto(anticiposInteractivos[row.indexUI])) || 0;
                let anticipoReal = row.anticipoFijo + anticipoExtraUI;
                
                let capital = abonoReal + anticipoReal;
                if (capital > saldo) {
                    capital = saldo;
                    if (abonoReal > saldo) { abonoReal = saldo; anticipoReal = 0; } else { anticipoReal = saldo - abonoReal; }
                }
                
                let iva = cobraIva ? (interes * 0.16) : 0;
                let totalPago = capital + interes + iva;
                saldo -= capital; if (saldo < 0.01) saldo = 0;

                tabla.push({ 
                    indexUI: row.indexUI, 
                    numero: row.numero, 
                    abono: abonoReal, 
                    anticipo: anticipoReal, 
                    interes: interes, 
                    iva: iva, 
                    pagoTotal: totalPago, 
                    saldoFinal: saldo, 
                    dias: diasTranscurridos, 
                    fechaStr: fechaActual.toLocaleDateString('es-MX') 
                });
                
                totalInteres += interes; totalGeneral += totalPago;
                fechaAnterior = new Date(fechaActual);
            });

            setTablaInteractivaRender(tabla);
            setTotalesInteractivos({ interes: totalInteres, total: totalGeneral });

        } catch (e) {
            console.error("Error fatal al renderizar el visor interactivo:", e);
            setTablaInteractivaRender([]);
        }
    }, [contratoParaAmortizacion, showVisorAmortizacion, anticiposInteractivos, pagosIrregulares]);

    const handleAnticipoInteractivoChange = (indexUI, valueStr) => {
        const val = parseInputMonto(valueStr);
        setAnticiposInteractivos(prev => ({ ...prev, [indexUI]: val }));
    };

    const handlePagoIrregularChange = (index, field, val) => {
        const newPagos = [...pagosIrregulares];
        newPagos[index][field] = val;
        setPagosIrregulares(newPagos);
    };

    const removePagoIrregular = (index) => {
        setPagosIrregulares(pagosIrregulares.filter((_, i) => i !== index));
    };

    const descargarPDFInteractivo = async () => {
        const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true);
        try {
            const url = `http://localhost:3001/api/inversores/contratos/${contratoParaAmortizacion.id}/tabla-amortizacion/generar-pdf`;
            const payload = {
                tablaData: tablaInteractivaRender,
                fondeador: inversorActivo?.nombre || '',
                montoInicial: contratoParaAmortizacion.monto_inicial,
                tasa: contratoParaAmortizacion.tasa_anual_esperada,
                sistema: contratoParaAmortizacion.tipo_amortizacion || 'frances',
                fechaInicio: cleanDateStr(contratoParaAmortizacion.fecha_inicio) 
            };

            const response = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Accept': 'application/pdf' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("Fallo de servidor al generar PDF.");
            
            const blob = await response.blob();
            const objUrl = window.URL.createObjectURL(blob); 
            const link = document.createElement('a'); 
            link.href = objUrl; link.download = `Amortizacion_Contrato_${contratoParaAmortizacion.id}.pdf`; 
            document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(objUrl);
        } catch (error) { 
            alert(`Error al generar el PDF: ${error.message}`); 
        } finally { setIsLoading(false); }
    };

    const openNewModal = () => { setIsEditing(false); setEditId(null); setFormError(''); setFormData({ tipo_persona: 'FISICA', nombre: '', apellidos: '', rfc: '', direccion: '', telefono: '', email: '', clabe_bancaria: '', numero_cuenta: '', banco: '', origen_fondos: 'Ahorros Personales / Salario', limite_credito: '', ben_nombre: '', ben_parentesco: '', ben_telefono: '' }); setIsModalOpen(true); };
    const openEditModal = (inversor) => { setIsEditing(true); setEditId(inversor.id); setFormError(''); setFormData({ tipo_persona: inversor.tipo_persona || 'FISICA', nombre: inversor.nombre, apellidos: '', rfc: inversor.rfc || '', direccion: inversor.ubicacion, telefono: inversor.telefono, email: inversor.email, clabe_bancaria: inversor.clabe_bancaria, numero_cuenta: inversor.numero_cuenta || '', banco: inversor.banco, origen_fondos: inversor.origen_fondos || 'Ahorros Personales / Salario', limite_credito: inversor.limite_credito || '', ben_nombre: '', ben_parentesco: '', ben_telefono: '' }); setIsModalOpen(true); };
    const triggerEliminarInversor = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Fondeador', message: `¿Estás seguro de eliminar a ${nombre}?`, onConfirm: () => ejecutarEliminarInversor(id) }); };
    const ejecutarEliminarInversor = async (id) => { const headers = getAuthHeaders(); if (!headers) return; try { const res = await fetch(`http://localhost:3001/api/inversores/${id}`, { method: 'DELETE', headers }); if (handleAuthError(res.status)) return; if ((await res.json()).success) fetchInversores(); } catch (error) { console.error(error); } };

    const validarFormulario = () => {
        setFormError('');
        if (!formData.nombre.trim()) { setFormError('El Nombre es obligatorio.'); return false; }
        if (!formData.limite_credito || parseFloat(formData.limite_credito) <= 0) { setFormError('Debe asignar un Límite de Crédito.'); return false; }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!validarFormulario()) return;
        const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true);
        const url = isEditing ? `http://localhost:3001/api/inversores/${editId}` : 'http://localhost:3001/api/inversores';
        const method = isEditing ? 'PUT' : 'POST';
        
        const payload = { ...formData, limite_credito: parseInputMonto(formData.limite_credito) };

        try {
            const res = await fetch(url, { method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (handleAuthError(res.status)) return;
            const data = await res.json();
            if (data.success) { setIsModalOpen(false); fetchInversores(); } else setFormError(data.message);
        } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
    };

    const cambiarEstatusInversor = async (id_persona, estatus_actual) => {
        const nuevoEstatus = estatus_actual === 1 ? 0 : 1; const authHeaders = getAuthHeaders(); if (!authHeaders) return;
        try { const response = await fetch(`http://localhost:3001/api/inversores/${id_persona}/estatus`, { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) }); if (handleAuthError(response.status)) return; if ((await response.json()).success) fetchInversores(); } catch (error) {}
    };

    const abrirModalFondeoDesdeSimulador = () => {
        setFormFondeo(prev => ({ ...prev, monto_inicial: monto || '', id_tasa: tasa ? tasas.find(t => parseFloat(t.tasa_anual_esperada) === parseFloat(tasa))?.id || '' : '', plazo_meses: plazo || '12', tipo_amortizacion: tipoAmortizacion, fecha_inicio: fechaInicioSim, plan_personalizado: tipoAmortizacion === 'personalizado' ? [...planPersonalizadoSim] : [] }));
        setIsFondeoModalOpen(true);
    };

    const handleCrearFondeo = async (e) => {
        e.preventDefault();
        if(!formFondeo.id_inversor || !formFondeo.monto_inicial || !formFondeo.id_tasa) return alert("Completa todos los campos.");
        const inversor = inversores.find(i => i.id == formFondeo.id_inversor);
        if (inversor && parseFloat(parseInputMonto(formFondeo.monto_inicial)) > parseFloat(inversor.limite_credito)) return alert(`Error: El monto excede el límite.`);
        
        const payload = { ...formFondeo }; 
        payload.monto_inicial = parseInputMonto(payload.monto_inicial); 
        if (payload.tipo_amortizacion === 'personalizado') payload.plan_json = JSON.stringify(payload.plan_personalizado);
        
        const headers = getAuthHeaders(); setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/inversores/inversion', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if(data.success) { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); setFormFondeo({ id_inversor: '', monto_inicial: '', id_tasa: '', plazo_meses: '12', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', fecha_inicio: new Date().toISOString().split('T')[0], plan_personalizado: [] }); setFiltroFondeador(''); fetchInversores(); alert("Contrato Generado."); } else alert(data.message);
        } catch(error) { alert("Error al registrar."); } finally { setIsLoading(false); }
    };

    const abrirPanel = async (inversor) => { setInversorActivo(inversor); setActiveTab('contratos'); setShowNuevoContrato(false); setShowNuevoMovimiento(false); setPanelOpen(true); fetchContratos(inversor.id); fetchBeneficiarios(inversor.id); fetchMovimientos(inversor.id); };
    const fetchContratos = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/contratos/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setContratos(data.data); } catch(e) {} };
    
    const getMesesContratoAntiguo = () => { if(!formContrato.fecha_inicio || !formContrato.fecha_fin) return 12; const start = new Date(formContrato.fecha_inicio); const end = new Date(formContrato.fecha_fin); return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44))); };

    const handleGuardarContrato = async (e) => { 
        e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true); 
        const payload = { ...formContrato, id_inversor: inversorActivo.id };
        payload.monto_inicial = parseInputMonto(payload.monto_inicial); 
        if (payload.tipo_amortizacion === 'personalizado') payload.plan_json = JSON.stringify(payload.plan_personalizado);
        try { const res = await fetch('http://localhost:3001/api/inversores/contratos', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if (data.success) { setShowNuevoContrato(false); fetchContratos(inversorActivo.id); } else alert(data.message); } catch (error) {} finally { setIsLoading(false); } 
    };

    const generarPDFContrato = async (id_contrato) => { const headers = getAuthHeaders(); setIsLoading(true); try { const response = await fetch(`http://localhost:3001/api/inversores/contratos/${id_contrato}/pdf`, { headers }); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Contrato_${id_contrato}.pdf`; link.click(); } catch (error) {} finally { setIsLoading(false); } };

    const fetchBeneficiarios = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/beneficiarios/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setBeneficiarios(data.data); } catch(e) {} };
    const totalPorcentaje = beneficiarios.reduce((acc, curr) => acc + parseFloat(curr.porcentaje), 0);
    const handleGuardarBeneficiario = async (e) => { e.preventDefault(); if (totalPorcentaje + parseFloat(formBeneficiario.porcentaje) > 100) return alert("Excede el 100%."); const headers = getAuthHeaders(); setIsLoading(true); try { const res = await fetch('http://localhost:3001/api/inversores/beneficiarios', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formBeneficiario, id_inversor: inversorActivo.id }) }); const data = await res.json(); if (data.success) { setFormBeneficiario({ nombre_completo: '', parentesco: '', telefono: '', porcentaje: '', fecha_nacimiento: '' }); fetchBeneficiarios(inversorActivo.id); } } catch (error) {} finally { setIsLoading(false); } };
    const eliminarBeneficiario = async (id) => { if (!window.confirm("¿Eliminar?")) return; const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/beneficiarios/${id}`, { method: 'DELETE', headers }); if ((await res.json()).success) fetchBeneficiarios(inversorActivo.id); } catch (error) {} };

    const fetchMovimientos = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/movimientos/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setMovimientos(data.data); } catch(e){} };
    const handleGuardarMovimiento = async (e) => { e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true); const formDataUpload = new FormData(); formDataUpload.append('id_contrato', formMovimiento.id_contrato); formDataUpload.append('tipo', formMovimiento.tipo); formDataUpload.append('monto', parseInputMonto(formMovimiento.monto)); if (fileComprobante) formDataUpload.append('comprobante', fileComprobante); try { const res = await fetch('http://localhost:3001/api/inversores/movimientos', { method: 'POST', headers, body: formDataUpload }); const data = await res.json(); if (data.success) { setShowNuevoMovimiento(false); fetchMovimientos(inversorActivo.id); } } catch (error) {} finally { setIsLoading(false); } };

    const inversoresFiltrados = inversores.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (i.rfc && i.rfc.toLowerCase().includes(searchTerm.toLowerCase())));
    const indexOfLastItem = currentPage * itemsPerPage; const indexOfFirstItem = indexOfLastItem - itemsPerPage; const currentInversores = inversoresFiltrados.slice(indexOfFirstItem, indexOfLastItem); const totalPages = Math.ceil(inversoresFiltrados.length / itemsPerPage);
    const nextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }; const prevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
    const inversoresParaFondeo = inversores.filter(inv => { if (inv.estatus_activo !== 1) return false; if (!filtroFondeador) return true; const term = filtroFondeador.toLowerCase().trim(); return (inv.nombre || '').toLowerCase().includes(term) || (inv.rfc || '').toLowerCase().includes(term) || (inv.telefono || '').toLowerCase().includes(term); });

    const TabContratos = () => (
        <div className="tab-content fade-in-up">
            {!showNuevoContrato ? (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 'bold' }}>CONTRATOS VIGENTES</h4>
                        <button style={{ backgroundColor: 'var(--brand-green)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }} onClick={() => setShowNuevoContrato(true)}>
                            + Nuevo Fondeo
                        </button>
                    </div>
                    {contratos.length > 0 ? contratos.map(c => (
                        <div key={c.id} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
                                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>Contrato #{c.id.toString().padStart(4, '0')}</span>
                                <span style={{ backgroundColor: '#e0f2fe', color: '#1e40af', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{c.estatus}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Monto Fondeado</span>
                                    <h3 style={{ margin: 0, fontSize: '28px', color: 'var(--brand-green)', fontWeight: '800' }}>{formatMoney(c.monto_inicial)}</h3>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'block', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Tasa / Producto</span>
                                    <div style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: '700' }}>{c.nombre_tasa} ({c.tasa_anual_esperada}%)</div>
                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Amortización: {c.tipo_amortizacion ? c.tipo_amortizacion.toUpperCase() : 'N/A'}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '14px', color: '#475569' }}>Vence: <strong style={{ color: '#0f172a' }}>{new Date(c.fecha_fin).toLocaleDateString()}</strong></span>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => generarPDFContrato(c.id)}>Ver Contrato</button>
                                    <button style={{ padding: '10px 20px', backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: 'white', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)' }} onClick={() => { setContratoParaAmortizacion(c); setAnticiposInteractivos({}); setPagosIrregulares([]); setShowVisorAmortizacion(true); }}>Ver Amortización</button>
                                </div>
                            </div>
                        </div>
                    )) : <div className="empty-state" style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', color: '#64748b', border: '1px dashed #cbd5e1' }}>Sin capital activo en este momento.</div>}
                </>
            ) : (
                <form className="nuevo-contrato-form" onSubmit={handleGuardarContrato} style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>CREAR CONTRATO ESTÁTICO</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Monto</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>$</span>
                                <input type="text" required placeholder="0.00" value={formatInputMonto(formContrato.monto_inicial)} onChange={e => setFormContrato({ ...formContrato, monto_inicial: parseInputMonto(e.target.value) })} style={{ ...inputStyle, paddingLeft: '28px' }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Sistema de Amortización</label>
                            <select required value={formContrato.tipo_amortizacion} onChange={e => setFormContrato({ ...formContrato, tipo_amortizacion: e.target.value })} style={inputStyle}>
                                <option value="frances">Cuota Fija (Sistema Francés)</option>
                                <option value="aleman">Capital Fijo (Sistema Alemán)</option>
                                <option value="diario">Saldos Diarios (Abono Libre)</option>
                                <option value="personalizado">Plan Personalizado (Institucional)</option>
                            </select>
                        </div>
                    </div>

                    {formContrato.tipo_amortizacion === 'personalizado' && (
                        <div style={{ marginBottom: '16px' }}>
                            <PlanPersonalizadoBuilder plan={formContrato.plan_personalizado} setPlan={(p) => setFormContrato({...formContrato, plan_personalizado: p})} montoAsignado={formContrato.monto_inicial} plazo={getMesesContratoAntiguo()} fechaInicio={formContrato.fecha_inicio} />
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={labelStyle}>Producto Tasa</label>
                            <select required value={formContrato.id_tasa} onChange={e => setFormContrato({ ...formContrato, id_tasa: e.target.value })} style={inputStyle}>
                                <option value="">Seleccione...</option>
                                {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa} - {t.tasa_anual_esperada}%</option>))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div><label style={labelStyle}>Fecha Inicio</label><input type="date" required value={formContrato.fecha_inicio} onChange={e => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Fecha Vencimiento</label><input type="date" required value={formContrato.fecha_fin} onChange={e => setFormContrato({ ...formContrato, fecha_fin: e.target.value })} style={inputStyle} /></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                        <button type="button" onClick={() => setShowNuevoContrato(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" disabled={isLoading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--brand-green)', color: 'white', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>{isLoading ? 'Guardando...' : 'Guardar Contrato'}</button>
                    </div>
                </form>
            )}
        </div>
    );

    const TabBeneficiarios = () => ( <div className="tab-content fade-in-up"> <div className="progress-container"> <div className="progress-header"> <strong>Porcentaje Asignado</strong> <span style={{ color: totalPorcentaje === 100 ? 'var(--brand-green)' : 'var(--text-muted)' }}>{totalPorcentaje}% / 100%</span> </div> <div className="progress-bg" style={{ backgroundColor: '#e2e8f0', borderRadius: '10px', height: '8px' }}><div className={`progress-fill ${totalPorcentaje === 100 ? 'full' : ''}`} style={{ width: `${totalPorcentaje}%`, backgroundColor: 'var(--brand-green)', height: '100%', borderRadius: '10px' }}></div></div> </div> {beneficiarios.length > 0 && ( <div className="beneficiarios-list" style={{ marginTop: '24px' }}> {beneficiarios.map(b => ( <div className="beneficiario-card" key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px' }}> <div className="b-info"> <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>{b.nombre_completo}</strong> <span style={{ fontSize: '13px', color: '#64748b' }}>Parentesco: {b.parentesco} • Tel: {b.telefono || 'N/A'}</span> </div> <div className="b-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}> <span className="b-percent" style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--brand-green)' }}>{b.porcentaje}%</span> <button onClick={() => eliminarBeneficiario(b.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px' }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> </button> </div> </div> ))} </div> )} {totalPorcentaje < 100 && ( <form style={{ marginTop: '32px', backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onSubmit={handleGuardarBeneficiario}> <h4 style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>Añadir Beneficiario Adicional</h4> <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}> <div><label style={labelStyle}>Nombre Completo</label><input type="text" required value={formBeneficiario.nombre_completo} onChange={e => setFormBeneficiario({ ...formBeneficiario, nombre_completo: e.target.value })} style={inputStyle} /></div> </div> <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}> <div><label style={labelStyle}>Teléfono</label><input type="text" required maxLength="10" value={formBeneficiario.telefono} onChange={e => setFormBeneficiario({ ...formBeneficiario, telefono: e.target.value.replace(/[^0-9]/g, '') })} style={inputStyle} /></div> <div><label style={labelStyle}>Parentesco</label><select required value={formBeneficiario.parentesco} onChange={e => setFormBeneficiario({ ...formBeneficiario, parentesco: e.target.value })} style={inputStyle}><option value="">Selecciona...</option><option value="Esposo/a">Esposo/a</option><option value="Hijo/a">Hijo/a</option><option value="Otro">Otro</option></select></div> <div><label style={labelStyle}>Porcentaje (%)</label><input type="number" required min="1" max={100 - totalPorcentaje} value={formBeneficiario.porcentaje} onChange={e => setFormBeneficiario({ ...formBeneficiario, porcentaje: e.target.value })} style={inputStyle} /></div> </div> <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="submit" disabled={isLoading} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--brand-green)', color: 'white', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>{isLoading ? 'Guardando...' : 'Agregar Beneficiario'}</button></div> </form> )} </div> );
    const TabMovimientos = () => ( <div className="tab-content fade-in-up"> {!showNuevoMovimiento ? ( <> <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}> <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 'bold' }}>HISTORIAL DE MOVIMIENTOS</h4> {contratos.length > 0 && (<button style={{ backgroundColor: 'var(--brand-green)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowNuevoMovimiento(true)}>+ Registrar Movimiento</button>)} </div> {contratos.length === 0 && <div className="empty-state" style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', color: '#64748b', border: '1px dashed #cbd5e1' }}>Debes crear un contrato de fondeo primero.</div>} {movimientos.length > 0 ? ( <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}> {movimientos.map(mov => { const isIngreso = mov.tipo === 'DEPOSITO'; const iconColor = isIngreso ? 'var(--brand-green)' : '#ef4444'; const bgColor = isIngreso ? '#dcfce3' : '#fee2e2'; return ( <div key={mov.id} style={{ display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}> <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: bgColor, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '20px' }}><path d={isIngreso ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M19 12l-7 7-7-7"}></path></svg></div> <div style={{ flex: 1 }}> <strong style={{ display: 'block', fontSize: '14px', color: '#1e293b', marginBottom: '2px' }}>{mov.tipo.replace('_', ' ')}</strong> <span style={{ fontSize: '12px', color: '#64748b' }}>Contrato #{mov.id_contrato.toString().padStart(4, '0')} • {new Date(mov.fecha_movimiento).toLocaleDateString()}</span> </div> <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}> <span style={{ fontSize: '16px', fontWeight: 'bold', color: iconColor }}>{isIngreso ? '+' : '-'}{formatMoney(mov.monto)}</span> {mov.recibo_comprobante && (<a href={`http://localhost:3001/${mov.recibo_comprobante}`} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', color: '#475569', textDecoration: 'none', fontWeight: 'bold' }}>Ver</a>)} </div> </div> ); })} </div> ) : (contratos.length > 0 && <div className="empty-state" style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', color: '#64748b', border: '1px dashed #cbd5e1' }}>No hay movimientos registrados en el sistema.</div>)} </> ) : ( <form style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }} onSubmit={handleGuardarMovimiento}> <h4 style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>Registrar Transacción Física</h4> <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}> <div> <label style={labelStyle}>Contrato Asociado</label> <select required value={formMovimiento.id_contrato} onChange={e => setFormMovimiento({ ...formMovimiento, id_contrato: e.target.value })} style={inputStyle}> <option value="">Selecciona un contrato...</option> {contratos.map(c => (<option key={c.id} value={c.id}>Contrato #{c.id.toString().padStart(4, '0')} - {formatMoney(c.monto_inicial)}</option>))} </select> </div> </div> <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}> <div> <label style={labelStyle}>Tipo de Operación</label> <select required value={formMovimiento.tipo} onChange={e => setFormMovimiento({ ...formMovimiento, tipo: e.target.value })} style={inputStyle}> <option value="PAGO_INTERES">Pago de Rendimientos (Salida de Institución)</option> <option value="DEPOSITO">Inyección Extra de Capital (Entrada a Institución)</option> <option value="RETIRO_CAPITAL">Retiro Parcial de Capital (Salida de Institución)</option> </select> </div> <div> <label style={labelStyle}>Monto Exacto</label> <div style={{ position: 'relative' }}> <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>$</span> <input type="text" required placeholder="0.00" value={formatInputMonto(formMovimiento.monto)} onChange={e => setFormMovimiento({ ...formMovimiento, monto: parseInputMonto(e.target.value) })} style={{ ...inputStyle, paddingLeft: '28px' }} /> </div> </div> </div> <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}> <div> <label style={labelStyle}>Comprobante Escaneado (PDF/IMG)</label> <input type="file" required onChange={e => setFileComprobante(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" style={{ width: '100%', padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '8px', fontSize: '13px' }} /> </div> </div> <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}> <button type="button" onClick={() => setShowNuevoMovimiento(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar Operación</button> <button type="submit" disabled={isLoading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--brand-green)', color: 'white', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>{isLoading ? 'Procesando...' : 'Asentar Movimiento'}</button> </div> </form> )} </div> );

    return (
        <div className="inversores-container" style={{ padding: '24px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', color: '#0f172a', fontWeight: '800', letterSpacing: '-0.5px' }}>Directorio Institucional</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Gestión integral de Fondeadores y Capital de Inversión</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ backgroundColor: 'white', color: 'var(--brand-green)', border: '1px solid var(--brand-green)', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} onClick={abrirModalFondeoDesdeSimulador}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width: '18px'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                        Nuevo Fondeo
                    </button>
                    <button style={{ backgroundColor: 'var(--brand-green)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }} onClick={openNewModal}>
                        + Registrar Fondeador
                    </button>
                </div>
            </div>

            {/* --- SIMULADOR DE PAGOS --- */}
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', marginBottom: '32px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f0fdf4', color: 'var(--brand-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
                        </div>
                        <div>
                            <h3 style={{margin:0, fontSize: '16px', color: '#0f172a'}}>Simulador de Fondeo</h3>
                            <p style={{margin:0, fontSize: '12px', color: '#64748b'}}>Proyección y corridas financieras</p>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Sistema de Amortización</label>
                            <select value={tipoAmortizacion} onChange={(e) => setTipoAmortizacion(e.target.value)} style={inputStyleBg}>
                                <option value="frances">Cuota Fija (Sistema Francés)</option>
                                <option value="aleman">Capital Fijo (Sistema Alemán)</option>
                                <option value="diario">Saldos Diarios (Abono Libre)</option>
                                <option value="personalizado">Personalizado (Institucional)</option>
                            </select>
                        </div>
                        
                        {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && (
                            <div style={{ display: 'grid', gridTemplateColumns: tipoAmortizacion === 'diario' ? '1fr 1fr' : '1fr', gap: '12px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                <div>
                                    <label style={labelStyle}>Disposición</label>
                                    <input type="date" value={fechaInicioSim} onChange={(e) => setFechaInicioSim(e.target.value)} style={inputStyle}/>
                                </div>
                                {tipoAmortizacion === 'diario' && (
                                    <div>
                                        <label style={labelStyle}>1er Pago</label>
                                        <input type="date" value={fechaPrimerPagoSim} onChange={(e) => setFechaPrimerPagoSim(e.target.value)} style={inputStyle}/>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div>
                            <label style={labelStyle}>Monto del Fondeo</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>$</span>
                                <input type="text" placeholder="0.00" value={formatInputMonto(monto)} onChange={(e) => setMonto(parseInputMonto(e.target.value))} style={{...inputStyleBg, paddingLeft: '28px', fontSize: '16px', fontWeight: 'bold', color: '#0f172a'}} />
                            </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={labelStyle}>Producto / Tasa</label>
                                <select value={tasa} onChange={(e) => setTasa(e.target.value)} style={inputStyleBg}>
                                    <option value="0">Tasa...</option>
                                    {tasas.map(t => (<option key={t.id} value={t.tasa_anual_esperada}>{t.nombre_tasa} ({t.tasa_anual_esperada}%)</option>))}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Plazo Global</label>
                                <select value={plazo} onChange={(e) => setPlazo(e.target.value)} style={inputStyleBg}>
                                    <option value="3">3 Meses</option>
                                    <option value="6">6 Meses</option>
                                    <option value="9">9 Meses</option>
                                    <option value="12">12 Meses</option>
                                    <option value="24">24 Meses</option>
                                </select>
                            </div>
                        </div>
                        
                        {tipoAmortizacion === 'diario' ? (
                            <div>
                                <label style={labelStyle}>Abono Fijo a Capital</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>$</span>
                                    <input type="text" value={formatInputMonto(abonoCapitalLibre)} onChange={(e) => setAbonoCapitalLibre(parseInputMonto(e.target.value))} style={{...inputStyleBg, paddingLeft: '28px'}} />
                                </div>
                            </div>
                        ) : tipoAmortizacion !== 'personalizado' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '12px' }}>
                                <div>
                                    <label style={labelStyle}>Simular Anticipo</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 'bold' }}>$</span>
                                        <input type="text" placeholder="0.00" value={formatInputMonto(anticipoMontoSim)} onChange={(e) => setAnticipoMontoSim(parseInputMonto(e.target.value))} style={{...inputStyleBg, paddingLeft: '28px'}} />
                                    </div>
                                </div>
                                <div>
                                    <label style={labelStyle}>Mes Aplic.</label>
                                    <input type="number" value={anticipoMesSim} onChange={(e) => setAnticipoMesSim(e.target.value)} style={inputStyleBg}/>
                                </div>
                            </div>
                        ) : null}

                        {tipoAmortizacion === 'personalizado' && (
                            <PlanPersonalizadoBuilder plan={planPersonalizadoSim} setPlan={setPlanPersonalizadoSim} montoAsignado={monto} plazo={plazo} fechaInicio={fechaInicioSim} />
                        )}
                        
                        {tipoAmortizacion === 'personalizado' && (
                            <button onClick={abrirModalFondeoDesdeSimulador} style={{ width: '100%', padding: '12px', marginTop: '8px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                ↓ Transferir Plan a Nuevo Fondeo
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px 24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'relative', zIndex: 2 }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f0fdf4', color: 'var(--brand-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proyección Rendimientos</span>
                                <h2 style={{ fontSize: '36px', margin: '8px 0', color: '#0f172a', fontWeight: '800', letterSpacing: '-1px' }}>{formatMoney(gananciaNeta)}</h2>
                                {monto > 0 && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#334155', fontWeight: '600', marginTop: '8px' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-green)', marginRight: '6px' }}></span>
                                        Tasa ROI: {((gananciaNeta / (parseFloat(parseInputMonto(monto)) || 1)) * 100).toFixed(2)}%
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ background: 'linear-gradient(135deg, var(--brand-green) 0%, #059669 100%)', borderRadius: '16px', padding: '32px 24px', color: 'white', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)' }}>
                            <div style={{ position: 'relative', zIndex: 2 }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '20px'}}><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '700', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Retorno Total (Cap+Int+IVA)</span>
                                <h2 style={{ fontSize: '36px', margin: '8px 0 0 0', fontWeight: '800', letterSpacing: '-1px' }}>{formatMoney(totalRecibir)}</h2>
                            </div>
                            <circle cx="90%" cy="10%" r="60" fill="white" opacity="0.05" />
                            <circle cx="80%" cy="80%" r="40" fill="white" opacity="0.05" />
                        </div>
                    </div>

                    {/* --- TABLA DE AMORTIZACIÓN EN TIEMPO REAL --- */}
                    {tablaAmortizacion.length > 0 && (
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                                <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Desglose de Amortización (Proyección)</h2>
                            </div>
                            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <tr>
                                            <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>NO.</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>CAPITAL</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>ANTICIPO</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>INTERÉS</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>IVA</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>TOTAL</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>SALDO</th>
                                            {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>DÍAS</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tablaAmortizacion.map((row, idx) => (
                                            <tr key={idx} style={{ backgroundColor: row.numero == anticipoMesSim && tipoAmortizacion !== 'diario' ? '#fef9c3' : row.numero === 'N/A' ? '#f0fdf4' : idx % 2 === 0 ? 'transparent' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                                    <strong style={{ color: '#0f172a' }}>{row.numero}</strong> 
                                                    {row.fechaStr !== '-' && <span style={{ display:'block', fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{row.fechaStr}</span>}
                                                </td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>{formatMoney(row.abono)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: row.anticipo > 0 ? '#166534' : '#94a3b8', fontWeight: row.anticipo > 0 ? 'bold' : 'normal' }}>{formatMoney(row.anticipo)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>{formatMoney(row.interes)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>{formatMoney(row.iva)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold' }}>{formatMoney(row.pagoTotal)}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>{formatMoney(row.saldoFinal)}</td>
                                                {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b' }}>{row.dias}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- DIRECTORIO DE FONDEADORES --- */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Directorio</h2>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{width: '18px', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" placeholder="Buscar por nombre o RFC..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyleBg, paddingLeft: '38px', borderRadius: '20px' }} />
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>FONDEADOR</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>CONTACTO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>LÍNEA DE CRÉDITO</th>
                                <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>ESTATUS</th>
                                <th style={{ padding: '16px 24px', textAlign: 'right', color: '#64748b', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.5px' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentInversores.length > 0 ? currentInversores.map((inv, idx) => (
                                <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? 'white' : '#fcfcfc', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#fcfcfc'}>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'var(--brand-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px', letterSpacing: '1px', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>
                                                {inv.nombre.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ color: '#1e293b', fontSize: '15px' }}>{inv.nombre}</strong>
                                                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>RFC: {inv.rfc || 'S/N'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', color: '#334155' }}>
                                            <span style={{ fontWeight: '500' }}>{inv.telefono}</span>
                                            <span style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{inv.email}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {inv.limite_credito > 0 ? (
                                                <>
                                                    <strong style={{color: 'var(--brand-green)', fontSize: '15px'}}>{formatMoney(inv.limite_credito)}</strong>
                                                    <span style={{color: '#94a3b8', fontSize: '11px', marginTop: '2px'}}>Revolvente Máx.</span>
                                                </>
                                            ) : (
                                                <span style={{color: '#94a3b8', fontSize: '14px', fontStyle: 'italic'}}>No Asignado</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <button onClick={() => cambiarEstatusInversor(inv.id, inv.estatus_activo)} style={{ backgroundColor: inv.estatus_activo ? '#dcfce3' : '#fee2e2', color: inv.estatus_activo ? '#166534' : '#991b1b', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: '1px solid', borderColor: inv.estatus_activo ? '#bbf7d0' : '#fecaca', cursor: 'pointer', transition: 'all 0.2s' }}>
                                            {inv.estatus_activo ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button style={{ border: '1px solid #e2e8f0', backgroundColor: 'white', borderRadius: '6px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => abrirPanel(inv)} title="Expediente y Contratos" onMouseOver={e => {e.currentTarget.style.borderColor='var(--brand-green)'; e.currentTarget.style.color='var(--brand-green)'}} onMouseOut={e => {e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b'}}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                            </button>
                                            <button style={{ border: '1px solid #e2e8f0', backgroundColor: 'white', borderRadius: '6px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => openEditModal(inv)} title="Editar Información" onMouseOver={e => {e.currentTarget.style.borderColor='#3b82f6'; e.currentTarget.style.color='#3b82f6'}} onMouseOut={e => {e.currentTarget.style.borderColor='#e2e8f0'; e.currentTarget.style.color='#64748b'}}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button style={{ border: '1px solid #e2e8f0', backgroundColor: 'white', borderRadius: '6px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => triggerEliminarInversor(inv.id, inv.nombre)} title="Dar de Baja" onMouseOver={e => {e.currentTarget.style.backgroundColor='#fef2f2'; e.currentTarget.style.borderColor='#fecaca'}} onMouseOut={e => {e.currentTarget.style.backgroundColor='white'; e.currentTarget.style.borderColor='#e2e8f0'}}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '48px' }}>
                                        <div style={{ color: '#64748b', fontSize: '15px' }}>
                                            No se encontraron fondeadores registrados en el directorio.
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                        <button onClick={prevPage} disabled={currentPage === 1} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: currentPage === 1 ? '#f1f5f9' : 'white', color: currentPage === 1 ? '#94a3b8' : '#334155', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}>&laquo; Anterior</button>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={nextPage} disabled={currentPage === totalPages} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: currentPage === totalPages ? '#f1f5f9' : 'white', color: currentPage === totalPages ? '#94a3b8' : '#334155', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}>Siguiente &raquo;</button>
                    </div>
                )}
            </div>

            {/* PANEL LATERAL DE DETALLES */}
            {panelOpen && inversorActivo && (
                <div className="modal-overlay" onClick={() => setPanelOpen(false)} style={{ zIndex: 3000 }}>
                    <div className="master-panel fade-in-right" onClick={e => e.stopPropagation()} style={{ width: '650px', backgroundColor: '#f8fafc', padding: 0, boxShadow: '-10px 0 25px rgba(0,0,0,0.1)' }}>
                        
                        <div style={{ backgroundColor: '#0f172a', padding: '32px 32px 24px 32px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>Panel de Control</h2>
                                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '14px', color: 'white', fontWeight: '600', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    {inversorActivo.nombre}
                                </div>
                            </div>
                            <button onClick={() => setPanelOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '28px', cursor: 'pointer', padding: 0, lineHeight: 1, transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='white'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}>×</button>
                        </div>
                        
                        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: 'white', padding: '0 24px' }}>
                            {['contratos', 'beneficiarios', 'movimientos'].map(tab => (
                                <button 
                                    key={tab} 
                                    onClick={() => setActiveTab(tab)}
                                    style={{ 
                                        flex: 1,
                                        padding: '16px 0', 
                                        background: 'transparent', 
                                        border: 'none', 
                                        borderBottom: activeTab === tab ? '3px solid var(--brand-green)' : '3px solid transparent', 
                                        color: activeTab === tab ? 'var(--brand-green)' : '#64748b', 
                                        fontWeight: activeTab === tab ? 'bold' : '600',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'center'
                                    }}
                                >
                                    {tab.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        
                        <div style={{ padding: '32px 24px', height: 'calc(100vh - 190px)', overflowY: 'auto' }}>
                            {activeTab === 'contratos' && TabContratos()}
                            {activeTab === 'beneficiarios' && TabBeneficiarios()}
                            {activeTab === 'movimientos' && TabMovimientos()}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REDISEÑADO: ALTA/EDICIÓN FONDEADOR */}
            {isModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '850px', width: '95%', padding: 0, overflow: 'hidden', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <div style={{ backgroundColor: '#0f172a', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{isEditing ? 'Editar Fondeador' : 'Registrar Nuevo Fondeador'}</h2>
                                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>Directorio General de Clientes Inversionistas</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '28px', cursor: 'pointer', padding: '0 8px', transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='white'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}>×</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '32px', maxHeight: '75vh', overflowY: 'auto', backgroundColor: '#f8fafc' }}>
                            
                            {/* SECCIÓN 1: DATOS PERSONALES */}
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 20px 0', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', fontSize: '15px', fontWeight: '700' }}>1. Datos de Identificación</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: isEditing ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Nombre(s)</label>
                                        <input type="text" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={inputStyleBg} />
                                    </div>
                                    {!isEditing && (
                                        <div>
                                            <label style={labelStyle}>Apellidos</label>
                                            <input type="text" required value={formData.apellidos} onChange={e => setFormData({ ...formData, apellidos: e.target.value })} style={inputStyleBg} />
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>RFC (Con Homoclave)</label>
                                        <input type="text" value={formData.rfc} onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} style={inputStyleBg} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* SECCIÓN 2: LÍNEA DE CRÉDITO */}
                            <div style={{ backgroundColor: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '24px' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '15px', fontWeight: '700' }}>2. Línea de Crédito Autorizada</h4>
                                <label style={{ color: '#15803d', fontSize: '12px', marginBottom: '16px', display: 'block' }}>Monto máximo permitido para fondear (Revolvente)</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', fontWeight: '800', color: 'var(--brand-green)' }}>$</span>
                                    <input type="text" required value={formatInputMonto(formData.limite_credito)} onChange={e => setFormData({ ...formData, limite_credito: parseInputMonto(e.target.value) })} placeholder="0.00" style={{ width: '100%', height: '56px', padding: '0 16px 0 36px', fontSize: '20px', borderRadius: '8px', border: '1px solid #86efac', outline: 'none', backgroundColor: 'white', fontWeight: '800', color: 'var(--brand-green)', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} />
                                </div>
                            </div>

                            {/* SECCIÓN 3: CONTACTO Y BANCOS */}
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 20px 0', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', fontSize: '15px', fontWeight: '700' }}>3. Contacto y Datos Bancarios</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Teléfono Celular</label>
                                        <input type="text" required value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value.replace(/[^0-9]/g, '') })} maxLength="10" style={inputStyleBg} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Correo Electrónico</label>
                                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyleBg} />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Dirección Completa</label>
                                    <input type="text" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} style={inputStyleBg} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Banco del Cliente</label>
                                        <input type="text" required value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} style={inputStyleBg} />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Cuenta Bancaria / CLABE</label>
                                        <input type="text" required value={formData.numero_cuenta} onChange={e => setFormData({ ...formData, numero_cuenta: e.target.value })} style={inputStyleBg} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* SECCIÓN 4: BENEFICIARIO */}
                            {!isEditing && (
                                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px' }}>
                                        <h4 style={{ margin: 0, color: '#0f172a', fontSize: '15px', fontWeight: '700' }}>4. Beneficiario Principal</h4>
                                        <span style={{ backgroundColor: '#dcfce3', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>100% ASIGNADO</span>
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>Nombre Completo del Beneficiario</label>
                                        <input type="text" required value={formData.ben_nombre} onChange={e => setFormData({ ...formData, ben_nombre: e.target.value })} style={inputStyleBg} />
                                    </div>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label style={labelStyle}>Parentesco</label>
                                            <select required value={formData.ben_parentesco} onChange={e => setFormData({ ...formData, ben_parentesco: e.target.value })} style={inputStyleBg}>
                                                <option value="">Selecciona...</option>
                                                <option value="Esposo/a">Esposo/a</option>
                                                <option value="Hijo/a">Hijo/a</option>
                                                <option value="Padre/Madre">Padre/Madre</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={labelStyle}>Teléfono del Beneficiario</label>
                                            <input type="text" value={formData.ben_telefono} onChange={e => setFormData({ ...formData, ben_telefono: e.target.value.replace(/[^0-9]/g, '') })} maxLength="10" style={inputStyleBg} />
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--brand-green)', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(15, 107, 56, 0.2)', transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#059669'} onMouseOut={e=>e.currentTarget.style.backgroundColor='var(--brand-green)'}>
                                    {isLoading ? 'Guardando...' : 'Guardar Expediente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ACTIVAR FONDEO RÁPIDO */}
            {isFondeoModalOpen && (
                <div className="modal-overlay" onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} style={{ zIndex: 4000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '650px', padding: 0, overflow: 'visible', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ backgroundColor: '#0f172a', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Activar Nuevo Fondeo</h2>
                                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>Generación de contrato e ingreso de capital</p>
                            </div>
                            <button onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '28px', cursor: 'pointer', padding: '0 8px', transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='white'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}>×</button>
                        </div>
                        
                        <form onSubmit={handleCrearFondeo} style={{ padding: '32px', maxHeight: '75vh', overflowY: 'visible', backgroundColor: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                            
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px', position: 'relative' }}>
                                <label style={{...labelStyle, color: '#0f172a', fontSize: '13px'}}>1. Seleccionar Inversionista</label>
                                <div style={{ ...inputStyleBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', height: '46px' }} onClick={() => setDropdownFondeadorOpen(!dropdownFondeadorOpen)}>
                                    <span style={{ color: formFondeo.id_inversor ? '#0f172a' : '#94a3b8', fontSize: '14px', fontWeight: formFondeo.id_inversor ? '600' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {formFondeo.id_inversor ? inversores.find(i => i.id == formFondeo.id_inversor)?.nombre : 'Despliegue para buscar un fondeador...'}
                                    </span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', color: '#64748b'}}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                
                                {dropdownFondeadorOpen && (
                                    <div style={{ position: 'absolute', top: '100%', left: '24px', right: '24px', zIndex: 100, backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                        <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                            <input type="text" autoFocus placeholder="Buscar por nombre..." value={filtroFondeador} onChange={(e) => setFiltroFondeador(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }} style={{ ...inputStyle, height: '36px' }} />
                                        </div>
                                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            {inversoresParaFondeo.length > 0 ? (
                                                inversoresParaFondeo.map(inv => (
                                                    <div key={inv.id} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onClick={() => { setFormFondeo({...formFondeo, id_inversor: inv.id}); setDropdownFondeadorOpen(false); setFiltroFondeador(''); }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>
                                                        <strong style={{ fontSize: '14px', display:'block', color: '#0f172a' }}>{inv.nombre}</strong>
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Línea Libre: {formatMoney(inv.limite_credito)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '16px', fontSize: '13px', color: '#ef4444', textAlign: 'center' }}>No se encontraron coincidencias.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Detalles de la Inversión</h4>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Fecha de Disposición</label>
                                        <input type="date" required value={formFondeo.fecha_inicio} onChange={e => setFormFondeo({ ...formFondeo, fecha_inicio: e.target.value })} style={inputStyleBg} />
                                    </div>
                                    <div>
                                        <label style={{...labelStyle, color: 'var(--brand-green)'}}>Monto a Invertir</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-green)', fontWeight: '800', fontSize: '16px' }}>$</span>
                                            <input type="text" required value={formatInputMonto(formFondeo.monto_inicial)} onChange={e => setFormFondeo({ ...formFondeo, monto_inicial: parseInputMonto(e.target.value) })} style={{ ...inputStyleBg, paddingLeft: '28px', color: 'var(--brand-green)', fontWeight: '800', fontSize: '16px', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <label style={labelStyle}>Tasa / Producto</label>
                                        <select required value={formFondeo.id_tasa} onChange={e => setFormFondeo({ ...formFondeo, id_tasa: e.target.value })} style={inputStyleBg}>
                                            <option value="">Seleccione...</option>
                                            {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Plazo Global</label>
                                        <select value={formFondeo.plazo_meses} onChange={e => setFormFondeo({ ...formFondeo, plazo_meses: e.target.value })} style={inputStyleBg}>
                                            <option value="6">6 Meses</option>
                                            <option value="12">12 Meses</option>
                                            <option value="24">24 Meses</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label style={labelStyle}>Sistema de Amortización</label>
                                    <select required value={formFondeo.tipo_amortizacion} onChange={e => setFormFondeo({ ...formFondeo, tipo_amortizacion: e.target.value })} style={inputStyleBg}>
                                        <option value="frances">Cuota Fija Constante (Sistema Francés)</option>
                                        <option value="aleman">Capital Fijo Constante (Sistema Alemán)</option>
                                        <option value="diario">Saldos Diarios (Abono Libre)</option>
                                        <option value="personalizado">Plan Personalizado (Institucional)</option>
                                    </select>
                                </div>
                            </div>

                            {formFondeo.tipo_amortizacion === 'personalizado' && (
                                <div style={{ marginBottom: '24px' }}>
                                    <PlanPersonalizadoBuilder 
                                        plan={formFondeo.plan_personalizado} 
                                        setPlan={(p) => setFormFondeo({...formFondeo, plan_personalizado: p})} 
                                        montoAsignado={formFondeo.monto_inicial} 
                                        plazo={formFondeo.plazo_meses}
                                        fechaInicio={formFondeo.fecha_inicio}
                                    />
                                </div>
                            )}
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--brand-green)', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                                    {isLoading ? 'Procesando...' : 'Generar Fondeo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- VISOR INTERACTIVO DE AMORTIZACIÓN (WYSIWYG) --- */}
            {showVisorAmortizacion && contratoParaAmortizacion && (
                <div className="modal-overlay" style={{ zIndex: 5000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: 0, borderRadius: '16px' }}>
                        <div style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 50, padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Tabla de Amortización #{contratoParaAmortizacion.id.toString().padStart(4, '0')}</h2>
                                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#cbd5e1' }}>
                                    Monto: {formatMoney(contratoParaAmortizacion.monto_inicial)} | Tasa: {contratoParaAmortizacion.tasa_anual_esperada}% | Sistema: {contratoParaAmortizacion.tipo_amortizacion ? contratoParaAmortizacion.tipo_amortizacion.toUpperCase() : 'FRANCÉS'}
                                </p>
                            </div>
                            <button onClick={() => { setShowVisorAmortizacion(false); setContratoParaAmortizacion(null); setAnticiposInteractivos({}); setPagosIrregulares([]); }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '28px', cursor: 'pointer', padding: '0 8px', transition: 'color 0.2s' }} onMouseOver={e=>e.currentTarget.style.color='white'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}>×</button>
                        </div>
                        
                        <div style={{ padding: '32px', backgroundColor: '#f8fafc' }}>
                            
                            <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h5 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '15px', fontWeight: '700' }}>+ Inyectar Pagos Irregulares (Fuera de Calendario)</h5>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>Agrega fechas de pago no contempladas. El sistema ajustará días e interés automáticamente.</p>
                                    </div>
                                    <button type="button" style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', padding: '8px 16px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)' }} onClick={() => setPagosIrregulares([...pagosIrregulares, { id: Date.now(), fecha: '', monto: '' }])}>
                                        + Añadir Fecha
                                    </button>
                                </div>

                                {pagosIrregulares.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                        {pagosIrregulares.map((pago, index) => (
                                            <div key={pago.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '16px', alignItems: 'end', backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #dcfce3', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                <div>
                                                    <label style={labelStyle}>FECHA DE INYECCIÓN</label>
                                                    <input type="date" value={pago.fecha} onChange={e => handlePagoIrregularChange(index, 'fecha', e.target.value)} style={inputStyleBg} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>MONTO A CAPITAL</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#166534', fontWeight: 'bold' }}>$</span>
                                                        <input type="text" value={formatInputMonto(pago.monto)} onChange={e => handlePagoIrregularChange(index, 'monto', parseInputMonto(e.target.value))} style={{ ...inputStyleBg, paddingLeft: '28px', color: '#166534', fontWeight: 'bold', borderColor: '#bbf7d0' }} placeholder="0.00" />
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => removePagoIrregular(index)} style={{ height: '42px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar pago">✖</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                                        <strong>Nota interactiva:</strong> Escribe directamente sobre las celdas verdes para inyectar anticipos al capital. El botón "Descargar PDF" bajará la tabla exactamente como la estás viendo.
                                    </p>
                                </div>
                                <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                            <tr>
                                                <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>NO. PAGO</th>
                                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>ABONO PRINC.</th>
                                                <th style={{ padding: '12px', textAlign: 'right', backgroundColor: '#dcfce3', color: '#166534', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #bbf7d0' }}>ANTICIPO (EDITABLE)</th>
                                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>INT. ORD.</th>
                                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>IVA</th>
                                                <th style={{ padding: '12px', textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>TOTAL PAGO</th>
                                                <th style={{ padding: '12px', textAlign: 'right', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>SALDO INSOLUTO</th>
                                                {(String(contratoParaAmortizacion.tipo_amortizacion).toLowerCase() === 'diario' || String(contratoParaAmortizacion.tipo_amortizacion).toLowerCase() === 'personalizado') && <th style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>DÍAS</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tablaInteractivaRender.map((row, idx) => (
                                                <tr key={idx} style={{ backgroundColor: row.numero === 'N/A' ? '#f0fdf4' : (anticiposInteractivos[row.indexUI] || 0) > 0 ? '#fef9c3' : idx % 2 === 0 ? 'transparent' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        <strong style={{ color: row.numero === 'N/A' ? '#166534' : '#0f172a' }}>{row.numero}</strong> 
                                                        {row.fechaStr !== '-' && <span style={{ display:'block', fontSize: '10px', color: row.numero === 'N/A' ? '#15803d' : '#64748b', marginTop: '2px' }}>{row.fechaStr}</span>}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: '#334155' }}>{formatMoney(row.abono)}</td>
                                                    <td style={{ padding: '4px 12px', textAlign: 'right', backgroundColor: row.numero === 'N/A' ? 'transparent' : '#f0fdf4' }}>
                                                        {row.numero === 'N/A' ? (
                                                            <strong style={{ color: '#166534', paddingRight: '8px' }}>{formatMoney(row.anticipo)}</strong>
                                                        ) : (
                                                            <div style={{ position: 'relative' }}>
                                                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#15803d', fontSize: '12px' }}>$</span>
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="0.00" 
                                                                    value={formatInputMonto(anticiposInteractivos[row.indexUI] || '')} 
                                                                    onChange={(e) => handleAnticipoInteractivoChange(row.indexUI, e.target.value)}
                                                                    style={{ width: '100%', height: '32px', border: '1px solid #bbf7d0', backgroundColor: 'white', borderRadius: '6px', padding: '0 8px 0 20px', textAlign: 'right', fontSize: '13px', color: '#166534', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }}
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: '#334155' }}>{formatMoney(row.interes)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: '#64748b' }}>{formatMoney(row.iva)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold' }}>{formatMoney(row.pagoTotal)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>{formatMoney(row.saldoFinal)}</td>
                                                    {(String(contratoParaAmortizacion.tipo_amortizacion).toLowerCase() === 'diario' || String(contratoParaAmortizacion.tipo_amortizacion).toLowerCase() === 'personalizado') && <td style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>{row.dias}</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ backgroundColor: '#e2e8f0' }}>
                                                <td colSpan="3" style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#334155' }}>TOTALES PROYECTADOS:</td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#334155' }}>{formatMoney(totalesInteractivos.interes)}</td>
                                                <td></td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--brand-green)' }}>{formatMoney(totalesInteractivos.total)}</td>
                                                <td colSpan="2"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div style={{ position: 'sticky', bottom: 0, backgroundColor: 'white', zIndex: 50, padding: '20px 32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                            <button type="button" onClick={() => { setShowVisorAmortizacion(false); setContratoParaAmortizacion(null); setAnticiposInteractivos({}); setPagosIrregulares([]); }} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>
                                Cerrar
                            </button>
                            <button type="button" onClick={descargarPDFInteractivo} disabled={isLoading} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--brand-green)', color: 'white', fontWeight: 'bold', fontSize: '14px', cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#059669'} onMouseOut={e=>e.currentTarget.style.backgroundColor='var(--brand-green)'}>
                                {isLoading ? 'Generando PDF...' : '↓ Descargar PDF Exacto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inversores;