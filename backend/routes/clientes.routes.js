const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de Multer para archivos de clientes
const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.body.id_persona + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/', verificarToken, (req, res) => {
    const query = `
    SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, 
           p.telefono, p.email_contacto AS email, c.limite_credito AS credito, c.estatus, 
           c.tipo_garantia, c.nombre_aval, c.kyc_validado
    FROM PERSONAS p INNER JOIN CLIENTES c ON p.id = c.id_persona
    WHERE p.eliminado = FALSE ORDER BY p.id DESC
  `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, credito, tipo_garantia, nombre_aval } = req.body;
    if (!telefono || telefono.length !== 10) return res.status(400).json({ success: false, message: 'Teléfono inválido' });

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)',
            [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Posible RFC duplicado' }));
                const idNuevaPersona = resultPersona.insertId;
                db.query('INSERT INTO CLIENTES (id_persona, limite_credito, estatus, tipo_garantia, nombre_aval) VALUES (?, ?, ?, ?, ?)',
                    [idNuevaPersona, credito, 'En revision', tipo_garantia || 'Ninguna', nombre_aval || ''], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        db.commit(err => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false }));
                            registrarBitacora(req.usuario.id, 'CREAR_CLIENTE', `Cliente registrado ID ${idNuevaPersona}`);
                            res.json({ success: true, message: 'Cliente registrado' });
                        });
                    });
            });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, credito, tipo_garantia, nombre_aval } = req.body;
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false });
        db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?',
            [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false }));
                db.query('UPDATE CLIENTES SET limite_credito=?, tipo_garantia=?, nombre_aval=? WHERE id_persona=?',
                    [credito, tipo_garantia, nombre_aval, id], (err) => {
                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                        db.commit(err => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false }));
                            registrarBitacora(req.usuario.id, 'EDITAR_CLIENTE', `Editó cliente ID ${id}`);
                            res.json({ success: true, message: 'Cliente actualizado' });
                        });
                    });
            });
    });
});

router.put('/:id_persona/estatus', verificarToken, (req, res) => {
    const { id_persona } = req.params;
    const { estatus } = req.body;
    db.query('UPDATE CLIENTES SET estatus = ? WHERE id_persona = ?', [estatus, id_persona], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Estatus de ID ${id_persona} a ${estatus}`);
        res.json({ success: true });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'BORRADO_LOGICO', `Cliente ID ${id} eliminado`);
        res.json({ success: true });
    });
});

// Rutas de Expedientes
router.post('/expedientes/upload', verificarToken, upload.single('archivo'), (req, res) => {
    const { id_persona, tipo_documento } = req.body;
    if (!req.file) return res.status(400).json({ success: false });
    const rutaArchivo = `uploads/${req.file.filename}`;
    db.query('INSERT INTO EXPEDIENTES_CLIENTES (id_persona, nombre_archivo, ruta_archivo, tipo_documento) VALUES (?, ?, ?, ?)',
        [id_persona, req.file.originalname, rutaArchivo, tipo_documento], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'SUBIR_DOCUMENTO', `Documento a ID ${id_persona}`);
            res.json({ success: true, message: 'Archivo subido' });
        });
});

router.get('/expedientes/:id_persona', verificarToken, (req, res) => {
    db.query('SELECT * FROM EXPEDIENTES_CLIENTES WHERE id_persona = ? ORDER BY fecha_subida DESC', [req.params.id_persona], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.delete('/expedientes/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    db.query('SELECT ruta_archivo FROM EXPEDIENTES_CLIENTES WHERE id = ?', [id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const rutaFisica = path.join(__dirname, '../', results[0].ruta_archivo);
        db.query('DELETE FROM EXPEDIENTES_CLIENTES WHERE id = ?', [id], (err2) => {
            if (err2) return res.status(500).json({ success: false });
            if (fs.existsSync(rutaFisica)) fs.unlinkSync(rutaFisica);
            registrarBitacora(req.usuario.id, 'ELIMINAR_DOCUMENTO', `Documento ID ${id} eliminado`);
            res.json({ success: true });
        });
    });
});

module.exports = router;