import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './DetalleSolicitud.css';

// ─── Iconos ───────────────────────────────────────────────────────────
const IconBack    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'18px'}}><polyline points="15 18 9 12 15 6"/></svg>;
const IconPDF     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconCheck   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width:'12px'}}><polyline points="20 6 9 17 4 12"/></svg>;
const IconX       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:'12px'}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconUpload  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IconClock   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:'40px', opacity:0.4}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
// Nuevo Icono para Adjuntos (Clip)
const IconAttachment = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:'16px'}}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>;

const formatCurrency = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
const formatFecha    = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' }) : '---';

const getBadge = (estatus) => {
    const map = {
        PENDIENTE_VOBO:   { cls: 'badge-warning', label: 'Requiere VoBo' },
        PENDIENTE:        { cls: 'badge-warning', label: 'Pendiente revision' },
        REVISION:         { cls: 'badge-warning', label: 'En revision' },
        AUTORIZADO_1:     { cls: 'badge-info',    label: 'Autorizado nivel 1' },
        AUTORIZADO_2:     { cls: 'badge-info',    label: 'Autorizado nivel 2' },
        AUTORIZADO_FINAL: { cls: 'badge-success', label: 'Totalmente autorizado' },
        PAGADO:           { cls: 'badge-success', label: 'Pagado' },
        RECHAZADO:        { cls: 'badge-danger',  label: 'Rechazado' },
    };
    const b = map[estatus] || { cls: 'badge-default', label: estatus };
    return <span className={`status-badge ${b.cls}`}>{b.label}</span>;
};

// Se reparó la firma de la función para que evalúe correctamente el Nivel -1
function obtenerRolEsperado(sol) {
    if (!sol) return null;
    const m = parseFloat(sol.monto) || 0;
    if (sol.nivel_actual === -1) return `VISTO BUENO (${sol.area_visto_bueno || 'Area Asignada'})`;
    if (sol.nivel_actual === 0) return 'REVISOR';
    if (sol.nivel_actual === 1) return 'AUTORIZADOR_1';
    if (sol.nivel_actual === 2 && m > 30000) return 'AUTORIZADOR_2';
    return null;
}

const TimelineItem = ({ firma, esUltimo }) => (
    <div className={`timeline-item${esUltimo ? ' last' : ''}`}>
        <div className={`timeline-icon ${firma.accion === 'RECHAZADO' ? 'icon-danger' : 'icon-success'}`}>
            {firma.accion === 'RECHAZADO' ? <IconX /> : <IconCheck />}
        </div>
        <div className="timeline-content">
            <div className="timeline-user">
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{firma.aprobador}</span>
                <span className="timeline-date">{formatFecha(firma.fecha_firma)}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {firma.aprobador_puesto} · {firma.etapa_firma}
            </div>
            {firma.comentario && (
                <div className="timeline-comment">"{firma.comentario}"</div>
            )}
        </div>
    </div>
);

