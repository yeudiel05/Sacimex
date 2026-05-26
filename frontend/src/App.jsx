import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/inversores" element={<Inversores />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/auditoria" element={<Auditoria />} />
          <Route path="/autorizaciones" element={<Autorizaciones />} />
          <Route path="/viaticos" element={<Viaticos />} />
          <Route path="/revision-viaticos" element={<RevisionViaticos />} />
          
          {/* Módulo de Solicitudes */}
          <Route path="/solicitudes/nueva" element={<Solicitud />} />
          <Route path="/solicitudes/historial" element={<Historial />} />
          <Route path="/solicitudes/detalle/:id" element={<DetalleSolicitud />} />
          <Route path="/solicitudes/detalle/:id" element={<DetalleSolicitud />} />
          
        </Route>
      </Routes>
    </Router>
  );
}

export default App;