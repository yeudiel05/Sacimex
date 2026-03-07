import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Inversores.css';

function Inversores() {
    const navigate = useNavigate();
    const [monto, setMonto] = useState('');
    const [tasa, setTasa] = useState(0); 
    const [plazo, setPlazo] = useState(12);
    const [gananciaNeta, setGananciaNeta] = useState(0);
    const [totalRecibir, setTotalRecibir] = useState(0);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [inversores, setInversores] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [formData, setFormData] = useState({ tipo_persona: 'FISICA', nombre: '', rfc: '', direccion: '', telefono: '', email: '', clabe_bancaria: '', banco: '', origen_fondos: 'Ahorros Personales / Salario' });
    
    const [panelOpen, setPanelOpen] = useState(false);
    const [inversorActivo, setInversorActivo] = useState(null);
    const [activeTab, setActiveTab] = useState('contratos');
    
    const [tasas, setTasas] = useState([]); 
    
    const [contratos, setContratos] = useState([]);
    const [showNuevoContrato, setShowNuevoContrato] = useState(false);
    const [formContrato, setFormContrato] = useState({ id_tasa: '', monto_inicial: '', frecuencia_pagos: 'MENSUAL', reinversion_automatica: 0, fecha_inicio: new Date().toISOString().split('T')[0], fecha_fin: '' });
    const [beneficiarios, setBeneficiarios] = useState([]);
    const [formBeneficiario, setFormBeneficiario] = useState({ nombre_completo: '', parentesco: '', porcentaje: '', fecha_nacimiento: '' });
    const [movimientos, setMovimientos] = useState([]);
    const [showNuevoMovimiento, setShowNuevoMovimiento] = useState(false);
    const [formMovimiento, setFormMovimiento] = useState({ id_contrato: '', tipo: 'PAGO_INTERES', monto: '' });
    const [fileComprobante, setFileComprobante] = useState(null);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/'); return null; }
        return { 'Authorization': `Bearer ${token}` };
    };

    const handleAuthError = (status) => {
        if (status === 401 || status === 403) { localStorage.removeItem('token'); localStorage.removeItem('rol'); navigate('/'); return true; }
        return false;
    };

    const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

    const fetchTasasActivas = async () => {
        const headers = getAuthHeaders(); if (!headers) return;
        try {
            const res = await fetch('http://localhost:3001/api/tasas', { headers });
            const data = await res.json();
            if (data.success) setTasas(data.data.filter(t => t.estatus_activo === 1));
        } catch (error) { console.error(error); }
    };

    const fetchInversores = async () => {
        const headers = getAuthHeaders(); if (!headers) return;
        try {
            const response = await fetch('http://localhost:3001/api/inversores', { headers });
            if (handleAuthError(response.status)) return;
            const data = await response.json(); if (data.success) setInversores(data.data);
        } catch (error) { console.error(error); }
    };

    useEffect(() => { 
        fetchInversores(); 
        fetchTasasActivas();
    }, []);

    useEffect(() => {
        const montoNum = parseFloat(monto) || 0;
        const tasaNum = parseFloat(tasa) || 0;
        const plazoNum = parseInt(plazo) || 0;
        const ganancia = montoNum * (tasaNum / 100) * (plazoNum / 12);
        setGananciaNeta(ganancia);
        setTotalRecibir(montoNum + ganancia);
    }, [monto, tasa, plazo]);

    const openNewModal = () => {
        setIsEditing(false); setEditId(null); setFormError('');
        setFormData({ tipo_persona: 'FISICA', nombre: '', rfc: '', direccion: '', telefono: '', email: '', clabe_bancaria: '', banco: '', origen_fondos: 'Ahorros Personales / Salario' });
        setIsModalOpen(true);
    };

    const openEditModal = (inversor) => {
        setIsEditing(true); setEditId(inversor.id); setFormError('');
        setFormData({ tipo_persona: inversor.tipo_persona || 'FISICA', nombre: inversor.nombre, rfc: inversor.rfc || '', direccion: inversor.ubicacion, telefono: inversor.telefono, email: inversor.email, clabe_bancaria: inversor.clabe_bancaria, banco: inversor.banco, origen_fondos: inversor.origen_fondos || 'Ahorros Personales / Salario' });
        setIsModalOpen(true);
    };

    const triggerEliminarInversor = (id, nombre) => {
        setConfirmModal({ isOpen: true, title: 'Eliminar Inversor', message: `¿Estás seguro de eliminar a ${nombre}? Perderás el acceso a sus contratos.`, onConfirm: () => ejecutarEliminarInversor(id) });
    };

    const ejecutarEliminarInversor = async (id) => {
        const headers = getAuthHeaders(); if (!headers) return;
        try {
            const res = await fetch(`http://localhost:3001/api/inversores/${id}`, { method: 'DELETE', headers });
            if (handleAuthError(res.status)) return;
            if ((await res.json()).success) fetchInversores();
        } catch (error) { console.error(error); }
    };

    const validarFormulario = () => {
        setFormError('');
        if (!formData.nombre.trim()) { setFormError('El Nombre es obligatorio.'); return false; }
        if (!formData.direccion.trim()) { setFormError('La Dirección es obligatoria.'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setFormError('Correo Electrónico inválido.'); return false; }
        if (!/^\d{10}$/.test(formData.telefono)) { setFormError('El teléfono debe tener 10 dígitos.'); return false; }
        if (formData.tipo_persona === 'FISICA') { if (!/^([A-ZÑ&]{4})(\d{6})([A-Z0-9]{3})$/i.test(formData.rfc)) { setFormError('RFC Física inválido.'); return false; } }
        else { if (!/^([A-ZÑ&]{3})(\d{6})([A-Z0-9]{3})$/i.test(formData.rfc)) { setFormError('RFC Moral inválido.'); return false; } }
        if (!formData.banco) { setFormError('Debe seleccionar un Banco.'); return false; }
        if (!/^\d{18}$/.test(formData.clabe_bancaria)) { setFormError('La CLABE debe tener 18 números.'); return false; }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validarFormulario()) return;
        const headers = getAuthHeaders(); if (!headers) return;
        setIsLoading(true);
        const url = isEditing ? `http://localhost:3001/api/inversores/${editId}` : 'http://localhost:3001/api/inversores';
        const method = isEditing ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, { method: method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
            if (handleAuthError(res.status)) return;
            const data = await res.json();
            if (data.success) { setIsModalOpen(false); fetchInversores(); alert(data.message); } else setFormError(data.message);
        } catch (error) { setFormError("Error de servidor."); } finally { setIsLoading(false); }
    };

    const cambiarEstatusInversor = async (id_persona, estatus_actual) => {
        const nuevoEstatus = estatus_actual === 1 ? 0 : 1;
        const authHeaders = getAuthHeaders(); if (!authHeaders) return;
        try {
            const response = await fetch(`http://localhost:3001/api/inversores/${id_persona}/estatus`, { method: 'PUT', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ estatus_activo: nuevoEstatus }) });
            if (handleAuthError(response.status)) return;
            if ((await response.json()).success) fetchInversores();
        } catch (error) { console.error(error); }
    };

    const abrirPanel = async (inversor) => {
        setInversorActivo(inversor); setActiveTab('contratos'); setShowNuevoContrato(false); setShowNuevoMovimiento(false); setPanelOpen(true);
        fetchContratos(inversor.id); fetchBeneficiarios(inversor.id); fetchMovimientos(inversor.id);
    };

    // =====================================================================
    // RUTAS CORREGIDAS PARA EL PANEL DEL INVERSOR (/api/inversores/...)
    // =====================================================================
    
    const fetchContratos = async (id_inversor) => {
        const headers = getAuthHeaders(); 
        try {
            const res = await fetch(`http://localhost:3001/api/inversores/contratos/${id_inversor}`, { headers });
            const data = await res.json(); if (data.success) setContratos(data.data);
        } catch(e) { console.error(e); }
    };

    const handleGuardarContrato = async (e) => {
        e.preventDefault(); 
        if (!formContrato.id_tasa || !formContrato.monto_inicial || !formContrato.fecha_fin) return alert("Completa todos los campos.");
        const headers = getAuthHeaders(); setIsLoading(true);
        try { 
            const res = await fetch('http://localhost:3001/api/inversores/contratos', { 
                method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ ...formContrato, id_inversor: inversorActivo.id }) 
            }); 
            if(!res.ok) throw new Error("Fallo en servidor");
            const data = await res.json(); 
            if (data.success) { setShowNuevoContrato(false); fetchContratos(inversorActivo.id); alert("Contrato Creado."); } 
            else alert(data.message); 
        } catch (error) { console.error(error); alert("No se pudo guardar el contrato. Revisa la consola."); } finally { setIsLoading(false); }
    };

    const generarPDFContrato = async (id_contrato) => {
        const headers = getAuthHeaders(); if (!headers) return; setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/inversores/contratos/${id_contrato}/pdf`, { headers });
            if (handleAuthError(response.status)) return;
            const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Contrato_Sacimex_${id_contrato.toString().padStart(4, '0')}.pdf`; document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url);
        } catch (error) { alert("Hubo un problema al generar el documento."); } finally { setIsLoading(false); }
    };

    const fetchBeneficiarios = async (id_inversor) => { 
        const headers = getAuthHeaders(); 
        try {
            const res = await fetch(`http://localhost:3001/api/inversores/beneficiarios/${id_inversor}`, { headers }); 
            const data = await res.json(); if (data.success) setBeneficiarios(data.data); 
        } catch(e) { console.error(e); }
    };

    const totalPorcentaje = beneficiarios.reduce((acc, curr) => acc + parseFloat(curr.porcentaje), 0);
    
    const handleGuardarBeneficiario = async (e) => { 
        e.preventDefault(); if (totalPorcentaje + parseFloat(formBeneficiario.porcentaje) > 100) return alert("Error: Supera el 100%."); 
        const headers = getAuthHeaders(); setIsLoading(true); 
        try { 
            const res = await fetch('http://localhost:3001/api/inversores/beneficiarios', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...formBeneficiario, id_inversor: inversorActivo.id }) }); 
            const data = await res.json();
            if (data.success) { setFormBeneficiario({ nombre_completo: '', parentesco: '', porcentaje: '', fecha_nacimiento: '' }); fetchBeneficiarios(inversorActivo.id); } 
        } catch (error) { console.error(error); } finally { setIsLoading(false); } 
    };
    
    const eliminarBeneficiario = async (id) => { 
        if (!window.confirm("¿Seguro de eliminar este beneficiario?")) return; 
        const headers = getAuthHeaders(); 
        try { 
            const res = await fetch(`http://localhost:3001/api/inversores/beneficiarios/${id}`, { method: 'DELETE', headers }); 
            if ((await res.json()).success) fetchBeneficiarios(inversorActivo.id); 
        } catch (error) { console.error(error); } 
    };

    const fetchMovimientos = async (id_inversor) => { 
        const headers = getAuthHeaders(); 
        try {
            const res = await fetch(`http://localhost:3001/api/inversores/movimientos/${id_inversor}`, { headers }); 
            const data = await res.json(); if (data.success) setMovimientos(data.data); 
        } catch(e){ console.error(e); }
    };
    
    const handleGuardarMovimiento = async (e) => { 
        e.preventDefault(); if (!formMovimiento.id_contrato || !formMovimiento.monto) return alert("Completa el contrato y el monto."); 
        const headers = getAuthHeaders(); setIsLoading(true); 
        const formDataUpload = new FormData(); 
        formDataUpload.append('id_contrato', formMovimiento.id_contrato); formDataUpload.append('tipo', formMovimiento.tipo); formDataUpload.append('monto', formMovimiento.monto); 
        if (fileComprobante) formDataUpload.append('comprobante', fileComprobante); 
        try { 
            const res = await fetch('http://localhost:3001/api/inversores/movimientos', { method: 'POST', headers, body: formDataUpload }); 
            const data = await res.json(); 
            if (data.success) { setShowNuevoMovimiento(false); setFormMovimiento({ id_contrato: '', tipo: 'PAGO_INTERES', monto: '' }); setFileComprobante(null); fetchMovimientos(inversorActivo.id); alert("Movimiento registrado con éxito"); } else alert(data.message); 
        } catch (error) { console.error(error); } finally { setIsLoading(false); } 
    };

    const inversoresFiltrados = inversores.filter(i => i.nombre.toLowerCase().includes(searchTerm.toLowerCase()));

    // ===== COMPONENTES DE PESTAÑAS =====
    const TabContratos = () => (
        <div className="tab-content fade-in-up">
            {!showNuevoContrato ? (
                <>
                    <div className="flex-between" style={{ marginBottom: '20px' }}>
                        <h4 className="section-subtitle" style={{ margin: 0, border: 'none' }}>Contratos Vigentes</h4>
                        <button className="btn-primary btn-sm" onClick={() => setShowNuevoContrato(true)}>+ Nuevo Contrato</button>
                    </div>
                    {contratos.length > 0 ? contratos.map(c => (
                        <div className="contrato-card" key={c.id}>
                            <div className="c-header"><strong>Contrato #{c.id.toString().padStart(4, '0')}</strong><span className="badge-activo">{c.estatus}</span></div>
                            <div className="c-body">
                                <div><span>Monto Invertido</span><h3>{formatMoney(c.monto_inicial)}</h3></div>
                                <div><span>Tasa</span><strong>{c.nombre_tasa} ({c.tasa_anual_esperada}%)</strong></div>
                            </div>
                            <div className="c-footer">
                                <span>Vence: {new Date(c.fecha_fin).toLocaleDateString()}</span>
                                <button className="btn-view" onClick={() => generarPDFContrato(c.id)} disabled={isLoading}>{isLoading ? 'Generando...' : 'Descargar Contrato'}</button>
                            </div>
                        </div>
                    )) : <div className="empty-state">El inversor aún no tiene capital activo.</div>}
                </>
            ) : (
                <form className="nuevo-contrato-form" onSubmit={handleGuardarContrato}>
                    <h4 className="section-subtitle">Crear Nuevo Contrato</h4>
                    <div className="form-group"><label>Monto a Invertir</label><input type="number" required min="1000" value={formContrato.monto_inicial} onChange={e => setFormContrato({ ...formContrato, monto_inicial: e.target.value })} /></div>
                    <div className="form-group">
                        <label>Seleccionar Producto</label>
                        <select className="custom-select" required value={formContrato.id_tasa} onChange={e => setFormContrato({ ...formContrato, id_tasa: e.target.value })}>
                            <option value="">Seleccione...</option>
                            {tasas.map(t => (<option key={t.id} value={t.id}>{t.nombre_tasa} - {t.tasa_anual_esperada}%</option>))}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label>Fecha Inicio</label><input type="date" required value={formContrato.fecha_inicio} onChange={e => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })} /></div>
                        <div className="form-group"><label>Fecha Vencimiento</label><input type="date" required value={formContrato.fecha_fin} onChange={e => setFormContrato({ ...formContrato, fecha_fin: e.target.value })} /></div>
                    </div>
                    <div className="modal-footer" style={{ marginTop: '20px' }}>
                        <button type="button" className="btn-cancel" onClick={() => setShowNuevoContrato(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Activar Inversión'}</button>
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
                <div className="beneficiarios-list">
                    {beneficiarios.map(b => (
                        <div className="beneficiario-card" key={b.id}>
                            <div className="b-info"><strong>{b.nombre_completo}</strong><span>Parentesco: {b.parentesco}</span></div>
                            <div className="b-actions">
                                <span className="b-percent">{b.porcentaje}%</span>
                                <button className="btn-delete-file" onClick={() => eliminarBeneficiario(b.id)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {totalPorcentaje < 100 && (
                <form className="nuevo-contrato-form" style={{ marginTop: '24px' }} onSubmit={handleGuardarBeneficiario}>
                    <h4 className="section-subtitle">Agregar Beneficiario</h4>
                    <div className="form-group"><label>Nombre Completo</label><input type="text" required value={formBeneficiario.nombre_completo} onChange={e => setFormBeneficiario({ ...formBeneficiario, nombre_completo: e.target.value })} /></div>
                    <div className="form-row">
                        <div className="form-group"><label>Parentesco</label><select className="custom-select" required value={formBeneficiario.parentesco} onChange={e => setFormBeneficiario({ ...formBeneficiario, parentesco: e.target.value })}><option value="">Selecciona...</option><option value="Esposo/a">Esposo/a</option><option value="Hijo/a">Hijo/a</option><option value="Otro">Otro</option></select></div>
                        <div className="form-group"><label>Porcentaje (%)</label><input type="number" required min="1" max={100 - totalPorcentaje} value={formBeneficiario.porcentaje} onChange={e => setFormBeneficiario({ ...formBeneficiario, porcentaje: e.target.value })} /></div>
                    </div>
                    <div className="modal-footer" style={{ marginTop: '16px' }}><button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Agregar Beneficiario'}</button></div>
                </form>
            )}
        </div>
    );

    const TabMovimientos = () => (
        <div className="tab-content fade-in-up">
            {!showNuevoMovimiento ? (
                <>
                    <div className="flex-between" style={{ marginBottom: '20px' }}>
                        <h4 className="section-subtitle" style={{ margin: 0, border: 'none' }}>Historial de Movimientos</h4>
                        {contratos.length > 0 && (<button className="btn-primary btn-sm" onClick={() => setShowNuevoMovimiento(true)}>+ Registrar Movimiento</button>)}
                    </div>
                    {contratos.length === 0 && <div className="empty-state">Debes crear un contrato de inversión primero.</div>}
                    {movimientos.length > 0 ? (
                        <div className="movimientos-list">
                            {movimientos.map(mov => {
                                const iconStyle = mov.tipo === 'PAGO_INTERES' ? { color: '#10b981', background: '#d1fae5' } : mov.tipo === 'DEPOSITO' ? { color: '#3b82f6', background: '#dbeafe' } : { color: '#ef4444', background: '#fee2e2' };
                                const iconPath = mov.tipo === 'RETIRO_CAPITAL' ? 
                                    <><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></> :
                                    mov.tipo === 'DEPOSITO' ?
                                    <><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></> :
                                    <><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></>;
                                return (
                                    <div className="movimiento-item" key={mov.id}>
                                        <div className="mov-icon"><svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{iconPath}</svg></div>
                                        <div className="mov-detalles"><strong>{mov.tipo.replace('_', ' ')}</strong><span>Contrato #{mov.id_contrato.toString().padStart(4, '0')} • {new Date(mov.fecha_movimiento).toLocaleDateString()}</span></div>
                                        <div className="mov-monto-accion">
                                            <span className={`mov-monto ${mov.tipo === 'RETIRO_CAPITAL' ? 'retiro' : 'ingreso'}`}>{mov.tipo === 'RETIRO_CAPITAL' ? '-' : '+'}{formatMoney(mov.monto)}</span>
                                            {mov.recibo_comprobante && (<a href={`http://localhost:3001/${mov.recibo_comprobante}`} target="_blank" rel="noreferrer" className="btn-view">Ver</a>)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (contratos.length > 0 && <div className="empty-state">No hay movimientos registrados.</div>)}
                </>
            ) : (
                <form className="nuevo-contrato-form" onSubmit={handleGuardarMovimiento}>
                    <h4 className="section-subtitle">Registrar Transacción</h4>
                    <div className="form-group"><label>Contrato Asociado</label><select className="custom-select" required value={formMovimiento.id_contrato} onChange={e => setFormMovimiento({ ...formMovimiento, id_contrato: e.target.value })}><option value="">Selecciona...</option>{contratos.map(c => (<option key={c.id} value={c.id}>Contrato #{c.id.toString().padStart(4, '0')} - {formatMoney(c.monto_inicial)}</option>))}</select></div>
                    <div className="form-row">
                        <div className="form-group"><label>Tipo</label><select className="custom-select" required value={formMovimiento.tipo} onChange={e => setFormMovimiento({ ...formMovimiento, tipo: e.target.value })}><option value="PAGO_INTERES">Pago de Intereses (Salida)</option><option value="DEPOSITO">Inyección de Capital (Entrada)</option><option value="RETIRO_CAPITAL">Retiro de Capital (Salida)</option></select></div>
                        <div className="form-group"><label>Monto</label><input type="number" required min="1" placeholder="Ej. 5000" value={formMovimiento.monto} onChange={e => setFormMovimiento({ ...formMovimiento, monto: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label>Comprobante</label><input type="file" className="file-input" required onChange={e => setFileComprobante(e.target.files[0])} accept=".pdf,.png,.jpg,.jpeg" /></div>
                    <div className="modal-footer" style={{ marginTop: '16px' }}>
                        <button type="button" className="btn-cancel" onClick={() => setShowNuevoMovimiento(false)}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Registrar'}</button>
                    </div>
                </form>
            )}
        </div>
    );

    return (
        <div className="inversores-container">
            <div className="page-header stagger-1">
                <div><h1>Inversores</h1><p>Calculadora de proyecciones y gestión de capital</p></div>
                <button className="btn-primary" onClick={openNewModal}>+ Registrar Inversor</button>
            </div>

            <div className="calc-dashboard stagger-2">
                <div className="calc-panel">
                    <div className="panel-title">
                        <div className="icon-wrapper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg></div>
                        <div><h3>Calculadora de Rendimientos</h3><p>Ingrese parámetros para proyectar el ROI</p></div>
                    </div>
                    <div className="calc-controls">
                        <div className="form-group">
                            <label>Monto de Inversión (MXN)</label>
                            <div className="input-with-prefix"><span className="prefix">$</span><input type="number" placeholder="0" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Producto de Inversión</label>
                                <select 
                                    className="calc-select" 
                                    value={tasa} 
                                    onChange={(e) => setTasa(e.target.value)}
                                    style={{ borderColor: 'var(--brand-green)', backgroundColor: 'var(--bg-main)' }}
                                >
                                    <option value="0">Seleccione un producto...</option>
                                    {tasas.map(t => (
                                        <option key={t.id} value={t.tasa_anual_esperada}>
                                            {t.nombre_tasa} ({t.tasa_anual_esperada}%)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group"><label>Plazo (Meses)</label><select value={plazo} onChange={(e) => setPlazo(e.target.value)} className="calc-select"><option value="3">3 Meses</option><option value="6">6 Meses</option><option value="9">9 Meses</option><option value="12">12 Meses</option><option value="24">24 Meses</option></select></div>
                        </div>
                    </div>
                </div>

                <div className="results-panel">
                    <div className="panel-title">
                        <div className="icon-wrapper glass-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></div>
                        <div><h3>Resumen Proyectado</h3><p>Basado en tasa fija de interés simple</p></div>
                    </div>
                    <div className="results-grid">
                        <div className="result-card green-card"><span>Ganancia Neta</span><h2>{formatMoney(gananciaNeta)}</h2>{monto > 0 && <div className="roi-badge">ROI: {((gananciaNeta / (parseFloat(monto) || 1)) * 100).toFixed(2)}%</div>}</div>
                        <div className="result-card blue-card"><span>Ganancia total a recibir</span><h2>{formatMoney(totalRecibir)}</h2></div>
                    </div>
                </div>
            </div>

            <div className="inversores-list-container fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="list-header">
                    <h2>Directorio de Inversores</h2>
                    <div className="search-bar" style={{ margin: 0, maxWidth: '350px' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                </div>
                <div className="clientes-grid">
                    {inversoresFiltrados.map((inversor) => (
                        <div className="cliente-card" key={inversor.id}>
                            <div className="cliente-card-header">
                                <div className="cliente-info-top">
                                    <div className={`avatar ${inversor.estatus_activo ? 'avatar-active' : 'avatar-inactive'}`}>{inversor.nombre.substring(0, 2).toUpperCase()}</div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <h4 style={{ margin: 0 }}>{inversor.nombre}</h4>
                                            <button className="btn-icon-edit" onClick={() => openEditModal(inversor)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                                            <button className="btn-icon-edit btn-icon-delete" onClick={() => triggerEliminarInversor(inversor.id, inversor.nombre)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                        </div>
                                        <span>RFC: {inversor.rfc}</span>
                                    </div>
                                </div>
                                <button className={`badge-estatus-select ${inversor.estatus_activo ? 'badge-activo' : 'badge-inactivo'}`} onClick={() => cambiarEstatusInversor(inversor.id, inversor.estatus_activo)}>{inversor.estatus_activo ? 'Activo' : 'Inactivo'}</button>
                            </div>
                            <div className="cliente-card-body">
                                <div className="bank-info-row"><span className="bank-label">Banco:</span><strong className="bank-value">{inversor.banco}</strong></div>
                                <div className="bank-info-row"><span className="bank-label">CLABE:</span><strong className="bank-value">{inversor.clabe_bancaria}</strong></div>
                            </div>
                            <div className="cliente-card-footer">
                                <button className="btn-secondary-full" onClick={() => abrirPanel(inversor)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg> Ver Contratos </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {panelOpen && inversorActivo && (
                <div className="modal-overlay" onClick={() => setPanelOpen(false)}>
                    <div className="master-panel fade-in-right" onClick={(e) => e.stopPropagation()}>
                        <div className="panel-header"><div><h2>Panel del Inversor</h2><p className="client-badge">{inversorActivo.nombre}</p></div><button className="btn-close" onClick={() => setPanelOpen(false)}>×</button></div>
                        <div className="panel-tabs">
                            {['contratos', 'beneficiarios', 'movimientos'].map(tab => (
                                <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                                    {tab === 'contratos' ? 'Contratos' : tab === 'beneficiarios' ? 'Beneficiarios' : 'Estado de Cuenta'}
                                </button>
                            ))}
                        </div>
                        <div className="panel-body">
                            {activeTab === 'contratos' && <TabContratos />}
                            {activeTab === 'beneficiarios' && <TabBeneficiarios />}
                            {activeTab === 'movimientos' && <TabMovimientos />}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL INVERSOR */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content fade-in-down" style={{ maxWidth: '700px' }}>
                        <div className="modal-header"><h2>{isEditing ? 'Editar Inversor' : 'Nuevo Inversor'}</h2><button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button></div>
                        <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            {formError && (<div className="error-message shake-animation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>{formError}</span></div>)}
                            <h4 className="section-subtitle">Datos Personales</h4>
                            <div className="form-row">
                                <div className="form-group"><label>Tipo de Persona</label><select className="custom-select" value={formData.tipo_persona} onChange={(e) => { setFormData({ ...formData, tipo_persona: e.target.value, rfc: '' }); setFormError(''); }}><option value="FISICA">Física</option><option value="MORAL">Moral</option></select></div>
                                <div className="form-group"><label>RFC</label><input type="text" required maxLength={formData.tipo_persona === 'FISICA' ? 13 : 12} placeholder={formData.tipo_persona === 'FISICA' ? 'ABCD800101XYZ' : 'ABC800101XYZ'} value={formData.rfc} onChange={(e) => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} /></div>
                            </div>
                            <div className="form-group"><label>Nombre Completo o Razón Social</label><input type="text" required value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} /></div>
                            <div className="form-row">
                                <div className="form-group"><label>Teléfono</label><input type="text" required maxLength="10" placeholder="10 dígitos" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value.replace(/[^0-9]/g, '') })} /></div>
                                <div className="form-group"><label>Correo</label><input type="email" required placeholder="correo@ejemplo.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
                            </div>
                            <div className="form-group"><label>Dirección Completa</label><input type="text" required value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} /></div>
                            <h4 className="section-subtitle">Datos Financieros</h4>
                            <div className="form-row">
                                <div className="form-group"><label>Banco</label><select className="custom-select" required value={formData.banco} onChange={(e) => setFormData({ ...formData, banco: e.target.value })}><option value="">Seleccione...</option><option value="BBVA">BBVA</option><option value="Santander">Santander</option><option value="Banorte">Banorte</option><option value="Citibanamex">Citibanamex</option><option value="HSBC">HSBC</option><option value="Otro">Otro</option></select></div>
                                <div className="form-group"><label>CLABE (18 dígitos)</label><input type="text" required maxLength="18" placeholder="000000000000000000" value={formData.clabe_bancaria} onChange={(e) => setFormData({ ...formData, clabe_bancaria: e.target.value.replace(/[^0-9]/g, '') })} /></div>
                            </div>
                            <div className="form-group"><label>Origen de Fondos</label><select className="custom-select" value={formData.origen_fondos} onChange={(e) => setFormData({ ...formData, origen_fondos: e.target.value })}><option value="Ahorros Personales / Salario">Ahorros</option><option value="Ingresos por Negocio">Negocio</option><option value="Venta de Inmueble">Inmueble</option><option value="Otro">Otro</option></select></div>
                            <div className="modal-footer" style={{ paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                                    <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Registrar'}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmModal.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                    <div className="confirm-modal-content fade-in-up">
                        <div className="confirm-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
                        <h3>{confirmModal.title}</h3>
                        <p>{confirmModal.message}</p>
                        <div className="confirm-actions">
                            <button className="btn-confirm-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancelar</button>
                            <button className="btn-confirm-delete" onClick={() => { confirmModal.onConfirm(); setConfirmModal({ ...confirmModal, isOpen: false }); }}>Sí, eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Inversores;