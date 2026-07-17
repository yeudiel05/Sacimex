import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Inversores.css';

// --- UTILERIAS GLOBALES Y MATEMATICAS ---
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

const getNextBusinessDate = (startDateStr, monthsToAdd) => {
    if (!startDateStr) return '';
    const [year, month, day] = startDateStr.split('-').map(Number);
    const d = new Date(year, month - 1 + monthsToAdd, day);
    
    if (d.getDay() === 6) d.setDate(d.getDate() - 1); 
    else if (d.getDay() === 0) d.setDate(d.getDate() - 2); 
    
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// --- ICONOS SVG LIMPIOS ---
const IconSave = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>;
const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconMail = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>;
const IconPlus = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconRefresh = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const IconClose = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconBell = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
const IconEdit = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;

// --- ESTILOS CONSTANTES ---
const inputStyle = { width: '100%', height: '42px', padding: '0 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', transition: 'border-color 0.2s', backgroundColor: 'white', boxSizing: 'border-box' };
const inputStyleBg = { ...inputStyle, backgroundColor: '#f8fafc' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const astStyle = { color: '#ef4444', marginLeft: '4px' };

// --- COMPONENTE: CONSTRUCTOR DE PLAN PERSONALIZADO ---
const PlanPersonalizadoBuilder = ({ plan = [], setPlan, montoAsignado, fechaInicio, setFechaInicio }) => {
    const [fechaTerm, setFechaTerm] = useState('');
    const totalCapital = plan.reduce((acc, curr) => acc + (parseFloat(parseInputMonto(curr.abono)) || 0) + (parseFloat(parseInputMonto(curr.anticipo)) || 0), 0);

    const generarCalendario = () => {
        if (!fechaInicio || !fechaTerm) return alert("Selecciona la fecha de disposicion y terminacion.");
        
        const inicio = new Date(`${fechaInicio}T12:00:00`);
        const fin = new Date(`${fechaTerm}T12:00:00`);
        
        if (inicio >= fin) return alert("La fecha de terminacion debe ser mayor a la de disposicion.");

        let mesesTotal = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth());
        if (mesesTotal <= 0) mesesTotal = 1;

        const nuevoPlan = [];
        for (let i = 1; i <= mesesTotal; i++) {
            const targetDateStr = getNextBusinessDate(cleanDateStr(fechaInicio), i);
            nuevoPlan.push({
                id: Date.now() + i,
                numero: i.toString(),
                fecha: targetDateStr, 
                abono: 0,             
                anticipo: 0         
            });
        }
        setPlan(nuevoPlan);
    };

    const handleAddAnticipo = () => { setPlan([...plan, { id: Date.now(), numero: 'N/A', fecha: '', abono: 0, anticipo: 0 }]); };
    const handleAddNormal = () => {
        const nextNum = plan.filter(p => p.numero !== 'N/A' && p.numero !== '').length + 1;
        setPlan([...plan, { id: Date.now(), numero: nextNum.toString(), fecha: '', abono: 0, anticipo: 0 }]);
    };
    const handleRemove = (index) => { setPlan(plan.filter((_, i) => i !== index)); };
    const handleUpdate = (index, field, val) => { const newPlan = [...plan]; newPlan[index][field] = val; setPlan(newPlan); };

    return (
        <div style={{ marginTop: '16px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            
            {/* FECHAS DE CONFIGURACION SUPERIORES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', marginBottom: '24px', alignItems: 'end', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
                <div className="form-group">
                    <label style={labelStyle}>Fecha Disposicion (Inicio) <span style={astStyle}>*</span></label>
                    <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyleBg} />
                </div>
                <div className="form-group">
                    <label style={labelStyle}>Fecha Terminacion (Fin) <span style={astStyle}>*</span></label>
                    <input type="date" value={fechaTerm} onChange={(e) => setFechaTerm(e.target.value)} style={inputStyleBg} />
                </div>
                <button type="button" onClick={generarCalendario} style={{ padding: '0 16px', height: '42px', backgroundColor: '#10d440', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Generar Fechas
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>Ajuste Manual Institucional</h4>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: totalCapital > parseFloat(parseInputMonto(montoAsignado) || 0) ? '#ef4444' : totalCapital === parseFloat(parseInputMonto(montoAsignado) || 0) ? 'var(--brand-green)' : '#f59e0b', backgroundColor: 'white', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                    Capital Distribuido: {formatMoney(totalCapital)} / {formatMoney(parseFloat(parseInputMonto(montoAsignado) || 0))}
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
                        <input type="text" placeholder="N/A" required value={p.numero} onChange={e => handleUpdate(idx, 'numero', e.target.value)} style={{ ...inputStyle, textAlign: 'center', backgroundColor: p.numero === 'N/A' ? '#fef9c3' : 'white', fontWeight: 'bold', color: p.numero === 'N/A' ? '#854d0e' : '#1e293b' }} />
                        <input type="date" required value={p.fecha} onChange={e => handleUpdate(idx, 'fecha', e.target.value)} style={inputStyle} />
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>$</span>
                            <input type="text" placeholder="0.00" value={formatInputMonto(p.abono)} onChange={e => handleUpdate(idx, 'abono', parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px', textAlign: 'right' }} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: parseFloat(p.anticipo) > 0 ? '#166534' : '#94a3b8', fontSize: '14px' }}>$</span>
                            <input type="text" placeholder="0.00" value={formatInputMonto(p.anticipo)} onChange={e => handleUpdate(idx, 'anticipo', parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px', textAlign: 'right', backgroundColor: parseFloat(p.anticipo) > 0 ? '#dcfce3' : 'white', borderColor: parseFloat(p.anticipo) > 0 ? '#86efac' : '#cbd5e1' }} />
                        </div>
                        <button type="button" onClick={() => handleRemove(idx)} style={{ height: '42px', width: '100%', color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>X</button>
                    </div>
                ))}
                {plan.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '13px', backgroundColor: 'white', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        Selecciona las fechas arriba y haz clic en "Generar Fechas" para crear el calendario de pagos.
                    </div>
                )}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={handleAddNormal} style={{ padding: '8px 16px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', color: '#334155', cursor: 'pointer' }}>+ Fila Normal</button>
                    <button type="button" onClick={handleAddAnticipo} style={{ padding: '8px 16px', backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', color: '#854d0e', cursor: 'pointer' }}>+ Inyeccion Sorpresa</button>
                </div>
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
    const [editandoContratoId, setEditandoContratoId] = useState(null); 
    
    const [formContrato, setFormContrato] = useState({ 
        id_tasa: '', monto_inicial: '', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', reinversion_automatica: 0, fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '', plan_personalizado: [], numero_disposicion: '' 
    });
    
    const [beneficiarios, setBeneficiarios] = useState([]);
    const [formBeneficiario, setFormBeneficiario] = useState({ nombre_completo: '', parentesco: '', telefono: '', porcentaje: '', fecha_nacimiento: '' });
    const [fileIne, setFileIne] = useState(null);
    const [movimientos, setMovimientos] = useState([]);
    const [showNuevoMovimiento, setShowNuevoMovimiento] = useState(false);
    const [formMovimiento, setFormMovimiento] = useState({ id_contrato: '', tipo: 'PAGO_INTERES', monto: '' });
    const [fileComprobante, setFileComprobante] = useState(null);
    
    const [cuotasPendientesForm, setCuotasPendientesForm] = useState([]); 
    const [inyeccionesPendientesForm, setInyeccionesPendientesForm] = useState([]);

    // --- ESTADOS VISOR INTERACTIVO Y EDICIÓN ---
    const [showVisorAmortizacion, setShowVisorAmortizacion] = useState(false);
    const [contratoParaAmortizacion, setContratoParaAmortizacion] = useState(null);
    const [edicionesInteractiva, setEdicionesInteractiva] = useState({}); 
    const [pagosIrregulares, setPagosIrregulares] = useState([]); 
    const [tablaInteractivaRender, setTablaInteractivaRender] = useState([]);
    const [totalesInteractivos, setTotalesInteractivos] = useState({ interes: 0, total: 0 });

    // --- ESTADOS PROYECCION GLOBAL ---
    const [showProyeccionGlobal, setShowProyeccionGlobal] = useState(false);
    const [pagosGlobalesMensuales, setPagosGlobalesMensuales] = useState([]);
    const [resumenContratos, setResumenContratos] = useState([]);
    const [correoContador, setCorreoContador] = useState('');
    const [isAlerting, setIsAlerting] = useState(false);

    // --- ESTADOS BANDEJA DE PAGOS PENDIENTES ---
    const [showBandejaPagos, setShowBandejaPagos] = useState(false);
    const [pagosProximos, setPagosProximos] = useState([]);

    // --- FUNCIONES DE RED ---
    const getAuthHeaders = () => { const token = localStorage.getItem('token'); if (!token) { navigate('/'); return null; } return { 'Authorization': `Bearer ${token}` }; };
    const handleAuthError = (status) => { if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; } return false; };

    const fetchTasasActivas = async () => { const headers = getAuthHeaders(); if (!headers) return; try { const res = await fetch('http://localhost:3001/api/tasas', { headers }); const data = await res.json(); if (data.success) setTasas(data.data.filter(t => t.estatus_activo === 1 && (!t.tipo_producto || t.tipo_producto === 'FONDEO'))); } catch (error) { console.error(error); } };
    const fetchInversores = async () => { const headers = getAuthHeaders(); if (!headers) return; try { const response = await fetch('http://localhost:3001/api/inversores', { headers }); if (handleAuthError(response.status)) return; const data = await response.json(); if (data.success) setInversores(data.data); } catch (error) { console.error(error); } };

    const fetchPagosProximos = async () => {
        const headers = getAuthHeaders(); if (!headers) return;
        try {
            const res = await fetch('http://localhost:3001/api/inversores/reportes/pagos-por-vencer', { headers });
            const data = await res.json();
            if(data.success) {
                setPagosProximos(data.data);
            }
        } catch(e) { console.error("Error al obtener pagos proximos", e); }
    };

    const [bancosDb, setBancosDb] = useState([]);

    const fetchBancos = async () => {
        const headers = getAuthHeaders(); if (!headers) return;
        try {
            const res = await fetch('http://localhost:3001/api/configuracion/bancos', { headers });
            const data = await res.json();
            if (data.success) setBancosDb(data.data.filter(b => b.estatus_activo === 1));
        } catch (error) { console.error(error); }
    };

    useEffect(() => { fetchInversores(); fetchTasasActivas(); fetchPagosProximos(); fetchBancos(); }, []);

    // --- EFECTO: CALCULAR CUOTAS E INYECCIONES PENDIENTES (BOLSA UNIFICADA) ---
    useEffect(() => {
        if (showNuevoMovimiento && formMovimiento.id_contrato) {
            const contratoSel = contratos.find(c => c.id === parseInt(formMovimiento.id_contrato));
            if (contratoSel) {
                let inyecciones = [];
                if(contratoSel.pagos_irregulares_json){
                    try { let temp = contratoSel.pagos_irregulares_json; while (typeof temp === 'string') temp = JSON.parse(temp); inyecciones = Array.isArray(temp) ? temp : []; } catch(e){}
                }
                const tabla = motorCalculoAmortizacion(contratoSel, inyecciones, {}).tabla;
                
                const movsContrato = movimientos.filter(m => m.id_contrato === contratoSel.id && (m.tipo === 'PAGO_INTERES' || m.tipo === 'DEPOSITO'));
                let bolsaTotal = movsContrato.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0);

                const pendientesInt = [];
                const pendientesDep = [];
                
                tabla.forEach(pago => {
                    if (bolsaTotal >= pago.pagoTotal - 0.5 && pago.pagoTotal > 0.01) {
                        bolsaTotal -= pago.pagoTotal; 
                    } else if (pago.pagoTotal > 0.01) {
                        if (pago.numero === 'N/A') {
                            pendientesDep.push(pago); 
                        } else {
                            pendientesInt.push(pago);
                        }
                    }
                });
                
                setCuotasPendientesForm(pendientesInt);
                setInyeccionesPendientesForm(pendientesDep);
            }
        } else {
            setCuotasPendientesForm([]);
            setInyeccionesPendientesForm([]);
        }
    }, [formMovimiento.id_contrato, showNuevoMovimiento, contratos, movimientos]);

    // --- MOTOR CORE DE AMORTIZACION CON RECALCULO AUTOMATICO ---
    const motorCalculoAmortizacion = (contratoObj, inyecciones = [], edicionesCustom = {}) => {
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
                timelineUnificado.push({ indexUI: `irreg_${pago.id || Date.now()}`, numero: 'N/A', fechaStr: cleanDateStr(pago.fecha), abonoFijo: 0, anticipoFijo: parseFloat(parseInputMonto(pago.monto)), esIrregular: true, excluirDia: pago.excluirDia || false });
            }
        });

        timelineUnificado.sort((a,b) => new Date(`${a.fechaStr}T12:00:00`) - new Date(`${b.fechaStr}T12:00:00`));

        let p_frances_meses_restantes = timelineUnificado.filter(r => !r.esIrregular).length;

        timelineUnificado.forEach((row) => {
            let fechaStrEval = edicionesCustom[row.indexUI]?.fecha || row.fechaStr;
            let fechaActual = new Date(`${fechaStrEval}T12:00:00`);
            if(isNaN(fechaActual.getTime())) fechaActual = new Date(fechaAnterior);
            
            let diffTime = Math.abs(Date.UTC(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate()) - Date.UTC(fechaAnterior.getFullYear(), fechaAnterior.getMonth(), fechaAnterior.getDate()));
            let diasTranscurridos = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
            
            let diasParaInteres = diasTranscurridos;
            if (row.esIrregular && row.excluirDia && diasTranscurridos > 0) {
                diasParaInteres = diasTranscurridos - 1;
            }
            
            let interes = (saldo * tasaAnual / 360) * diasParaInteres;
            
            let abonoOverride = edicionesCustom[row.indexUI]?.abono;
            let abonoReal = row.abonoFijo;
            
            if (abonoOverride !== undefined && abonoOverride !== '') {
                abonoReal = parseFloat(abonoOverride) || 0;
            } else if (tipoReal === 'frances' && !row.esIrregular && p_frances_meses_restantes > 0) {
                let cuotaPura = (saldo * (tasaMensual / (1 - Math.pow(1 + tasaMensual, -p_frances_meses_restantes))));
                abonoReal = cuotaPura - interes;
                p_frances_meses_restantes--;
            }

            let anticipoReal = row.anticipoFijo; 
            
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
                fechaInputStr: fechaStrEval,
                fechaPura: fechaActual 
            });
            totalInteres += interes; totalGeneral += totalPago;
            fechaAnterior = new Date(fechaActual);
        });

        return { tabla: tablaRes, totales: { interes: totalInteres, total: totalGeneral } };
    };

    // --- EFECTO: SIMULADOR MAESTRO ---
    useEffect(() => {
        const m = parseFloat(parseInputMonto(monto)) || 0;
        const t = parseFloat(tasa) || 0;
        const p = parseInt(plazo) || 0;
        const aMonto = parseFloat(parseInputMonto(anticipoMontoSim)) || 0;
        const aMes = parseInt(anticipoMesSim) || 0;

        if (m <= 0 || t <= 0 || (p <= 0 && tipoAmortizacion !== 'personalizado')) { setTablaAmortizacion([]); setGananciaNeta(0); setTotalRecibir(0); return; }
        
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
        setEdicionesInteractiva({}); 
    }, [contratoParaAmortizacion, showVisorAmortizacion]);

    useEffect(() => {
        if (!contratoParaAmortizacion || !showVisorAmortizacion) return;
        const res = motorCalculoAmortizacion(contratoParaAmortizacion, pagosIrregulares, edicionesInteractiva);
        setTablaInteractivaRender(res.tabla);
        setTotalesInteractivos(res.totales);
    }, [contratoParaAmortizacion, showVisorAmortizacion, edicionesInteractiva, pagosIrregulares]);

    // --- FUNCIONES INTERACTIVAS ---
    const handleEdicionInteractiva = (indexUI, field, valueStr) => {
        setEdicionesInteractiva(prev => ({
            ...prev,
            [indexUI]: {
                ...prev[indexUI],
                [field]: field === 'fecha' ? valueStr : parseInputMonto(valueStr)
            }
        }));
    };

    const handlePagoIrregularChange = (index, field, val) => {
        const newPagos = [...pagosIrregulares];
        newPagos[index][field] = val;
        setPagosIrregulares(newPagos);
    };

    const removePagoIrregular = (index) => {
        setPagosIrregulares(pagosIrregulares.filter((_, i) => i !== index));
    };

   const handleGuardarInyecciones = async () => {
        const headers = getAuthHeaders(); 
        if(!headers) return; 
        setIsLoading(true);
        
        const huboInyeccion = pagosIrregulares.length > (contratoParaAmortizacion.pagos_irregulares_json ? JSON.parse(contratoParaAmortizacion.pagos_irregulares_json).length : 0);

        const nuevoPlanBase = tablaInteractivaRender
            .filter(row => row.numero !== 'N/A')
            .map(row => ({
                numero: row.numero,
                fecha: row.fechaInputStr || row.fechaStr,
                abono: row.abono,
                anticipo: 0 
            }));

        try {
            const res = await fetch(`http://localhost:3001/api/inversores/contratos/${contratoParaAmortizacion.id}/pagos-irregulares`, {
                method: 'PUT', 
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    pagos_irregulares: pagosIrregulares,
                    plan_json: nuevoPlanBase,
                    huboInyeccion: huboInyeccion 
                })
            });
            const data = await res.json();
            if(data.success) {
                alert("Cambios guardados correctamente.");
                fetchContratos(inversorActivo.id); 
                fetchPagosProximos();
                
                setShowVisorAmortizacion(false);
                setContratoParaAmortizacion(null);
                setEdicionesInteractiva({});
                setPagosIrregulares([]);
                
                if (huboInyeccion) {
                    setActiveTab('movimientos');
                    setShowNuevoMovimiento(true);
                }
            } else alert(data.message);
        } catch(e) { console.error(e); } finally { setIsLoading(false); }
    };

    // --- PROYECCION GLOBAL DEFINITIVA ---
    const abrirProyeccionGlobal = async (inversor) => {
        const headers = getAuthHeaders(); if(!headers) return;
        try {
            const [resContratos, resMovimientos] = await Promise.all([
                fetch(`http://localhost:3001/api/inversores/contratos/${inversor.id}`, { headers }),
                fetch(`http://localhost:3001/api/inversores/movimientos/${inversor.id}`, { headers })
            ]);

            const dataContratos = await resContratos.json();
            const dataMovimientos = await resMovimientos.json();

            if (dataContratos.success && dataContratos.data.length > 0) {
                const movimientosTotales = dataMovimientos.success ? dataMovimientos.data : [];
                let todosLosPagosFuturos = [];
                let resumenList = [];
                
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                const msInDay = 24 * 60 * 60 * 1000;
                
                const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                const mesActualStr = inicioMesActual.toLocaleString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
                
                dataContratos.data.forEach(c => {
                    const movsContrato = movimientosTotales.filter(m => m.id_contrato === c.id && (m.tipo === 'PAGO_INTERES' || m.tipo === 'DEPOSITO'));
                    let bolsaTotal = movsContrato.reduce((acc, curr) => acc + parseFloat(curr.monto || 0), 0);

                    let inyecciones = [];
                    if(c.pagos_irregulares_json){
                        try { let temp = c.pagos_irregulares_json; while (typeof temp === 'string') temp = JSON.parse(temp); inyecciones = Array.isArray(temp) ? temp : []; } catch(e){}
                    }
                    
                    const tablaC = motorCalculoAmortizacion(c, inyecciones, {}).tabla;
                    
                    tablaC.forEach(pago => {
                        if (pago.pagoTotal > 0.01) {
                            if (bolsaTotal >= pago.pagoTotal - 0.5) {
                                pago.pagado = true;
                                bolsaTotal -= pago.pagoTotal;
                            } else {
                                pago.pagado = false;
                            }
                        } else {
                            pago.pagado = true;
                        }
                    });

                    let proximoPago = null;
                    let pagosRegulares = tablaC.filter(t => t.numero !== 'N/A');
                    let totalPagos = pagosRegulares.length;

                    for (let i = 0; i < tablaC.length; i++) {
                        if (!tablaC[i].pagado && tablaC[i].numero !== 'N/A') {
                            proximoPago = tablaC[i];
                            break;
                        }
                    }

                    if(!proximoPago && tablaC.length > 0) {
                        proximoPago = pagosRegulares.length > 0 ? pagosRegulares[pagosRegulares.length - 1] : tablaC[tablaC.length - 1]; 
                    }

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
                        if (!pago.pagado && pago.pagoTotal > 0.01) {
                            let dDiff = (pago.fechaPura - hoy) / msInDay;
                            todosLosPagosFuturos.push({
                                ...pago,
                                contrato_id: c.id,
                                disp: c.numero_disposicion || 'S/N',
                                cssDotClass: dDiff < 0 ? 'dot-vencido' : dDiff <= 5 ? 'dot-alerta' : 'dot-pendiente',
                                esArrastrado: pago.fechaPura < inicioMesActual
                            });
                        }
                    });
                });

                setResumenContratos(resumenList);
                todosLosPagosFuturos.sort((a,b) => a.fechaPura - b.fechaPura);
                
                const agrupadoPorMes = todosLosPagosFuturos.reduce((acc, pago) => {
                    const mesAnio = pago.esArrastrado ? mesActualStr : pago.fechaPura.toLocaleString('es-MX', { month: 'long', year: 'numeric' }).toUpperCase();
                    
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
        } catch (e) { console.error("Error al abrir proyeccion global:", e); }
    };

    // --- ALERTAS DE CORREO ---
    const enviarAlertasCorreo = async () => {
        const targetEmail = correoContador || inversorActivo.email;
        if(!targetEmail) return alert("Por favor ingresa un correo electronico destino valido.");
        
        const headers = getAuthHeaders(); if(!headers) return; setIsAlerting(true);
        try {
            const res = await fetch('http://localhost:3001/api/inversores/alertas-correo', {
                method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail, id_inversor: inversorActivo.id })
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
    const triggerEliminarInversor = (id, nombre) => { setConfirmModal({ isOpen: true, title: 'Eliminar Fondeador', message: `¿Estas seguro de eliminar a ${nombre}?`, onConfirm: () => ejecutarEliminarInversor(id) }); };
    
    const ejecutarEliminarInversor = async (id) => { 
        const headers = getAuthHeaders(); if (!headers) return; 
        try { const res = await fetch(`http://localhost:3001/api/inversores/${id}`, { method: 'DELETE', headers }); 
            if (handleAuthError(res.status)) return; 
            if ((await res.json()).success) { setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null }); fetchInversores(); }
        } catch (error) { console.error(error); } 
    };

    const validarFormulario = () => { setFormError(''); if (!formData.nombre.trim()) { setFormError('El Nombre es obligatorio.'); return false; } if (!formData.limite_credito || parseFloat(formData.limite_credito) <= 0) { setFormError('Debe asignar un Limite de Credito.'); return false; } return true; };

    const handleSubmit = async (e) => {
        e.preventDefault(); if (!validarFormulario()) return; const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true);
        const url = isEditing ? `http://localhost:3001/api/inversores/${editId}` : 'http://localhost:3001/api/inversores';
        const method = isEditing ? 'PUT' : 'POST';
        const payload = { ...formData, limite_credito: parseInputMonto(formData.limite_credito) };
        try { const res = await fetch(url, { method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (handleAuthError(res.status)) return; const data = await res.json(); if (data.success) { setIsModalOpen(false); fetchInversores(); } else setFormError(data.message); } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
    };

    const cambiarEstatusInversor = async (id_persona, estatus_actual) => { const nuevoEstatus = estatus_actual === 1 ? 0 : 1; const authHeaders = getAuthHeaders(); if (!authHeaders) return; try { const response = await fetch(`http://localhost:3001/api/inversores/${id_persona}/estatus`, { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) }); if (handleAuthError(response.status)) return; if ((await response.json()).success) fetchInversores(); } catch (error) {} };

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
        const inversor = inversores.find(i => i.id == formFondeo.id_inversor); if (inversor && parseFloat(parseInputMonto(formFondeo.monto_inicial)) > parseFloat(inversor.limite_credito)) return alert(`Error: El monto excede el limite.`);
        const payload = { ...formFondeo }; payload.monto_inicial = parseInputMonto(payload.monto_inicial); if (payload.tipo_amortizacion === 'personalizado') payload.plan_json = JSON.stringify(payload.plan_personalizado);
        const headers = getAuthHeaders(); setIsLoading(true);
        try { 
            const res = await fetch('http://localhost:3001/api/inversores/inversion', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); 
            const data = await res.json(); 
            if(data.success) { 
                setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); setFormFondeo({ id_inversor: '', monto_inicial: '', id_tasa: '', plazo_meses: '12', frecuencia_pagos: 'MENSUAL', tipo_amortizacion: 'frances', fecha_inicio: new Date().toISOString().split('T')[0], plan_personalizado: [], numero_disposicion: '' }); setFiltroFondeador(''); fetchInversores(); alert("Contrato Generado."); 
            } else {
                alert(data.message); 
            }
        } catch(error) { alert("Error al registrar."); } finally { setIsLoading(false); }
    };

    const abrirPanel = async (inversor) => { setInversorActivo(inversor); setActiveTab('contratos'); setShowNuevoContrato(false); setShowNuevoMovimiento(false); setEditandoContratoId(null); setPanelOpen(true); fetchContratos(inversor.id); fetchBeneficiarios(inversor.id); fetchMovimientos(inversor.id); };
    const fetchContratos = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/contratos/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setContratos(data.data); } catch(e) {} };

    const iniciarEdicionContrato = (c) => {
        setFormContrato({
            id_tasa: c.id_tasa, monto_inicial: c.monto_inicial, frecuencia_pagos: c.frecuencia_pagos, 
            tipo_amortizacion: c.tipo_amortizacion, reinversion_automatica: c.reinversion_automatica, 
            fecha_inicio: cleanDateStr(c.fecha_inicio), fecha_fin: cleanDateStr(c.fecha_fin), 
            plan_personalizado: [], numero_disposicion: c.numero_disposicion || ''
        });
        setEditandoContratoId(c.id);
        setShowNuevoContrato(true);
    };

    const handleGuardarContrato = async (e) => { 
        e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true); 
        if (editandoContratoId) {
            try {
                const res = await fetch(`http://localhost:3001/api/inversores/contratos/${editandoContratoId}`, {
                    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_inicio: formContrato.fecha_inicio, numero_disposicion: formContrato.numero_disposicion })
                });
                const data = await res.json();
                if (data.success) {
                    setShowNuevoContrato(false); setEditandoContratoId(null); fetchContratos(inversorActivo.id); fetchPagosProximos();
                } else alert(data.message);
            } catch(e) {} finally { setIsLoading(false); }
        } else {
            const payload = { ...formContrato, id_inversor: inversorActivo.id }; payload.monto_inicial = parseInputMonto(payload.monto_inicial); if (payload.tipo_amortizacion === 'personalizado') payload.plan_json = JSON.stringify(payload.plan_personalizado);
            try { 
                const res = await fetch('http://localhost:3001/api/inversores/contratos', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); 
                const data = await res.json(); 
                if (data.success) { 
                    setShowNuevoContrato(false); fetchContratos(inversorActivo.id); fetchPagosProximos(); 
                } else {
                    alert(data.message); 
                }
            } catch (error) {} finally { setIsLoading(false); } 
        }
    };

    const generarPDFContrato = async (id_contrato) => { const headers = getAuthHeaders(); setIsLoading(true); try { const response = await fetch(`http://localhost:3001/api/inversores/contratos/${id_contrato}/pdf`, { headers }); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Contrato_${id_contrato}.pdf`; link.click(); } catch (error) {} finally { setIsLoading(false); } };
    const fetchBeneficiarios = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/beneficiarios/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setBeneficiarios(data.data); } catch(e) {} };
    const totalPorcentaje = beneficiarios.reduce((acc, curr) => acc + parseFloat(curr.porcentaje), 0);
    
    const handleGuardarBeneficiario = async (e) => { 
        e.preventDefault(); 
        if (totalPorcentaje + parseFloat(formBeneficiario.porcentaje) > 100) return alert("Excede el 100%."); 
        
        const token = localStorage.getItem('token'); 
        if (!token) return;

        setIsLoading(true); 
        try { 
            const formData = new FormData();
            formData.append('id_inversor', inversorActivo.id);
            formData.append('nombre_completo', formBeneficiario.nombre_completo);
            formData.append('parentesco', formBeneficiario.parentesco);
            formData.append('telefono', formBeneficiario.telefono);
            formData.append('porcentaje', formBeneficiario.porcentaje);
            if (formBeneficiario.fecha_nacimiento) formData.append('fecha_nacimiento', formBeneficiario.fecha_nacimiento);
            
            if (fileIne) formData.append('ine', fileIne);

            const res = await fetch('http://localhost:3001/api/inversores/beneficiarios', { 
                method: 'POST', 
                headers: { 
                    'Authorization': `Bearer ${token}` 
                }, 
                body: formData 
            }); 
            
            const data = await res.json(); 
            if (data.success) { 
                setFormBeneficiario({ nombre_completo: '', parentesco: '', telefono: '', porcentaje: '', fecha_nacimiento: '' }); 
                setFileIne(null);
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = '';
                fetchBeneficiarios(inversorActivo.id); 
            } else {
                alert(data.message || "Error al guardar el beneficiario.");
            }
        } catch (error) { 
            console.error(error);
            alert("Ocurrio un error al enviar los datos.");
        } finally { 
            setIsLoading(false); 
        } 
    };

    const eliminarBeneficiario = async (id) => { if (!window.confirm("¿Eliminar?")) return; const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/beneficiarios/${id}`, { method: 'DELETE', headers }); if ((await res.json()).success) fetchBeneficiarios(inversorActivo.id); } catch (error) {} };
    const fetchMovimientos = async (id_inversor) => { const headers = getAuthHeaders(); try { const res = await fetch(`http://localhost:3001/api/inversores/movimientos/${id_inversor}`, { headers }); const data = await res.json(); if (data.success) setMovimientos(data.data); } catch(e){} };
    
    const handleGuardarMovimiento = async (e) => { 
        e.preventDefault(); const headers = getAuthHeaders(); setIsLoading(true); 
        const formDataUpload = new FormData(); 
        formDataUpload.append('id_contrato', formMovimiento.id_contrato); 
        formDataUpload.append('tipo', formMovimiento.tipo); 
        formDataUpload.append('monto', parseInputMonto(formMovimiento.monto)); 
        if (fileComprobante) formDataUpload.append('comprobante', fileComprobante); 
        try { 
            const res = await fetch('http://localhost:3001/api/inversores/movimientos', { method: 'POST', headers, body: formDataUpload }); 
            const data = await res.json(); 
            if (data.success) { 
                setShowNuevoMovimiento(false); 
                fetchMovimientos(inversorActivo.id); 
                fetchPagosProximos();
            } 
        } catch (error) {} finally { setIsLoading(false); } 
    };

    const inversoresFiltrados = inversores.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (i.rfc && i.rfc.toLowerCase().includes(searchTerm.toLowerCase())));
    const indexOfLastItem = currentPage * itemsPerPage; const indexOfFirstItem = indexOfLastItem - itemsPerPage; const currentInversores = inversoresFiltrados.slice(indexOfFirstItem, indexOfLastItem); const totalPages = Math.ceil(inversoresFiltrados.length / itemsPerPage);
    const nextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }; const prevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
    const inversoresParaFondeo = inversores.filter(inv => { if (inv.estatus_activo !== 1) return false; if (!filtroFondeador) return true; const term = filtroFondeador.toLowerCase().trim(); return (inv.nombre || '').toLowerCase().includes(term) || (inv.rfc || '').toLowerCase().includes(term) || (inv.telefono || '').toLowerCase().includes(term); });

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
                            <div className="c-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong>Contrato #{c.id.toString().padStart(4, '0')}</strong>
                                    <button onClick={() => iniciarEdicionContrato(c)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Editar Datos Basicos">
                                        <IconEdit />
                                    </button>
                                </div>
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
                                    <button className="btn-primary" style={{ backgroundColor: '#0f172a', boxShadow: 'none' }} onClick={() => { setContratoParaAmortizacion(c); setShowVisorAmortizacion(true); }}>Ver Amortizacion</button>
                                </div>
                            </div>
                        </div>
                    )) : <div className="empty-state">Sin capital activo en este momento.</div>}
                </>
            ) : (
                <form className="modal-form" style={{ padding: 0 }} onSubmit={handleGuardarContrato}>
                    <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>{editandoContratoId ? 'EDITAR CONTRATO ESTATICO' : 'CREAR CONTRATO ESTATICO'}</h4>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Monto <span style={astStyle}>*</span></label>
                        <div className="input-with-prefix">
                            <span className="prefix">$</span>
                            <input type="text" required placeholder="0.00" value={formatInputMonto(formContrato.monto_inicial)} onChange={e => setFormContrato({ ...formContrato, monto_inicial: parseInputMonto(e.target.value) })} style={inputStyleBg} disabled={!!editandoContratoId} />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Numero de Disposicion (Fondeador) <span style={astStyle}>*</span></label>
                        <input type="text" placeholder="Ej. 001-2026" required value={formContrato.numero_disposicion} onChange={e => setFormContrato({ ...formContrato, numero_disposicion: e.target.value })} style={inputStyleBg} />
                    </div>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Sistema de Amortizacion <span style={astStyle}>*</span></label>
                        <select required value={formContrato.tipo_amortizacion} onChange={e => setFormContrato({ ...formContrato, tipo_amortizacion: e.target.value })} style={inputStyleBg} disabled={!!editandoContratoId}>
                            <option value="frances">Cuota Fija (Sistema Frances)</option>
                            <option value="aleman">Capital Fijo (Sistema Aleman)</option>
                            <option value="diario">Saldos Diarios (Abono Libre)</option>
                            <option value="personalizado">Plan Personalizado (Institucional)</option>
                        </select>
                    </div>
                    {formContrato.tipo_amortizacion === 'personalizado' && !editandoContratoId && (
                        <PlanPersonalizadoBuilder 
                            plan={formContrato.plan_personalizado} 
                            setPlan={(p) => setFormContrato({...formContrato, plan_personalizado: p})} 
                            montoAsignado={formContrato.monto_inicial} 
                            fechaInicio={formContrato.fecha_inicio} 
                            setFechaInicio={(val) => setFormContrato({...formContrato, fecha_inicio: val})} 
                        />
                    )}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Producto Tasa <span style={astStyle}>*</span></label>
                        <select required value={formContrato.id_tasa} onChange={e => setFormContrato({ ...formContrato, id_tasa: e.target.value })} style={inputStyleBg} disabled={!!editandoContratoId}>
                            <option value="">Seleccione...</option>
                            {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa} - {t.tasa_anual_esperada}%</option>))}
                        </select>
                    </div>
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                        <div className="form-group"><label>Fecha Inicio <span style={astStyle}>*</span></label><input type="date" required value={formContrato.fecha_inicio} onChange={e => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })} style={inputStyleBg} /></div>
                        <div className="form-group"><label>Fecha Vencimiento <span style={astStyle}>*</span></label><input type="date" required value={formContrato.fecha_fin} onChange={e => setFormContrato({ ...formContrato, fecha_fin: e.target.value })} style={inputStyleBg} disabled={!!editandoContratoId} /></div>
                    </div>
                    <div className="modal-footer" style={{ padding: 0, backgroundColor: 'transparent', border: 'none', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => { setShowNuevoContrato(false); setEditandoContratoId(null); }} className="btn-cancel">Cancelar</button>
                        <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Guardando...' : 'Guardar Contrato'}</button>
                    </div>
                </form>
            )}
        </div>
    );

    const TabBeneficiarios = () => ( 
        <div className="tab-content fade-in-up"> 
            <div className="progress-container"> 
                <div className="progress-header"> 
                    <strong>Porcentaje Asignado</strong> 
                    <span style={{ color: totalPorcentaje === 100 ? 'var(--brand-green)' : 'var(--text-muted)' }}>{totalPorcentaje}% / 100%</span> 
                </div> 
                <div className="progress-bg"><div className={`progress-fill ${totalPorcentaje === 100 ? 'full' : ''}`} style={{ width: `${totalPorcentaje}%` }}></div></div> 
            </div> 
            {beneficiarios.length > 0 && ( 
                <div className="beneficiarios-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}> 
                    {beneficiarios.map(b => ( 
                        <div className="beneficiario-card" key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}> 
                            <div className="b-info"> 
                                <strong style={{ display: 'block', color: '#0f172a' }}>{b.nombre_completo}</strong> 
                                <span style={{ fontSize: '12px', color: '#64748b' }}>Parentesco: {b.parentesco} - Tel: {b.telefono || 'N/A'}</span> 
                                {b.ine_url && (
                                    <a href={`http://localhost:3001${b.ine_url}`} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: '#2563eb', textDecoration: 'none', fontWeight: 'bold' }}>
                                        📄 Ver Documento INE
                                    </a>
                                )}
                            </div> 
                            <div className="b-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}> 
                                <span className="b-percent" style={{ fontWeight: 'bold', color: '#166534', backgroundColor: '#dcfce3', padding: '4px 10px', borderRadius: '12px', fontSize: '12px' }}>{b.porcentaje}%</span> 
                                <button onClick={() => eliminarBeneficiario(b.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}> <IconClose/> </button> 
                            </div> 
                        </div> 
                    ))} 
                </div> 
            )} 
            {totalPorcentaje < 100 && ( 
                <form className="modal-form" style={{ padding: 0, marginTop: '32px' }} onSubmit={handleGuardarBeneficiario}> 
                    <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>Añadir Beneficiario Adicional</h4> 
                    <div className="form-group" style={{ marginBottom: '16px' }}> 
                        <label>Nombre Completo <span style={astStyle}>*</span></label>
                        <input type="text" required value={formBeneficiario.nombre_completo} onChange={e => setFormBeneficiario({ ...formBeneficiario, nombre_completo: e.target.value })} style={inputStyleBg} /> 
                    </div> 
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}> 
                        <div className="form-group">
                            <label>Telefono <span style={astStyle}>*</span></label>
                            <input type="text" required maxLength="10" value={formBeneficiario.telefono} onChange={e => setFormBeneficiario({ ...formBeneficiario, telefono: e.target.value.replace(/[^0-9]/g, '') })} style={inputStyleBg} />
                        </div> 
                        <div className="form-group">
                            <label>Parentesco <span style={astStyle}>*</span></label>
                            <select required value={formBeneficiario.parentesco} onChange={e => setFormBeneficiario({ ...formBeneficiario, parentesco: e.target.value })} style={inputStyleBg}>
                                <option value="">Selecciona...</option>
                                <option value="Esposo/a">Esposo/a</option>
                                <option value="Hijo/a">Hijo/a</option>
                                <option value="Padre/Madre">Padre/Madre</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div> 
                        <div className="form-group">
                            <label>Porcentaje (%) <span style={astStyle}>*</span></label>
                            <input type="number" required min="1" max={100 - totalPorcentaje} value={formBeneficiario.porcentaje} onChange={e => setFormBeneficiario({ ...formBeneficiario, porcentaje: e.target.value })} style={inputStyleBg} />
                        </div> 
                    </div> 
                    
                    <div className="form-group" style={{ marginBottom: '24px' }}> 
                        <label>Identificación (INE) <span style={{ color: '#94a3b8', fontWeight: 'normal', fontSize: '11px', marginLeft: '4px' }}>(Opcional)</span></label> 
                        <input type="file" onChange={e => setFileIne(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" style={{ ...inputStyleBg, padding: '8px', border: '1px dashed #cbd5e1' }} /> 
                    </div> 

                    <div className="modal-footer" style={{ padding: 0, backgroundColor: 'transparent', border: 'none', display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Guardando...' : 'Agregar Beneficiario'}</button>
                    </div> 
                </form> 
            )} 
        </div>
    );

    const TabMovimientos = () => ( 
        <div className="tab-content fade-in-up"> 
            {!showNuevoMovimiento ? ( 
                <> 
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}> 
                        <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)', fontWeight: 'bold' }}>HISTORIAL DE PAGOS REALIZADOS</h4> 
                        {contratos.length > 0 && (<button className="btn-primary" onClick={() => setShowNuevoMovimiento(true)}><IconPlus/> Registrar Pago Fisico</button>)} 
                    </div> 
                    {contratos.length === 0 && <div className="empty-state">Debes crear un contrato de fondeo primero.</div>} 
                    {movimientos.length > 0 ? ( 
                        <div className="movimientos-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}> 
                            {movimientos.map(mov => { 
                                const iconColor = '#ef4444'; 
                                const bgColor = '#fef2f2'; 
                                
                                let labelTipo = mov.tipo.replace('_', ' ');
                                if (mov.tipo === 'DEPOSITO') labelTipo = 'PAGO INYECCION A CAPITAL';
                                
                                return ( 
                                    <div className="movimiento-item" key={mov.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: `1px solid ${bgColor}` }}> 
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div className="mov-icon" style={{ backgroundColor: bgColor, color: iconColor, width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M12 5v14M19 12l-7 7-7-7"></path></svg>
                                            </div> 
                                            <div className="mov-detalles"> 
                                                <strong style={{ display: 'block', color: '#0f172a' }}>{labelTipo}</strong> 
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>Contrato #{mov.id_contrato.toString().padStart(4, '0')} - {new Date(mov.fecha_movimiento).toLocaleDateString()}</span> 
                                            </div> 
                                        </div>
                                        <div className="mov-monto-accion" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}> 
                                            <span className="mov-monto retiro" style={{ fontWeight: 'bold', fontSize: '15px', color: iconColor }}>-{formatMoney(mov.monto)}</span> 
                                            {mov.recibo_comprobante && (<a href={`http://localhost:3001/${mov.recibo_comprobante}`} target="_blank" rel="noreferrer" className="btn-cancel" style={{ padding: '4px 10px', fontSize: '11px', textDecoration: 'none' }}>Ver Doc</a>)} 
                                        </div> 
                                    </div> 
                                ); 
                            })} 
                        </div> 
                    ) : (contratos.length > 0 && <div className="empty-state">No hay pagos registrados en el sistema.</div>)} 
                </> 
            ) : ( 
                <form className="modal-form" style={{ padding: 0 }} onSubmit={handleGuardarMovimiento}> 
                    <h4 className="section-subtitle" style={{ border: 'none', marginBottom: '16px' }}>Registrar Pago Fisico al Fondeador</h4> 
                    
                    <div className="form-group" style={{ marginBottom: '16px' }}> 
                        <label>Contrato Asociado <span style={astStyle}>*</span></label> 
                        <select required value={formMovimiento.id_contrato} onChange={e => setFormMovimiento({ ...formMovimiento, id_contrato: e.target.value, monto: '' })} style={inputStyleBg}> 
                            <option value="">Selecciona un contrato...</option> 
                            {contratos.map(c => (<option key={c.id} value={c.id}>Contrato #{c.id.toString().padStart(4, '0')} - {formatMoney(c.monto_inicial)}</option>))} 
                        </select> 
                    </div> 

                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}> 
                        <div className="form-group"> 
                            <label>Concepto de Salida (Pago) <span style={astStyle}>*</span></label> 
                            <select required value={formMovimiento.tipo} onChange={e => setFormMovimiento({ ...formMovimiento, tipo: e.target.value, monto: '' })} style={inputStyleBg}> 
                                <option value="PAGO_INTERES">Pago de Rendimientos Ordinarios</option> 
                                <option value="DEPOSITO">Pago de Inyeccion Extra a Capital</option> 
                                <option value="RETIRO_CAPITAL">Retiro Parcial de Capital / Finiquito</option> 
                            </select> 
                        </div> 
                        <div className="form-group"> 
                            <label>Monto Exacto Pagado <span style={astStyle}>*</span></label> 
                            <div className="input-with-prefix"> 
                                <span className="prefix">$</span> 
                                <input type="text" required placeholder="0.00" value={formatInputMonto(formMovimiento.monto)} onChange={e => setFormMovimiento({ ...formMovimiento, monto: parseInputMonto(e.target.value) })} style={{ ...inputStyleBg, paddingLeft: '28px', fontWeight: 'bold' }} /> 
                            </div> 
                        </div> 
                    </div> 

                    {formMovimiento.tipo === 'PAGO_INTERES' && cuotasPendientesForm.length > 0 && (
                        <div className="form-group" style={{ marginBottom: '16px', backgroundColor: '#eff6ff', padding: '12px', borderRadius: '8px', border: '1px dashed #bfdbfe' }}>
                            <label style={{ color: '#1e40af', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>AUTO-LLENAR CON UNA CUOTA PENDIENTE</label>
                            <select 
                                onChange={(e) => {
                                    if (e.target.value !== "") {
                                        const cuota = cuotasPendientesForm[e.target.value];
                                        setFormMovimiento({ ...formMovimiento, monto: cuota.pagoTotal });
                                    }
                                }} 
                                style={{...inputStyleBg, borderColor: '#93c5fd'}}
                            >
                                <option value="">Selecciona la cuota que estas pagando...</option>
                                {cuotasPendientesForm.map((cuota, index) => (
                                    <option key={index} value={index}>
                                        Pago #{cuota.numero} - Vence: {cuota.fechaStr} - {formatMoney(cuota.pagoTotal)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {formMovimiento.tipo === 'DEPOSITO' && inyeccionesPendientesForm.length > 0 && (
                        <div className="form-group" style={{ marginBottom: '16px', backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px dashed #bbf7d0' }}>
                            <label style={{ color: '#166534', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>AUTO-LLENAR CON UNA INYECCION PROGRAMADA</label>
                            <select 
                                onChange={(e) => {
                                    if (e.target.value !== "") {
                                        const iny = inyeccionesPendientesForm[e.target.value];
                                        setFormMovimiento({ ...formMovimiento, monto: iny.pagoTotal });
                                    }
                                }} 
                                style={{...inputStyleBg, borderColor: '#86efac'}}
                            >
                                <option value="">Selecciona la inyeccion a capital...</option>
                                {inyeccionesPendientesForm.map((iny, index) => (
                                    <option key={index} value={index}>
                                        Fecha Programada: {iny.fechaStr} - {formatMoney(iny.pagoTotal)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: '24px' }}> 
                        <label>Comprobante Escaneado (PDF/IMG) <span style={astStyle}>*</span></label> 
                        <input type="file" required onChange={e => setFileComprobante(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" style={{ ...inputStyleBg, padding: '8px', border: '1px dashed #cbd5e1' }} /> 
                    </div> 
                    <div className="modal-footer" style={{ padding: 0, backgroundColor: 'transparent', border: 'none', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}> 
                        <button type="button" onClick={() => setShowNuevoMovimiento(false)} className="btn-cancel">Cancelar</button> 
                        <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? 'Procesando...' : 'Asentar Pago'}</button> 
                    </div> 
                </form> 
            )} 
        </div> 
    );

    // --- RENDER PRINCIPAL ---
    return (
        <div className="inversores-container">
            {/* --- ENCABEZADO --- */}
            <div className="page-header stagger-1">
                <div>
                    <h1>Directorio Institucional</h1>
                    <p>Gestion integral de Fondeadores y Capital de Inversion</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        className="btn-primary" 
                        style={{ backgroundColor: 'white', color: '#ef4444', border: '1px solid #ef4444', boxShadow: 'none' }} 
                        onClick={() => setShowBandejaPagos(true)}
                    >
                        <IconBell /> Pagos Vencidos / Proximos ({pagosProximos.length})
                    </button>
                    <button className="btn-primary" style={{ backgroundColor: 'white', color: 'var(--brand-green)', border: '1px solid var(--brand-green)', boxShadow: 'none' }} onClick={abrirModalFondeoDesdeSimulador}>
                        <IconSave /> Activar Fondeo Rapido
                    </button>
                    <button className="btn-primary" onClick={openNewModal}>
                        <IconPlus/> Registrar Nuevo Perfil
                    </button>
                </div>
            </div>

            {/* --- BANDEJA DE PAGOS PENDIENTES (ALERTA) --- */}
            {showBandejaPagos && (
                <div className="modal-overlay" style={{ zIndex: 7000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ flexShrink: 0, backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                            <div>
                                <h2 style={{ color: '#991b1b', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <IconBell/> Alertas de Vencimiento de Fondeos
                                </h2>
                                <p style={{ color: '#b91c1c', margin: '4px 0 0 0', fontSize: '13px' }}>Pagos de rendimientos pendientes a nivel global.</p>
                            </div>
                            <button onClick={() => setShowBandejaPagos(false)} className="btn-close" style={{ color: '#991b1b' }}><IconClose/></button>
                        </div>
                        
                        <div style={{ overflowY: 'auto', padding: '24px', backgroundColor: '#f8fafc', flexGrow: 1 }}>
                            <table className="data-table" style={{ width: '100%', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <thead style={{ backgroundColor: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ padding: '12px' }}>FECHA LIMITE</th>
                                        <th style={{ padding: '12px' }}>FONDEADOR</th>
                                        <th style={{ padding: '12px' }}>CONCEPTO</th>
                                        <th style={{ padding: '12px', textAlign: 'right' }}>MONTO</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>ESTADO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagosProximos.length > 0 ? pagosProximos.map(p => {
                                        const diasR = p.dias_restantes;
                                        let bBg = '#fee2e2', bCol = '#dc2626', bText = 'Vencido';
                                        let tText = diasR === 0 ? '(Hoy)' : `(Retraso ${Math.abs(diasR)}d)`;

                                        if (diasR > 5) { bBg = '#d1fae5'; bCol = '#059669'; bText = 'A Tiempo'; tText = `(Faltan ${diasR}d)`; }
                                        else if (diasR > 0) { bBg = '#fef3c7'; bCol = '#d97706'; bText = 'Por Vencer'; tText = `(Faltan ${diasR}d)`; }

                                        return (
                                            <tr key={p.id_pago} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{new Date(p.fecha_solicitud).toLocaleDateString('es-MX', {timeZone: 'UTC'})}</td>
                                                <td style={{ padding: '12px', color: '#1e293b', fontWeight: '600' }}>{p.proveedor}</td>
                                                <td style={{ padding: '12px', fontSize: '13px', color: '#475569' }}>{p.concepto}</td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: '#0f172a' }}>{formatMoney(p.monto_pago)}</td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <span style={{ backgroundColor: bBg, color: bCol, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{bText}</span>
                                                        <span style={{ fontSize: '10px', color: bCol, marginTop: '2px', fontWeight: '600' }}>{tText}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    }) : (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No hay vencimientos proximos.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* --- SIMULADOR DE PAGOS (PARTE SUPERIOR) --- */}
            <div className="calc-panel stagger-2" style={{ marginBottom: '24px', backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div className="panel-title" style={{ marginBottom: '20px' }}>
                    <div className="icon-wrapper">
                        <IconRefresh />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Simulador Maestro</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Proyeccion y corridas financieras</p>
                    </div>
                </div>
                
                <div className="calc-controls">
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Sistema de Amortizacion <span style={astStyle}>*</span></label>
                        <select value={tipoAmortizacion} onChange={(e) => setTipoAmortizacion(e.target.value)} style={inputStyle}>
                            <option value="frances">Cuota Fija (Sistema Frances)</option>
                            <option value="aleman">Capital Fijo (Sistema Aleman)</option>
                            <option value="diario">Saldos Diarios (Abono Libre)</option>
                            <option value="personalizado">Personalizado (Institucional)</option>
                        </select>
                    </div>
                    
                    {tipoAmortizacion === 'diario' && (
                        <div className="form-row" style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label style={labelStyle}>Fecha Disposicion <span style={astStyle}>*</span></label>
                                <input type="date" value={fechaInicioSim} onChange={(e) => setFechaInicioSim(e.target.value)} style={inputStyle} />
                            </div>
                            <div className="form-group">
                                <label style={labelStyle}>1er Pago <span style={astStyle}>*</span></label>
                                <input type="date" value={fechaPrimerPagoSim} onChange={(e) => setFechaPrimerPagoSim(e.target.value)} style={inputStyle} />
                            </div>
                        </div>
                    )}
                    
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Monto a Fondear <span style={astStyle}>*</span></label>
                        <div className="input-with-prefix" style={{ position: 'relative' }}>
                            <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#64748b' }}>$</span>
                            <input type="text" placeholder="0.00" value={formatInputMonto(monto)} onChange={(e) => setMonto(parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px', fontSize: '16px', fontWeight: 'bold' }} />
                        </div>
                    </div>
                    
                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group">
                            <label style={labelStyle}>Producto / Tasa <span style={astStyle}>*</span></label>
                            <select value={tasa} onChange={(e) => setTasa(e.target.value)} style={inputStyle}>
                                <option value="0">Tasa...</option>
                                {tasas.map(t => (<option key={t.id} value={t.tasa_anual_esperada}>{t.nombre_tasa} ({t.tasa_anual_esperada}%)</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label style={labelStyle}>Plazo Global (Meses) <span style={astStyle}>*</span></label>
                            <input type="number" min="1" required value={plazo} onChange={(e) => setPlazo(e.target.value)} style={inputStyle} />
                        </div>
                    </div>
                    
                    {tipoAmortizacion === 'diario' ? (
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label style={labelStyle}>Abono Fijo a Capital <span style={astStyle}>*</span></label>
                            <div className="input-with-prefix" style={{ position: 'relative' }}>
                                <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#64748b' }}>$</span>
                                <input type="text" value={formatInputMonto(abonoCapitalLibre)} onChange={(e) => setAbonoCapitalLibre(parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px' }} />
                            </div>
                        </div>
                    ) : tipoAmortizacion !== 'personalizado' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '16px', marginBottom: '16px' }}>
                            <div className="form-group">
                                <label style={labelStyle}>Simular Anticipo a Capital</label>
                                <div className="input-with-prefix" style={{ position: 'relative' }}>
                                    <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#64748b' }}>$</span>
                                    <input type="text" placeholder="0.00" value={formatInputMonto(anticipoMontoSim)} onChange={(e) => setAnticipoMontoSim(parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px' }} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label style={labelStyle}>Mes Aplic.</label>
                                <input type="number" value={anticipoMesSim} onChange={(e) => setAnticipoMesSim(e.target.value)} style={inputStyle} />
                            </div>
                        </div>
                    ) : null}

                    {tipoAmortizacion === 'personalizado' && (
                        <PlanPersonalizadoBuilder 
                            plan={planPersonalizadoSim} 
                            setPlan={setPlanPersonalizadoSim} 
                            montoAsignado={monto} 
                            fechaInicio={fechaInicioSim} 
                            setFechaInicio={setFechaInicioSim} 
                        />
                    )}
                    
                    {tipoAmortizacion === 'personalizado' && (
                        <button onClick={abrirModalFondeoDesdeSimulador} style={{ width: '100%', padding: '12px', marginTop: '16px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                            <IconSave/> Transferir Plan a Nuevo Fondeo
                        </button>
                    )}
                </div>
            </div>

            {/* --- PROYECCION Y TABLA (PARTE INFERIOR) --- */}
            <div className="results-panel stagger-2" style={{ marginBottom: '32px', backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div className="panel-title" style={{ marginBottom: '20px' }}>
                    <div className="icon-wrapper glass-icon">
                        <IconDownload />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Proyeccion de Fondeo</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Valores totales acumulados</p>
                    </div>
                </div>
                
                <div className="results-grid">
                    <div className="result-card green-card">
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <span>Rendimientos a Pagar (Interes)</span>
                            <h2>{formatMoney(gananciaNeta)}</h2>
                            {monto > 0 && (
                                <div className="roi-badge">
                                    Costo Fondeo: {((gananciaNeta / (parseFloat(parseInputMonto(monto)) || 1)) * 100).toFixed(2)}%
                                </div>
                            )}
                        </div>
                        <svg viewBox="0 0 100 100" style={{ position: 'absolute', right: '-10%', top: '-20%', width: '150px', opacity: 0.1, transform: 'rotate(15deg)' }} fill="currentColor"><path d="M50 0L100 50L50 100L0 50Z"></path></svg>
                    </div>

                    <div className="result-card blue-card" style={{ position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <span>Salida Total (Cap+Int+IVA)</span>
                            <h2>{formatMoney(totalRecibir)}</h2>
                        </div>
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
                            <circle cx="90%" cy="10%" r="60" fill="white" opacity="0.05" />
                            <circle cx="80%" cy="80%" r="40" fill="white" opacity="0.05" />
                        </svg>
                    </div>
                </div>

                {/* --- TABLA DE AMORTIZACION EN TIEMPO REAL --- */}
                {tablaAmortizacion.length > 0 && (
                    <div className="table-responsive" style={{ maxHeight: '450px', marginTop: '24px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10, borderBottom: '1px solid #cbd5e1' }}>
                                <tr>
                                    <th style={{ padding: '10px', textAlign: 'center' }}>NO.</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>CAPITAL</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>ANTICIPO</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>INTERES</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>IVA</th>
                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--brand-green)' }}>TOTAL</th>
                                    <th style={{ padding: '10px', textAlign: 'right' }}>SALDO</th>
                                    {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && <th style={{ padding: '10px', textAlign: 'center' }}>DIAS</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {tablaAmortizacion.map((row, idx) => (
                                    <tr key={idx} style={{ backgroundColor: row.numero == anticipoMesSim && tipoAmortizacion !== 'diario' ? '#fef9c3' : row.numero === 'N/A' ? '#f0fdf4' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '8px', textAlign: 'center' }}>
                                            <strong style={{ color: 'var(--text-main)' }}>{row.numero}</strong> 
                                            {row.fechaStr !== '-' && <span style={{ display:'block', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{row.fechaStr}</span>}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatMoney(row.abono)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: row.anticipo > 0 ? '#166534' : 'var(--text-muted)', fontWeight: row.anticipo > 0 ? 'bold' : 'normal' }}>{formatMoney(row.anticipo)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatMoney(row.interes)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatMoney(row.iva)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold' }}>{formatMoney(row.pagoTotal)}</td>
                                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-main)', fontWeight: '600' }}>{formatMoney(row.saldoFinal)}</td>
                                        {(tipoAmortizacion === 'diario' || tipoAmortizacion === 'personalizado') && <td style={{ padding: '8px', textAlign: 'center' }}>{row.dias}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- DIRECTORIO DE FONDEADORES --- */}
            <div className="inversores-list-container fade-in-up">
                <div className="list-header">
                    <h2>Directorio</h2>
                    <div className="input-with-prefix" style={{ width: '300px', position: 'relative' }}>
                        <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#64748b' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input type="text" placeholder="Buscar por nombre o RFC..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ ...inputStyle, paddingLeft: '36px', borderRadius: '20px', backgroundColor: 'var(--bg-main)' }} />
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                            <tr>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>FONDEADOR</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>CONTACTO</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b' }}>LINEA DE CREDITO</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>ESTATUS</th>
                                <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: '#64748b' }}>ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentInversores.length > 0 ? currentInversores.map((inv, idx) => (
                                <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div className={`avatar-sm ${inv.estatus_activo ? 'avatar-active' : 'avatar-inactive'}`} style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', backgroundColor: inv.estatus_activo ? '#10d440' : '#94a3b8' }}>
                                                {inv.nombre.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong style={{ color: 'var(--text-main)', fontSize: '15px' }}>{inv.nombre}</strong>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>RFC: {inv.rfc || 'S/N'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--text-main)' }}>
                                            <span style={{ fontWeight: '500', fontSize: '14px' }}>{inv.telefono}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{inv.email}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {inv.limite_credito > 0 ? (
                                                <>
                                                    <strong style={{color: 'var(--brand-green)', fontSize: '15px'}}>{formatMoney(inv.limite_credito)}</strong>
                                                    <span style={{color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px'}}>Revolvente Max.</span>
                                                </>
                                            ) : (
                                                <span style={{color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic'}}>No Asignado</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <button onClick={() => cambiarEstatusInversor(inv.id, inv.estatus_activo)} style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: inv.estatus_activo ? '#dcfce3' : '#f1f5f9', color: inv.estatus_activo ? '#166534' : '#64748b' }}>
                                            {inv.estatus_activo ? 'Activo' : 'Inactivo'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button className="btn-icon-edit" onClick={() => abrirProyeccionGlobal(inv)} title="Proyeccion Global y Alertas" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', color: '#475569' }}>
                                                <IconRefresh/>
                                            </button>
                                            <button className="btn-icon-edit" onClick={() => abrirPanel(inv)} title="Expediente y Contratos" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', color: '#475569' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                            </button>
                                            <button className="btn-icon-edit" onClick={() => openEditModal(inv)} title="Editar Informacion" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', color: '#475569' }}>
                                                <IconEdit />
                                            </button>
                                            <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarInversor(inv.id, inv.nombre)} title="Dar de Baja" style={{ padding: '8px', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fef2f2', cursor: 'pointer', color: '#ef4444' }}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="empty-state" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        No se encontraron fondeadores registrados en el directorio.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px', alignItems: 'center' }}>
                        <button onClick={prevPage} disabled={currentPage === 1} className="btn-page" style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Anterior</button>
                        <span className="page-info" style={{ fontSize: '14px', color: '#475569' }}>Pagina <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
                        <button onClick={nextPage} disabled={currentPage === totalPages} className="btn-page" style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}>Siguiente</button>
                    </div>
                )}
            </div>

            {/* PANEL LATERAL DE DETALLES */}
            {panelOpen && inversorActivo && (
                <div className="modal-overlay" onClick={() => setPanelOpen(false)} style={{ zIndex: 5000, backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
                    <div className="master-panel fade-in-right" onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '900px', maxWidth: '100%', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)' }}>
                        
                        <div className="modal-header" style={{ flexShrink: 0, backgroundColor: '#0f172a', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ color: 'white', margin: 0, fontSize: '24px' }}>Panel de Fondeador</h2>
                                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 16px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '14px', color: 'white', fontWeight: '600', border: '1px solid rgba(255,255,255,0.2)', marginTop: '8px' }}>
                                    {inversorActivo.nombre}
                                </div>
                            </div>
                            <button onClick={() => setPanelOpen(false)} className="btn-close" style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                <IconClose/>
                            </button>
                        </div>
                        
                        <div className="panel-tabs" style={{ flexShrink: 0, display: 'flex', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 32px' }}>
                            {['contratos', 'beneficiarios', 'movimientos'].map(tab => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} style={{ padding: '16px 24px', background: 'transparent', border: 'none', borderBottom: activeTab === tab ? '3px solid #10d440' : '3px solid transparent', color: activeTab === tab ? '#0f172a' : '#64748b', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', outline: 'none' }}>
                                    {tab.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        
                        <div className="panel-body" style={{ flexGrow: 1, overflowY: 'auto', padding: '32px' }}>
                            {activeTab === 'contratos' && TabContratos()}
                            {activeTab === 'beneficiarios' && TabBeneficiarios()}
                            {activeTab === 'movimientos' && TabMovimientos()}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL REDISEÑADO: ALTA/EDICION FONDEADOR */}
            {isModalOpen && (
                <div className="modal-overlay" style={{ zIndex: 6000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden' }}>
                        <div className="modal-header" style={{ flexShrink: 0, padding: '24px 32px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ color: '#0f172a', margin: 0, fontSize: '20px', fontWeight: '800' }}>{isEditing ? 'Editar Fondeador' : 'Registrar Nuevo Fondeador'}</h2>
                                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '13px' }}>Directorio General de Clientes Inversionistas</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="btn-close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><IconClose/></button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form" style={{ backgroundColor: '#f8fafc', overflowY: 'auto', flexGrow: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>1. Datos de Identificacion</h4>
                                
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Tipo de Persona <span style={astStyle}>*</span></label>
                                    <select required value={formData.tipo_persona} onChange={e => setFormData({ ...formData, tipo_persona: e.target.value })} style={inputStyle}>
                                        <option value="FISICA">Persona Fisica</option>
                                        <option value="MORAL">Persona Moral (Empresa)</option>
                                    </select>
                                </div>

                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label style={labelStyle}>{formData.tipo_persona === 'MORAL' ? 'Razon Social (Empresa)' : 'Nombre(s)'} <span style={astStyle}>*</span></label>
                                        <input type="text" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={inputStyle} />
                                    </div>
                                    {formData.tipo_persona === 'FISICA' && !isEditing && (
                                        <div className="form-group">
                                            <label style={labelStyle}>Apellidos <span style={astStyle}>*</span></label>
                                            <input type="text" required value={formData.apellidos} onChange={e => setFormData({ ...formData, apellidos: e.target.value })} style={inputStyle} />
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label style={labelStyle}>RFC (Con Homoclave) <span style={astStyle}>*</span></label>
                                    <input type="text" required value={formData.rfc} onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} style={inputStyle} />
                                </div>
                            </div>
                            
                            <div style={{ backgroundColor: '#f0fdf4', padding: '24px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '15px', fontWeight: '800' }}>2. Linea de Credito Autorizada</h4>
                                <label style={{ color: '#15803d', fontSize: '12px', marginBottom: '16px', display: 'block' }}>Monto maximo permitido para fondear (Revolvente) <span style={astStyle}>*</span></label>
                                <div className="input-with-prefix" style={{ position: 'relative' }}>
                                    <span className="prefix" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', fontWeight: '800', color: 'var(--brand-green)' }}>$</span>
                                    <input type="text" required value={formatInputMonto(formData.limite_credito)} onChange={e => setFormData({ ...formData, limite_credito: parseInputMonto(e.target.value) })} placeholder="0.00" style={{ ...inputStyle, paddingLeft: '36px', height: '56px', fontSize: '20px', fontWeight: '800', color: 'var(--brand-green)', borderColor: '#86efac' }} />
                                </div>
                            </div>

                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>3. Contacto y Datos Bancarios</h4>
                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label style={labelStyle}>Telefono Celular <span style={astStyle}>*</span></label>
                                        <input type="text" required value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value.replace(/[^0-9]/g, '') })} maxLength="10" style={inputStyle} />
                                    </div>
                                    <div className="form-group">
                                        <label style={labelStyle}>Correo Electronico <span style={astStyle}>*</span></label>
                                        <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={inputStyle} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label style={labelStyle}>Direccion Completa <span style={astStyle}>*</span></label>
                                    <input type="text" required value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} style={inputStyle} />
                                </div>
                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                    <div className="form-group">
                                        <label style={labelStyle}>Banco del Cliente <span style={astStyle}>*</span></label>
                                        <select required value={formData.banco} onChange={e => setFormData({ ...formData, banco: e.target.value })} style={inputStyle}>
                                            <option value="">Selecciona un banco...</option>
                                            {bancosDb.map(b => (
                                                <option key={b.id} value={b.nombre}>{b.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label style={labelStyle}>Cuenta Bancaria / CLABE <span style={astStyle}>*</span></label>
                                        <input type="text" required value={formData.numero_cuenta} onChange={e => setFormData({ ...formData, numero_cuenta: e.target.value })} style={inputStyle} />
                                    </div>
                                </div>
                            </div>
                            
                            {!isEditing && formData.tipo_persona === 'FISICA' && (
                                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '20px' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>4. Beneficiario Principal</h4>
                                        <span style={{ backgroundColor: '#dcfce3', color: '#166534', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>100% ASIGNADO</span>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>Nombre Completo del Beneficiario <span style={astStyle}>*</span></label>
                                        <input type="text" required value={formData.ben_nombre} onChange={e => setFormData({ ...formData, ben_nombre: e.target.value })} style={inputStyle} />
                                    </div>
                                    <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group">
                                            <label style={labelStyle}>Parentesco <span style={astStyle}>*</span></label>
                                            <select required value={formData.ben_parentesco} onChange={e => setFormData({ ...formData, ben_parentesco: e.target.value })} style={inputStyle}>
                                                <option value="">Selecciona...</option>
                                                <option value="Esposo/a">Esposo/a</option>
                                                <option value="Hijo/a">Hijo/a</option>
                                                <option value="Padre/Madre">Padre/Madre</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label style={labelStyle}>Telefono del Beneficiario <span style={astStyle}>*</span></label>
                                            <input type="text" required value={formData.ben_telefono} onChange={e => setFormData({ ...formData, ben_telefono: e.target.value.replace(/[^0-9]/g, '') })} maxLength="10" style={inputStyle} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </form>
                        <div className="modal-footer" style={{ flexShrink: 0, padding: '24px 32px', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>Cancelar</button>
                            <button type="submit" onClick={handleSubmit} disabled={isLoading} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#10d440', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconSave/> {isLoading ? 'Guardando...' : 'Guardar Expediente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ACTIVAR FONDEO RAPIDO */}
            {isFondeoModalOpen && (
                <div className="modal-overlay" onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} style={{ zIndex: 6000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ flexShrink: 0, padding: '24px 32px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>Activar Nuevo Fondeo</h2>
                                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '13px' }}>Generacion de contrato e ingreso de capital</p>
                            </div>
                            <button onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} className="btn-close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><IconClose/></button>
                        </div>
                        
                        <form id="fondeoForm" onSubmit={handleCrearFondeo} className="modal-form" style={{ backgroundColor: '#f8fafc', overflowY: 'auto', flexGrow: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative' }}>
                                <label style={labelStyle}>1. Seleccionar Fondeador <span style={astStyle}>*</span></label>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '46px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 16px', backgroundColor: '#f8fafc' }} onClick={() => setDropdownFondeadorOpen(!dropdownFondeadorOpen)}>
                                    <span style={{ color: formFondeo.id_inversor ? '#0f172a' : '#94a3b8', fontSize: '14px', fontWeight: formFondeo.id_inversor ? '700' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {formFondeo.id_inversor ? inversores.find(i => i.id == formFondeo.id_inversor)?.nombre : 'Despliegue para buscar un fondeador...'}
                                    </span>
                                </div>
                                
                                {dropdownFondeadorOpen && (
                                    <div style={{ position: 'absolute', top: '90px', left: '24px', right: '24px', zIndex: 100, backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                        <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                            <input type="text" autoFocus placeholder="Buscar por nombre..." value={filtroFondeador} onChange={(e) => setFiltroFondeador(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault(); }} style={{ ...inputStyle, height: '36px' }} />
                                        </div>
                                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            {inversoresParaFondeo.length > 0 ? (
                                                inversoresParaFondeo.map(inv => (
                                                    <div key={inv.id} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onClick={() => { setFormFondeo({...formFondeo, id_inversor: inv.id}); setDropdownFondeadorOpen(false); setFiltroFondeador(''); }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>
                                                        <strong style={{ fontSize: '14px', display:'block', color: '#0f172a' }}>{inv.nombre}</strong>
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>Linea Libre: {formatMoney(inv.limite_credito)}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No se encontraron coincidencias.</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>2. Detalles del Fondeo</h4>
                                
                                <div className="form-group" style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Numero de Disposicion <span style={astStyle}>*</span></label>
                                    <input type="text" placeholder="Ej. 001-2026" required value={formFondeo.numero_disposicion} onChange={e => setFormFondeo({ ...formFondeo, numero_disposicion: e.target.value })} style={inputStyle} />
                                </div>

                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label style={{...labelStyle, color: 'var(--brand-green)'}}>Monto a Fondear <span style={astStyle}>*</span></label>
                                        <div className="input-with-prefix" style={{ position: 'relative' }}>
                                            <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--brand-green)', fontWeight: '800' }}>$</span>
                                            <input type="text" required value={formatInputMonto(formFondeo.monto_inicial)} onChange={e => setFormFondeo({ ...formFondeo, monto_inicial: parseInputMonto(e.target.value) })} style={{ ...inputStyle, paddingLeft: '28px', color: 'var(--brand-green)', fontWeight: '800', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }} />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label style={labelStyle}>Sistema de Amortizacion <span style={astStyle}>*</span></label>
                                        <select required value={formFondeo.tipo_amortizacion} onChange={e => setFormFondeo({ ...formFondeo, tipo_amortizacion: e.target.value })} style={inputStyle}>
                                            <option value="frances">Cuota Fija Constante (Sistema Frances)</option>
                                            <option value="aleman">Capital Fijo Constante (Sistema Aleman)</option>
                                            <option value="diario">Saldos Diarios (Abono Libre)</option>
                                            <option value="personalizado">Plan Personalizado (Institucional)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div className="form-group">
                                        <label style={labelStyle}>Tasa / Producto <span style={astStyle}>*</span></label>
                                        <select required value={formFondeo.id_tasa} onChange={e => setFormFondeo({ ...formFondeo, id_tasa: e.target.value })} style={inputStyle}>
                                            <option value="">Seleccione...</option>
                                            {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa}</option>))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label style={labelStyle}>Plazo Global (Meses) <span style={astStyle}>*</span></label>
                                        <input type="number" min="1" required value={formFondeo.plazo_meses} onChange={e => setFormFondeo({ ...formFondeo, plazo_meses: e.target.value })} style={inputStyle} />
                                    </div>
                                </div>
                                
                                {formFondeo.tipo_amortizacion !== 'personalizado' && (
                                    <div className="form-group" style={{ marginBottom: '16px' }}>
                                        <label style={labelStyle}>Fecha de Disposicion <span style={astStyle}>*</span></label>
                                        <input type="date" required value={formFondeo.fecha_inicio} onChange={e => setFormFondeo({ ...formFondeo, fecha_inicio: e.target.value })} style={inputStyle} />
                                    </div>
                                )}
                            </div>

                            {formFondeo.tipo_amortizacion === 'personalizado' && (
                                <PlanPersonalizadoBuilder 
                                    plan={formFondeo.plan_personalizado || []} 
                                    setPlan={(p) => setFormFondeo({...formFondeo, plan_personalizado: p})} 
                                    montoAsignado={formFondeo.monto_inicial} 
                                    fechaInicio={formFondeo.fecha_inicio} 
                                    setFechaInicio={(val) => setFormFondeo({...formFondeo, fecha_inicio: val})} 
                                />
                            )}
                        </form>
                        <div className="modal-footer" style={{ flexShrink: 0, padding: '24px 32px', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button type="button" onClick={() => { setIsFondeoModalOpen(false); setDropdownFondeadorOpen(false); }} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>Cancelar</button>
                            <button type="submit" form="fondeoForm" disabled={isLoading} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#10d440', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconSave/> {isLoading ? 'Procesando...' : 'Generar Fondeo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VISOR INTERACTIVO E INYECCIONES DE CAPITAL --- */}
            {showVisorAmortizacion && contratoParaAmortizacion && (
                <div className="modal-overlay" style={{ zIndex: 6000 }}>
                    <div className="modal-content fade-in-down" style={{ maxWidth: '1200px', width: '95%', height: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '16px', overflow: 'hidden' }}>
                        
                        <div className="modal-header" style={{ flexShrink: 0, padding: '24px 32px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ color: '#0f172a', margin: 0, fontSize: '20px', fontWeight: '800' }}>Tabla de Amortizacion #{contratoParaAmortizacion.id.toString().padStart(4, '0')}</h2>
                                <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '13px' }}>
                                    Monto: <strong style={{ color: '#10d440' }}>{formatMoney(contratoParaAmortizacion.monto_inicial)}</strong> | Tasa: {contratoParaAmortizacion.tasa_anual_esperada}% | Sistema: {contratoParaAmortizacion.tipo_amortizacion ? contratoParaAmortizacion.tipo_amortizacion.toUpperCase() : 'FRANCES'}
                                </p>
                            </div>
                            <button onClick={() => { setShowVisorAmortizacion(false); setContratoParaAmortizacion(null); setEdicionesInteractiva({}); setPagosIrregulares([]); }} className="btn-close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><IconClose/></button>
                        </div>
                        
                        <div className="modal-body" style={{ backgroundColor: '#f8fafc', overflowY: 'auto', flexGrow: 1, padding: '32px' }}>
                            
                            <div style={{ marginBottom: '24px', padding: '24px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h5 style={{ margin: '0 0 8px 0', color: '#166534', fontSize: '16px', fontWeight: '800' }}>+ Inyectar Pagos Irregulares (Abonos a Capital)</h5>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#15803d', maxWidth: '600px', lineHeight: '1.5' }}>
                                            Agrega fechas de abono no contempladas en el calendario original. El motor recalculara automaticamente los intereses de las siguientes mensualidades basandose en el nuevo saldo reducido. Si marcas la casilla "No cobrar dia", <strong>el interes del dia del abono se descuenta</strong>.
                                        </p>
                                    </div>
                                    <button type="button" style={{ backgroundColor: '#10d440', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', padding: '10px 20px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(16, 212, 64, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setPagosIrregulares([...pagosIrregulares, { id: Date.now(), fecha: '', monto: '', excluirDia: false }])}>
                                        <IconPlus/> Añadir Abono
                                    </button>
                                </div>
                                
                                {pagosIrregulares.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                                        {pagosIrregulares.map((pago, index) => (
                                            <div key={pago.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 40px', gap: '16px', alignItems: 'end', backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                <div className="form-group">
                                                    <label style={labelStyle}>FECHA DE ABONO <span style={astStyle}>*</span></label>
                                                    <input type="date" required value={pago.fecha} onChange={e => handlePagoIrregularChange(index, 'fecha', e.target.value)} style={inputStyle} />
                                                </div>
                                                <div className="form-group">
                                                    <label style={labelStyle}>MONTO A CAPITAL <span style={astStyle}>*</span></label>
                                                    <div className="input-with-prefix" style={{ position: 'relative' }}>
                                                        <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#166534', fontWeight: 'bold' }}>$</span>
                                                        <input type="text" required value={formatInputMonto(pago.monto)} onChange={e => handlePagoIrregularChange(index, 'monto', parseInputMonto(e.target.value))} style={{ ...inputStyle, paddingLeft: '28px', color: '#166534', fontWeight: 'bold', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }} placeholder="0.00" />
                                                    </div>
                                                </div>
                                                <div className="form-group" style={{ textAlign: 'center', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#475569' }}>¿NO COBRAR DIA?</label>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={pago.excluirDia || false} 
                                                        onChange={e => handlePagoIrregularChange(index, 'excluirDia', e.target.checked)} 
                                                        style={{ width: '20px', height: '20px', cursor: 'pointer', marginTop: '8px' }}
                                                    />
                                                </div>
                                                <button type="button" onClick={() => removePagoIrregular(index)} style={{ height: '42px', width: '100%', marginBottom: '2px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar abono">
                                                    <IconClose/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div> 
                            
                            <div className="table-responsive" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                <div style={{ padding: '16px 24px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' }}>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                        <strong>Nota interactiva:</strong> Edita la Fecha de Vencimiento y el Abono a Principal directamente en la tabla. El motor recalculará todo al instante.
                                    </p>
                                </div>
                                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                        <tr>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>NO.</th>
                                            <th style={{ padding: '12px', textAlign: 'center', backgroundColor: '#dcfce3', color: '#166534' }}>VENCIMIENTO</th>
                                            <th style={{ padding: '12px', textAlign: 'right', backgroundColor: '#dcfce3', color: '#166534' }}>ABONO PRINC.</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>ANTICIPO</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>INT. ORD.</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>IVA</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--brand-green)' }}>TOTAL PAGO</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>SALDO INSOLUTO</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>DIAS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tablaInteractivaRender.map((row, idx) => (
                                            <tr key={idx} style={{ backgroundColor: row.numero === 'N/A' ? '#f0fdf4' : (edicionesInteractiva[row.indexUI] ? '#fef9c3' : 'transparent'), borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                                    <strong style={{ color: row.numero === 'N/A' ? '#166534' : '#0f172a' }}>{row.numero}</strong> 
                                                </td>
                                                
                                                {/* COLUMNA FECHA VENCIMIENTO EDITABLE */}
                                                <td style={{ padding: '6px 12px', textAlign: 'center', backgroundColor: row.numero === 'N/A' ? 'transparent' : '#f0fdf4' }}>
                                                    {row.numero === 'N/A' ? (
                                                        <strong style={{ color: '#15803d' }}>{row.fechaStr}</strong>
                                                    ) : (
                                                        <input 
                                                            type="date" 
                                                            value={edicionesInteractiva[row.indexUI]?.fecha || row.fechaInputStr} 
                                                            onChange={(e) => handleEdicionInteractiva(row.indexUI, 'fecha', e.target.value)} 
                                                            style={{ width: '120px', height: '32px', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0 8px', textAlign: 'center', fontSize: '13px', color: '#166534', fontWeight: 'bold', outline: 'none', backgroundColor: 'white' }} 
                                                        />
                                                    )}
                                                </td>

                                                {/* COLUMNA ABONO PRINCIPAL EDITABLE */}
                                                <td style={{ padding: '6px 12px', textAlign: 'right', backgroundColor: row.numero === 'N/A' ? 'transparent' : '#f0fdf4' }}>
                                                    {row.numero === 'N/A' ? (
                                                        <strong style={{ color: '#64748b' }}>$0.00</strong>
                                                    ) : (
                                                        <div style={{ position: 'relative' }}>
                                                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#15803d', fontSize: '12px' }}>$</span>
                                                            <input 
                                                                type="text" 
                                                                placeholder="0.00" 
                                                                value={edicionesInteractiva[row.indexUI]?.abono !== undefined ? formatInputMonto(edicionesInteractiva[row.indexUI].abono) : formatInputMonto(row.abono)} 
                                                                onChange={(e) => handleEdicionInteractiva(row.indexUI, 'abono', e.target.value)} 
                                                                style={{ width: '100%', height: '32px', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0 8px 0 20px', textAlign: 'right', fontSize: '13px', color: '#166534', fontWeight: 'bold', outline: 'none', backgroundColor: 'white' }} 
                                                            />
                                                        </div>
                                                    )}
                                                </td>

                                                <td style={{ padding: '10px', textAlign: 'right', color: row.anticipo > 0 ? '#166534' : 'var(--text-muted)' }}>
                                                    {formatMoney(row.anticipo)}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(row.interes)}</td>
                                                <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(row.iva)}</td>
                                                <td style={{ padding: '10px', textAlign: 'right', color: 'var(--brand-green)', fontWeight: 'bold' }}>{formatMoney(row.pagoTotal)}</td>
                                                <td style={{ padding: '10px', textAlign: 'right', color: '#0f172a', fontWeight: '800' }}>{formatMoney(row.saldoFinal)}</td>
                                                <td style={{ padding: '10px', textAlign: 'center', color: '#64748b' }}>{row.dias}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                                            <td colSpan="4" style={{ padding: '16px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>TOTALES PROYECTADOS:</td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{formatMoney(totalesInteractivos.interes)}</td>
                                            <td></td>
                                            <td style={{ padding: '16px', textAlign: 'right', fontWeight: '800', color: 'var(--brand-green)' }}>{formatMoney(totalesInteractivos.total)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div> 

                        </div> 

                        <div className="modal-footer" style={{ flexShrink: 0, padding: '24px 32px', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                            <button type="button" onClick={() => { setShowVisorAmortizacion(false); setContratoParaAmortizacion(null); setEdicionesInteractiva({}); setPagosIrregulares([]); }} style={{ padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: 'white', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>Cerrar</button>
                            <button type="button" onClick={handleGuardarInyecciones} disabled={isLoading} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#0f172a', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconSave/> Guardar Abonos
                            </button>
                            <button type="button" onClick={descargarPDFInteractivo} disabled={isLoading} style={{ padding: '10px 24px', border: 'none', borderRadius: '8px', backgroundColor: '#10d440', fontWeight: 'bold', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconDownload/> Descargar PDF
                            </button>
                        </div>

                    </div> 
                </div>
            )}

            {/* --- PROYECCION GLOBAL --- */}
            {showProyeccionGlobal && (
                <div className="modal-overlay" style={{ zIndex: 6000, backgroundColor: '#f1f5f9' }}>
                    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header" style={{ borderRadius: 0, flexShrink: 0, backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '24px 40px' }}>
                            <div>
                                <h2 style={{ color: '#0f172a', margin: 0, fontSize: '24px', fontWeight: '800' }}>Proyeccion Global de Pagos</h2>
                                <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Vista anticipada de vencimientos para el fondeador: <strong style={{ color: '#10d440' }}>{inversorActivo?.nombre}</strong></p>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span> VENCIDO / ATRASADO
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }}></span> PROXIMO A VENCER (5 Dias)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}></span> A TIEMPO
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <div className="input-with-prefix" style={{ width: '300px', position: 'relative' }}>
                                    <span className="prefix" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#2563eb' }}>
                                        <IconMail/>
                                    </span>
                                    <input type="email" placeholder="Correo del Contador..." value={correoContador} onChange={e => setCorreoContador(e.target.value)} style={{ ...inputStyle, paddingLeft: '36px', backgroundColor: 'white', color: '#1e3a8a', borderColor: '#bfdbfe' }} />
                                </div>
                                <button onClick={enviarAlertasCorreo} disabled={isAlerting} style={{ padding: '10px 24px', border: '1px solid #10d440', borderRadius: '8px', backgroundColor: 'white', fontWeight: 'bold', color: '#10d440', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <IconMail/> {isAlerting ? 'Enviando...' : 'Enviar Alertas'}
                                </button>
                                <button onClick={() => setShowProyeccionGlobal(false)} className="btn-close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', marginLeft: '16px' }}><IconClose/></button>
                            </div>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                            {pagosGlobalesMensuales.length === 0 && resumenContratos.length === 0 ? (
                                <div className="empty-state" style={{ textAlign: 'center', padding: '60px', color: '#64748b', backgroundColor: 'white', borderRadius: '16px' }}>No hay contratos activos para este fondeador.</div>
                            ) : (
                                <>
                                    <div className="table-responsive" style={{ maxHeight: '350px', marginBottom: '32px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', borderRadius: '12px', backgroundColor: 'white', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                                <tr>
                                                    <th colSpan="12" style={{ backgroundColor: '#eff6ff', color: '#1e40af', fontSize: '14px', padding: '16px', fontWeight: '800' }}>PAGO A FONDEADORES - {inversorActivo?.nombre}</th>
                                                </tr>
                                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#475569' }}># DISPOSICION</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>F. INICIO</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>F. TERMINO</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>MONTO</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>TASA</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>SALDO CAPITAL</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>PROXIMO PAGO</th>
                                                    <th style={{ padding: '10px', textAlign: 'center', color: '#475569' }}>NO. PAGO</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>A. CAPITAL</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>P. INTERES</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: 'var(--brand-green)' }}>TOTAL PAGO</th>
                                                    <th style={{ padding: '10px', textAlign: 'right', color: '#475569' }}>SALDO FINAL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {resumenContratos.map(c => (
                                                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{c.numero_disposicion || 'S/N'}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>{c.f_inicio}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>{c.f_termino}</td>
                                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>{formatMoney(c.monto)}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>{c.tasa}%</td>
                                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600' }}>{formatMoney(c.saldo_capital)}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: c.estado_color }}>{c.prox_pago_fecha}</td>
                                                        <td style={{ padding: '10px', textAlign: 'center' }}>{c.no_pago} {c.no_pago !== 'N/A' ? `de ${c.total_pagos}` : ''}</td>
                                                        <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(c.a_capital)}</td>
                                                        <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(c.p_interes)}</td>
                                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', backgroundColor: '#f0fdf4', color: '#166534' }}>{formatMoney(c.total_pago)}</td>
                                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{formatMoney(c.saldo_final)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
                                        {pagosGlobalesMensuales.map((mesGrupo, index) => (
                                            <div key={index} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                                                <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>{mesGrupo.mesStr}</strong>
                                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#10d440' }}>Total: {formatMoney(mesGrupo.totalCorte)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    {mesGrupo.pagos.map((p, i) => (
                                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < mesGrupo.pagos.length -1 ? '1px solid #f1f5f9' : 'none' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <span className={`payment-status-dot ${p.cssDotClass}`} style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.cssDotClass === 'dot-vencido' ? '#ef4444' : p.cssDotClass === 'dot-alerta' ? '#f59e0b' : '#3b82f6', boxShadow: `0 0 0 4px ${p.cssDotClass === 'dot-vencido' ? '#fef2f2' : p.cssDotClass === 'dot-alerta' ? '#fffbeb' : '#eff6ff'}` }}></span>
                                                                <div>
                                                                    <strong style={{ fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {p.fechaStr}
                                                                        {p.esArrastrado && <span style={{ color: '#ef4444', fontSize: '10px', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ATRASADO</span>}
                                                                    </strong>
                                                                    <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Disp: <strong>{p.disp}</strong> | Cto. #{p.contrato_id.toString().padStart(4,'0')}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <strong style={{ display: 'block', fontSize: '15px', color: '#166534' }}>{formatMoney(p.pagoTotal)}</strong>
                                                                <span style={{ fontSize: '11px', color: '#64748b' }}>{p.numero === 'N/A' ? 'Inyeccion' : `Pago ${p.numero}`}</span>
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

            {confirmModal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 8000 }}>
                    <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>{confirmModal.title}</h3>
                        <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>{confirmModal.message}</p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={confirmModal.onConfirm} style={{ padding: '10px 20px', backgroundColor: '#ef4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Si, Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inversores;