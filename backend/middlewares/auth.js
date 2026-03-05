const jwt = require('jsonwebtoken');
const db = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'sacimex';

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ success: false, message: 'Acceso denegado.' });

  jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
    if (err) return res.status(401).json({ success: false, message: 'Token expirado.' });
    req.usuario = usuarioDecodificado;
    next();
  });
};

const registrarBitacora = (id_usuario, accion, detalle) => {
  const id = id_usuario || 0;
  const query = 'INSERT INTO BITACORA_AUDITORIA (id_usuario, accion, detalle) VALUES (?, ?, ?)';
  db.query(query, [id, accion, detalle], (err) => { if (err) console.error(err); });
};

module.exports = { verificarToken, registrarBitacora, JWT_SECRET };