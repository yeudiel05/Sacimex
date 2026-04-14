const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.body.id_persona + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// OBTENER TODOS LOS CLIENTES
// ==========================================
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

// ==========================================
// CREAR CLIENTE
// ==========================================
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
                            
                            // CORRECCIÓN: Registra el nombre del cliente
                            registrarBitacora(req.usuario.id, 'CREAR_CLIENTE', `Registró al nuevo cliente: ${nombre}`);
                            res.json({ success: true, message: 'Cliente registrado' });
                        });
                    });
            });
    });
});

// ==========================================
// EDITAR CLIENTE
// ==========================================
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
                            
                            // CORRECCIÓN: Registra el nombre del cliente
                            registrarBitacora(req.usuario.id, 'EDITAR_CLIENTE', `Actualizó el expediente de: ${nombre}`);
                            res.json({ success: true, message: 'Cliente actualizado' });
                        });
                    });
            });
    });
});

// ==========================================
// CAMBIAR ESTATUS DEL CLIENTE
// ==========================================
router.put('/:id_persona/estatus', verificarToken, (req, res) => {
    const { id_persona } = req.params;
    const { estatus } = req.body;

    // CORRECCIÓN: Buscamos el nombre para la bitácora
    db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_persona], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const nombreCliente = results[0].nombre_razon_social;

        db.query('UPDATE CLIENTES SET estatus = ? WHERE id_persona = ?', [estatus, id_persona], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Cambió estatus a '${estatus}' para el cliente: ${nombreCliente}`);
            res.json({ success: true });
        });
    });
});

// ==========================================
// ELIMINAR CLIENTE (BORRADO LÓGICO)
// ==========================================
router.delete('/:id', verificarToken, (req, res) => {
    const { id } = req.params;

    // CORRECCIÓN: Buscamos el nombre para la bitácora
    db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const nombreCliente = results[0].nombre_razon_social;

        db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'ELIMINAR_CLIENTE', `Eliminó el expediente del cliente: ${nombreCliente}`);
            res.json({ success: true });
        });
    });
});

// ==========================================
// EXPEDIENTES: SUBIR DOCUMENTO
// ==========================================
router.post('/expedientes/upload', verificarToken, upload.single('archivo'), (req, res) => {
    const { id_persona, tipo_documento } = req.body;
    if (!req.file) return res.status(400).json({ success: false });
    const rutaArchivo = `uploads/${req.file.filename}`;

    // Buscamos el nombre del cliente para la bitácora
    db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_persona], (err, results) => {
        const nombreCliente = (results && results.length > 0) ? results[0].nombre_razon_social : 'Cliente Desconocido';

        db.query('INSERT INTO EXPEDIENTES_CLIENTES (id_persona, nombre_archivo, ruta_archivo, tipo_documento) VALUES (?, ?, ?, ?)',
            [id_persona, req.file.originalname, rutaArchivo, tipo_documento], (err) => {
                if (err) return res.status(500).json({ success: false });
                
                const tipoDocLegible = tipo_documento.replace(/_/g, ' ');
                registrarBitacora(req.usuario.id, 'SUBIR_DOCUMENTO', `Subió un documento (${tipoDocLegible}) al expediente de: ${nombreCliente}`);
                res.json({ success: true, message: 'Archivo subido' });
            });
    });
});

// ==========================================
// EXPEDIENTES: OBTENER DOCUMENTOS
// ==========================================
router.get('/expedientes/:id_persona', verificarToken, (req, res) => {
    db.query('SELECT * FROM EXPEDIENTES_CLIENTES WHERE id_persona = ? ORDER BY fecha_subida DESC', [req.params.id_persona], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// ==========================================
// EXPEDIENTES: ELIMINAR DOCUMENTO
// ==========================================
router.delete('/expedientes/:id', verificarToken, (req, res) => {
    const { id } = req.params;

    // Buscamos la ruta física, el nombre del archivo y el nombre del cliente para la bitácora
    const queryInfo = `
        SELECT e.ruta_archivo, e.nombre_archivo, p.nombre_razon_social 
        FROM EXPEDIENTES_CLIENTES e
        JOIN PERSONAS p ON e.id_persona = p.id
        WHERE e.id = ?
    `;

    db.query(queryInfo, [id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        
        const rutaFisica = path.join(__dirname, '../', results[0].ruta_archivo);
        const nombreDoc = results[0].nombre_archivo;
        const nombreCliente = results[0].nombre_razon_social;

        db.query('DELETE FROM EXPEDIENTES_CLIENTES WHERE id = ?', [id], (err2) => {
            if (err2) return res.status(500).json({ success: false });
            
            // Eliminar el archivo físico del servidor
            if (fs.existsSync(rutaFisica)) fs.unlinkSync(rutaFisica);
            
            registrarBitacora(req.usuario.id, 'ELIMINAR_DOCUMENTO', `Eliminó el documento '${nombreDoc}' del expediente de: ${nombreCliente}`);
            res.json({ success: true });
        });
    });
});

module.exports = router;