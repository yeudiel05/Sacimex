import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Importación de Componentes y Páginas
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Clientes from './pages/Clientes/Clientes';
import Inversores from './pages/Inversores/Inversores';
import Proveedores from './pages/Proveedores/Proveedores';
import Layout from './components/Layout/Layout';
import Usuarios from './pages/Usuarios/Usuarios';
import Configuracion from './pages/Configuracion/Configuracion';
import Reportes from './pages/Reportes/Reportes';
import Auditoria from './pages/Auditoria/Auditoria';
import Autorizaciones from './pages/Autorizaciones/Autorizaciones';
import Viaticos from './pages/Viaticos/Viaticos';
import RevisionViaticos from './pages/Viaticos/RevisionViaticos';
import Solicitud from './pages/Solicitudes/Solicitud';
import Historial from './pages/Solicitudes/Historial';
import DetalleSolicitud from './pages/Solicitudes/DetalleSolicitud';

// ==========================================
// ==========================================
const ProtectedRoute = ({ children, rolesPermitidos, deptosPermitidos = [] }) => {
  const token = localStorage.getItem('token');
  
  // LIMPIEZA EXTREMA DEL ROL (Evita bugs por espacios o saltos de línea \r de la BD)
  const rawRole = localStorage.getItem('rol') || '';
  const userRole = rawRole.trim().replace(/\r?\n|\r/g, '').toUpperCase();
  
  const rawDepto = localStorage.getItem('departamento') || '';
  const userDepto = rawDepto.trim().replace(/\r?\n|\r/g, '').toUpperCase();

  // Si no hay sesión (token), lo mandamos a la pantalla de Login
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Comprobar si el usuario tiene permiso por ROL o por DEPARTAMENTO
  const tieneRolPermitido = rolesPermitidos && rolesPermitidos.includes(userRole);
  const tieneDeptoPermitido = deptosPermitidos && deptosPermitidos.includes(userDepto);

  if (!tieneRolPermitido && !tieneDeptoPermitido) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si pasa todas las pruebas de seguridad, mostramos la pantalla
  return children;
};

// ==========================================
//  ENRUTADOR PRINCIPAL (App)
// ==========================================
function App() {
  // Lista universal de todos los roles operativos que pueden ver lo básico (Dashboard, Solicitudes)
  const rolesGenerales = ['ADMIN', 'CONTADOR', 'ALMACEN', 'AUXILIAR', 'D.H.O', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA'];
  
  // Departamentos que dan Visto Bueno a las solicitudes
  const deptosVistoBueno = ['COORDINACION TI', 'COORDINACION DHO', 'GERENCIA GENERAL'];

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route element={<Layout />}>
          
          <Route path="/dashboard" element={
            <ProtectedRoute rolesPermitidos={rolesGenerales}><Dashboard /></ProtectedRoute>
          } />

          <Route path="/clientes" element={
            <ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR', 'AUXILIAR']}><Clientes /></ProtectedRoute>
          } />

          <Route path="/inversores" element={
            <ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR']}><Inversores /></ProtectedRoute>
          } />

          {/* Tesorería necesita acceso a Proveedores para ver el Reporte Maestro de Egresos */}
          <Route path="/proveedores" element={
            <ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR', 'ALMACEN', 'TESORERIA']}><Proveedores /></ProtectedRoute>
          } />

          {/* Solicitudes (Todos pueden entrar a crear y ver su historial) */}
          <Route path="/solicitudes/nueva" element={
            <ProtectedRoute rolesPermitidos={rolesGenerales}><Solicitud /></ProtectedRoute>
          } />
          <Route path="/solicitudes/historial" element={
            <ProtectedRoute rolesPermitidos={rolesGenerales}><Historial /></ProtectedRoute>
          } />
          <Route path="/solicitudes/detalle/:id" element={
            <ProtectedRoute rolesPermitidos={rolesGenerales}><DetalleSolicitud /></ProtectedRoute>
          } />

          {/* Viáticos */}
          <Route path="/viaticos" element={
            <ProtectedRoute rolesPermitidos={rolesGenerales}><Viaticos /></ProtectedRoute>
          } />
          <Route path="/revision-viaticos" element={
            <ProtectedRoute rolesPermitidos={['D.H.O', 'ADMIN']}><RevisionViaticos /></ProtectedRoute>
          } />

          {/* Autorizaciones (Solo los que firman O los que dan Visto Bueno Y Tesorería) */}
          <Route path="/autorizaciones" element={
            <ProtectedRoute 
                rolesPermitidos={['ADMIN', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA']} 
                deptosPermitidos={deptosVistoBueno}
            >
                <Autorizaciones />
            </ProtectedRoute>
          } />

          {/* Reportes */}
          <Route path="/reportes" element={
            <ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR']}><Reportes /></ProtectedRoute>
          } />

          {/* Configuración Administrativa */}
          <Route path="/usuarios" element={
            <ProtectedRoute rolesPermitidos={['ADMIN']}><Usuarios /></ProtectedRoute>
          } />
          <Route path="/configuracion" element={
            <ProtectedRoute rolesPermitidos={['ADMIN']}><Configuracion /></ProtectedRoute>
          } />
          <Route path="/auditoria" element={
            <ProtectedRoute rolesPermitidos={['ADMIN']}><Auditoria /></ProtectedRoute>
          } />

        </Route>
      </Routes>
    </Router>
  );
}

export default App;