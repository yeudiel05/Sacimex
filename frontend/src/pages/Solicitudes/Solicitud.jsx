import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import './Solicitud.css';

// ─── Catálogos ────────────────────────────────────────────────────────
const CONCEPTOS = [
    { id: 'C-01', label: 'C-01: ADQUISICIÓN DE ACTIVO FIJO - Cómputo (Corporativo)' },
    { id: 'C-02', label: 'C-02: ADQUISICIÓN DE ACTIVO FIJO - Transporte (Corporativo)' },
    { id: 'C-03', label: 'C-03: ADQUISICIÓN DE ACTIVO FIJO - Mobiliario (Corporativo)' },
    { id: 'C-04', label: 'C-04: ADQUISICIÓN DE ACTIVO FIJO Otros - (Corporativo)' },
    { id: 'C-05', label: 'C-05: APOYO FUNERARIO' },
    { id: 'C-06', label: 'C-06: PAGO DE SERVICIOS EMPRESARIALES (Personas Morales)' },
    { id: 'C-07', label: 'C-07: PAGO SERVICIOS, COMPRAS Y HONORARIOS (Personas físicas)' },
    { id: 'C-08', label: 'C-08: PAGO DE SERVICIOS PÚBLICOS' },
    { id: 'C-09', label: 'C-09: IMPUESTOS, DERECHOS, PRODUCTOS Y APROVECHAMIENTOS' },
    { id: 'C-10', label: 'C-10: PRÉSTAMOS BANCARIOS Y DE OTROS ORGANISMOS' },
    { id: 'C-11', label: 'C-11: RENTA DE BIENES MUEBLES E INMUEBLES' },
    { id: 'C-12', label: 'C-12: COMBUSTIBLE' },
    { id: 'C-13', label: 'C-13: NOMINA VIA PRESTADORA DE SERVICIOS' },
    { id: 'C-14', label: 'C-14: OTROS ACREEDORES' },
    { id: 'C-15', label: 'C-15: APOYOS A LA LOCALIDAD' },
    { id: 'C-16', label: 'C-16: FONDO FIJO PARA GASTOS MENORES' },
    { id: 'C-17', label: 'C-17: GASTOS A COMPROBAR' },
    { id: 'C-18', label: 'C-18: OTROS GASTOS' },
    { id: 'C-19', label: 'C-19: NOMINA REGISTRO PATRONAL SACIMEX' },
];

const UNIDADES_NEGOCIO = [
    { id: '01.CRP', label: '01.CRP - Corporativo' },
    { id: '02.ETL', label: '02.ETL - Etla' },
    { id: '03.ANT', label: '03.ANT - San Antonio' },
    { id: '04.CNT', label: '04.CNT - Centro' },
    { id: '05.RCP', label: '05.RCP - Recuperación' },
    { id: '06.HTL', label: '06.HTL - Huatulco' },
    { id: '07.CCT', label: '07.CCT - Cuicatlán' },
    { id: '08.CNT', label: '08.CNT - Central' },
    { id: '09.CTL', label: '09.CTL - Cuautla' },
    { id: '10.AJL', label: '10.AJL - Ajalpan' },
    { id: '11.TCM', label: '11.TCM - Tecamachalco' },
    { id: '12.HCH', label: '12.HCH - Huauchinango' },
    { id: '13.SLN', label: '13.SLN - Salina Cruz' },
    { id: '14.HJP', label: '14.HJP - Huajuapan' },
    { id: '15.ONL', label: '15.ONL - Virtual' },
    { id: '16.ESC', label: '16.ESC - Puerto Escondido' },
    { id: '17.MHT', label: '17.MHT - Miahutlán' },
    { id: '18.OCT', label: '18.OCT - Ocotlán' },
];

// ─── Pasos del flujo ──────────────────────────────────────────────────
const FLUJO_PASOS = [
    { paso: '01', titulo: 'Envío', desc: 'Tu solicitud queda en revisión', color: '#10d440', bg: '#f0fdf4' },
    { paso: '02', titulo: 'Revisión', desc: 'El responsable evalúa la solicitud', color: '#d97706', bg: '#fffbeb' },
    { paso: '03', titulo: 'Autorización', desc: 'Aprobación final del monto', color: '#2563eb', bg: '#eff6ff' },
    { paso: '04', titulo: 'Pago', desc: 'Dispersión a la cuenta destino', color: '#7c3aed', bg: '#f5f3ff' },
];

// ─── Formateador de monto ─────────────────────────────────────────────
const formatInputMonto = (val) => {
    if (!val && val !== 0) return '';
    const raw = String(val).replace(/[^0-9.]/g, '');
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts[1] && parts[1].length > 2) parts[1] = parts[1].substring(0, 2);
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
};

