const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// ==========================================
// OBTENER TODOS LOS ROLES ACTIVOS
// ==========================================
router.get('/', verificarToken, (req, res) => {
    // Todos los usuarios logueados pueden ver la lista de roles (necesario para los selects)
    db.query('SELECT * FROM catalogo_roles WHERE estatus_activo = 1 ORDER BY id ASC', (err, results) => {
        if (err) {
            console.error("Error obteniendo roles:", err);
            return res.status(500).json({ success: false, message: 'Error al obtener los roles' });
        }
        res.json({ success: true, data: results });
    });
});

// ==========================================
// CREAR UN NUEVO ROL (Solo ADMIN)
// ==========================================
router.post('/', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'No tienes permisos para crear roles' });
    }
    
    const { nombre_rol, descripcion } = req.body;
    
    // Limpiamos el texto: Lo pasamos a mayúsculas y cambiamos espacios por guiones bajos
    const rolFormateado = nombre_rol.toUpperCase().trim().replace(/\s+/g, '_'); 

    db.query('INSERT INTO catalogo_roles (nombre_rol, descripcion) VALUES (?, ?)', [rolFormateado, descripcion], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: 'Este rol ya existe en el sistema.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno al crear el rol.' });
        }
        
        registrarBitacora(req.usuario.id, 'CREAR_ROL', `Se creó el nuevo rol: ${rolFormateado}`);
        res.json({ success: true, message: 'Rol creado con éxito.' });
    });
});

// ==========================================
// EDITAR UN ROL (Solo ADMIN)
// ==========================================
router.put('/:id', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'No tienes permisos para editar roles' });
    }

    const { nombre_rol, descripcion } = req.body;
    const rolFormateado = nombre_rol.toUpperCase().trim().replace(/\s+/g, '_');

    // Evitamos que editen el rol de ADMIN por seguridad (ID 1)
    if (req.params.id == 1 && rolFormateado !== 'ADMIN') {
        return res.status(400).json({ success: false, message: 'No puedes cambiar el nombre del rol Administrador Principal.' });
    }

    db.query('UPDATE catalogo_roles SET nombre_rol = ?, descripcion = ? WHERE id = ?', [rolFormateado, descripcion, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al actualizar el rol.' });
        
        registrarBitacora(req.usuario.id, 'EDITAR_ROL', `Se actualizaron los datos del rol ID ${req.params.id}`);
        res.json({ success: true, message: 'Rol actualizado correctamente.' });
    });
});

// ==========================================
// ELIMINAR/DESACTIVAR UN ROL (Solo ADMIN)
// ==========================================
router.delete('/:id', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar roles' });
    }

    // Candado de seguridad vital: Nadie puede borrar el rol ADMIN (ID 1)
    if (req.params.id == 1) {
        return res.status(400).json({ success: false, message: 'Seguridad: No se puede eliminar el rol Administrador.' });
    }

    // Borrado lógico (lo desactivamos en lugar de borrarlo por completo)
    db.query('UPDATE catalogo_roles SET estatus_activo = 0 WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al intentar eliminar el rol.' });
        
        registrarBitacora(req.usuario.id, 'ELIMINAR_ROL', `Se desactivó el rol ID ${req.params.id}`);
        res.json({ success: true, message: 'Rol eliminado con éxito.' });
    });
});

module.exports = router;