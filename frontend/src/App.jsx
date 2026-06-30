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
const ProtectedRoute = ({ children, rolesPermitidos, deptosPermitidos = [], usuariosPermitidos = [] }) => {
  const token = localStorage.getItem('token');
  
  // LIMPIEZA EXTREMA DEL ROL Y DEPTO
  const rawRole = localStorage.getItem('rol') || '';
  const userRole = rawRole.trim().replace(/\r?\n|\r/g, '').toUpperCase();
  
  const rawDepto = localStorage.getItem('departamento') || '';
  const userDepto = rawDepto.trim().replace(/\r?\n|\r/g, '').toUpperCase();

  // LIMPIEZA FLEXIBLE DEL USERNAME
  const rawUsername = localStorage.getItem('username') || '';
  const currentUsername = rawUsername.trim().toLowerCase();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Comprobaciones
  const tieneRolPermitido = rolesPermitidos && rolesPermitidos.includes(userRole);
  const tieneDeptoPermitido = deptosPermitidos && deptosPermitidos.includes(userDepto);
  
  // Magia: Usamos .some() y .includes() para que detecte el usuario aunque tenga espacios o sufijos
  const tieneUsuarioPermitido = usuariosPermitidos && usuariosPermitidos.some(u => currentUsername.includes(u.toLowerCase()));

  // ================= DEPURACIÓN =================
  console.log("--- RUTAS (App.jsx) ---");
  console.log("Usuario actual intentando entrar:", currentUsername);
  console.log("¿Está en la lista blanca?:", tieneUsuarioPermitido);
  // ==============================================

  if (!tieneRolPermitido && !tieneDeptoPermitido && !tieneUsuarioPermitido) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// ==========================================
//  ENRUTADOR PRINCIPAL (App)
// ==========================================
function App() {
  const rolesGenerales = ['ADMIN', 'CONTADOR', 'ALMACEN', 'AUXILIAR', 'D.H.O', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA'];
  const deptosVistoBueno = ['COORDINACION TI', 'COORDINACION DHO', 'GERENCIA GENERAL', 'DIRECCION'];

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route element={<Layout />}>
          
          <Route path="/dashboard" element={<ProtectedRoute rolesPermitidos={rolesGenerales}><Dashboard /></ProtectedRoute>} />

          <Route path="/clientes" element={
            <ProtectedRoute 
                rolesPermitidos={['ADMIN', 'CONTADOR']} 
                deptosPermitidos={['DIRECCION', 'GERENCIA GENERAL']}
                usuariosPermitidos={['icruz', 'treyes', 'ecruz']}
            >
                <Clientes />
            </ProtectedRoute>
          } />

          <Route path="/inversores" element={<ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR']}><Inversores /></ProtectedRoute>} />
          <Route path="/proveedores" element={<ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR', 'ALMACEN', 'TESORERIA']}><Proveedores /></ProtectedRoute>} />
          <Route path="/solicitudes/nueva" element={<ProtectedRoute rolesPermitidos={rolesGenerales}><Solicitud /></ProtectedRoute>} />
          <Route path="/solicitudes/historial" element={<ProtectedRoute rolesPermitidos={rolesGenerales}><Historial /></ProtectedRoute>} />
          <Route path="/solicitudes/detalle/:id" element={<ProtectedRoute rolesPermitidos={rolesGenerales}><DetalleSolicitud /></ProtectedRoute>} />
          <Route path="/viaticos" element={<ProtectedRoute rolesPermitidos={rolesGenerales}><Viaticos /></ProtectedRoute>} />
          <Route path="/revision-viaticos" element={<ProtectedRoute rolesPermitidos={['D.H.O', 'ADMIN']}><RevisionViaticos /></ProtectedRoute>} />
          <Route path="/autorizaciones" element={<ProtectedRoute rolesPermitidos={['ADMIN', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA']} deptosPermitidos={deptosVistoBueno}><Autorizaciones /></ProtectedRoute>} />
          <Route path="/reportes" element={<ProtectedRoute rolesPermitidos={['ADMIN', 'CONTADOR']}><Reportes /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute rolesPermitidos={['ADMIN']}><Usuarios /></ProtectedRoute>} />
          <Route path="/configuracion" element={<ProtectedRoute rolesPermitidos={['ADMIN']}><Configuracion /></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute rolesPermitidos={['ADMIN']}><Auditoria /></ProtectedRoute>} />

        </Route>
      </Routes>
    </Router>
  );
}

export default App;