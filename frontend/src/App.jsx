import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Clientes from './pages/Clientes/Clientes';
import Inversores from './pages/Inversores/Inversores';
import Proveedores from './pages/Proveedores/Proveedores';
import Layout from './components/Layout/Layout';
import Usuarios from './pages/Usuarios/Usuarios';
import Configuracion from './pages/Configuracion/Configuracion';
import MatrizAutorizacion from './pages/Configuracion/MatrizAutorizacion';
import Reportes from './pages/Reportes/Reportes';
import Auditoria from './pages/Auditoria/Auditoria';
import Autorizaciones from './pages/Autorizaciones/Autorizaciones';
import Viaticos from './pages/Viaticos/Viaticos';
import RevisionViaticos from './pages/Viaticos/RevisionViaticos';
import Solicitud from './pages/Solicitudes/Solicitud';
import Historial from './pages/Solicitudes/Historial';
import DetalleSolicitud from './pages/Solicitudes/DetalleSolicitud';

// ============================================================
// Contexto de permisos en tiempo real
const PermisosContext = React.createContext({ permisos: {}, listo: false });

function PermisosProvider({ children }) {
  const token  = localStorage.getItem('token');
  const rol    = (localStorage.getItem('rol') || '').toUpperCase();

  // Iniciar siempre con permisos vacíos — se cargan del servidor
  // para evitar que permisos obsoletos del localStorage bloqueen rutas
  const [permisos, setPermisos] = React.useState({});
  const [listo, setListo] = React.useState(rol === 'ADMIN' || !token);

  const refrescar = React.useCallback(async () => {
    if (!token || rol === 'ADMIN') { setListo(true); return; }
    try {
      const res = await fetch('/api/configuracion/mis-permisos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { setListo(true); return; }
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('permisos', JSON.stringify(data.permisos));
        setPermisos(data.permisos);
      }
    } catch {}
    finally { setListo(true); }
  }, [token, rol]);

  React.useEffect(() => {
    refrescar();
    const interval = setInterval(refrescar, 30000);
    return () => clearInterval(interval);
  }, [refrescar]);

  return (
    <PermisosContext.Provider value={{ permisos, listo, refrescar }}>
      {children}
    </PermisosContext.Provider>
  );
}

// Tabla centralizada de módulos por rol — fuente única de verdad
const PERMISOS_POR_ROL = {
  ADMIN:         ['dashboard','clientes','inversores','proveedores','solicitudes','historial','viaticos','bandeja_dho','autorizaciones','reportes','auditoria','usuarios','configuracion','matriz'],
  CONTADOR:      ['dashboard','clientes','inversores','proveedores','solicitudes','historial','reportes'],
  AUTORIZADOR_1: ['dashboard','solicitudes','historial','autorizaciones','viaticos'],
  AUTORIZADOR_2: ['dashboard','solicitudes','historial','autorizaciones','viaticos'],
  REVISOR:       ['dashboard','solicitudes','historial','autorizaciones','viaticos'],
  TESORERIA:     ['dashboard','solicitudes','historial','autorizaciones','viaticos','proveedores'],
  'D.H.O':       ['dashboard','viaticos','bandeja_dho','solicitudes','historial'],
  GERENTE:       ['dashboard','clientes','reportes','solicitudes','historial'],
  DIRECTOR:      ['dashboard','clientes','reportes','solicitudes','historial'],
  AUXILIAR:      ['dashboard','solicitudes','historial','viaticos'],
  ALMACEN:       ['dashboard','proveedores'],
};

// ProtectedRoute — espera a que los permisos estén listos antes de evaluar
const ProtectedRoute = ({ children, modulo }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" replace />;

  const rol = (localStorage.getItem('rol') || '').trim().toUpperCase();
  if (rol === 'ADMIN') return children;

  const { permisos, listo } = React.useContext(PermisosContext);

  // Mostrar spinner mientras cargan los permisos del servidor
  if (!listo) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#f8fafc' }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid #e2e8f0', borderTopColor:'#10b981', animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  // 1. Permiso granular explícito → manda siempre
  if (modulo && modulo in permisos) {
    const p = permisos[modulo];
    const puedeVer = typeof p === 'object' ? !!p.ver : !!p;
    return puedeVer ? children : <Navigate to="/dashboard" replace />;
  }

  // 2. Sin granular → usar tabla de rol base
  if (modulo) {
    const modulosRol = PERMISOS_POR_ROL[rol] || [];
    if (!modulosRol.includes(modulo)) return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// ============================================================
function App() {
  return (
    <PermisosProvider>
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={
            <ProtectedRoute modulo="dashboard"><Dashboard /></ProtectedRoute>
          } />

          <Route path="/clientes" element={
            <ProtectedRoute modulo="clientes"><Clientes /></ProtectedRoute>
          } />

          <Route path="/inversores" element={
            <ProtectedRoute modulo="inversores"><Inversores /></ProtectedRoute>
          } />

          <Route path="/proveedores" element={
            <ProtectedRoute modulo="proveedores"><Proveedores /></ProtectedRoute>
          } />

          <Route path="/solicitudes/nueva" element={
            <ProtectedRoute modulo="solicitudes"><Solicitud /></ProtectedRoute>
          } />
          <Route path="/solicitudes/historial" element={
            <ProtectedRoute modulo="historial"><Historial /></ProtectedRoute>
          } />
          <Route path="/solicitudes/detalle/:id" element={
            <ProtectedRoute modulo="historial"><DetalleSolicitud /></ProtectedRoute>
          } />

          <Route path="/viaticos" element={
            <ProtectedRoute modulo="viaticos"><Viaticos /></ProtectedRoute>
          } />
          <Route path="/revision-viaticos" element={
            <ProtectedRoute modulo="bandeja_dho"><RevisionViaticos /></ProtectedRoute>
          } />

          <Route path="/autorizaciones" element={
            <ProtectedRoute modulo="autorizaciones"><Autorizaciones /></ProtectedRoute>
          } />

          <Route path="/reportes" element={
            <ProtectedRoute modulo="reportes"><Reportes /></ProtectedRoute>
          } />

          <Route path="/usuarios" element={
            <ProtectedRoute modulo="usuarios"><Usuarios /></ProtectedRoute>
          } />

          <Route path="/configuracion" element={
            <ProtectedRoute modulo="configuracion"><Configuracion /></ProtectedRoute>
          } />
          <Route path="/configuracion/matriz-autorizacion" element={
            <ProtectedRoute modulo="matriz"><MatrizAutorizacion /></ProtectedRoute>
          } />

          <Route path="/auditoria" element={
            <ProtectedRoute modulo="auditoria"><Auditoria /></ProtectedRoute>
          } />
        </Route>
      </Routes>
    </Router>
    </PermisosProvider>
  );
}

export default App;