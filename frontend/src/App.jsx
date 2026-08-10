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

  // ADMIN no necesita permisos granulares — siempre listo
  const [permisos, setPermisos] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('permisos') || '{}'); } catch { return {}; }
  });
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

// ProtectedRoute — espera a que los permisos estén listos antes de evaluar
const ProtectedRoute = ({ children, modulo, rolesPermitidos = [], deptosPermitidos = [] }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" replace />;

  const rol   = (localStorage.getItem('rol')          || '').trim().toUpperCase();
  const depto = (localStorage.getItem('departamento') || '').trim().toUpperCase();

  if (rol === 'ADMIN') return children;

  const { permisos, listo } = React.useContext(PermisosContext);

  // Esperar a que carguen los permisos del servidor antes de decidir
  if (!listo) return null;

  // Permiso granular explícito → esa regla manda
  if (modulo && modulo in permisos) {
    const p = permisos[modulo];
    const puedeVer = typeof p === 'object' ? !!p.ver : !!p;
    return puedeVer ? children : <Navigate to="/dashboard" replace />;
  }

  // Sin permiso granular → fallback al rol/depto
  const tieneRol   = rolesPermitidos.length === 0 || rolesPermitidos.includes(rol);
  const tieneDepto = deptosPermitidos.length > 0  && deptosPermitidos.includes(depto);

  if (tieneRol || tieneDepto) return children;
  return <Navigate to="/dashboard" replace />;
};

// ============================================================
function App() {
  const rolesGenerales = ['ADMIN', 'CONTADOR', 'ALMACEN', 'AUXILIAR', 'D.H.O', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA'];
  const deptosVistoBueno = ['COORDINACION TI', 'COORDINACION DHO', 'GERENCIA GENERAL', 'DIRECCION'];

  return (
    <PermisosProvider>
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<Layout />}>
          <Route path="/dashboard" element={
            <ProtectedRoute modulo="dashboard" rolesPermitidos={rolesGenerales}>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/clientes" element={
            <ProtectedRoute modulo="clientes" rolesPermitidos={['ADMIN', 'CONTADOR', 'GERENTE', 'DIRECTOR']} deptosPermitidos={['DIRECCION', 'GERENCIA GENERAL']}>
              <Clientes />
            </ProtectedRoute>
          } />

          <Route path="/inversores" element={
            <ProtectedRoute modulo="inversores" rolesPermitidos={['ADMIN', 'CONTADOR']} deptosPermitidos={['CONTABILIDAD', 'DIRECCION']}>
              <Inversores />
            </ProtectedRoute>
          } />

          <Route path="/proveedores" element={
            <ProtectedRoute modulo="proveedores" rolesPermitidos={['ADMIN', 'CONTADOR', 'ALMACEN', 'TESORERIA']}>
              <Proveedores />
            </ProtectedRoute>
          } />

          <Route path="/solicitudes/nueva" element={
            <ProtectedRoute modulo="solicitudes" rolesPermitidos={rolesGenerales}>
              <Solicitud />
            </ProtectedRoute>
          } />
          <Route path="/solicitudes/historial" element={
            <ProtectedRoute modulo="historial" rolesPermitidos={rolesGenerales}>
              <Historial />
            </ProtectedRoute>
          } />
          <Route path="/solicitudes/detalle/:id" element={
            <ProtectedRoute modulo="historial" rolesPermitidos={rolesGenerales}>
              <DetalleSolicitud />
            </ProtectedRoute>
          } />

          <Route path="/viaticos" element={
            <ProtectedRoute modulo="viaticos" rolesPermitidos={rolesGenerales}>
              <Viaticos />
            </ProtectedRoute>
          } />
          <Route path="/revision-viaticos" element={
            <ProtectedRoute modulo="bandeja_dho" rolesPermitidos={['D.H.O', 'ADMIN']}>
              <RevisionViaticos />
            </ProtectedRoute>
          } />

          <Route path="/autorizaciones" element={
            <ProtectedRoute modulo="autorizaciones" rolesPermitidos={['ADMIN', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA']} deptosPermitidos={deptosVistoBueno}>
              <Autorizaciones />
            </ProtectedRoute>
          } />

          <Route path="/reportes" element={
            <ProtectedRoute modulo="reportes" rolesPermitidos={['ADMIN', 'CONTADOR']}>
              <Reportes />
            </ProtectedRoute>
          } />

          <Route path="/usuarios" element={
            <ProtectedRoute modulo="usuarios" rolesPermitidos={['ADMIN']}>
              <Usuarios />
            </ProtectedRoute>
          } />

          <Route path="/configuracion" element={
            <ProtectedRoute modulo="configuracion" rolesPermitidos={['ADMIN']}>
              <Configuracion />
            </ProtectedRoute>
          } />
          <Route path="/configuracion/matriz-autorizacion" element={
            <ProtectedRoute modulo="matriz" rolesPermitidos={['ADMIN']}>
              <MatrizAutorizacion />
            </ProtectedRoute>
          } />

          <Route path="/auditoria" element={
            <ProtectedRoute modulo="auditoria" rolesPermitidos={['ADMIN']}>
              <Auditoria />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </Router>
    </PermisosProvider>
  );
}

export default App;