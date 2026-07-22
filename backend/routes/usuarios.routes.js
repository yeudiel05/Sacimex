const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuracion de Multer para subir firmas
const dirFirmas = path.join(__dirname, '../uploads/firmas');
if (!fs.existsSync(dirFirmas)){
    fs.mkdirSync(dirFirmas, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirFirmas),
    filename: (req, file, cb) => cb(null, `firma_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });


// ==========================================
// 1. APIS DE CATALOGO DE PUESTOS
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
        registrarBitacora(req.usuario.id, 'CREAR_PUESTO', `Agrego el puesto: ${nombre}`, req);
        res.json({ success: true, message: 'Puesto agregado exitosamente.' });
    });
});

router.put('/puestos/:id', verificarToken, (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('UPDATE catalogo_puestos SET nombre = ?, departamento_default = ?, nivel_default = ?, rol_default = ?, puede_solicitar_default = ? WHERE id = ?', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_PUESTO', `Modifico el puesto ID ${req.params.id} a: ${nombre}`, req);
        res.json({ success: true, message: 'Puesto actualizado.' });
    });
});

router.put('/puestos/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_puestos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_PUESTO_CATALOGO', `Cambio estatus del puesto ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
        res.json({ success: true });
    });
});

router.delete('/puestos/:id', verificarToken, (req, res) => {
    db.query('DELETE FROM catalogo_puestos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este puesto esta en uso.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_PUESTO', `Elimino un puesto (ID: ${req.params.id})`, req);
        res.json({ success: true, message: 'Puesto eliminado.' });
    });
});


// ==========================================
// 2. RUTAS DE USUARIOS
// ==========================================

// Obtener Lista Completa de Usuarios
router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT u.id as id_usuario, u.username, u.rol, u.estatus_activo, 
               u.puede_solicitar, u.nivel_autorizacion, u.ruta_firma_png AS firma,
               e.puesto, e.departamento, e.unidad_negocio, 
               e.empresa_maestra, e.banco, e.cuenta_bancaria,
               p.id as id_persona, p.nombre_razon_social AS nombre, p.email_contacto AS email, p.telefono
        FROM usuarios u
        INNER JOIN empleados e ON u.id_empleado = e.id_persona
        INNER JOIN personas p ON e.id_persona = p.id
        WHERE p.eliminado = FALSE
        ORDER BY u.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al consultar usuarios.' });
        res.json({ success: true, data: results });
    });
});

// Obtener Expediente Completo de un solo Usuario
router.get('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    
    const query = `
        SELECT 
            u.id AS id_usuario, u.username, u.rol, u.puede_solicitar, u.nivel_autorizacion, u.ruta_firma_png,
            e.id_persona, e.puesto, e.departamento, e.unidad_negocio, e.no_empleado, e.empresa_maestra, e.clave_puesto, e.nivel, e.zona, e.jefe_inmediato, e.banco, e.cuenta_bancaria,
            p.nombre_razon_social, p.telefono, p.email_contacto, p.titulo, p.iniciales
        FROM usuarios u
        LEFT JOIN empleados e ON u.id_empleado = e.id_persona
        LEFT JOIN personas p ON e.id_persona = p.id
        WHERE u.id = ?
    `;
    
    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de servidor.' });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        
        res.json({ success: true, data: results[0] });
    });
});

// Crear Nuevo Usuario
router.post('/', verificarToken, upload.single('firma'), async (req, res) => {
    const { 
        nombre, telefono, email, puesto, departamento, unidad_negocio, username, password, rol, puede_solicitar, nivel_autorizacion,
        titulo, iniciales, no_empleado, empresa_maestra, clave_puesto, nivel, zona, jefe_inmediato, banco, cuenta_bancaria 
    } = req.body;
    
    const rutaFirma = req.file ? `uploads/firmas/${req.file.filename}` : null;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        db.beginTransaction(err => {
            if (err) return res.status(500).json({ success: false, message: 'Error de servidor.' });

            db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, telefono, email_contacto, titulo, iniciales) VALUES ("FISICA", ?, ?, ?, ?, ?)',
                [nombre || '', telefono || '', email || '', titulo || '', iniciales || ''], (err, resultPersona) => {
                    
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD (Personas): ' + err.message }));

                    const idPersona = resultPersona.insertId;

                    db.query('INSERT INTO empleados (id_persona, puesto, departamento, unidad_negocio, fecha_ingreso, no_empleado, empresa_maestra, clave_puesto, nivel, zona, jefe_inmediato, banco, cuenta_bancaria) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?)',
                        [idPersona, puesto || '', departamento || '', unidad_negocio || '', no_empleado || '', empresa_maestra || '', clave_puesto || '', nivel || '', zona || '', jefe_inmediato || '', banco || '', cuenta_bancaria || ''], (err) => {
                            
                            if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD (Empleados): ' + err.message }));

                            db.query('INSERT INTO usuarios (id_empleado, username, password_hash, rol, puede_solicitar, nivel_autorizacion, ruta_firma_png) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [idPersona, username, hashedPassword, rol, puede_solicitar || 0, nivel_autorizacion || 0, rutaFirma], (err) => {
                                    
                                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD (Usuarios): ' + err.message }));

                                    db.commit(err => {
                                        if (err) return db.rollback(() => res.status(500).json({ success: false }));
                                        registrarBitacora(req.usuario.id, 'CREAR_USUARIO', `Se creo el usuario ${username} con rol ${rol}`, req);
                                        res.json({ success: true, message: 'Usuario y firma creados exitosamente.' });
                                    });
                                });
                        });
                });
        });
    } catch (error) {
        console.error("Error al encriptar contrasena:", error);
        return res.status(500).json({ success: false, message: 'Error interno al procesar la contrasena.' });
    }
});

