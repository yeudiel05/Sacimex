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

// --- ICONOS SVG LIMPIOS (SIN EMOJIS) ---
const IconSave = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconMail = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
const IconPlus = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconRefresh = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const IconClose = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

// --- ESTILOS CONSTANTES ---
const inputStyle = { width: '100%', height: '42px', padding: '0 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'white', boxSizing: 'border-box' };
const inputStyleBg = { ...inputStyle, backgroundColor: '#f8fafc' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };

// --- COMPONENTE: CONSTRUCTOR DE PLAN PERSONALIZADO ---
const PlanPersonalizadoBuilder = ({ plan = [], setPlan, montoAsignado, plazo, fechaInicio }) => {
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
    
    // --- ESTADOS DEL SIMULADOR ---
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
    
    // --- ESTADOS GENERALES Y CRUD ---
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
        fecha_inicio: new Date().toISOString().split('T')[0], plan_personalizado: [], numero_disposicion: ''
    });

    const [panelOpen, setPanelOpen] = useState(false);
    const [inversorActivo, setInversorActivo] = useState(null);
    const [activeTab, setActiveTab] = useState('contratos');
    const [tasas, setTasas] = useState([]); 
    const [contratos, setContratos] = useState([]);
    const [showNuevoContrato, setShowNuevoContrato] = useState(false);
    const [formContrato, setFormContrato] = useState({ 
        id_tasa: '', monto_inicial: '', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', reinversion_automatica: 0, fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '', plan_personalizado: [], numero_disposicion: '' 
    });
    
    const [beneficiarios, setBeneficiarios] = useState([]);
    const [formBeneficiario, setFormBeneficiario] = useState({ nombre_completo: '', parentesco: '', telefono: '', porcentaje: '', fecha_nacimiento: '' });
    const [movimientos, setMovimientos] = useState([]);
    const [showNuevoMovimiento, setShowNuevoMovimiento] = useState(false);
    const [formMovimiento, setFormMovimiento] = useState({ id_contrato: '', tipo: 'PAGO_INTERES', monto: '' });
    const [fileComprobante, setFileComprobante] = useState(null);

    // --- ESTADOS VISOR E INYECCIONES GUARDADAS ---
    const [showVisorAmortizacion, setShowVisorAmortizacion] = useState(false);
    const [contratoParaAmortizacion, setContratoParaAmortizacion] = useState(null);
    const [anticiposInteractivos, setAnticiposInteractivos] = useState({});
    const [pagosIrregulares, setPagosIrregulares] = useState([]); 
    const [tablaInteractivaRender, setTablaInteractivaRender] = useState([]);
    const [totalesInteractivos, setTotalesInteractivos] = useState({ interes: 0, total: 0 });

    // --- ESTADOS PROYECCIÓN GLOBAL ---
    const [showProyeccionGlobal, setShowProyeccionGlobal] = useState(false);
    const [pagosGlobalesMensuales, setPagosGlobalesMensuales] = useState([]);
    const [resumenContratos, setResumenContratos] = useState([]);
    const [correoContador, setCorreoContador] = useState('');
    const [isAlerting, setIsAlerting] = useState(false);

    // --- FUNCIONES DE RED ---
    const getAuthHeaders = () => { const token = localStorage.getItem('token'); if (!token) { navigate('/'); return null; } return { 'Authorization': `Bearer ${token}` }; };
    const handleAuthError = (status) => { if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; } return false; };

    const fetchTasasActivas = async () => { const headers = getAuthHeaders(); if (!headers) return; try { const res = await fetch('http://localhost:3001/api/tasas', { headers }); const data = await res.json(); if (data.success) setTasas(data.data.filter(t => t.estatus_activo === 1 && (!t.tipo_producto || t.tipo_producto === 'FONDEO'))); } catch (error) { console.error(error); } };
    const fetchInversores = async () => { const headers = getAuthHeaders(); if (!headers) return; try { const response = await fetch('http://localhost:3001/api/inversores', { headers }); if (handleAuthError(response.status)) return; const data = await response.json(); if (data.success) setInversores(data.data); } catch (error) { console.error(error); } };

    useEffect(() => { fetchInversores(); fetchTasasActivas(); }, []);

    // --- MOTOR CORE DE AMORTIZACIÓN (AQUÍ ESTÁ LA LÓGICA DEL CHECKBOX EXCLUIR DÍA) ---
    const motorCalculoAmortizacion = (contratoObj, inyecciones = [], customAnticipos = {}) => {
        const m = parseFloat(contratoObj.monto_inicial) || 0;
        const t = parseFloat(contratoObj.tasa_anual_esperada) || 0;
        const tipoReal = String(contratoObj.tipo_amortizacion || 'frances').toLowerCase().trim();
        
        let planBaseGuardado = [];
        if (contratoObj.plan_json) {
            try {
                let temp = contratoObj.plan_json;
                while (typeof temp === 'string') temp = JSON.parse(temp);
                if (Array.isArray(temp)) planBaseGuardado = temp;
            } catch (e) { console.error(e); }
        }

        const tasaAnual = t / 100; const tasaMensual = tasaAnual / 12;
        let saldo = m; let tablaRes = []; let totalInteres = 0; let totalGeneral = 0;
        
        const tasaConfig = tasas.find(item => item.id === contratoObj.id_tasa);
        const cobraIva = tasaConfig ? (tasaConfig.cobra_iva === 1) : false; 

        const fInicioStr = cleanDateStr(contratoObj.fecha_inicio);
        let fechaAnterior = new Date(`${fInicioStr}T12:00:00`);
        if (isNaN(fechaAnterior.getTime())) fechaAnterior = new Date();

        let timelineUnificado = [];

        if (tipoReal === 'personalizado' && planBaseGuardado.length > 0) {
            timelineUnificado = planBaseGuardado.map((row, i) => ({
                indexUI: `base_${i}`, numero: row.numero || (i + 1).toString(), fechaStr: cleanDateStr(row.fecha),
                abonoFijo: parseFloat(parseInputMonto(row.abono)) || 0, anticipoFijo: parseFloat(parseInputMonto(row.anticipo)) || 0, esIrregular: false, excluirDia: false
            }));
        } else {
            const fFinStr = cleanDateStr(contratoObj.fecha_fin);
            let fFin = new Date(`${fFinStr}T12:00:00`);
            if(isNaN(fFin.getTime())) { fFin = new Date(fechaAnterior); fFin.setMonth(fechaAnterior.getMonth() + 12); }
            let plazoMeses = Math.max(1, Math.round((fFin - fechaAnterior) / (1000 * 60 * 60 * 24 * 30.44)));
            if (isNaN(plazoMeses) || plazoMeses < 1) plazoMeses = 12;
            
            let fTemp = new Date(fechaAnterior);
            for(let i=1; i<=plazoMeses; i++){
                fTemp.setMonth(fTemp.getMonth() + 1);
                let capFijo = tipoReal === 'aleman' ? m / plazoMeses : 0;
                timelineUnificado.push({ indexUI: `base_${i}`, numero: i.toString(), fechaStr: fTemp.toISOString().split('T')[0], abonoFijo: capFijo, anticipoFijo: 0, esIrregular: false, excluirDia: false });
            }
        }

        inyecciones.forEach(pago => {
            if (pago.fecha && parseFloat(parseInputMonto(pago.monto)) > 0) {
                // AQUÍ INYECTAMOS LA REGLA DEL CHECKBOX excluirDia
                timelineUnificado.push({ indexUI: `irreg_${pago.id || Date.now()}`, numero: 'N/A', fechaStr: cleanDateStr(pago.fecha), abonoFijo: 0, anticipoFijo: parseFloat(parseInputMonto(pago.monto)), esIrregular: true, excluirDia: pago.excluirDia || false });
            }
        });

        timelineUnificado.sort((a,b) => new Date(`${a.fechaStr}T12:00:00`) - new Date(`${b.fechaStr}T12:00:00`));

        let p_frances_meses_restantes = timelineUnificado.filter(r => !r.esIrregular).length;

        timelineUnificado.forEach((row) => {
            let fechaActual = new Date(`${row.fechaStr}T12:00:00`);
            if(isNaN(fechaActual.getTime())) fechaActual = new Date(fechaAnterior);
            
            let diffTime = Math.abs(Date.UTC(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate()) - Date.UTC(fechaAnterior.getFullYear(), fechaAnterior.getMonth(), fechaAnterior.getDate()));
            let diasTranscurridos = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
            
            // Si el checkbox está marcado, no se cobra el interés del día actual
            let diasParaInteres = diasTranscurridos;
            if (row.esIrregular && row.excluirDia && diasTranscurridos > 0) {
                diasParaInteres = diasTranscurridos - 1;
            }
            
            let interes = (saldo * tasaAnual / 360) * diasParaInteres;
            let abonoReal = row.abonoFijo;
            
            if (tipoReal === 'frances' && !row.esIrregular && p_frances_meses_restantes > 0) {
                let cuotaPura = (saldo * (tasaMensual / (1 - Math.pow(1 + tasaMensual, -p_frances_meses_restantes))));
                abonoReal = cuotaPura - interes;
                p_frances_meses_restantes--;
            }

            let anticipoExtraUI = parseFloat(parseInputMonto(customAnticipos[row.indexUI])) || 0;
            let anticipoReal = row.anticipoFijo + anticipoExtraUI;
            
            let capital = abonoReal + anticipoReal;
            if (capital > saldo) {
                capital = saldo;
                if (abonoReal > saldo) { abonoReal = saldo; anticipoReal = 0; } else { anticipoReal = saldo - abonoReal; }
            }
            
            let iva = cobraIva ? (interes * 0.16) : 0;
            let totalPago = capital + interes + iva;
            saldo -= capital; if (saldo < 0.01) saldo = 0;

            tablaRes.push({
                indexUI: row.indexUI, numero: row.numero, abono: abonoReal, anticipo: anticipoReal, 
                interes: interes, iva: iva, pagoTotal: totalPago, saldoFinal: saldo, dias: diasParaInteres, 
                fechaStr: fechaActual.toLocaleDateString('es-MX'),
                fechaPura: fechaActual 
            });
            totalInteres += interes; totalGeneral += totalPago;
            fechaAnterior = new Date(fechaActual);
        });

        return { tabla: tablaRes, totales: { interes: totalInteres, total: totalGeneral } };
    };

    // --- EFECTO: SIMULADOR MAESTRO ---
    useEffect(() => {
        const m = parseFloat(monto) || 0;
        const t = parseFloat(tasa) || 0;
        const p = parseInt(plazo) || 0;
        const aMonto = parseFloat(anticipoMontoSim) || 0;
        const aMes = parseInt(anticipoMesSim) || 0;

        if (m <= 0 || t <= 0 || p <= 0) { setTablaAmortizacion([]); setGananciaNeta(0); setTotalRecibir(0); return; }
        
        const pseudoContrato = { monto_inicial: m, tasa_anual_esperada: t, tipo_amortizacion: tipoAmortizacion, fecha_inicio: fechaInicioSim, fecha_fin: new Date(new Date(fechaInicioSim).setMonth(new Date(fechaInicioSim).getMonth() + p)).toISOString(), plan_json: planPersonalizadoSim, id_tasa: tasas.find(item => parseFloat(item.tasa_anual_esperada) === t)?.id };
        
        const inySimuladas = [];
        if(aMonto > 0 && aMes > 0 && tipoAmortizacion !== 'personalizado'){
            let fSim = new Date(`${fechaInicioSim}T12:00:00`);
            fSim.setMonth(fSim.getMonth() + aMes);
            inySimuladas.push({ id: 'sim', monto: aMonto, fecha: fSim.toISOString(), excluirDia: false });
        }

        const res = motorCalculoAmortizacion(pseudoContrato, inySimuladas, {});
        setTablaAmortizacion(res.tabla); setGananciaNeta(res.totales.interes); setTotalRecibir(res.totales.total);
    }, [monto, tasa, plazo, anticipoMontoSim, anticipoMesSim, tipoAmortizacion, fechaInicioSim, fechaPrimerPagoSim, abonoCapitalLibre, tasas, planPersonalizadoSim]);

    // --- EFECTO: CARGAR INYECCIONES EN VISOR INTERACTIVO ---
    useEffect(() => {
        if (!contratoParaAmortizacion || !showVisorAmortizacion) return;
        
        let inyeccionesCargadas = [];
        if(contratoParaAmortizacion.pagos_irregulares_json) {
            try {
                let temp = contratoParaAmortizacion.pagos_irregulares_json;
                while (typeof temp === 'string') temp = JSON.parse(temp);
                if (Array.isArray(temp)) inyeccionesCargadas = temp;
            } catch(e) {}
        }
        setPagosIrregulares(inyeccionesCargadas);
        setAnticiposInteractivos({});
    }, [contratoParaAmortizacion, showVisorAmortizacion]);

    useEffect(() => {
        if (!contratoParaAmortizacion || !showVisorAmortizacion) return;
        const res = motorCalculoAmortizacion(contratoParaAmortizacion, pagosIrregulares, anticiposInteractivos);
        setTablaInteractivaRender(res.tabla);
        setTotalesInteractivos(res.totales);
    }, [contratoParaAmortizacion, showVisorAmortizacion, anticiposInteractivos, pagosIrregulares]);

    // --- FUNCIONES INTERACTIVAS ---
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

    // --- NUEVO: GUARDAR INYECCIONES EN LA BD ---
    const handleGuardarInyecciones = async () => {
        const headers = getAuthHeaders(); if(!headers) return; setIsLoading(true);
        try {
            const res = await fetch(`http://localhost:3001/api/inversores/contratos/${contratoParaAmortizacion.id}/pagos-irregulares`, {
                method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pagos_irregulares: pagosIrregulares })
            });
            const data = await res.json();
            if(data.success) {
                alert("Inyecciones de capital guardadas exitosamente. El saldo se ha reestructurado permanentemente.");
                fetchContratos(inversorActivo.id); 
            } else alert(data.message);
        } catch(e) { console.error(e); } finally { setIsLoading(false); }
    };

    // --- NUEVO: PROYECCIÓN GLOBAL ---
    const abrirProyeccionGlobal = async (inversor) => {
        const headers = getAuthHeaders(); if(!headers) return;
        try {
            const res = await fetch(`http://localhost:3001/api/inversores/contratos/${inversor.id}`, { headers });
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                let todosLosPagosFuturos = [];
                let resumenList = [];
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                const msInDay = 24 * 60 * 60 * 1000;
                
                data.data.forEach(c => {
                    let inyecciones = [];
                    if(c.pagos_irregulares_json){
                        try { let temp = c.pagos_irregulares_json; while (typeof temp === 'string') temp = JSON.parse(temp); inyecciones = Array.isArray(temp) ? temp : []; } catch(e){}
                    }
                    const tablaC = motorCalculoAmortizacion(c, inyecciones, {}).tabla;
                    
                    let proximoPago = null;
                    let pagosRegulares = tablaC.filter(t => t.numero !== 'N/A');
                    let totalPagos = pagosRegulares.length;

                    for (let i = 0; i < tablaC.length; i++) {
                        if (tablaC[i].fechaPura >= hoy) {
                            proximoPago = tablaC[i];
                            break;
                        }
                    }

                    if(!proximoPago && tablaC.length > 0) proximoPago = tablaC[tablaC.length - 1]; 

                    if(proximoPago) {
                        let diasDiff = (proximoPago.fechaPura - hoy) / msInDay;
                        let estadoColor = diasDiff < 0 ? '#ef4444' : diasDiff <= 5 ? '#f59e0b' : '#3b82f6';
                        let cssDotClass = diasDiff < 0 ? 'dot-vencido' : diasDiff <= 5 ? 'dot-alerta' : 'dot-pendiente';
                        
                        let saldoCapitalPrevio = proximoPago.saldoFinal + proximoPago.abono + proximoPago.anticipo;

                        resumenList.push({
                            id: c.id,
                            numero_disposicion: c.numero_disposicion,
                            f_inicio: new Date(c.fecha_inicio).toLocaleDateString('es-MX'),
                            f_termino: new Date(c.fecha_fin).toLocaleDateString('es-MX'),
                            monto: c.monto_inicial,
                            tasa: c.tasa_anual_esperada,
                            saldo_capital: saldoCapitalPrevio,
                            prox_pago_fecha: proximoPago.fechaStr,
                            no_pago: proximoPago.numero,
                            total_pagos: totalPagos,
                            a_capital: proximoPago.abono + proximoPago.anticipo,
                            p_interes: proximoPago.interes + proximoPago.iva,
                            total_pago: proximoPago.pagoTotal,
                            saldo_final: proximoPago.saldoFinal,
                            estado_color: estadoColor,
                            cssDotClass: cssDotClass
                        });
                    }

                    tablaC.forEach(pago => {
                        if (pago.fechaPura >= hoy && pago.pagoTotal > 0.01) {
                            let dDiff = (pago.fechaPura - hoy) / msInDay;
                            todosLosPagosFuturos.push({
                                ...pago,
                                contrato_id: c.id,
                                disp: c.numero_disposicion || 'S/N',
                                cssDotClass: dDiff < 0 ? 'dot-vencido' : dDiff <= 5 ? 'dot-alerta' : 'dot-pendiente'
                            });
                        }
                    });
                });

                setResumenContratos(resumenList);

                todosLosPagosFuturos.sort((a,b) => a.fechaPura - b.fechaPura);
                const agrupadoPorMes = todosLosPagosFuturos.reduce((acc, pago) => {
                    const mesAnio = pago.fechaPura.toLocaleString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
                    if(!acc[mesAnio]) acc[mesAnio] = { mesStr: mesAnio, totalCorte: 0, pagos: [] };
                    acc[mesAnio].pagos.push(pago);
                    acc[mesAnio].totalCorte += pago.pagoTotal;
                    return acc;
                }, {});

                setPagosGlobalesMensuales(Object.values(agrupadoPorMes));
                setInversorActivo(inversor);
                setCorreoContador(inversor.email || ''); 
                setShowProyeccionGlobal(true);
            } else {
                alert("Este fondeador no tiene contratos activos para proyectar.");
            }
        } catch (e) { console.error(e); }
    };

    // --- NUEVO: ALERTAS DE CORREO ---
    const enviarAlertasCorreo = async () => {
        const targetEmail = correoContador || inversorActivo.email;
        if(!targetEmail) return alert("Por favor ingresa un correo electrónico destino válido.");
        
        const headers = getAuthHeaders(); if(!headers) return; setIsAlerting(true);
        try {
            const res = await fetch('http://localhost:3001/api/inversores/alertas-correo', {
                method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail, fondeador: inversorActivo.nombre, totalPagos: pagosGlobalesMensuales.reduce((acc, mes) => acc + mes.pagos.length, 0) })
            });
            const data = await res.json();
            if(data.success) alert(data.message);
        } catch(e) { console.error(e); alert("Error de red al simular correos."); } finally { setIsAlerting(false); }
    };

    // --- DESCARGAR PDF INTERACTIVO ---
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
                fechaInicio: cleanDateStr(contratoParaAmortizacion.fecha_inicio),
                numeroDisposicion: contratoParaAmortizacion.numero_disposicion 
            };
            const response = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Accept': 'application/pdf' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error("Fallo de servidor al generar PDF.");
            const blob = await response.blob();
            const objUrl = window.URL.createObjectURL(blob); 
            const link = document.createElement('a'); 
            link.href = objUrl; link.download = `Amortizacion_Contrato_${contratoParaAmortizacion.id}.pdf`; 
            document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(objUrl);
        } catch (error) { alert(`Error al generar el PDF: ${error.message}`); } finally { setIsLoading(false); }
    };

    // --- FUNCIONES CRUD Y MANEJADORES DE ESTADO BASE ---
    const openNewModal = () => { setIsEditing(false); setEditId(null); setFormError(''); setFormData({ tipo_persona: 'FISICA', nombre: '', apellidos: '', rfc: '', direccion: '', telefono: '', email: '', clabe_bancaria: '', numero_cuenta: '', banco: '', origen_fondos: 'Ahorros Personales / Salario', limite_credito: '', ben_nombre: '', ben_parentesco: '', ben_telefono: '' }); setIsModalOpen(true); };
    const openEditModal = (inversor) => { setIsEditing(true); setEditId(inversor.id); setFormError(''); setFormData({ tipo_persona: inversor.tipo_persona || 'FISICA', nombre: inversor.nombre, apellidos: '', rfc: inversor.rfc || '', direccion: inversor.ubicacion, telefono: inversor.telefono, email: inversor.email, clabe_bancaria: inversor.clabe_bancaria, numero_cuenta: inversor.numero_cuenta || '', banco: inversor.banco, origen_fondos: inversor.origen_fondos || 'Ahorros Personales / Salario', limite_credito: inversor.limite_credito || '', ben_nombre: '', ben_parentesco: '', ben_telefono: '' }); setIsModalOpen(true); };
    const triggerEliminarInversor = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Fondeador', message: `¿Estás seguro de eliminar a ${nombre}?`, onConfirm: () => ejecutarEliminarInversor(id) }); };
    
    const ejecutarEliminarInversor = async (id) => { 
        const headers = getAuthHeaders(); if (!headers) return; 
        try { const res = await fetch(`http://localhost:3001/api/inversores/${id}`, { method: 'DELETE', headers }); 
            if (handleAuthError(res.status)) return; 
            if ((await res.json()).success) { setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null }); fetchInversores(); }
        } catch (error) { console.error(error); } 
    };

    const validarFormulario = () => { setFormError(''); if (!formData.nombre.trim()) { setFormError('El Nombre es obligatorio.'); return false; } if (!formData.limite_credito || parseFloat(formData.limite_credito) <= 0) { setFormError('Debe asignar un Límite de Crédito.'); return false; } return true; };

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!validarFormulario()) return; const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true);
        const url = isEditing ? `http://localhost:3001/api/inversores/${editId}` : 'http://localhost:3001/api/inversores';
        const method = isEditing ? 'PUT' : 'POST';
        const payload = { ...formData, limite_credito: parseInputMonto(formData.limite_credito) };
        try { const res = await fetch(url, { method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (handleAuthError(res.status)) return; const data = await res.json(); if (data.success) { setIsModalOpen(false); fetchInversores(); } else setFormError(data.message); } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
    };

    const cambiarEstatusInversor = async (id_persona, estatus_actual) => { const nuevoEstatus = estatus_actual === 1 ? 0 : 1; const authHeaders = getAuthHeaders(); if (!authHeaders) return; try { const response = await fetch(`http://localhost:3001/api/inversores/${id_persona}/estatus`, { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) }); if (handleAuthError(response.status)) return; if ((await response.json()).success) fetchInversores(); } catch (error) {} };

    // ESTA FUNCIÓN CORRIGE EL PANTALLAZO BLANCO DEL FONDEO RÁPIDO
    const abrirModalFondeoDesdeSimulador = () => { 
        let idTasa = '';
        if (tasas && tasas.length > 0) {
            const found = tasas.find(t => parseFloat(t.tasa_anual_esperada) === parseFloat(tasa));
            idTasa = found?.id || tasas[0]?.id || '';
        }
        
        setFormFondeo(prev => ({ 
            ...prev, 
            monto_inicial: monto || '', 
            id_tasa: idTasa, 
            plazo_meses: plazo || '12', 
            tipo_amortizacion: tipoAmortizacion || 'frances', 
            fecha_inicio: fechaInicioSim || new Date().toISOString().split('T')[0], 
            plan_personalizado: tipoAmortizacion === 'personalizado' ? [...(planPersonalizadoSim || [])] : [], 
            numero_disposicion: '' 
        })); 
        setIsFondeoModalOpen(true); 
    };

    const handleCrearFondeo = async (e) => {
        e.preventDefault(); if(!formFondeo.id_inversor || !formFondeo.monto_inicial || !formFondeo.id_tasa) return alert("Completa todos los campos.");
        const inversor = inversores.find(i => i.id == formFondeo.id_inversor); if (inversor && parseFloat(parseInputMonto(formFondeo.monto_inicial)) > parseFloat(inversor.limite_credito)) return alert(`Error: El monto excede el límite.`);
        const payload = { ...formFondeo }; payload.monto_inicial = parseInputMonto(payload.monto_inicial); if (payload.tipo_amortizacion === 'personalizado') payload.plan_json = JSON.stringify(payload.plan_personalizado);
        const headers = getAuthHeaders(); setIsLoading(true);
        try { const res = await fetch('http://localhost:3001/api/inversores/inversion', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if(data.success) { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); setFormFondeo({ id_inversor: '', monto_inicial: '', id_tasa: '', plazo_meses: '12', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', fecha_inicio: new Date().toISOString().split('T')[0], plan_personalizado: [], numero_disposicion: '' }); setFiltroFondeador(''); fetchInversores(); alert("Contrato Generado."); } else alert(data.message); } catch(error) { alert("Error al registrar."); } finally { setIsLoading(false); }
    };

    const abrirPanel = async (inversor) => { setInversorActivo(inversor); setActiveTab('contratos'); setShowNuevoContrato(false); setShowNuevoMovimiento(false); setPanelOpen(true); fetchContratos(inversor.id); fetchBeneficiarios(inversor.id); fetchMovimientos(inversor.id); };
    const fetchContratos = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/contratos/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setContratos(data.data); } catch(e) {} };
    const getMesesContratoAntiguo = () => { if(!formContrato.fecha_inicio || !formContrato.fecha_fin) return 12; const start = new Date(formContrato.fecha_inicio); const end = new Date(formContrato.fecha_fin); return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44))); };

    const handleGuardarContrato = async (e) => { 
        e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true); 
        const payload = { ...formContrato, id_inversor: inversorActivo.id }; payload.monto_inicial = parseInputMonto(payload.monto_inicial); if (payload.tipo_amortizacion === 'personalizado') payload.plan_json = JSON.stringify(payload.plan_personalizado);
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

    // --- COMPONENTES DE PESTAÑAS (PANEL LATERAL) ---
    const TabContratos = () => (
        <div className="tab-content fade-in-up">
            {!showNuevoContrato ? (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', fontWeight: 'bold' }}>CONTRATOS VIGENTES</h4>
                        <button className="btn-primary" onClick={() => setShowNuevoContrato(true)}><IconPlus /> Nuevo Contrato Antiguo</button>
                    </div>
                    {contratos.length > 0 ? contratos.map(c => (
                        <div key={c.id} className="contrato-card">
                            <div className="c-header">
                                <strong>Contrato #{c.id.toString().padStart(4, '0')}</strong>
                                <span className="status-badge active" style={{backgroundColor: '#e0f2fe', color: '#1e40af', borderColor: '#bae6fd'}}>{c.estatus}</span>
                            </div>
                            <div className="c-body">
                                <div>
                                    <span>Monto Fondeado</span>
                                    <h3>{formatMoney(c.monto_inicial)}</h3>
                                    {c.numero_disposicion && (<strong style={{color: 'var(--text-muted)'}}>Disp: {c.numero_disposicion}</strong>)}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span>Tasa / Producto</span>
                                    <strong>{c.nombre_tasa} ({c.tasa_anual_esperada}%)</strong>
                                    <span style={{ display: 'block', marginTop: '4px' }}>Sist: {c.tipo_amortizacion ? c.tipo_amortizacion.toUpperCase() : 'N/A'}</span>
                                </div>
                            </div>
                            <div className="c-footer">
                                <span>Vence: <strong>{new Date(c.fecha_fin).toLocaleDateString()}</strong></span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn-cancel" onClick={() => generarPDFContrato(c.id)}>Ver Contrato</button>
                                    <button className="btn-primary" style={{ backgroundColor: '#0f172a', boxShadow: 'none' }} onClick={() => { setContratoParaAmortizacion(c); setShowVisorAmortizacion(true); }}>Ver Amortización</button>
                                </div>
                            </div>
                        </div>
                    )) : <div className="empty-state">Sin capital activo en este momento.</div>}
                </>
            ) : (
                <form className="modal-form" style={{ padding: 0 }} onSubmit={handleGuardarContrato}>
                    <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>CREAR CONTRATO ESTÁTICO</h4>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Monto</label>
                        <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input type="text" required placeholder="0.00" value={formatInputMonto(formContrato.monto_inicial)} onChange={e => setFormContrato({ ...formContrato, monto_inicial: parseInputMonto(e.target.value) })} />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Número de Disposición (Fondeador)</label>
                        <input type="text" placeholder="Ej. 001-2026" value={formContrato.numero_disposicion} onChange={e => setFormContrato({ ...formContrato, numero_disposicion: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Sistema de Amortización</label>
                        <select required value={formContrato.tipo_amortizacion} onChange={e => setFormContrato({ ...formContrato, tipo_amortizacion: e.target.value })} className="custom-select">
                            <option value="frances">Cuota Fija (Sistema Francés)</option>
                            <option value="aleman">Capital Fijo (Sistema Alemán)</option>
                            <option value="diario">Saldos Diarios (Abono Libre)</option>
                            <option value="personalizado">Plan Personalizado (Institucional)</option>
                        </select>
                    </div>
                    {formContrato.tipo_amortizacion === 'personalizado' && (
                        <PlanPersonalizadoBuilder plan={formContrato.plan_personalizado} setPlan={(p) => setFormContrato({...formContrato, plan_personalizado: p})} montoAsignado={formContrato.monto_inicial} plazo={getMesesContratoAntiguo()} fechaInicio={formContrato.fecha_inicio} />
                    )}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Producto Tasa</label>
                        <select required value={formContrato.id_tasa} onChange={e => setFormContrato({ ...formContrato, id_tasa: e.target.value })} className="custom-select">
                            <option value="">Seleccione...</option>
                            {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa} - {t.tasa_anual_esperada}%</option>))}
                        </select>
                    </div>
                    <div className="form-row" style={{ marginBottom: '24px' }}>
                        <div className="form-group"><label>Fecha Inicio</label><input type="date" required value={formContrato.fecha_inicio} onChange={e => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })} /></div>
                        <div className="form-group"><label>Fecha Vencimiento</label><input type="date" required value={formContrato.fecha_fin} onChange={e => setFormContrato({ ...formContrato, fecha_fin: e.target.value })} /></div>
                    </div>
                    <div className="modal-footer" style={{ padding: 0, backgroundColor: 'transparent', border: 'none' }}>
                        <button type="button" onClick={() => setShowNuevoContrato(false)} className="btn-cancel">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Guardando...' : 'Guardar Contrato'}</button>
                    </div>
                </form>
            )}
        </div>
    );

    const TabBeneficiarios = () => ( <div className="tab-content fade-in-up"> <div className="progress-container"> <div className="progress-header"> <strong>Porcentaje Asignado</strong> <span style={{ color: totalPorcentaje === 100 ? 'var(--brand-green)' : 'var(--text-muted)' }}>{totalPorcentaje}% / 100%</span> </div> <div className="progress-bg"><div className={`progress-fill ${totalPorcentaje === 100 ? 'full' : ''}`} style={{ width: `${totalPorcentaje}%` }}></div></div> </div> {beneficiarios.length > 0 && ( <div className="beneficiarios-list"> {beneficiarios.map(b => ( <div className="beneficiario-card" key={b.id}> <div className="b-info"> <strong>{b.nombre_completo}</strong> <span>Parentesco: {b.parentesco} • Tel: {b.telefono || 'N/A'}</span> </div> <div className="b-actions"> <span className="b-percent">{b.porcentaje}%</span> <button onClick={() => eliminarBeneficiario(b.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}> <IconClose/> </button> </div> </div> ))} </div> )} {totalPorcentaje < 100 && ( <form className="modal-form" style={{ padding: 0, marginTop: '32px' }} onSubmit={handleGuardarBeneficiario}> <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>Añadir Beneficiario Adicional</h4> <div className="form-group" style={{ marginBottom: '16px' }}> <label>Nombre Completo</label><input type="text" required value={formBeneficiario.nombre_completo} onChange={e => setFormBeneficiario({ ...formBeneficiario, nombre_completo: e.target.value })} /> </div> <div className="form-row" style={{ marginBottom: '24px' }}> <div className="form-group"><label>Teléfono</label><input type="text" required maxLength="10" value={formBeneficiario.telefono} onChange={e => setFormBeneficiario({ ...formBeneficiario, telefono: e.target.value.replace(/[^0-9]/g, '') })} /></div> <div className="form-group"><label>Parentesco</label><select required value={formBeneficiario.parentesco} onChange={e => setFormBeneficiario({ ...formBeneficiario, parentesco: e.target.value })} className="custom-select"><option value="">Selecciona...</option><option value="Esposo/a">Esposo/a</option><option value="Hijo/a">Hijo/a</option><option value="Padre/Madre">Padre/Madre</option><option value="Otro">Otro</option></select></div> <div className="form-group"><label>Porcentaje (%)</label><input type="number" required min="1" max={100 - totalPorcentaje} value={formBeneficiario.porcentaje} onChange={e => setFormBeneficiario({ ...formBeneficiario, porcentaje: e.target.value })} /></div> </div> <div className="modal-footer" style={{ padding: 0, backgroundColor: 'transparent', border: 'none' }}><button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Guardando...' : 'Agregar Beneficiario'}</button></div> </form> )} </div> );
    const TabMovimientos = () => ( <div className="tab-content fade-in-up"> {!showNuevoMovimiento ? ( <> <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}> <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', fontWeight: 'bold' }}>HISTORIAL DE MOVIMIENTOS</h4> {contratos.length > 0 && (<button className="btn-primary" onClick={() => setShowNuevoMovimiento(true)}><IconPlus/> Registrar Movimiento</button>)} </div> {contratos.length === 0 && <div className="empty-state">Debes crear un contrato de fondeo primero.</div>} {movimientos.length > 0 ? ( <div className="movimientos-list"> {movimientos.map(mov => { const isIngreso = mov.tipo === 'DEPOSITO'; const iconColor = isIngreso ? 'var(--brand-green)' : '#ef4444'; const bgColor = isIngreso ? '#dcfce3' : '#fee2e2'; return ( <div className="movimiento-item" key={mov.id}> <div className="mov-icon" style={{ backgroundColor: bgColor, color: iconColor }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={isIngreso ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M19 12l-7 7-7-7"}></path></svg></div> <div className="mov-detalles"> <strong>{mov.tipo.replace('_', ' ')}</strong> <span>Contrato #{mov.id_contrato.toString().padStart(4, '0')} • {new Date(mov.fecha_movimiento).toLocaleDateString()}</span> </div> <div className="mov-monto-accion"> <span className={`mov-monto ${isIngreso ? 'ingreso' : 'retiro'}`}>{isIngreso ? '+' : '-'}{formatMoney(mov.monto)}</span> {mov.recibo_comprobante && (<a href={`http://localhost:3001/${mov.recibo_comprobante}`} target="_blank" rel="noreferrer" className="btn-cancel" style={{ padding: '6px 12px' }}>Ver</a>)} </div> </div> ); })} </div> ) : (contratos.length > 0 && <div className="empty-state">No hay movimientos registrados en el sistema.</div>)} </> ) : ( <form className="modal-form" style={{ padding: 0 }} onSubmit={handleGuardarMovimiento}> <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>Registrar Transacción Física</h4> <div className="form-group" style={{ marginBottom: '16px' }}> <label>Contrato Asociado</label> <select required value={formMovimiento.id_contrato} onChange={e => setFormMovimiento({ ...formMovimiento, id_contrato: e.target.value })} className="custom-select"> <option value="">Selecciona un contrato...</option> {contratos.map(c => (<option key={c.id} value={c.id}>Contrato #{c.id.toString().padStart(4, '0')} - {formatMoney(c.monto_inicial)}</option>))} </select> </div> <div className="form-row" style={{ marginBottom: '16px' }}> <div className="form-group"> <label>Tipo de Operación</label> <select required value={formMovimiento.tipo} onChange={e => setFormMovimiento({ ...formMovimiento, tipo: e.target.value })} className="custom-select"> <option value="PAGO_INTERES">Pago de Rendimientos (Salida)</option> <option value="DEPOSITO">Inyección Extra de Capital (Entrada)</option> <option value="RETIRO_CAPITAL">Retiro Parcial de Capital (Salida)</option> </select> </div> <div className="form-group"> <label>Monto Exacto</label> <div className="input-with-prefix"> <span className="prefix">$</span> <input type="text" required placeholder="0.00" value={formatInputMonto(formMovimiento.monto)} onChange={e => setFormMovimiento({ ...formMovimiento, monto: parseInputMonto(e.target.value) })} /> </div> </div> </div> <div className="form-group" style={{ marginBottom: '24px' }}> <label>Comprobante Escaneado (PDF/IMG)</label> <input type="file" required onChange={e => setFileComprobante(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" style={{ padding: '8px', border: '1px dashed var(--border-focus)' }} /> </div> <div className="modal-footer" style={{ padding: 0, backgroundColor: 'transparent', border: 'none' }}> <button type="button" onClick={() => setShowNuevoMovimiento(false)} className="btn-cancel">Cancelar</button> <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Procesando...' : 'Asentar Movimiento'}</button> </div> </form> )} </div> );

    // --- RENDER PRINCIPAL ---
    return (
        <div className="inversores-container">
            {/* --- ENCABEZADO --- */}
            <div className="page-header stagger-1">
                <div>
                    <h1>Directorio Institucional</h1>
                    <p>Gestión integral de Fondeadores y Capital de Inversión</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-primary" style={{ backgroundColor: 'white', color: 'var(--brand-green)', border: '1px solid var(--brand-green)', boxShadow: 'none' }} onClick={abrirModalFondeoDesdeSimulador}>
                        <IconSave /> Activar Fondeo Rápido
                    </button>
                    <button className="btn-primary" onClick={openNewModal}>
                        <IconPlus/> Registrar Nuevo Perfil
                    </button>
                </div>
            </div>

            {/* --- SIMULADOR DE PAGOS --- */}
            <div className="calc-dashboard stagger-2">
                <div className="calc-panel">
                    <div className="panel-title">
                        <div className="icon-wrapper">
                            <IconRefresh />
                        </div>
                        <div>
                            <h3>Simulador Maestro</h3>
                            <p>Proyección y corridas financieras</p>
                        </div>
                    </div>
                    
                    <div className="calc-controls">
                        <div className="form-group">
                            <label>Sistema de Amortización</label>
                            <select value={tipoAmortizacion} onChange={(e) => setTipoAmortizacion(e.target.value)} className="calc-select">
                                <option value="frances">Cuota Fija (Sistema Francés)</option>
                                <option value="aleman">Capital Fijo (Sistema Alemán)</option>
                                <option value="diario">Saldos Diarios (Abono Libre)</option>
                                <option value="personalizado">Personalizado (Institucional)</option>
                            </select>
                        </div>
                        
                        {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && (
                            <div className="form-row" style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px dashed var(--border-focus)' }}>
                                <div className="form-group">
                                    <label>Disposición</label>
                                    <input type="date" value={fechaInicioSim} onChange={(e) => setFechaInicioSim(e.target.value)} />
                                </div>
                                {tipoAmortizacion === 'diario' && (
                                    <div className="form-group">
                                        <label>1er Pago</label>
                                        <input type="date" value={fechaPrimerPagoSim} onChange={(e) => setFechaPrimerPagoSim(e.target.value)} />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div className="form-group">
                            <label>Monto del Fondeo</label>
                            <div className="input-with-prefix">
                                <span className="prefix">$</span>
                                <input type="text" placeholder="0.00" value={formatInputMonto(monto)} onChange={(e) => setMonto(parseInputMonto(e.target.value))} style={{ fontSize: '16px', fontWeight: 'bold' }} />
                            </div>
                        </div>
                        
                        <div className="form-row">
                            <div className="form-group">
                                <label>Producto / Tasa</label>
                                <select value={tasa} onChange={(e) => setTasa(e.target.value)} className="calc-select">
                                    <option value="0">Tasa...</option>
                                    {tasas.map(t => (<option key={t.id} value={t.tasa_anual_esperada}>{t.nombre_tasa} ({t.tasa_anual_esperada}%)</option>))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Plazo Global</label>
                                <select value={plazo} onChange={(e) => setPlazo(e.target.value)} className="calc-select">
                                    <option value="3">3 Meses</option>
                                    <option value="6">6 Meses</option>
                                    <option value="9">9 Meses</option>
                                    <option value="12">12 Meses</option>
                                    <option value="24">24 Meses</option>
                                </select>
                            </div>
                        </div>
                        
                        {tipoAmortizacion === 'diario' ? (
                            <div className="form-group">
                                <label>Abono Fijo a Capital</label>
                                <div className="input-with-prefix">
                                    <span className="prefix">$</span>
                                    <input type="text" value={formatInputMonto(abonoCapitalLibre)} onChange={(e) => setAbonoCapitalLibre(parseInputMonto(e.target.value))} />
                                </div>
                            </div>
                        ) : tipoAmortizacion !== 'personalizado' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '16px' }}>
                                <div className="form-group">
                                    <label>Simular Anticipo</label>
                                    <div className="input-with-prefix">
                                        <span className="prefix">$</span>
                                        <input type="text" placeholder="0.00" value={formatInputMonto(anticipoMontoSim)} onChange={(e) => setAnticipoMontoSim(parseInputMonto(e.target.value))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Mes Aplic.</label>
                                    <input type="number" value={anticipoMesSim} onChange={(e) => setAnticipoMesSim(e.target.value)} />
                                </div>
                            </div>
                        ) : null}

                        {tipoAmortizacion === 'personalizado' && (
                            <PlanPersonalizadoBuilder plan={planPersonalizadoSim} setPlan={setPlanPersonalizadoSim} montoAsignado={monto} plazo={plazo} fechaInicio={fechaInicioSim} />
                        )}
                        
                        {tipoAmortizacion === 'personalizado' && (
                            <button onClick={abrirModalFondeoDesdeSimulador} style={{ width: '100%', padding: '12px', marginTop: '8px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'var(--transition-smooth)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                <IconSave/> Transferir Plan a Nuevo Fondeo
                            </button>
                        )}
                    </div>
                </div>

                <div className="results-panel">
                    <div className="panel-title">
                        <div className="icon-wrapper glass-icon">
                            <IconDownload />
                        </div>
                        <div>
                            <h3>Proyección de Fondeo</h3>
                            <p>Valores totales acumulados</p>
                        </div>
                    </div>
                    
                    <div className="results-grid">
                        <div className="result-card green-card">
                            <div style={{ position: 'relative', zIndex: 2 }}>
                                <span>Intereses Totales a Pagar</span>
                                <h2>{formatMoney(gananciaNeta)}</h2>
                                {monto > 0 && (
                                    <div className="roi-badge">
                                        Tasa ROI: {((gananciaNeta / (parseFloat(parseInputMonto(monto)) || 1)) * 100).toFixed(2)}%
                                    </div>
                                )}
                            </div>
                            <svg viewBox="0 0 100 100" style={{ position: 'absolute', right: '-10%', top: '-20%', width: '150px', opacity: 0.1, transform: 'rotate(15deg)' }} fill="currentColor"><path d="M50 0L100 50L50 100L0 50Z"></path></svg>
                        </div>

                        <div className="result-card blue-card">
                            <div style={{ position: 'relative', zIndex: 2 }}>
                                <span>Retorno Total (Cap+Int+IVA)</span>
                                <h2>{formatMoney(totalRecibir)}</h2>
                            </div>
                            <circle cx="90%" cy="10%" r="60" fill="white" opacity="0.05" />
                            <circle cx="80%" cy="80%" r="40" fill="white" opacity="0.05" />
                        </div>
                    </div>

                    {/* --- TABLA DE AMORTIZACIÓN EN TIEMPO REAL --- */}
                    {tablaAmortizacion.length > 0 && (
                        <div className="table-responsive" style={{ maxHeight: '350px', marginTop: '24px' }}>
                            <table className="data-table">
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-main)', zIndex: 10 }}>
                                    <tr>
                                        <th style={{ textAlign: 'center' }}>NO.</th>
                                        <th style={{ textAlign: 'right' }}>CAPITAL</th>
                                        <th style={{ textAlign: 'right' }}>ANTICIPO</th>
                                        <th style={{ textAlign: 'right' }}>INTERÉS</th>
                                        <th style={{ textAlign: 'right' }}>IVA</th>
                                        <th style={{ textAlign: 'right', color: 'var(--brand-green)' }}>TOTAL</th>
                                        <th style={{ textAlign: 'right' }}>SALDO</th>
                                        {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && <th style={{ textAlign: 'center' }}>DÍAS</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {tablaAmortizacion.map((row, idx) => (
                                        <tr key={idx} style={{ backgroundColor: row.numero == anticipoMesSim && tipoAmortizacion !== 'diario' ? '#fef9c3' : row.numero === 'N/A' ? '#f0fdf4' : 'transparent' }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <strong style={{ color: 'var(--text-main)' }}>{row.numero}</strong> 
                                                {row.fechaStr !== '-' && <span style={{ display:'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{row.fechaStr}</span>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{formatMoney(row.abono)}</td>
                                            <td style={{ textAlign: 'right', color: row.anticipo > 0 ? '#166534' : 'var(--text-muted)', fontWeight: row.anticipo > 0 ? 'bold' : 'normal' }}>{formatMoney(row.anticipo)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMoney(row.interes)}</td>
                                            <td style={{ textAlign: 'right' }}>{formatMoney(row.iva)}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold' }}>{formatMoney(row.pagoTotal)}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: '600' }}>{formatMoney(row.saldoFinal)}</td>
                                            {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && <td style={{ textAlign: 'center' }}>{row.dias}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* --- DIRECTORIO DE FONDEADORES --- */}
            <div className="inversores-list-container fade-in-up">
                <div className="list-header">
                    <h2>Directorio</h2>
                    <div className="input-with-prefix" style={{ width: '300px' }}>
                        <span className="prefix" style={{ display: 'flex', alignItems: 'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input type="text" placeholder="Buscar por nombre o RFC..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ borderRadius: '20px', backgroundColor: 'var(--bg-main)' }} />
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>FONDEADOR</th>
                                <th>CONTACTO</th>
                                <th>LÍNEA DE CRÉDITO</th>
                                <th>ESTATUS</th>
                                <th style={{ textAlign: 'right' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentInversores.length > 0 ? currentInversores.map((inv, idx) => (
                                <tr key={inv.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div className={`avatar-sm ${inv.estatus_activo ? 'avatar-active' : 'avatar-inactive'}`}>
                                                {inv.nombre.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ color: 'var(--text-main)', fontSize: '15px' }}>{inv.nombre}</strong>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>RFC: {inv.rfc || 'S/N'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--text-main)' }}>
                                            <span style={{ fontWeight: '500' }}>{inv.telefono}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{inv.email}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {inv.limite_credito > 0 ? (
                                                <>
                                                    <strong style={{color: 'var(--brand-green)', fontSize: '15px'}}>{formatMoney(inv.limite_credito)}</strong>
                                                    <span style={{color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px'}}>Revolvente Máx.</span>
                                                </>
                                            ) : (
                                                <span style={{color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic'}}>No Asignado</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <button onClick={() => cambiarEstatusInversor(inv.id, inv.estatus_activo)} className={`status-badge ${inv.estatus_activo ? 'active' : 'inactive'}`}>
                                            {inv.estatus_activo ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn-icon-edit" onClick={() => abrirProyeccionGlobal(inv)} title="Proyección Global y Alertas">
                                                <IconRefresh/>
                                            </button>
                                            <button className="btn-icon-edit" onClick={() => abrirPanel(inv)} title="Expediente y Contratos">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                            </button>
                                            <button className="btn-icon-edit" onClick={() => openEditModal(inv)} title="Editar Información">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarInversor(inv.id, inv.nombre)} title="Dar de Baja">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="empty-state">
                                        No se encontraron fondeadores registrados en el directorio.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="pagination-container">
                        <button onClick={prevPage} disabled={currentPage === 1} className="btn-page">&laquo; Anterior</button>
                        <span className="page-info">Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={nextPage} disabled={currentPage === totalPages} className="btn-page">Siguiente &raquo;</button>
                    </div>
                )}
            </div>

            {/* PANEL LATERAL DE DETALLES */}
            {panelOpen && inversorActivo && (
                <div className="modal-overlay" onClick={() => setPanelOpen(false)}>
                    <div className="master-panel fade-in-right" onClick={e => e.stopPropagation()}>
                        
                        <div className="modal-header" style={{ flexShrink: 0 }}>
                            <div>
                                <h2 style={{ color: 'white' }}>Panel de Control</h2>
                                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '14px', color: 'white', fontWeight: '600', border: '1px solid rgba(255,255,255,0.2)', marginTop: '8px' }}>
                                    {inversorActivo.nombre}
                                </div>
                            </div>
                            <button onClick={() => setPanelOpen(false)} className="btn-close" style={{ color: 'white' }}>
                                <IconClose/>
                            </button>
                        </div>
                        
                        <div className="panel-tabs" style={{ flexShrink: 0 }}>
                            {['contratos', 'beneficiarios', 'movimientos'].map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn ${activeTab === tab ? 'active' : ''}`}>
                                    {tab.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        
                        <div className="panel-body" style={{ flexGrow: 1, overflowY: 'auto' }}>
                            {activeTab === 'contratos' && TabContratos()}
                            {activeTab === 'beneficiarios' && TabBeneficiarios()}
                            {activeTab === 'movimientos' && TabMovimientos()}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REDISEÑADO: ALTA/EDICIÓN FONDEADOR */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content fade-in-down" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ flexShrink: 0, backgroundColor: 'white', borderBottom: '1px solid var(--border-light)' }}>
                            <div>
                                <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '20px', fontWeight: '700' }}>{isEditing ? 'Editar Fondeador' : 'Registrar Nuevo Fondeador'}</h2>
                                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>Directorio General de Clientes Inversionistas</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="btn-close"><IconClose/></button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form" style={{ backgroundColor: 'var(--bg-main)', overflowY: 'auto', flexGrow: 1 }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }}>
                                <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '20px' }}>1. Datos de Identificación</h4>
                                
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Tipo de Persona</label>
                                    <select value={formData.tipo_persona} onChange={e => setFormData({ ...formData, tipo_persona: e.target.value })} className="custom-select">
                                        <option value="FISICA">Persona Física</option>
                                        <option value="MORAL">Persona Moral (Empresa)</option>
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>{formData.tipo_persona === 'MORAL' ? 'Razón Social (Empresa)' : 'Nombre(s)'}</label>
                                        <input type="text" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
                                    </div>
                                    {formData.tipo_persona === 'FISICA' && !isEditing && (
                                        <div className="form-group">
                                            <label>Apellidos</label>
                                            <input type="text" required value={formData.apellidos} onChange={e => setFormData({ ...formData, apellidos: e.target.value })} />
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>RFC (Con Homoclave)</label>
                                    <input type="text" value={formData.rfc} onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} />
                                </div>
                            </div>
                            
                            <div style={{ backgroundColor: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '15px', fontWeight: '700' }}>2. Línea de Crédito Autorizada</h4>
                                <label style={{ color: '#15803d', fontSize: '12px', marginBottom: '16px', display: 'block' }}>Monto máximo permitido para fondear (Revolvente)</label>
                                <div className="input-with-prefix">
                                    <span className="prefix" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--brand-green)' }}>$</span>
                                    <input type="text" required value={formatInputMonto(formData.limite_credito)} onChange={e => setFormData({ ...formData, limite_credito: parseInputMonto(e.target.value) })} placeholder="0.00" style={{ height: '56px', fontSize: '20px', fontWeight: '800', color: 'var(--brand-green)', borderColor: '#86efac', backgroundColor: 'white' }} />
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }}>
                                <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '20px' }}>3. Contacto y Datos Bancarios</h4>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Teléfono Celular</label>
                                        <input type="text" required value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value.replace(/[^0-9]/g, '') })} maxLength="10" />
                                    </div>
                                    <div className="form-group">
                                        <label>Correo Electrónico</label>
                                        <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label>Dirección Completa</label>
                                    <input type="text" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                                </div>
                                <div className="form-row" style={{ marginTop: '16px' }}>
                                    <div className="form-group">
                                        <label>Banco del Cliente</label>
                                        <input type="text" required value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Cuenta Bancaria / CLABE</label>
                                        <input type="text" required value={formData.numero_cuenta} onChange={e => setFormData({ ...formData, numero_cuenta: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            
                            {!isEditing && formData.tipo_persona === 'FISICA' && (
                                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '20px' }}>
                                        <h4 className="section-subtitle" style={{ border: 'none', margin: 0 }}>4. Beneficiario Principal</h4>
                                        <span className="status-badge active">100% ASIGNADO</span>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label>Nombre Completo del Beneficiario</label>
                                        <input type="text" required value={formData.ben_nombre} onChange={e => setFormData({ ...formData, ben_nombre: e.target.value })} />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Parentesco</label>
                                            <select required value={formData.ben_parentesco} onChange={e => setFormData({ ...formData, ben_parentesco: e.target.value })} className="custom-select">
                                                <option value="">Selecciona...</option>
                                                <option value="Esposo/a">Esposo/a</option>
                                                <option value="Hijo/a">Hijo/a</option>
                                                <option value="Padre/Madre">Padre/Madre</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Teléfono del Beneficiario</label>
                                            <input type="text" value={formData.ben_telefono} onChange={e => setFormData({ ...formData, ben_telefono: e.target.value.replace(/[^0-9]/g, '') })} maxLength="10" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                        <div className="modal-footer" style={{ flexShrink: 0 }}>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-cancel">Cancelar</button>
                            <button type="submit" onClick={handleSubmit} disabled={isLoading} className="btn-primary">
                                <IconSave/> {isLoading ? 'Guardando...' : 'Guardar Expediente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ACTIVAR FONDEO RÁPIDO */}
            {isFondeoModalOpen && (
                <div className="modal-overlay" onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ flexShrink: 0, backgroundColor: 'white', borderBottom: '1px solid var(--border-light)' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: 'var(--text-main)' }}>Activar Nuevo Fondeo</h2>
                                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '13px' }}>Generación de contrato e ingreso de capital</p>
                            </div>
                            <button onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} className="btn-close"><IconClose/></button>
                        </div>
                        
                        <form id="fondeoForm" onSubmit={handleCrearFondeo} className="modal-form" style={{ backgroundColor: 'var(--bg-main)', overflowY: 'auto', flexGrow: 1 }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)', position: 'relative' }}>
                                <label style={labelStyle}>1. Seleccionar Inversionista</label>
                                <div className="custom-select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '46px', cursor: 'pointer' }} onClick={() => setDropdownFondeadorOpen(!dropdownFondeadorOpen)}>
                                    <span style={{ color: formFondeo.id_inversor ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '14px', fontWeight: formFondeo.id_inversor ? '600' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {formFondeo.id_inversor ? inversores.find(i => i.id == formFondeo.id_inversor)?.nombre : 'Despliegue para buscar un fondeador...'}
                                    </span>
                                </div>
                                
                                {dropdownFondeadorOpen && (
                                    <div style={{ position: 'absolute', top: '100%', left: '24px', right: '24px', zIndex: 100, backgroundColor: 'white', border: '1px solid var(--border-focus)', borderRadius: '8px', marginTop: '4px', boxShadow: 'var(--shadow-panel)', overflow: 'hidden' }}>
                                        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-main)' }}>
                                            <input type="text" autoFocus placeholder="Buscar por nombre..." value={filtroFondeador} onChange={(e) => setFiltroFondeador(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }} style={{ height: '36px', width: '100%', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border-focus)', outline: 'none' }} />
                                        </div>
                                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            {inversoresParaFondeo.length > 0 ? (
                                                inversoresParaFondeo.map(inv => (
                                                    <div key={inv.id} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', transition: 'var(--transition-smooth)' }} onClick={() => { setFormFondeo({...formFondeo, id_inversor: inv.id}); setDropdownFondeadorOpen(false); setFiltroFondeador(''); }} onMouseOver={e=>e.currentTarget.style.backgroundColor='var(--bg-main)'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>
                                                        <strong style={{ fontSize: '14px', display:'block', color: 'var(--text-main)' }}>{inv.nombre}</strong>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Línea Libre: {formatMoney(inv.limite_credito)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="empty-state" style={{ padding: '16px' }}>No se encontraron coincidencias.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>2. Detalles de la Inversión</h4>
                                
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label>Número de Disposición (Fondeador)</label>
                                    <input type="text" placeholder="Ej. 001-2026" value={formFondeo.numero_disposicion} onChange={e => setFormFondeo({ ...formFondeo, numero_disposicion: e.target.value })} />
                                </div>

                                <div className="form-row" style={{ marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label>Fecha de Disposición</label>
                                        <input type="date" required value={formFondeo.fecha_inicio} onChange={e => setFormFondeo({ ...formFondeo, fecha_inicio: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label style={{color: 'var(--brand-green)'}}>Monto a Invertir</label>
                                        <div className="input-with-prefix">
                                            <span className="prefix" style={{ color: 'var(--brand-green)', fontWeight: '800' }}>$</span>
                                            <input type="text" required value={formatInputMonto(formFondeo.monto_inicial)} onChange={e => setFormFondeo({ ...formFondeo, monto_inicial: parseInputMonto(e.target.value) })} style={{ color: 'var(--brand-green)', fontWeight: '800', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="form-row" style={{ marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label>Tasa / Producto</label>
                                        <select required value={formFondeo.id_tasa} onChange={e => setFormFondeo({ ...formFondeo, id_tasa: e.target.value })} className="custom-select">
                                            <option value="">Seleccione...</option>
                                            {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa}</option>))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Plazo Global</label>
                                        <select value={formFondeo.plazo_meses} onChange={e => setFormFondeo({ ...formFondeo, plazo_meses: e.target.value })} className="custom-select">
                                            <option value="6">6 Meses</option>
                                            <option value="12">12 Meses</option>
                                            <option value="24">24 Meses</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label>Sistema de Amortización</label>
                                    <select required value={formFondeo.tipo_amortizacion} onChange={e => setFormFondeo({ ...formFondeo, tipo_amortizacion: e.target.value })} className="custom-select">
                                        <option value="frances">Cuota Fija Constante (Sistema Francés)</option>
                                        <option value="aleman">Capital Fijo Constante (Sistema Alemán)</option>
                                        <option value="diario">Saldos Diarios (Abono Libre)</option>
                                        <option value="personalizado">Plan Personalizado (Institucional)</option>
                                    </select>
                                </div>
                            </div>

                            {formFondeo.tipo_amortizacion === 'personalizado' && (
                                <PlanPersonalizadoBuilder plan={formFondeo.plan_personalizado || []} setPlan={(p) => setFormFondeo({...formFondeo, plan_personalizado: p})} montoAsignado={formFondeo.monto_inicial} plazo={formFondeo.plazo_meses} fechaInicio={formFondeo.fecha_inicio} />
                            )}
                        </form>
                        <div className="modal-footer" style={{ flexShrink: 0 }}>
                            <button type="button" onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} className="btn-cancel">Cancelar</button>
                            <button type="submit" form="fondeoForm" disabled={isLoading} className="btn-primary">
                                <IconSave/> {isLoading ? 'Procesando...' : 'Generar Fondeo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VISOR INTERACTIVO E INYECCIONES DE CAPITAL --- */}
            {showVisorAmortizacion && contratoParaAmortizacion && (
                <div className="modal-overlay">
                    <div className="modal-content fade-in-down" style={{ maxWidth: '1200px', width: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ flexShrink: 0, backgroundColor: 'white', borderBottom: '1px solid var(--border-light)' }}>
                            <div>
                                <h2 style={{ color: 'var(--text-main)', margin: 0, fontSize: '20px', fontWeight: '700' }}>Tabla de Amortización #{contratoParaAmortizacion.id.toString().padStart(4, '0')}</h2>
                                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                                    Monto: {formatMoney(contratoParaAmortizacion.monto_inicial)} | Tasa: {contratoParaAmortizacion.tasa_anual_esperada}% | Sistema: {contratoParaAmortizacion.tipo_amortizacion ? contratoParaAmortizacion.tipo_amortizacion.toUpperCase() : 'FRANCÉS'}
                                </p>
                            </div>
                            <button onClick={() => { setShowVisorAmortizacion(false); setContratoParaAmortizacion(null); setAnticiposInteractivos({}); setPagosIrregulares([]); }} className="btn-close"><IconClose/></button>
                        </div>
                        
                        <div className="modal-body" style={{ backgroundColor: 'var(--bg-main)', overflowY: 'auto', flexGrow: 1, padding: '32px' }}>
                            <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', boxShadow: 'var(--shadow-sm)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h5 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '15px', fontWeight: '700' }}>+ Inyectar Pagos Irregulares (Fuera de Calendario)</h5>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                                            Agrega fechas de inyección no contempladas. Si marcas la casilla "No cobrar día", <strong>el interés del día de la inyección se descuenta</strong>.
                                        </p>
                                    </div>
                                    <button type="button" style={{ backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', padding: '10px 20px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setPagosIrregulares([...pagosIrregulares, { id: Date.now(), fecha: '', monto: '', excluirDia: false }])}>
                                        <IconPlus/> Añadir Fecha
                                    </button>
                                </div>

                                {pagosIrregulares.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                                        {pagosIrregulares.map((pago, index) => (
                                            <div key={pago.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 40px', gap: '16px', alignItems: 'end', backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                <div className="form-group">
                                                    <label>FECHA DE INYECCIÓN</label>
                                                    <input type="date" value={pago.fecha} onChange={e => handlePagoIrregularChange(index, 'fecha', e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label>MONTO A CAPITAL</label>
                                                    <div className="input-with-prefix">
                                                        <span className="prefix" style={{ color: '#166534', fontWeight: 'bold' }}>$</span>
                                                        <input type="text" value={formatInputMonto(pago.monto)} onChange={e => handlePagoIrregularChange(index, 'monto', parseInputMonto(e.target.value))} style={{ color: '#166534', fontWeight: 'bold', borderColor: '#bbf7d0' }} placeholder="0.00" />
                                                    </div>
                                                </div>
                                                <div className="form-group" style={{ textAlign: 'center', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '10px' }}>¿NO COBRAR DÍA?</label>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={pago.excluirDia || false} 
                                                        onChange={e => handlePagoIrregularChange(index, 'excluirDia', e.target.checked)} 
                                                        style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '8px' }}
                                                    />
                                                </div>
                                                <button type="button" onClick={() => removePagoIrregular(index)} className="btn-icon-edit btn-icon-delete" style={{ height: '42px', width: '100%', marginBottom: '2px' }} title="Eliminar pago">
                                                    <IconClose/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <div className="table-responsive" style={{ boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-light)' }}>
                                <div style={{ padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid var(--border-light)' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                                        <strong>Nota interactiva:</strong> Escribe sobre las celdas verdes para anticipos programados. Guarda tus inyecciones para no perderlas.
                                    </p>
                                </div>
                                <table className="detailed-table">
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                        <tr>
                                            <th>NO. PAGO</th>
                                            <th>VENCIMIENTO</th>
                                            <th>ABONO PRINC.</th>
                                            <th style={{ backgroundColor: '#dcfce3', color: '#166534' }}>ANTICIPO (EDITABLE)</th>
                                            <th>INT. ORD.</th>
                                            <th>IVA</th>
                                            <th style={{ color: 'var(--brand-green)' }}>TOTAL PAGO</th>
                                            <th>SALDO INSOLUTO</th>
                                            <th>DÍAS COBRADOS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tablaInteractivaRender.map((row, idx) => (
                                            <tr key={idx} style={{ backgroundColor: row.numero === 'N/A' ? '#f0fdf4' : (anticiposInteractivos[row.indexUI] || 0) > 0 ? '#fef9c3' : 'transparent' }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <strong style={{ color: row.numero === 'N/A' ? '#166534' : 'var(--text-main)' }}>{row.numero}</strong> 
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <strong style={{ color: row.numero === 'N/A' ? '#15803d' : 'var(--text-main)' }}>{row.fechaStr}</strong>
                                                </td>
                                                <td className="number">{formatMoney(row.abono)}</td>
                                                <td className="number" style={{ padding: '4px 12px', backgroundColor: row.numero === 'N/A' ? 'transparent' : '#f0fdf4' }}>
                                                    {row.numero === 'N/A' ? (
                                                        <strong style={{ color: '#166534', paddingRight: '8px' }}>{formatMoney(row.anticipo)}</strong>
                                                    ) : (
                                                        <div style={{ position: 'relative' }}>
                                                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#15803d', fontSize: '12px' }}>$</span>
                                                            <input type="text" placeholder="0.00" value={formatInputMonto(anticiposInteractivos[row.indexUI] || '')} onChange={(e) => handleAnticipoInteractivoChange(row.indexUI, e.target.value)} style={{ width: '100%', height: '32px', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0 8px 0 20px', textAlign: 'right', fontSize: '13px', color: '#166534', fontWeight: 'bold', outline: 'none', fontFamily: 'Courier New, Courier, monospace' }} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="number">{formatMoney(row.interes)}</td>
                                                <td className="number">{formatMoney(row.iva)}</td>
                                                <td className="number" style={{ color: 'var(--brand-green)', fontWeight: 'bold' }}>{formatMoney(row.pagoTotal)}</td>
                                                <td className="number" style={{ color: 'var(--text-main)', fontWeight: '800' }}>{formatMoney(row.saldoFinal)}</td>
                                                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{row.dias}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: 'var(--border-light)' }}>
                                            <td colSpan="4" style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-main)' }}>TOTALES PROYECTADOS:</td>
                                            <td className="number" style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>{formatMoney(totalesInteractivos.interes)}</td>
                                            <td></td>
                                            <td className="number" style={{ padding: '12px', fontWeight: 'bold', color: 'var(--brand-green)' }}>{formatMoney(totalesInteractivos.total)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ flexShrink: 0 }}>
                            <button type="button" onClick={() => { setShowVisorAmortizacion(false); setContratoParaAmortizacion(null); setAnticiposInteractivos({}); setPagosIrregulares([]); }} className="btn-cancel">Cerrar</button>
                            <button type="button" onClick={handleGuardarInyecciones} disabled={isLoading} className="btn-primary" style={{ backgroundColor: '#0f172a' }}>
                                <IconSave/> Guardar Inyecciones
                            </button>
                            <button type="button" onClick={descargarPDFInteractivo} disabled={isLoading} className="btn-primary">
                                <IconDownload/> Descargar PDF Exacto
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PROYECCIÓN GLOBAL A PANTALLA COMPLETA --- */}
            {showProyeccionGlobal && (
                <div className="modal-overlay" style={{ zIndex: 6000, backgroundColor: 'var(--bg-main)', backdropFilter: 'none' }}>
                    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ borderRadius: 0, flexShrink: 0, backgroundColor: 'white', borderBottom: '1px solid var(--border-light)' }}>
                            <div>
                                <h2 style={{ color: 'var(--text-main)', margin: 0 }}>Proyección Global de Pagos</h2>
                                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Vista anticipada de vencimientos para: <strong style={{ color: 'var(--brand-green)' }}>{inversorActivo?.nombre}</strong></p>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div className="input-with-prefix" style={{ width: '300px' }}>
                                    <span className="prefix" style={{ color: '#1e3a8a' }}>
                                        <IconMail/>
                                    </span>
                                    <input type="email" placeholder="Correo del Contador..." value={correoContador} onChange={e => setCorreoContador(e.target.value)} style={{ backgroundColor: 'white', color: '#1e3a8a', border: '1px solid #bfdbfe' }} />
                                </div>
                                <button onClick={enviarAlertasCorreo} disabled={isAlerting} className="btn-primary" style={{ backgroundColor: 'white', color: 'var(--brand-green)', border: '1px solid var(--brand-green)', boxShadow: 'none' }}>
                                    <IconMail/> {isAlerting ? 'Enviando...' : 'Enviar Alertas'}
                                </button>
                                <button onClick={() => setShowProyeccionGlobal(false)} className="btn-close"><IconClose/></button>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                            {pagosGlobalesMensuales.length === 0 && resumenContratos.length === 0 ? (
                                <div className="empty-state">No hay contratos activos para este fondeador.</div>
                            ) : (
                                <>
                                    {/* TABLA DE RESUMEN TIPO EXCEL */}
                                    <div className="table-responsive" style={{ maxHeight: '350px', marginBottom: '32px', boxShadow: 'var(--shadow-lg)' }}>
                                        <table className="detailed-table">
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                                <tr>
                                                    <th colSpan="12" style={{ backgroundColor: '#bfdbfe', color: '#1e3a8a', fontSize: '13px', padding: '12px' }}>PAGO FONDEADORES - {inversorActivo?.nombre}</th>
                                                </tr>
                                                <tr>
                                                    <th># DISPOSICIÓN</th>
                                                    <th>F. INICIO</th>
                                                    <th>F. TÉRMINO</th>
                                                    <th>MONTO</th>
                                                    <th>TASA</th>
                                                    <th>SALDO CAPITAL</th>
                                                    <th>PRÓXIMO PAGO</th>
                                                    <th>NO. PAGO</th>
                                                    <th>A. CAPITAL</th>
                                                    <th>P. INTERÉS</th>
                                                    <th style={{ color: 'var(--brand-green)' }}>TOTAL PAGO</th>
                                                    <th>SALDO FINAL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {resumenContratos.map(c => (
                                                    <tr key={c.id}>
                                                        <td style={{textAlign: 'center', fontWeight: 'bold'}}>{c.numero_disposicion || 'S/N'}</td>
                                                        <td style={{textAlign: 'center'}}>{c.f_inicio}</td>
                                                        <td style={{textAlign: 'center'}}>{c.f_termino}</td>
                                                        <td className="number">{formatMoney(c.monto)}</td>
                                                        <td className="number" style={{textAlign: 'center'}}>{c.tasa}%</td>
                                                        <td className="number">{formatMoney(c.saldo_capital)}</td>
                                                        <td style={{textAlign: 'center', fontWeight: 'bold', color: c.estado_color}}>{c.prox_pago_fecha}</td>
                                                        <td style={{textAlign: 'center'}}>{c.no_pago} {c.no_pago !== 'N/A' ? `de ${c.total_pagos}` : ''}</td>
                                                        <td className="number">{formatMoney(c.a_capital)}</td>
                                                        <td className="number">{formatMoney(c.p_interes)}</td>
                                                        <td className="number" style={{fontWeight: '800', backgroundColor: 'var(--bg-main)', color: 'var(--brand-green)'}}>{formatMoney(c.total_pago)}</td>
                                                        <td className="number">{formatMoney(c.saldo_final)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* TARJETAS MENSUALES */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                                        {pagosGlobalesMensuales.map((mesGrupo, index) => (
                                            <div key={index} className="month-card">
                                                <div className="month-card-header">
                                                    <strong>{mesGrupo.mesStr}</strong>
                                                    <span>Total: {formatMoney(mesGrupo.totalCorte)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {mesGrupo.pagos.map((p, i) => (
                                                        <div key={i} className="payment-row">
                                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                <span className={`payment-status-dot ${p.cssDotClass}`}></span>
                                                                <div>
                                                                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{p.fechaStr}</strong>
                                                                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Disp: <strong>{p.disp}</strong> | Cto. #{p.contrato_id.toString().padStart(4,'0')}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <strong style={{ display: 'block', fontSize: '15px', color: 'var(--brand-green)' }}>{formatMoney(p.pagoTotal)}</strong>
                                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.numero === 'N/A' ? 'Inyección' : `Pago ${p.numero}`}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN (ELIMINAR) */}
            {confirmModal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 6000 }}>
                    <div className="confirm-modal-content">
                        <div className="confirm-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3>{confirmModal.title}</h3>
                        <p>{confirmModal.message}</p>
                        <div className="confirm-actions">
                            <button onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })} className="btn-confirm-cancel">Cancelar</button>
                            <button onClick={confirmModal.onConfirm} className="btn-confirm-delete">Sí, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inversores;