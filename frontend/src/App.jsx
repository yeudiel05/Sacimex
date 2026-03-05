import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Clientes from './pages/Clientes/Clientes';
import Inversores from './pages/Inversores/Inversores';
import Proveedores from './pages/Proveedores/Proveedores';
import Layout from './components/Layout/Layout';

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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;