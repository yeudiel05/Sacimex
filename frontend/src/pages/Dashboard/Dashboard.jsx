import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import './Dashboard.css';

// Datos de prueba para las gráficas
const dataRendimientos = [
  { mes: 'Oct', ingresos: 1200000 },
  { mes: 'Nov', ingresos: 1800000 },
  { mes: 'Dic', ingresos: 2400000 },
  { mes: 'Ene', ingresos: 3100000 },
  { mes: 'Feb', ingresos: 4500000 },
  { mes: 'Mar', ingresos: 5200000 },
];

const dataPortafolio = [
  { name: 'Inversión Tipo A', value: 45 },
  { name: 'Inversión Tipo B', value: 35 },
  { name: 'Inversión Mixta', value: 20 },
];
const COLORS = ['#3b82f6', '#10d440', '#fbbf24'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">
          ${(payload[0].value / 1000000).toFixed(1)}M MXN
        </p>
      </div>
    );
  }
  return null;
};

function Dashboard() {
  return (
    <>
      <div className="page-header stagger-1">
        <div>
          <h1>Dashboard Ejecutivo</h1>
          <p>Resumen general de la actividad financiera y operativa</p>
        </div>
        <button className="btn-primary pulse-effect">
            + Nuevo Movimiento
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card stagger-2">
          <div className="stat-header">
            <div className="stat-texts">
              <h4>Capital Activo</h4>
              <h2>$12,450,000</h2>
            </div>
            <div className="icon-wrapper green-light">
                <span className="stat-icon-text">$</span>
            </div>
          </div>
          <p className="stat-trend positive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            +8.2% <span>vs mes anterior</span>
          </p>
        </div>

        <div className="stat-card stagger-3">
          <div className="stat-header">
            <div className="stat-texts">
              <h4>Inversores Activos</h4>
              <h2>342</h2>
            </div>
            <div className="icon-wrapper blue-light">
              <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
          </div>
          <p className="stat-trend positive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            +12 nuevos <span>este mes</span>
          </p>
        </div>

        <div className="stat-card stagger-4">
          <div className="stat-header">
            <div className="stat-texts">
              <h4>Pagos Pendientes</h4>
              <h2>28</h2>
            </div>
            <div className="icon-wrapper orange-light">
              <svg className="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
          </div>
          <p className="stat-trend warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            $1,250,000 <span>por cobrar</span>
          </p>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card stagger-5">
          <div className="chart-header">
            <div>
              <h4>Rendimientos Mensuales</h4>
              <p>Rendimiento acumulado por mes (2026)</p>
            </div>
            <select className="chart-select"><option>Este año</option><option>Año pasado</option></select>
          </div>
          
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={dataRendimientos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} tickFormatter={(value) => `$${value / 1000000}M`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(16, 212, 64, 0.05)' }} />
                <Bar dataKey="ingresos" fill="#10d440" radius={[6, 6, 0, 0]} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card stagger-6">
          <div className="chart-header">
            <div>
              <h4>Distribución de Portafolio</h4>
              <p>Porcentaje por tipo</p>
            </div>
          </div>
          
          <div style={{ width: '100%', height: 200, display: 'flex', justifyContent: 'center' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={dataPortafolio} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" animationDuration={1500}>
                  {dataPortafolio.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="pie-legend-custom">
            {dataPortafolio.map((item, index) => (
              <div className="legend-item" key={index}>
                <span><span className="dot" style={{ backgroundColor: COLORS[index] }}></span> {item.name}</span>
                <span className="legend-value">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Dashboard;