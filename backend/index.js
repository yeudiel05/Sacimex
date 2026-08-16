require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importar rutas modulares
const authRoutes = require('./routes/auth.routes');
const clientesRoutes = require('./routes/clientes.routes');
const inversoresRoutes = require('./routes/inversores.routes');
const proveedoresRoutes = require('./routes/proveedores.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const tasasRoutes = require('./routes/tasas.routes');
const reportesRoutes = require('./routes/reportes.routes');
const auditoriaRoutes = require('./routes/auditoria.routes');
const notificacionesRoutes = require('./routes/notificaciones.routes');
const backupRoutes = require('./routes/backup.routes');
const rolesRoutes = require('./routes/roles.routes');
const viaticosroutes = require('./routes/viaticos.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const unidadesRoutes = require('./routes/unidades.routes');
const tabuladorRoutes = require('./routes/tabulador.routes');
const configuracionRoutes = require('./routes/configuracion.routes');
const logAccesos = require('./middlewares/logAccesos');

const app = express();

// Necesario para que req.ip / X-Forwarded-For reflejen la IP real del cliente
// cuando la app corre detras de un reverse proxy (Plesk, Nginx, Apache).
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

// Bitacora tecnica global: registra CADA peticion al API (quien, que ruta,
// metodo, IP, codigo de respuesta y duracion exacta), sin depender de que
// cada endpoint la registre manualmente.
app.use('/api', logAccesos);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
app.use('/uploads', express.static(uploadDir));

app.use('/api', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/inversores', inversoresRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/tasas', tasasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/viaticos', viaticosroutes);
app.use('/api/solicitudes', solicitudesRoutes);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/tabulador-viaticos', tabuladorRoutes);
app.use('/api/configuracion', configuracionRoutes);

// =============================================
// Servir el frontend (React + Vite) en produccion
// =============================================
// El build de Vite vive en ../frontend/dist relativo a este archivo
// (es decir: httpdocs/frontend/dist en el servidor)
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  // Catch-all: cualquier ruta GET que no sea /api o /uploads,
  // regresa el index.html de React (para que funcione el ruteo de React Router).
  // Se usa app.use() en vez de app.get('*', ...) porque Express 5 cambio
  // la sintaxis de rutas comodin y '*' ya no funciona igual.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  console.warn('Aviso: no se encontro frontend/dist. Corre "npm run build" en la carpeta frontend.');
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor Backend modular corriendo en el puerto ${PORT}`);
});