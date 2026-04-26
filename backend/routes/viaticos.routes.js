const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, path.join(__dirname, '../uploads')); },
    filename: function (req, file, cb) {
        cb(null, 'viatico-' + req.params.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 1. CREAR NUEVA SOLICITUD
router.post('/', verificarToken, (req, res) => {
    const id_usuario = req.usuario.id;
    const { 
        puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo, fecha_salida, fecha_regreso, dias_comision, 
        medio_transporte, monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado 
    } = req.body;
    const num = (valor) => parseFloat(valor) || 0;

    const query = `INSERT INTO solicitudes_viaticos (id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo, fecha_salida, fecha_regreso, dias_comision, medio_transporte, monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
        id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo, 
        fecha_salida, fecha_regreso, parseInt(dias_comision) || 0, medio_transporte, 
        num(monto_alimentos), num(monto_hospedaje), num(monto_pasajes), num(monto_taxis), num(monto_gasolina), num(monto_otros), num(total_solicitado)
    ];

    db.query(query, values, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al guardar la solicitud' });
        registrarBitacora(id_usuario, 'SOLICITUD_VIATICOS', `Solicitó viáticos por $${num(total_solicitado).toFixed(2)} para ${destino}`);
        res.json({ success: true, message: 'Solicitud enviada correctamente' });
    });
});

// 2. OBTENER
router.get('/mis-solicitudes', verificarToken, (req, res) => {
    db.query('SELECT * FROM solicitudes_viaticos WHERE id_usuario = ? ORDER BY fecha_solicitud DESC', [req.usuario.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// 3. OBTENER TODAS (Para la Bandeja de D.H.O)
router.get('/todas', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN' && req.usuario.rol !== 'D.H.O' && req.usuario.rol !== 'DHO') return res.status(403).json({ success: false, message: 'Acceso denegado' });
    db.query('SELECT sv.*, u.username as solicitante_usuario FROM solicitudes_viaticos sv JOIN usuarios u ON sv.id_usuario = u.id ORDER BY sv.fecha_solicitud DESC', (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// 4. AUTORIZAR / RECHAZAR (Por D.H.O)
router.put('/:id/estatus', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN' && req.usuario.rol !== 'D.H.O' && req.usuario.rol !== 'DHO') return res.status(403).json({ success: false });
    db.query('UPDATE solicitudes_viaticos SET estatus = ? WHERE id = ?', [req.body.estatus, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, `VIATICO_${req.body.estatus}`, `Marcó viático #${req.params.id} como ${req.body.estatus}`);
        res.json({ success: true, message: `Solicitud ${req.body.estatus.toLowerCase()} correctamente.` });
    });
});

// 5. D.H.O SUBE COMPROBANTE DE TRANSFERENCIA
router.post('/:id/comprobante', verificarToken, upload.single('comprobante'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No hay archivo.' });
    const urlArchivo = `uploads/${req.file.filename}`;
    db.query('UPDATE solicitudes_viaticos SET url_comprobante_transferencia = ? WHERE id = ?', [urlArchivo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'COMPROBANTE_TRANSF', `Subió transferencia de viático #${req.params.id}`);
        res.json({ success: true, message: 'Transferencia adjuntada.', url: urlArchivo });
    });
});

// 6. EMPLEADO SUBE SUS FACTURAS DE GASTOS
router.post('/:id/comprobante-gastos', verificarToken, upload.single('comprobante_gastos'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No hay archivo.' });
    const urlArchivo = `uploads/${req.file.filename}`;
    // Al subir gastos, cambiamos el estatus a COMPROBADO
    db.query('UPDATE solicitudes_viaticos SET url_comprobante_gastos = ?, estatus = "COMPROBADO" WHERE id = ? AND id_usuario = ?', [urlArchivo, req.params.id, req.usuario.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'COMPROBACION_GASTOS', `Comprobó gastos del viático #${req.params.id}`);
        res.json({ success: true, message: 'Gastos comprobados con éxito.', url: urlArchivo });
    });
});

module.exports = router;