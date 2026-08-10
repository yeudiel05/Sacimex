// backend/middlewares/logAccesos.js
// Registra CADA petición al API en bitacora_accesos (quién, qué ruta,
// método, IP, código de respuesta, duración exacta con milisegundos).
// Se aplica globalmente con app.use('/api', logAccesos).

const db = require('../db');

function logAccesos(req, res, next) {
  const inicio = Date.now();

  res.on('finish', () => {
    const duracion    = Date.now() - inicio;
    const idUsuario   = req.usuario?.id   || null;
    const username    = req.usuario?.username || 'ANONIMO';
    const metodo      = req.method;
    const ruta        = req.originalUrl || req.path;
    const statusCode  = res.statusCode;
    const ip          = req.ip || req.headers?.['x-forwarded-for'] || null;
    const fechaMs     = new Date();

    const sql = `
      INSERT INTO bitacora_accesos
        (id_usuario, usuario, metodo_http, ruta, ip_address, status_code, duracion_ms, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [idUsuario, username, metodo, ruta, ip, statusCode, duracion, fechaMs], (err) => {
      if (err) {
        // Solo loguear error si no es por columnas faltantes (migración pendiente)
        if (err.code !== 'ER_BAD_FIELD_ERROR') {
          console.error('[logAccesos] Error:', err.message);
        }
      }
    });
  });

  next();
}

module.exports = logAccesos;