const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken } = require('../middlewares/auth');

router.get('/stats', verificarToken, (req, res) => {
  const stats = {};
  db.query("SELECT COUNT(*) AS total FROM clientes WHERE estatus = 'Activo'", (err, cl) => {
    if (err) return res.status(500).json({ success: false });
    stats.clientesActivos = cl[0].total;
    db.query("SELECT COUNT(*) AS total FROM inversores WHERE estatus_activo = 1", (err, inv) => {
      stats.inversoresActivos = inv[0].total;
      db.query("SELECT SUM(monto_inicial) AS total_capital FROM contratos_inversion WHERE estatus = 'ACTIVO'", (err, cap) => {
        stats.capitalActivo = cap[0].total_capital || 0;
        db.query("SELECT COUNT(*) AS total FROM proveedores WHERE estatus_activo = 1", (err, prov) => {
          stats.proveedoresActivos = prov[0].total;
          db.query("SELECT accion, detalle, fecha FROM bitacora_auditoria ORDER BY fecha DESC LIMIT 6", (err, bitacora) => {
            stats.actividadReciente = bitacora;
            res.json({ success: true, data: stats });
          });
        });
      });
    });
  });
});

module.exports = router;