// ================================================================
// EDITAR USUARIO - CORREGIDO (async en la función principal)
// ================================================================
router.put('/:id_usuario', verificarToken, upload.single('firma'), async (req, res) => {
    const { id_usuario } = req.params;
    const { 
        nombre, telefono, email, puesto, departamento, unidad_negocio, username, password, rol, id_persona, puede_solicitar, nivel_autorizacion,
        titulo, iniciales, no_empleado, empresa_maestra, clave_puesto, nivel, zona, jefe_inmediato, banco, cuenta_bancaria 
    } = req.body;
    
    if (!id_persona || id_persona === 'null') {
        return res.status(400).json({ success: false, message: 'ID de persona invalido.' });
    }

    const rutaFirmaNueva = req.file ? `uploads/firmas/${req.file.filename}` : null;

    // Obtenemos el nombre de usuario actual para la bitácora
    db.query('SELECT username FROM usuarios WHERE id = ?', [id_usuario], (errSelect, rowsUsuario) => {
        const nombreUsuarioActual = (rowsUsuario && rowsUsuario.length > 0) ? rowsUsuario[0].username : 'Usuario Desconocido';

        // Movemos el try-catch aquí para manejar el async/await dentro del callback
        (async () => {
            try {
                let hashedPassword = null;
                if (password && password.trim() !== '') {
                    const salt = await bcrypt.genSalt(10);
                    hashedPassword = await bcrypt.hash(password, salt);
                }

                db.beginTransaction(err => {
                    if (err) return res.status(500).json({ success: false });
                    
                    db.query('UPDATE personas SET nombre_razon_social=?, telefono=?, email_contacto=?, titulo=?, iniciales=? WHERE id=?',
                        [nombre || '', telefono || '', email || '', titulo || '', iniciales || '', id_persona], (err) => {
                            if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD Personas: ' + err.message }));

                            db.query('UPDATE empleados SET puesto=?, departamento=?, unidad_negocio=?, no_empleado=?, empresa_maestra=?, clave_puesto=?, nivel=?, zona=?, jefe_inmediato=?, banco=?, cuenta_bancaria=? WHERE id_persona=?',
                                [puesto || '', departamento || '', unidad_negocio || '', no_empleado || '', empresa_maestra || '', clave_puesto || '', nivel || '', zona || '', jefe_inmediato || '', banco || '', cuenta_bancaria || '', id_persona], (err) => {
                                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Error BD Empleados: ' + err.message }));
                                    
                                    let queryUser = 'UPDATE usuarios SET username=?, rol=?, puede_solicitar=?, nivel_autorizacion=?';
                                    let paramsUser = [username, rol, puede_solicitar || 0, nivel_autorizacion || 0];

                                    if (hashedPassword) {
                                        queryUser += ', password_hash=?';
                                        paramsUser.push(hashedPassword);
                                    }
                                    
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
                                            // REGISTRO EN BITACORA - EDITAR USUARIO (usa username)
                                            registrarBitacora(req.usuario.id, 'EDITAR_USUARIO', `Se edito al usuario: ${nombreUsuarioActual}`, req);
                                            res.json({ success: true, message: 'Usuario actualizado correctamente.' });
                                        });
                                    });
                                });
                        });
                });
            } catch (error) {
                console.error("Error al encriptar la nueva contrasena:", error);
                return res.status(500).json({ success: false, message: 'Error interno al actualizar la contrasena.' });
            }
        })();
    });
});

// ================================================================
// CAMBIAR ESTATUS - CORREGIDO
// ================================================================
router.put('/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    
    // Obtenemos el username para la bitácora
    db.query('SELECT username FROM usuarios WHERE id = ?', [req.params.id], (errSelect, rowsUsuario) => {
        const nombreUsuario = (rowsUsuario && rowsUsuario.length > 0) ? rowsUsuario[0].username : 'Usuario Desconocido';
        
        db.query('UPDATE usuarios SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error al cambiar estatus.' });
            
            // REGISTRO EN BITACORA - ESTATUS USUARIO (usa username)
            registrarBitacora(req.usuario.id, 'ESTATUS_USUARIO', `Cambio el estatus del usuario: ${nombreUsuario} a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
            
            res.json({ success: true });
        });
    });
});

// ================================================================
// ELIMINAR USUARIO - CORREGIDO
// ================================================================
router.delete('/:id_persona', verificarToken, (req, res) => {
    const idPersona = req.params.id_persona;
    
    // Obtenemos el nombre de la persona para la bitácora
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [idPersona], (errSelect, rowsPersona) => {
        const nombrePersona = (rowsPersona && rowsPersona.length > 0) ? rowsPersona[0].nombre_razon_social : 'Persona Desconocida';
        
        db.query('UPDATE personas SET eliminado = TRUE WHERE id = ?', [idPersona], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error al eliminar usuario.' });
            
            registrarBitacora(req.usuario.id, 'ELIMINAR_USUARIO', `Elimino (soft delete) al usuario: ${nombrePersona}`, req);
            
            res.json({ success: true });
        });
    });
});

module.exports = router;