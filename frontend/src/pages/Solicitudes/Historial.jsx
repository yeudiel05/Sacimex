import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import './Historial.css';

// ─── Iconos SVG ───────────────────────────────────────────────────────
const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}>
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

const IconEye = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const IconRefresh = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}>
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────
const formatCurrency = (monto) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getStatusBadge = (estatus) => {
    switch (estatus) {
        case 'PENDIENTE':
        case 'REVISION':
            return <span className="status-badge badge-warning">{estatus}</span>;
        case 'AUTORIZADO_1':
        case 'AUTORIZADO_2':
        case 'AUTORIZADO_3':
        case 'AUTORIZADO_FINAL':
            return <span className="status-badge badge-info">{estatus}</span>;
        case 'PAGADO':
            return <span className="status-badge badge-success">PAGADO</span>;
        case 'RECHAZADO':
            return <span className="status-badge badge-danger">RECHAZADO</span>;
        default:
            return <span className="status-badge badge-default">{estatus || 'DESCONOCIDO'}</span>;
    }
};

// ─── Componente Principal ─────────────────────────────────────────────
const Historial = () => {
    const navigate = useNavigate();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchSolicitudes = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await api.get('/solicitudes', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setSolicitudes(response.data.data);
            } else {
                setError('No se pudieron cargar las solicitudes.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error de conexión con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSolicitudes();
    }, []);

    return (
        <div className="historial-container">
            {/* ── HEADER ── */}
            <div className="historial-header">
                <div>
                    <h1>Historial de Solicitudes</h1>
                    <p>Monitorea el estatus de las solicitudes de recursos</p>
                </div>
                <div className="header-actions">
                    <button className="btn-icon" onClick={fetchSolicitudes} title="Actualizar">
                        <IconRefresh />
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/solicitudes/nueva')}>
                        <IconPlus />
                        Nueva Solicitud
                    </button>
                </div>
            </div>

            {/* ── TABLA DE DATOS ── */}
            <div className="historial-card">
                {error && <div className="error-alert">{error}</div>}

                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID / Folio</th>
                                <th>Fecha</th>
                                <th>Concepto</th>
                                <th>Unidad de Negocio</th>
                                <th style={{ textAlign: 'right' }}>Monto</th>
                                <th style={{ textAlign: 'center' }}>Estatus</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="empty-state">
                                        <div className="loading-spinner"></div> Cargando solicitudes...
                                    </td>
                                </tr>
                            ) : solicitudes.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-state">
                                        No hay solicitudes registradas aún.
                                    </td>
                                </tr>
                            ) : (
                                solicitudes.map((sol) => (
                                    <tr key={sol.id}>
                                        <td style={{ fontWeight: '700', color: '#0f172a' }}>
                                            {sol.folio || `SOL-${String(sol.id).padStart(4, '0')}`}
                                        </td>
                                        <td>{formatDate(sol.fecha_solicitud)}</td>
                                        <td>
                                            <span className="truncate-text" title={sol.concepto_id}>
                                                {sol.concepto_id}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="unidad-pill">{sol.unidad_negocio}</span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                            {formatCurrency(sol.monto)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {getStatusBadge(sol.estatus)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                className="btn-action-view" 
                                                onClick={() => navigate(`/solicitudes/detalle/${sol.id}`)}
                                                title="Ver detalle y tracking"
                                            >
                                                <IconEye />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Historial;