import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

// Datos de prueba para la gráfica visual (luego se puede conectar a la BD real)
const chartData = [
  { name: 'Ene', Inversiones: 400000, Colocacion: 240000 },
  { name: 'Feb', Inversiones: 500000, Colocacion: 390000 },
  { name: 'Mar', Inversiones: 800000, Colocacion: 580000 },
  { name: 'Abr', Inversiones: 1200000, Colocacion: 900000 },
  { name: 'May', Inversiones: 1500000, Colocacion: 1100000 },
  { name: 'Jun', Inversiones: 2100000, Colocacion: 1700000 },
];

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    clientesActivos: 0, inversoresActivos: 0, capitalActivo: 0, proveedoresActivos: 0, actividadReciente: []
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchStats = async () => {
      const headers = getAuthHeaders();
      if (!headers) return;
      try {
        const res = await fetch('http://localhost:3001/api/dashboard/stats', { headers });
        if (res.status === 401 || res.status === 403) {
          localStorage.clear(); navigate('/'); return;
        }
        const data = await res.json();
        if (data.success) setStats(data.data);
      } catch (error) {
        console.error("Error cargando dashboard:", error);
      }
    };
    fetchStats();
  }, []);

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="dashboard-container fade-in-up">
      <div className="page-header stagger-1">
        <div>
          <h1>Panel de Control</h1>
          <p>Resumen general de operaciones Sacimex</p>
        </div>
        <div className="date-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* TARJETAS DE KPI (Indicadores Clave) */}
      <div className="kpi-grid stagger-2">
        <div className="kpi-card">
          <div className="kpi-icon icon-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
          <div className="kpi-info"><span>Clientes Activos</span><h3>{stats.clientesActivos}</h3></div>
        </div>
        
        <div className="kpi-card highlight-card">
          <div className="kpi-icon icon-white"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
          <div className="kpi-info"><span>Capital Administrado</span><h3>{formatMoney(stats.capitalActivo)}</h3></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon icon-green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg></div>
          <div className="kpi-info"><span>Inversores Activos</span><h3>{stats.inversoresActivos}</h3></div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon icon-purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path></svg></div>
          <div className="kpi-info"><span>Proveedores</span><h3>{stats.proveedoresActivos}</h3></div>
        </div>
      </div>

      <div className="dashboard-content stagger-2">
        {/* GRÁFICA DE RENDIMIENTO */}
        <div className="chart-panel">
          <div className="panel-header-simple">
            <h3>Crecimiento de Cartera</h3>
            <span className="badge-activo-dark">Año en curso</span>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10d440" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10d440" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}/>
                <Area type="monotone" dataKey="Inversiones" stroke="#10d440" strokeWidth={3} fillOpacity={1} fill="url(#colorInv)" />
                <Area type="monotone" dataKey="Colocacion" name="Colocación" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorCol)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FEED DE ACTIVIDAD RECIENTE */}
        <div className="activity-panel">
          <div className="panel-header-simple">
            <h3>Actividad Reciente</h3>
          </div>
          <div className="activity-feed">
            {stats.actividadReciente.length > 0 ? (
              stats.actividadReciente.map((log, index) => (
                <div className="activity-item" key={index}>
                  <div className="activity-dot"></div>
                  <div className="activity-content">
                    <p><strong>{log.accion.replace('_', ' ')}</strong> - {log.detalle}</p>
                    <span>{new Date(log.fecha).toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state" style={{padding: '20px', fontSize: '14px'}}>Aún no hay actividad registrada hoy.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;