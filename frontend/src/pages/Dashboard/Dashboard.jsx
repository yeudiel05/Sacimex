import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    clientesActivos: 0, 
    fondeadoresActivos: 0, 
    capitalActivo: 0, 
    proveedoresActivos: 0,
    pagosPendientesCount: 0,
    pagosPendientesMonto: 0,
    capitalColocado: 0
  });
  
  const [actividadReciente, setActividadReciente] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchStats = async (showLoader = true) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    
    if (showLoader) setIsLoading(true);
    
    try {
      const res = await fetch('http://localhost:3001/api/dashboard/stats', { headers });
      if (res.status === 401 || res.status === 403) {
        localStorage.clear(); navigate('/'); return;
      }
      const data = await res.json();
      
      if (data.success) {
          setStats(data.data.metricas);
          setActividadReciente(data.data.actividadReciente);
          procesarDatosGrafica(data.data.graficas.fondeos, data.data.graficas.colocacion);
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(true); 
    
    const intervalId = setInterval(() => {
      fetchStats(false);
    }, 15000); 

    return () => clearInterval(intervalId); 
  }, []);

  const procesarDatosGrafica = (datosFondeo, datosColocacion) => {
    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataCompleta = [];

    for (let i = 1; i <= 12; i++) {
        dataCompleta.push({
            mesNum: i,
            name: mesesNombres[i - 1],
            Fondeo: 0,
            NuevosClientes: 0
        });
    }

    if (datosFondeo && datosFondeo.length > 0) {
        datosFondeo.forEach(item => {
            const index = dataCompleta.findIndex(m => m.mesNum === item.mes);
            if (index !== -1) dataCompleta[index].Fondeo = parseFloat(item.total);
        });
    }

    if (datosColocacion && datosColocacion.length > 0) {
        datosColocacion.forEach(item => {
            const index = dataCompleta.findIndex(m => m.mesNum === item.mes);
            if (index !== -1) dataCompleta[index].NuevosClientes = parseInt(item.total_nuevos) * 50000; 
        });
    }

    const mesActual = new Date().getMonth() + 1;
    const chartDataFinal = dataCompleta.filter(m => m.mesNum <= mesActual);
    setChartData(chartDataFinal);
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1e293b' }}>{`Mes: ${label}`}</p>
          <p style={{ margin: 0, color: '#10b981', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
             <span style={{ display:'inline-block', width:'10px', height:'10px', borderRadius:'50%', backgroundColor:'#10b981', marginRight:'8px'}}></span>
             Fondeo: <strong>{formatMoney(payload[0].value)}</strong>
          </p>
          <p style={{ margin: '6px 0 0 0', color: '#3b82f6', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
             <span style={{ display:'inline-block', width:'10px', height:'10px', borderRadius:'50%', backgroundColor:'#3b82f6', marginRight:'8px'}}></span>
             Colocación: <strong>{formatMoney(payload[1].value)}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
      return (
        <div className="dashboard-container" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh'}}>
            <div className="loader-spinner"></div>
        </div>
      );
  }

  return (
    <div className="dashboard-container fade-in-up">
      <div className="page-header stagger-1">
        <div>
          <h1>Panel de Control</h1>
          <p>Resumen general de operaciones e indicadores financieros</p>
        </div>
        <div className="date-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="kpi-grid stagger-2">
        
        {/* Card 1: Fondeo (Verde) */}
        <div className="kpi-card highlight-green">
          <div className="kpi-icon-soft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          </div>
          <div className="kpi-info">
            <span>CAPITAL CAPTADO (FONDEO)</span>
            <h3>{formatMoney(stats.capitalActivo)}</h3>
          </div>
        </div>

        {/* Card 2: Cartera (Teal Oscuro) */}
        <div className="kpi-card highlight-teal">
          <div className="kpi-icon-soft">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </div>
          <div className="kpi-info">
            <span>CARTERA DE CLIENTES (ACTIVA)</span>
            <h3>{formatMoney(stats.capitalColocado)}</h3>
          </div>
        </div>

        {/* Card 3: Clientes (Blanca) */}
        <div className="kpi-card white-card">
          <div className="kpi-icon icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div className="kpi-info">
            <span className="dark-label">CLIENTES / ACREDITADOS</span>
            <h3 className="dark-value">{stats.clientesActivos}</h3>
          </div>
        </div>
        
        {/* Card 4: Fondeadores (Blanca) */}
        <div className="kpi-card white-card grid-col-span-1-5">
          <div className="kpi-icon icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          </div>
          <div className="kpi-info">
            <span className="dark-label">FONDEADORES ACTIVOS</span>
            <h3 className="dark-value">{stats.fondeadoresActivos}</h3>
          </div>
        </div>

        {/* Card 5: Proveedores / Pagos (Blanca) */}
        <div className="kpi-card white-card grid-col-span-1-5" onClick={() => stats.pagosPendientesCount > 0 && navigate('/autorizar-pagos')} style={{ cursor: stats.pagosPendientesCount > 0 ? 'pointer' : 'default', border: stats.pagosPendientesCount > 0 ? '1px solid #f87171' : 'none' }}>
          <div className="kpi-icon icon-purple" style={{ backgroundColor: stats.pagosPendientesCount > 0 ? '#fee2e2' : '', color: stats.pagosPendientesCount > 0 ? '#ef4444' : '' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path></svg>
          </div>
          <div className="kpi-info">
            <span className="dark-label" style={{ color: stats.pagosPendientesCount > 0 ? '#ef4444' : '' }}>
                {stats.pagosPendientesCount > 0 ? 'PAGOS POR AUTORIZAR' : 'PROVEEDORES'}
            </span>
            <h3 className="dark-value" style={{ color: stats.pagosPendientesCount > 0 ? '#ef4444' : '' }}>
                {stats.pagosPendientesCount > 0 ? formatMoney(stats.pagosPendientesMonto) : stats.proveedoresActivos}
            </h3>
          </div>
        </div>
      </div>

      <div className="dashboard-content stagger-2">
        <div className="chart-panel">
          <div className="panel-header-simple">
            <div>
                <h3 style={{ margin: 0 }}>Crecimiento Comparativo</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Capital Fondeado vs Dinero Colocado (Est.)</p>
            </div>
            <span className="badge-activo-dark">Año en curso</span>
          </div>
          <div className="chart-container" style={{ height: '320px', marginTop: '30px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value/1000}k`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Fondeo" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFon)" activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="NuevosClientes" name="Colocación" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCol)" activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="activity-panel">
          <div className="panel-header-simple">
            <h3 style={{ margin: 0 }}>Actividad Reciente</h3>
            <span style={{ fontSize: '13px', color: '#64748b', cursor: 'pointer', fontWeight: '500' }} onClick={() => navigate('/auditoria')}>Ver todo &rarr;</span>
          </div>
          <div className="activity-feed">
            {actividadReciente.length > 0 ? (
              actividadReciente.map((log) => (
                <div className="activity-item" key={log.id}>
                  <div className="activity-dot"></div>
                  <div className="activity-content">
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#334155', lineHeight: '1.4' }}>
                        <strong style={{ color: '#0f172a' }}>{log.usuario}</strong> {log.detalle}
                    </p>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
                        {log.accion.replace(/_/g, ' ')} • {new Date(log.fecha).toLocaleString('es-MX', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{padding: '40px 20px', textAlign: 'center', fontSize: '13px', color: '#94a3b8'}}>
                No hay actividad registrada.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;