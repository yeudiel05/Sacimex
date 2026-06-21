const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Configuración de Multer para subir firmas ───────────────────────
// Aseguramos que la carpeta exista, si no, se crea automáticamente
const dirFirmas = path.join(__dirname, '../uploads/firmas');
if (!fs.existsSync(dirFirmas)){
    fs.mkdirSync(dirFirmas, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirFirmas),
    filename: (req, file, cb) => cb(null, `firma_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

// ─── RUTAS ───────────────────────────────────────────────────────────

router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT u.id as id_usuario, u.username, u.rol, u.estatus_activo, 
               u.puede_solicitar, u.nivel_autorizacion, u.ruta_firma_png AS firma,
               e.puesto, e.departamento, e.unidad_negocio, 
               p.id as id_persona, p.nombre_razon_social AS nombre, p.email_contacto AS email, p.telefono
        FROM usuarios u
        INNER JOIN empleados e ON u.id_empleado = e.id_persona
        INNER JOIN personas p ON e.id_persona = p.id
        WHERE p.eliminado = FALSE
        ORDER BY u.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// Usamos upload.single('firma') para atrapar la imagen en la creación
router.post('/', verificarToken, upload.single('firma'), async (req, res) => {
    // Ya no extraemos RFC ni fechas del body
    const { nombre, telefono, email, puesto, departamento, unidad_negocio, username, password, rol, puede_solicitar, nivel_autorizacion } = req.body;
    
    // Si se subió un archivo, armamos la ruta
    const rutaFirma = req.file ? `uploads/firmas/${req.file.filename}` : null;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        db.beginTransaction(err => {
            if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });

            // Inserción limpia en Personas sin RFC ni Fechas
            db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, telefono, email_contacto) VALUES ("FISICA", ?, ?, ?)',
                [nombre, telefono, email], (err, resultPersona) => {
                    
                    if (err) {
                        console.error(" Error en Personas:", err.message);
                        return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD (Personas): ' + err.message }));
                    }

                    const idPersona = resultPersona.insertId;

                    // Inserción en Empleados (dejamos CURDATE() por si tu BD exige una fecha de registro por defecto)
                    db.query('INSERT INTO empleados (id_persona, puesto, departamento, unidad_negocio, fecha_ingreso) VALUES (?, ?, ?, ?, CURDATE())',
                        [idPersona, puesto, departamento, unidad_negocio], (err) => {
                            
                            if (err) {
                                console.error("❌ Error en Empleados:", err.message);
                                return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD (Empleados): ' + err.message }));
                            }

                            // Insertamos los permisos y la ruta de la firma en la tabla usuarios
                            db.query('INSERT INTO usuarios (id_empleado, username, password_hash, rol, puede_solicitar, nivel_autorizacion, ruta_firma_png) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [idPersona, username, hashedPassword, rol, puede_solicitar || 0, nivel_autorizacion || 0, rutaFirma], (err) => {
                                    
                                    if (err) {
                                        console.error("❌ Error en Usuarios:", err.message);
                                        return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD (Usuarios): ' + err.message }));
                                    }

                                    db.commit(err => {
                                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                                        registrarBitacora(req.usuario.id, 'CREAR_USUARIO', `Se creó el usuario ${username} con rol ${rol}`);
                                        res.json({ success: true, message: 'Usuario y firma creados exitosamente.' });
                                    });
                                });
                        });
                });
        });
    } catch (error) {
        console.error("Error al encriptar contraseña:", error);
        return res.status(500).json({ success: false, message: 'Error interno al procesar la contraseña.' });
    }
});

// ⚠️ Usamos upload.single('firma') para atrapar la imagen en la edición
router.put('/:id_usuario', verificarToken, upload.single('firma'), async (req, res) => {
    const { id_usuario } = req.params;
    // Eliminamos RFC de la extracción
    const { nombre, telefono, email, puesto, departamento, unidad_negocio, username, password, rol, id_persona, puede_solicitar, nivel_autorizacion } = req.body;

    // Si se subió un nuevo archivo, actualizamos la firma, si no, se queda la que ya estaba en la BD
    const rutaFirmaNueva = req.file ? `uploads/firmas/${req.file.filename}` : null;

    try {
        let hashedPassword = null;
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        db.beginTransaction(err => {
            if (err) return res.status(500).json({ success: false });
            
            // Actualización limpia en Personas
            db.query('UPDATE personas SET nombre_razon_social=?, telefono=?, email_contacto=? WHERE id=?',
                [nombre, telefono, email, id_persona], (err) => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD Personas: ' + err.message }));

                    db.query('UPDATE empleados SET puesto=?, departamento=?, unidad_negocio=? WHERE id_persona=?',
                        [puesto, departamento, unidad_negocio, id_persona], (err) => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD Empleados: ' + err.message }));
                            
                            // Construcción dinámica de la consulta para usuarios
                            let queryUser = 'UPDATE usuarios SET username=?, rol=?, puede_solicitar=?, nivel_autorizacion=?';
                            let paramsUser = [username, rol, puede_solicitar || 0, nivel_autorizacion || 0];

                            if (hashedPassword) {
                                queryUser += ', password_hash=?';
                                paramsUser.push(hashedPassword);
                            }
                            
                            // Si detectamos que mandaron un archivo nuevo, lo agregamos al UPDATE
                            if (rutaFirmaNueva) {
                                queryUser += ', ruta_firma_png=?';
                                paramsUser.push(rutaFirmaNueva);
                            }

                            queryUser += ' WHERE id=?';
                            paramsUser.push(id_usuario);

                            db.query(queryUser, paramsUser, (err) => {
                                if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD Usuarios: ' + err.message }));

                                db.commit(err => {
                                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                                    registrarBitacora(req.usuario.id, 'EDITAR_USUARIO', `Se editó al usuario ID ${id_usuario}`);
                                    res.json({ success: true, message: 'Usuario actualizado correctamente.' });
                                });
                            });
                        });
                });
        });
    } catch (error) {
        console.error("Error al encriptar la nueva contraseña:", error);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la contraseña.' });
    }
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE usuarios SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

router.delete('/:id_persona', verificarToken, (req, res) => {
    db.query('UPDATE personas SET eliminado = TRUE WHERE id = ?', [req.params.id_persona], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE PUESTOS
// ==========================================

router.get('/puestos', verificarToken, (req, res) => {
    db.query('SELECT * FROM catalogo_puestos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/puestos', verificarToken, (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('INSERT INTO catalogo_puestos (nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default) VALUES (?, ?, ?, ?, ?)', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El puesto ya existe.' });
        registrarBitacora(req.usuario.id, 'CREAR_PUESTO', `Agregó el puesto: ${nombre}`);
        res.json({ success: true, message: 'Puesto agregado exitosamente.' });
    });
});

router.put('/puestos/:id', verificarToken, (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('UPDATE catalogo_puestos SET nombre = ?, departamento_default = ?, nivel_default = ?, rol_default = ?, puede_solicitar_default = ? WHERE id = ?', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_PUESTO', `Modificó el puesto ID ${req.params.id} a: ${nombre}`);
        res.json({ success: true, message: 'Puesto actualizado.' });
    });
});

router.put('/puestos/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_puestos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true });
    });
});

router.delete('/puestos/:id', verificarToken, (req, res) => {
    db.query('DELETE FROM catalogo_puestos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este puesto está en uso.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_PUESTO', `Eliminó un puesto (ID: ${req.params.id})`);
        res.json({ success: true, message: 'Puesto eliminado.' });
    });
});

module.exports = router;