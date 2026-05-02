const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// ==========================================
// OBTENER TODOS LOS ROLES ACTIVOS
// ==========================================
router.get('/', verificarToken, (req, res) => {
    // Al usar SELECT *, ya incluimos las nuevas columnas de permisos (perm_usuarios, etc.)
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
    
    // Recibimos el nombre, descripción y las palomitas de la Matriz de Permisos
    const { 
        nombre_rol, 
        descripcion, 
        perm_usuarios, 
        perm_proveedores, 
        perm_viaticos, 
        perm_pagos, 
        perm_reportes 
    } = req.body;
    
    // Limpiamos el texto: Mayúsculas y guiones bajos para el nombre técnico
    const rolFormateado = nombre_rol.toUpperCase().trim().replace(/\s+/g, '_'); 

    // Consulta incluyendo los 5 campos de la matriz
    const query = `
        INSERT INTO catalogo_roles 
        (nombre_rol, descripcion, perm_usuarios, perm_proveedores, perm_viaticos, perm_pagos, perm_reportes, estatus_activo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `;

    // Convertimos los booleanos de React (true/false) a enteros (1/0) para MySQL
    const values = [
        rolFormateado, 
        descripcion, 
        perm_usuarios ? 1 : 0, 
        perm_proveedores ? 1 : 0, 
        perm_viaticos ? 1 : 0, 
        perm_pagos ? 1 : 0, 
        perm_reportes ? 1 : 0
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ success: false, message: 'Este rol ya existe en el sistema.' });
            }
            console.error("Error al crear rol:", err);
            return res.status(500).json({ success: false, message: 'Error interno al crear el rol.' });
        }
        
        registrarBitacora(req.usuario.id, 'CREAR_ROL', `Se creó el rol: ${rolFormateado} con su matriz de permisos.`);
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

    const { 
        nombre_rol, 
        descripcion, 
        perm_usuarios, 
        perm_proveedores, 
        perm_viaticos, 
        perm_pagos, 
        perm_reportes 
    } = req.body;
    
    const rolFormateado = nombre_rol.toUpperCase().trim().replace(/\s+/g, '_');

    // Seguridad: El rol ADMIN (ID 1) debe conservar siempre todos los permisos
    if (req.params.id == 1) {
        return res.status(400).json({ success: false, message: 'Por seguridad, el rol Administrador no puede ser modificado.' });
    }

    const query = `
        UPDATE catalogo_roles 
        SET nombre_rol = ?, 
            descripcion = ?, 
            perm_usuarios = ?, 
            perm_proveedores = ?, 
            perm_viaticos = ?, 
            perm_pagos = ?, 
            perm_reportes = ? 
        WHERE id = ?
    `;

    const values = [
        rolFormateado, 
        descripcion, 
        perm_usuarios ? 1 : 0, 
        perm_proveedores ? 1 : 0, 
        perm_viaticos ? 1 : 0, 
        perm_pagos ? 1 : 0, 
        perm_reportes ? 1 : 0,
        req.params.id
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error al actualizar rol:", err);
            return res.status(500).json({ success: false, message: 'Error al actualizar el rol.' });
        }
        
        registrarBitacora(req.usuario.id, 'EDITAR_ROL', `Se actualizaron los permisos y datos del rol ID ${req.params.id}`);
        res.json({ success: true, message: 'Rol y matriz de permisos actualizados correctamente.' });
    });
});

// ==========================================
// ELIMINAR/DESACTIVAR UN ROL (Solo ADMIN)
// ==========================================
router.delete('/:id', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'No tienes permisos para eliminar roles' });
    }

    if (req.params.id == 1) {
        return res.status(400).json({ success: false, message: 'Seguridad: No se puede eliminar el rol Administrador.' });
    }

    // Borrado lógico
    db.query('UPDATE catalogo_roles SET estatus_activo = 0 WHERE id = ?', [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al intentar eliminar el rol.' });
        
        registrarBitacora(req.usuario.id, 'ELIMINAR_ROL', `Se desactivó el rol ID ${req.params.id}`);
        res.json({ success: true, message: 'Rol eliminado con éxito.' });
    });
});

module.exports = router;