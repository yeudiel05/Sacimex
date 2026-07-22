const jwt = require('jsonwebtoken'); // <-- Importante, necesitamos la librería de JWT
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'sacimex';

const verificarToken = (req, res, next) => {
  // 1. Recibimos el token del encabezado que manda React
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Si no hay token, bloqueamos el paso
  if (!token) {
      return res.status(403).json({ success: false, message: 'No enviaste token de seguridad' });
  }

  // 2. Desencriptamos el token con la palabra secreta
  jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
      if (err) {
          return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
      }
      
      // 3. ¡LA MAGIA REAL! Le pasamos al sistema la identidad VERDADERA del usuario
      req.usuario = usuarioDecodificado; 
      next(); // Lo dejamos pasar a la ruta
  });
};

// Obtiene la IP real del cliente, incluso detrás de un reverse proxy (Plesk/Nginx/Apache).
// Requiere que en index.js se configure app.set('trust proxy', true).
const obtenerIP = (req) => {
  if (!req) return null;
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress) || null;
};

// Cache en memoria: ¿la tabla bitacora_auditoria ya tiene las columnas nuevas?
// null = todavía no se sabe, true/false = resultado ya verificado.
let columnasExtendidasDisponibles = null;
db.query("SHOW COLUMNS FROM bitacora_auditoria LIKE 'ip_address'", (err, rows) => {
  columnasExtendidasDisponibles = !err && rows && rows.length > 0;
  if (!columnasExtendidasDisponibles) {
    console.warn('[bitacora] La tabla bitacora_auditoria aún no tiene las columnas ip_address/metodo_http/ruta. ' +
      'La IP y ruta exacta se seguirán guardando dentro del texto de "detalle" hasta que corras la migración SQL.');
  }
});

/**
 * Registra un evento en la bitácora de auditoría.
 *
 * IMPORTANTE (diseño simple-pero-completo): el texto de "detalle" que ve
 * cualquier persona en la pantalla de Auditoría se queda tal cual lo manda
 * cada ruta (una frase clara en español, ej. "El usuario treyes inició
 * sesión"), SIN mezclar IP, método HTTP ni rutas técnicas — eso confunde a
 * alguien que no es de sistemas (un director general, por ejemplo).
 *
 * El detalle técnico completo (IP, método, ruta, hora exacta con
 * milisegundos) NO se pierde: se guarda aparte, en columnas propias
 * (ip_address, metodo_http, ruta) que la pantalla puede mostrar de forma
 * opcional/expandible para quien sí lo necesite (soporte técnico, IT).
 *
 * @param {number} id_usuario - id del usuario que ejecuta la acción (0/falsy = anónimo/sistema)
 * @param {string} accion - código corto de la acción (ej. 'LOGIN', 'CREAR_CLIENTE')
 * @param {string} detalle - descripción legible del evento, en español simple
 * @param {import('express').Request} [req] - request de Express (opcional, para IP/ruta/hora exacta)
 */
const registrarBitacora = (id_usuario, accion, detalle, req) => {
  const id = id_usuario || null; // null, no 0: la FK a usuarios(id) rechaza un id inexistente
  const ahora = new Date();
  const ip = obtenerIP(req);
  const metodo = req ? req.method : null;
  const ruta = req ? req.originalUrl : null;

  const insertarClasico = () => {
    // Sin las columnas nuevas todavía: al menos dejamos la IP, en español
    // simple, para no perder ese dato mientras se corre la migración SQL.
    const detalleSimple = ip ? `${detalle} (conectado desde ${ip})` : detalle;
    const query = 'INSERT INTO bitacora_auditoria (id_usuario, accion, detalle, fecha) VALUES (?, ?, ?, ?)';
    db.query(query, [id, accion, detalleSimple, ahora], (err) => {
      if (err) console.error('Error en bitácora:', err);
    });
  };

  if (columnasExtendidasDisponibles === false) {
    insertarClasico();
    return;
  }

  const queryExtendido = `INSERT INTO bitacora_auditoria (id_usuario, accion, detalle, fecha, ip_address, metodo_http, ruta)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.query(queryExtendido, [id, accion, detalle, ahora, ip, metodo, ruta], (err) => {
    if (err) {
      // Todavía no se corrió la migración SQL: caemos al formato clásico sin perder el registro.
      columnasExtendidasDisponibles = false;
      insertarClasico();
    }
  });
};

module.exports = { verificarToken, registrarBitacora, JWT_SECRET, obtenerIP };