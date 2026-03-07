const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prov-' + req.body.id_proveedor + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/autorizaciones/pendientes', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false, message: 'No autorizado' });
    const query = `
        SELECT pp.*, p.nombre_razon_social as proveedor, u.username as solicitante
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        JOIN usuarios u ON pp.id_usuario_solicita = u.id
        WHERE pp.estatus = 'PENDIENTE'
        ORDER BY pp.fecha_solicitud ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.put('/autorizaciones/:id/aprobar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query("UPDATE pagos_a_proveedores SET estatus = 'PAGADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'PAGO_AUTORIZADO', `Autorizó la salida de dinero para el pago ID ${req.params.id}`);
        res.json({ success: true });
    });
});

router.put('/autorizaciones/:id/rechazar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query("UPDATE pagos_a_proveedores SET estatus = 'RECHAZADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'PAGO_RECHAZADO', `Rechazó el pago ID ${req.params.id}`);
        res.json({ success: true });
    });
});

router.get('/', verificarToken, (req, res) => {
    const query = `SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, p.telefono, p.email_contacto AS email, pr.categoria, pr.cuenta_bancaria, pr.banco, pr.dias_credito, pr.estatus_activo FROM PERSONAS p INNER JOIN PROVEEDORES pr ON p.id = pr.id_persona WHERE p.eliminado = FALSE ORDER BY p.id DESC`;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, cuenta_bancaria, banco, dias_credito } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false }));
            const idNuevaPersona = resultPersona.insertId;
            db.query('INSERT INTO PROVEEDORES (id_persona, categoria, cuenta_bancaria, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, 1)', [idNuevaPersona, categoria, cuenta_bancaria, banco, dias_credito || 0], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, cuenta_bancaria, banco, dias_credito } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false }));
            db.query('UPDATE PROVEEDORES SET categoria=?, cuenta_bancaria=?, banco=?, dias_credito=? WHERE id_persona=?', [categoria, cuenta_bancaria, banco, dias_credito, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    db.query('UPDATE PROVEEDORES SET estatus_activo = ? WHERE id_persona = ?', [req.body.estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.get('/:id/pagos', verificarToken, (req, res) => {
    db.query('SELECT * FROM pagos_a_proveedores WHERE id_proveedor = ? ORDER BY fecha_solicitud DESC', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/pagos', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_proveedor, concepto, monto_pago, num_factura_ref } = req.body;
    let url = req.file ? `uploads/${req.file.filename}` : null;
    
    const estatus = req.usuario.rol === 'ADMIN' ? 'PAGADO' : 'PENDIENTE';
    const id_autoriza = req.usuario.rol === 'ADMIN' ? req.usuario.id : null;

    db.query('INSERT INTO pagos_a_proveedores (id_proveedor, id_usuario_solicita, id_usuario_autoriza, monto_pago, concepto, num_factura_ref, url_comprobante_pago, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [id_proveedor, req.usuario.id, id_autoriza, monto_pago, concepto, num_factura_ref, url, estatus], (err) => {
        if (err) return res.status(500).json({ success: false });
        
        if(estatus === 'PAGADO'){
            registrarBitacora(req.usuario.id, 'PAGO_PROVEEDOR', `Registró y autorizó pago directo por $${monto_pago}`);
        } else {
            registrarBitacora(req.usuario.id, 'SOLICITUD_PAGO', `Envió solicitud de pago por $${monto_pago} (Pendiente de Autorizar)`);
        }
        res.json({ success: true, message: estatus === 'PAGADO' ? 'Pago registrado' : 'Solicitud enviada a Director para autorización' });
    });
});

module.exports = router;