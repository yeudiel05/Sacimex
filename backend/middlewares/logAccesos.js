const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, obtenerIP } = require('./auth');

// Cache en memoria: ¿ya existe la tabla bitacora_accesos? (se crea con la migración SQL)
let tablaDisponible = null;
db.query("SHOW TABLES LIKE 'bitacora_accesos'", (err, rows) => {
  tablaDisponible = !err && rows && rows.length > 0;
  if (!tablaDisponible) {
    console.warn('[bitacora_accesos] La tabla no existe todavía. Corre la migración SQL ' +
      '(sql/2026_07_ampliar_bitacora.sql) para activar el registro de absolutamente cada petición al API.');
  }
});

/**
 * Middleware GLOBAL de auditoría técnica: registra literalmente CADA petición que llega
 * al API (incluidas lecturas/GET), sin depender de que cada ruta llame a registrarBitacora()
 * manualmente. Es un respaldo para que nunca falte un "quién hizo qué, cuándo y desde dónde",
 * incluso si a futuro se agrega un endpoint nuevo y se olvida loguearlo a mano.
 *
 * Se guarda en una tabla separada (bitacora_accesos) para no saturar la pantalla de
 * Auditoría (bitacora_auditoria), que muestra solo eventos de negocio relevantes.
 */
const logAccesos = (req, res, next) => {
  const inicio = Date.now();

  // Intentamos identificar al usuario aunque el token todavía no haya pasado por verificarToken
  let usuario = 'ANONIMO';
  let idUsuario = null;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      usuario = payload.username || 'DESCONOCIDO';
      idUsuario = payload.id || null;
    } catch (e) {
      usuario = 'TOKEN_INVALIDO_O_EXPIRADO';
    }
  }

  const ip = obtenerIP(req);

  res.on('finish', () => {
    if (tablaDisponible === false) return; // migración no aplicada todavía, no insistimos
    const duracionMs = Date.now() - inicio;
    const ahora = new Date();
    const query = `INSERT INTO bitacora_accesos
      (id_usuario, usuario, metodo_http, ruta, ip_address, status_code, duracion_ms, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(query, [idUsuario, usuario, req.method, req.originalUrl, ip, res.statusCode, duracionMs, ahora], (err) => {
      if (err && tablaDisponible !== false) {
        tablaDisponible = false;
        console.error('[bitacora_accesos] Error al insertar (¿falta correr la migración SQL?):', err.message);
      }
    });
  });

  next();
};

module.exports = logAccesos;