const parseInputMonto = (val) => String(val).replace(/,/g, '');

// ─── Iconos SVG ───────────────────────────────────────────────────────
const IconDoc = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const IconHistorial = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const IconTrend = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
    </svg>
);

const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconSend = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconSpinner = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinner">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

// ─── Componente principal ─────────────────────────────────────────────
const Solicitud = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [montoDisplay, setMontoDisplay] = useState('');
    
    // Estado para guardar los proveedores traídos de la base de datos
    const [proveedoresDB, setProveedoresDB] = useState([]);

    const [formData, setFormData] = useState({
        concepto_id: '',
        unidad_negocio: '',
        id_proveedor: '', 
        forma_pago: 'TRANSFERENCIA',
        monto: '',
        descripcion: '',
        fecha_limite_pago: '', // <-- NUEVO CAMPO
    });

    // ─── Efecto para cargar proveedores al abrir la pantalla ───
    useEffect(() => {
        const fetchProveedores = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await api.get('/proveedores', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data.success) {
                    setProveedoresDB(response.data.data);
                }
            } catch (error) {
                console.error("No se pudieron cargar los proveedores", error);
            }
        };
        fetchProveedores();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleMontoChange = (e) => {
        const raw = parseInputMonto(e.target.value);
        setMontoDisplay(formatInputMonto(raw));
        setFormData({ ...formData, monto: raw });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/solicitudes/crear', formData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.success) {
                setSubmitted(true);
                setTimeout(() => navigate('/solicitudes/historial'), 1800);
            }
        } catch (error) {
            alert('Error al enviar: ' + (error.response?.data?.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    const conceptoSeleccionado = CONCEPTOS.find((c) => c.id === formData.concepto_id);
    const unidadSeleccionada = UNIDADES_NEGOCIO.find((u) => u.id === formData.unidad_negocio);
    const proveedorSeleccionado = proveedoresDB.find((p) => String(p.id_persona || p.id) === String(formData.id_proveedor));

    return (
        <div className="solicitud-container">

            {/* ── HEADER ── */}
            <div className="solicitud-header">
                <div>
                    <h1>Nueva Solicitud</h1>
                    <p>Registro de nueva solicitud de recursos</p>
                </div>
                <button className="btn-historial" onClick={() => navigate('/solicitudes/historial')}>
                    <IconHistorial />
                    Ver Historial
                </button>
            </div>

            {/* ── GRID PRINCIPAL ── */}
            <div className="solicitud-grid">

                {/* ── TARJETA FORMULARIO ── */}
                <div className="solicitud-card">

                    <div className="card-header">
                        <div className="card-icon"><IconDoc /></div>
                        <div>
                            <h3>Detalles de la Solicitud</h3>
                            <p>Completa todos los campos requeridos</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="solicitud-form">

                        {/* Fila: Concepto + Unidad */}
                        <div className="form-row-2">
                            <div className="form-group">
                                <label className="form-label">Concepto de Pago</label>
                                <select name="concepto_id" className="form-select" value={formData.concepto_id} onChange={handleChange} required>
                                    <option value="">Seleccione...</option>
                                    {CONCEPTOS.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Unidad de Negocio</label>
                                <select name="unidad_negocio" className="form-select" value={formData.unidad_negocio} onChange={handleChange} required>
                                    <option value="">Seleccione...</option>
                                    {UNIDADES_NEGOCIO.map((u) => (
                                        <option key={u.id} value={u.id}>{u.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* ── FILA: Proveedor + Forma de Pago ── */}
                        <div className="form-row-2">
                            <div className="form-group">
                                <label className="form-label">Proveedor / Beneficiario</label>
                                <select name="id_proveedor" className="form-select" value={formData.id_proveedor} onChange={handleChange} required>
                                    <option value="">Seleccione al destinatario...</option>
                                    {proveedoresDB.map((p) => (
                                        <option key={p.id_persona || p.id} value={p.id_persona || p.id}>
                                            {p.nombre_razon_social || p.nombre} {p.banco ? `(${p.banco})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Forma de Pago</label>
                                <select name="forma_pago" className="form-select" value={formData.forma_pago} onChange={handleChange} required>
                                    <option value="TRANSFERENCIA">Transferencia Electrónica</option>
                                    <option value="CHEQUE">Póliza de Cheque</option>
                                </select>
                            </div>
                        </div>

                        {/* ── FILA: Monto + Fecha Límite de Pago ── */}
                        <div className="form-row-2">
                            <div className="form-group">
                                <label className="form-label">Monto Solicitado</label>
                                <div className="input-monto-wrapper">
                                    <span className="input-monto-prefix">$</span>
                                    <input
                                        type="text"
                                        className="form-input-monto"
                                        placeholder="  0.00"
                                        value={montoDisplay}
                                        onChange={handleMontoChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Fecha Límite de Pago</label>
                                <input
                                    type="date"
                                    name="fecha_limite_pago"
                                    className="form-select"
                                    style={{ paddingLeft: '12px' }}
                                    value={formData.fecha_limite_pago}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        {/* Descripción */}
                        <div className="form-group">
                            <label className="form-label">Descripción / Justificación</label>
                            <textarea
                                name="descripcion"
                                className="form-textarea"
                                rows="5"
                                value={formData.descripcion}
                                onChange={handleChange}
                                required
                                placeholder="Describe el motivo exacto de la solicitud o número de factura a pagar..."
                            />
                        </div>

                        {/* Mensaje éxito */}
                        {submitted && (
                            <div className="success-msg">
                                <IconCheck />
                                Solicitud enviada correctamente. Redirigiendo al historial...
                            </div>
                        )}

                        {/* Botones */}
                        <div className="form-footer">
                            <button type="button" className="btn-cancelar" onClick={() => navigate('/solicitudes/historial')}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn-enviar" disabled={loading || submitted}>
                                {loading ? <><IconSpinner /> Procesando...</> : <><IconSend /> Enviar Solicitud</>}
                            </button>
                        </div>

                    </form>
                </div>

                {/* ── COLUMNA DERECHA (RESUMEN) ── */}
                <div className="resumen-col">

                    {/* Tarjeta resumen */}
                    <div className="resumen-card">
                        <div className="resumen-card-header">
                            <div className="resumen-icon"><IconTrend /></div>
                            <div>
                                <h3>Resumen</h3>
                                <p>Vista previa de tu solicitud</p>
                            </div>
                        </div>

                        {/* Monto */}
                        <div className="monto-badge">
                            <div className="monto-label">Monto Solicitado</div>
                            <div className="monto-valor">
                                {formData.monto ? `$${formatInputMonto(formData.monto)}` : '$0.00'}
                            </div>
                            <div className="monto-label" style={{marginTop: '4px'}}>
                                {formData.forma_pago}
                            </div>
                        </div>

                        {/* Concepto */}
                        <div className="resumen-row">
                            <div className="resumen-row-label">Concepto</div>
                            {conceptoSeleccionado
                                ? <div className="resumen-row-value">{conceptoSeleccionado.label}</div>
                                : <div className="resumen-row-empty">Sin seleccionar</div>
                            }
                        </div>

                        {/* Unidad */}
                        <div className="resumen-row">
                            <div className="resumen-row-label">Unidad de Negocio</div>
                            {unidadSeleccionada
                                ? (
                                    <div className="resumen-row-value">
                                        <span className="unidad-badge">
                                            <span className="unidad-id-pill">{unidadSeleccionada.id}</span>
                                            {unidadSeleccionada.label.split(' - ')[1]}
                                        </span>
                                    </div>
                                )
                                : <div className="resumen-row-empty">Sin seleccionar</div>
                            }
                        </div>

                        {/* Proveedor Resumen */}
                        <div className="resumen-row">
                            <div className="resumen-row-label">Destinatario / Proveedor</div>
                            {proveedorSeleccionado
                                ? (
                                    <div className="resumen-row-value">
                                        <strong style={{color: '#0f172a'}}>{proveedorSeleccionado.nombre_razon_social || proveedorSeleccionado.nombre}</strong><br/>
                                        <span style={{fontSize: '11px', color: '#64748b'}}>{proveedorSeleccionado.banco || 'Sin banco registrado'}</span>
                                    </div>
                                )
                                : <div className="resumen-row-empty">Sin seleccionar</div>
                            }
                        </div>

                        {/* Fecha Límite Resumen */}
                        <div className="resumen-row">
                            <div className="resumen-row-label">Vencimiento</div>
                            {formData.fecha_limite_pago
                                ? <div className="resumen-row-value" style={{color: '#dc2626', fontWeight: 'bold'}}>
                                    {new Date(formData.fecha_limite_pago).toLocaleDateString('es-MX', {timeZone: 'UTC'})}
                                  </div>
                                : <div className="resumen-row-empty">Sin seleccionar</div>
                            }
                        </div>
                    </div>

                    {/* Tarjeta flujo */}
                    <div className="flujo-card">
                        <h4>Flujo de Aprobación</h4>
                        {FLUJO_PASOS.map((s) => (
                            <div key={s.paso} className="flujo-step">
                                <div className="flujo-num" style={{ backgroundColor: s.bg, color: s.color }}>
                                    {s.paso}
                                </div>
                                <div className="flujo-step-text">
                                    <strong>{s.titulo}</strong>
                                    <span>{s.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Solicitud;