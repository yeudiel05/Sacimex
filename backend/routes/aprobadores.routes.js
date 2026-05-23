const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración para guardar las imágenes de las firmas
const firmasDir = path.join(__dirname, '../uploads/firmas');
if (!fs.existsSync(firmasDir)){
    fs.mkdirSync(firmasDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, firmasDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'firma-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png') { cb(null, true); } 
        else { cb(new Error('Solo se permiten imágenes PNG con fondo transparente')); }
    }
});

// ==========================================
// OBTENER TODOS LOS APROBADORES
// ==========================================
router.get('/', verificarToken, (req, res) => {
    // Solo un ADMIN debería poder ver y gestionar esto
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false, message: 'Acceso denegado' });

    db.query('SELECT * FROM usuarios_aprobadores ORDER BY rol_sistema, nombre_completo', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de base de datos' });
        res.json({ success: true, data: results });
    });
});

// ==========================================
// REGISTRAR NUEVO APROBADOR CON FIRMA
// ==========================================
router.post('/', verificarToken, upload.single('firma_png'), (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });

    const { nombre_completo, puesto, correo, rol_sistema } = req.body;
    let ruta_firma = req.file ? `firmas/${req.file.filename}` : null;

    const query = 'INSERT INTO usuarios_aprobadores (nombre_completo, puesto, correo, rol_sistema, ruta_firma_png) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [nombre_completo, puesto, correo, rol_sistema, ruta_firma], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al guardar el usuario.' });
        registrarBitacora(req.usuario.id, 'CREAR_APROBADOR', `Alta de usuario en matriz de firmas: ${nombre_completo} (${rol_sistema})`);
        res.json({ success: true, message: 'Usuario y firma registrados correctamente.' });
    });
});

// ==========================================
// ACTUALIZAR APROBADOR (Y SU FIRMA SI SE ENVÍA OTRA)
// ==========================================
router.put('/:id', verificarToken, upload.single('firma_png'), (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });

    const { nombre_completo, puesto, correo, rol_sistema } = req.body;
    const { id } = req.params;
    
    let query = 'UPDATE usuarios_aprobadores SET nombre_completo = ?, puesto = ?, correo = ?, rol_sistema = ? WHERE id = ?';
    let params = [nombre_completo, puesto, correo, rol_sistema, id];

    if (req.file) {
        query = 'UPDATE usuarios_aprobadores SET nombre_completo = ?, puesto = ?, correo = ?, rol_sistema = ?, ruta_firma_png = ? WHERE id = ?';
        params = [nombre_completo, puesto, correo, rol_sistema, `firmas/${req.file.filename}`, id];
    }

    db.query(query, params, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al actualizar.' });
        registrarBitacora(req.usuario.id, 'EDITAR_APROBADOR', `Modificó permisos/firma de: ${nombre_completo}`);
        res.json({ success: true, message: 'Perfil actualizado.' });
    });
});

// ==========================================
// ELIMINAR APROBADOR DE LA MATRIZ
// ==========================================
router.delete('/:id', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });

    db.query('DELETE FROM usuarios_aprobadores WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar, el usuario ya ha firmado solicitudes históricas.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_APROBADOR', `Eliminó de la matriz al usuario con ID: ${req.params.id}`);
        res.json({ success: true });
    });
});

module.exports = router;