const DetalleSolicitud = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [solicitud, setSolicitud]       = useState(null);
    const [firmas, setFirmas]             = useState([]);
    const [loading, setLoading]           = useState(true);
    const [procesando, setProcesando]     = useState(false);
    const [fileComprobante, setFile]      = useState(null);
    const [subiendoFile, setSubiendoFile] = useState(false);
    const [msgExito, setMsgExito]         = useState('');

    const miRol    = localStorage.getItem('rol')    || '';
    const API_URL = 'http://localhost:3001/api';

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/'); return null; }
        return { 'Authorization': `Bearer ${token}` };
    };

    const fetchDetalle = async () => {
        const headers = getAuthHeaders(); if (!headers) return;
        try {
            const response = await fetch(`${API_URL}/solicitudes/${id}`, { headers });
            const data = await response.json();
            
            if (data.success) {
                setSolicitud(data.solicitud);
                setFirmas(data.firmas || []);
            } else {
                setSolicitud(null);
            }
        } catch (e) {
            console.error(e);
            setSolicitud(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDetalle(); }, [id]);

    const handleAutorizar = async () => {
        const comentario = window.prompt('Comentario para la autorizacion (opcional):');
        if (comentario === null) return; 
        
        const headers = getAuthHeaders(); if (!headers) return;
        setProcesando(true);
        
        try {
            const response = await fetch(`${API_URL}/solicitudes/autorizar/${id}`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ comentario: comentario || 'Aprobado' })
            });
            const data = await response.json();
            
            if (data.success) {
                setMsgExito(`✓ ${data.message} → ${data.nuevo_estatus}`);
                fetchDetalle();
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error al autorizar');
        } finally {
            setProcesando(false);
        }
    };

    const handleRechazar = async () => {
        const motivo = window.prompt('Motivo del rechazo (obligatorio):');
        if (!motivo || !motivo.trim()) return;
        
        const headers = getAuthHeaders(); if (!headers) return;
        setProcesando(true);
        
        try {
            const response = await fetch(`${API_URL}/solicitudes/rechazar/${id}`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo })
            });
            const data = await response.json();
            
            if (data.success) { 
                setMsgExito('Solicitud rechazada.'); 
                fetchDetalle(); 
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error al rechazar');
        } finally {
            setProcesando(false);
        }
    };

    const handleSubirComprobante = async () => {
        if (!fileComprobante) return alert('Selecciona un archivo primero.');
        
        const headers = getAuthHeaders(); if (!headers) return;
        setSubiendoFile(true);
        
        try {
            const form = new FormData();
            form.append('comprobante', fileComprobante);
            
            const response = await fetch(`${API_URL}/solicitudes/comprobante/${id}`, {
                method: 'POST',
                headers: { 'Authorization': headers.Authorization },
                body: form
            });
            const data = await response.json();
            
            if (data.success) { 
                setMsgExito('Comprobante subido y solicitud marcada como PAGADA.'); 
                setFile(null); 
                fetchDetalle(); 
            } else {
                alert(data.message);
            }
        } catch (e) {
            alert('Error al subir comprobante');
        } finally {
            setSubiendoFile(false);
        }
    };

    const handleVerPDF = async () => {
        const headers = getAuthHeaders(); if (!headers) return;
        
        try {
            const response = await fetch(`${API_URL}/solicitudes/${id}/pdf`, { headers });
            if (!response.ok) throw new Error('Network response was not ok');
            
            const blob = await response.blob();
            const fileURL = window.URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
        } catch (error) {
            console.error('Error al descargar el PDF:', error);
            alert('No se pudo generar el documento PDF.');
        }
    };

    if (loading)   return <div className="detalle-container" style={{padding:'48px', textAlign:'center', color:'#64748b'}}>Cargando...</div>;
    if (!solicitud) return <div className="detalle-container" style={{padding:'48px', textAlign:'center', color:'#ef4444'}}>Solicitud no encontrada.</div>;

    const rolEsperado    = obtenerRolEsperado(solicitud);
    const yaTerminada    = ['PAGADO','RECHAZADO','AUTORIZADO_FINAL'].includes(solicitud.estatus);
    const puedeAutorizar = (solicitud.me_toca_firmar === true || solicitud.me_toca_firmar === 1) && !yaTerminada;
    const esTesorera     = miRol === 'TESORERIA' || miRol === 'ADMIN';
    const puedeSubirComp = esTesorera && solicitud.estatus === 'AUTORIZADO_FINAL' && !solicitud.comprobante_pago_path;

    return (
        <div className="detalle-container">
            <div className="detalle-header">
                <div className="detalle-title-group">
                    <button className="btn-icon-back" onClick={() => navigate('/solicitudes/historial')}>
                        <IconBack />
                    </button>
                    <div>
                        <h1>{solicitud.folio || `SOL-${String(solicitud.id).padStart(5,'0')}`}</h1>
                        <div className="detalle-estatus">
                            Estatus: &nbsp;{getBadge(solicitud.estatus)}
                        </div>
                    </div>
                </div>

                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'flex-end' }}>
                    
                    {/* NUEVO BOTÓN: VISUALIZAR COTIZACIÓN/SOPORTE ADJUNTO */}
                    {solicitud.cotizacion_path && (
                        <a 
                            href={`http://localhost:3001/${solicitud.cotizacion_path}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '6px', 
                                padding: '8px 16px', borderRadius: '6px', border: '1px solid #3b82f6', 
                                color: '#3b82f6', backgroundColor: '#eff6ff', textDecoration: 'none', 
                                fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <IconAttachment /> Ver Cotización / Soporte
                        </a>
                    )}

                    <button className="btn-outline-red" onClick={handleVerPDF}>
                        <IconPDF /> Ver SAC-TSR-RCS
                    </button>

                    {puedeAutorizar && (
                        <>
                            <button className="btn-danger-outline" onClick={handleRechazar} disabled={procesando}>
                                <IconX /> Rechazar
                            </button>
                            <button className="btn-primary" onClick={handleAutorizar} disabled={procesando}>
                                <IconCheck /> {procesando ? 'Procesando...' : 'Autorizar'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {msgExito && (
                <div className="success-banner" style={{marginBottom:'16px'}}>
                    <IconCheck />{msgExito}
                </div>
            )}

            <div className="detalle-grid">
                <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                    <div className="detalle-card">
                        <div className="detalle-card-header">
                            <h3>Informacion General</h3>
                        </div>
                        <div className="info-grid">
                            {[
                                ['Concepto de Pago',    solicitud.concepto_desc || solicitud.concepto_id],
                                ['Unidad de Negocio',   solicitud.unidad_negocio],
                                ['Fecha de Solicitud',  formatFecha(solicitud.fecha_solicitud)],
                                ['Solicitante',         solicitud.solicitante_nombre],
                            ].map(([label, val]) => (
                                <div key={label} className="info-block">
                                    <span className="info-label">{label}</span>
                                    <div className="info-value">{val || '---'}</div>
                                </div>
                            ))}
                        </div>
                        
                        {solicitud.proveedor_nombre && (
                            <div style={{marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0'}}>
                                <h4 style={{fontSize: '12px', color: '#64748b', marginBottom: '8px'}}>Datos del Proveedor / Beneficiario</h4>
                                <div className="info-grid">
                                    <div className="info-block"><span className="info-label">Nombre Comercial</span><div className="info-value">{solicitud.proveedor_nombre}</div></div>
                                    <div className="info-block"><span className="info-label">Banco y Cuenta/CLABE</span><div className="info-value">{solicitud.proveedor_banco} / {solicitud.proveedor_clabe || solicitud.proveedor_cuenta}</div></div>
                                </div>
                            </div>
                        )}

                        <div className="monto-grande">
                            <span className="monto-label">Monto Solicitado</span>
                            <span className="monto-valor">{formatCurrency(solicitud.monto)}</span>
                            <span className="monto-forma">{solicitud.forma_pago || 'TRANSFERENCIA'}</span>
                        </div>
                    </div>

                    <div className="detalle-card">
                        <div className="detalle-card-header"><h3>Justificacion</h3></div>
                        <div className="desc-block">
                            <p>{solicitud.descripcion || 'Sin descripcion.'}</p>
                        </div>
                    </div>
                </div>

                <div className="detalle-card" style={{ alignSelf:'start' }}>
                    <div className="detalle-card-header">
                        <h3>Tracker de Aprobacion</h3>
                        <span style={{ fontSize:'11px', color:'#64748b' }}>
                            {solicitud.nivel_actual === -1 ? 'Fase Previa: VoBo' : `Nivel ${solicitud.nivel_actual}/${solicitud.niveles_requeridos || '?'}`}
                        </span>
                    </div>

                    {solicitud.niveles_requeridos > 0 && (
                        <div style={{ margin:'4px 0 20px', backgroundColor:'#e2e8f0', borderRadius:'10px', height:'6px' }}>
                            <div style={{
                                width: `${Math.min(100, ((Math.max(solicitud.nivel_actual, 0)) / solicitud.niveles_requeridos) * 100)}%`,
                                backgroundColor: solicitud.estatus === 'RECHAZADO' ? '#ef4444' : '#10d440',
                                height:'100%', borderRadius:'10px',
                                transition:'width 0.5s ease'
                            }} />
                        </div>
                    )}

                    {firmas.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'40px 0', color:'#64748b' }}>
                            <IconClock />
                            <p style={{ margin:'12px 0 4px', fontSize:'14px', fontWeight:'600' }}>Sin firmas aun</p>
                            <span style={{ fontSize:'12px', color:'#94a3b8' }}>Esperando validacion inicial</span>
                        </div>
                    ) : (
                        <div className="timeline">
                            {firmas.map((firma, idx) => (
                                <TimelineItem key={idx} firma={firma} esUltimo={idx === firmas.length - 1} />
                            ))}
                        </div>
                    )}

                    {rolEsperado && !yaTerminada && (
                        <div style={{
                            marginTop:'16px', padding:'12px 16px',
                            backgroundColor:'#fffbeb', border:'1px solid #fde68a',
                            borderRadius:'8px', fontSize:'12px', color:'#92400e'
                        }}>
                            <strong>Proximo paso:</strong><br/>
                            Esperando firma de <strong>{rolEsperado}</strong>
                            {rolEsperado === 'REVISOR'       && ' (Asistente Contable)'}
                            {rolEsperado === 'AUTORIZADOR_1' && ' (Gerente)'}
                            {rolEsperado === 'AUTORIZADOR_2' && ' (Director General)'}
                        </div>
                    )}

                    {solicitud.estatus === 'AUTORIZADO_FINAL' && !solicitud.comprobante_pago_path && (
                        <div style={{ marginTop:'16px', padding:'12px 16px', backgroundColor:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', fontSize:'12px', color:'#1e40af' }}>
                            <strong>✓ Totalmente autorizado.</strong><br/>
                            Esperando que Tesoreria suba el comprobante de pago.
                        </div>
                    )}

                    {puedeSubirComp && (
                        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                            <h4 style={{ fontSize: '13px', marginBottom: '8px', color: '#334155' }}>Subir Comprobante de Pago</h4>
                            <input type="file" accept=".pdf, image/*" onChange={(e) => setFile(e.target.files[0])} style={{ marginBottom: '12px', width: '100%', fontSize: '12px' }} />
                            <button className="btn-primary" onClick={handleSubirComprobante} disabled={subiendoFile || !fileComprobante} style={{ width: '100%', justifyContent: 'center' }}>
                                <IconUpload /> {subiendoFile ? 'Subiendo...' : 'Registrar Pago'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetalleSolicitud;