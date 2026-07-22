// routes/unidades.routes.js

const express = require('express');
const router = express.Router();
const db = require('../db');

const { verificarToken, registrarBitacora } = require('../middlewares/auth');

/**
 * GET - Obtener todas las unidades (Ruta Protegida)
 */
router.get('/', verificarToken, (req, res) => {
    const sql = `
        SELECT *
        FROM unidades_negocio
        ORDER BY id ASC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error al obtener unidades:', err);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener las unidades',
                error: err.message
            });
        }

        res.status(200).json({
            success: true,
            data: results
        });
    });
});

/**
 * POST - Crear nueva unidad (Ruta Protegida)
 */
router.post('/', verificarToken, (req, res) => {
    let { nombre } = req.body;

    nombre = nombre?.trim();

    if (!nombre) {
        return res.status(400).json({
            success: false,
            message: 'El nombre es obligatorio'
        });
    }

    const verificarSql = `
        SELECT id
        FROM unidades_negocio
        WHERE nombre = ?
        LIMIT 1
    `;

    db.query(verificarSql, [nombre], (err, existe) => {
        if (err) {
            console.error('Error al validar unidad:', err);
            return res.status(500).json({
                success: false,
                message: 'Error al validar la unidad',
                error: err.message
            });
        }

        if (existe.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una unidad con ese nombre'
            });
        }

        const insertSql = `
            INSERT INTO unidades_negocio
            (nombre, estatus_activo)
            VALUES (?, 1)
        `;

        db.query(insertSql, [nombre], (err, result) => {
            if (err) {
                console.error('Error al crear unidad:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error al crear la unidad',
                    error: err.message
                });
            }
            
            try {
                registrarBitacora(req.usuario.id, 'CREAR_UNIDAD_NEGOCIO', `Creó la nueva unidad de negocio: ${nombre}`, req);
            } catch (bitErr) {}

            res.status(201).json({
                success: true,
                message: 'Unidad creada correctamente',
                id: result.insertId
            });
        });
    });
});

/**
 * PUT - Actualizar unidad (Ruta Protegida)
 */
router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    let { nombre } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID inválido'
        });
    }

    nombre = nombre?.trim();

    if (!nombre) {
        return res.status(400).json({
            success: false,
            message: 'El nombre es obligatorio'
        });
    }

    const validarDuplicadoSql = `
        SELECT id
        FROM unidades_negocio
        WHERE nombre = ?
        AND id <> ?
        LIMIT 1
    `;

    db.query(validarDuplicadoSql, [nombre, id], (err, existe) => {
        if (err) {
            console.error('Error al validar duplicados:', err);
            return res.status(500).json({
                success: false,
                message: 'Error al validar la unidad',
                error: err.message
            });
        }

        if (existe.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una unidad con ese nombre'
            });
        }

        const updateSql = `
            UPDATE unidades_negocio
            SET nombre = ?
            WHERE id = ?
        `;

        db.query(updateSql, [nombre, id], (err, result) => {
            if (err) {
                console.error('Error al actualizar unidad:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error al actualizar la unidad',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Unidad no encontrada'
                });
            }
            
            try {
                registrarBitacora(req.usuario.id, 'EDITAR_UNIDAD_NEGOCIO', `Actualizó el nombre de la unidad ID ${id} a: ${nombre}`, req);
            } catch (bitErr) {}

            res.status(200).json({
                success: true,
                message: 'Unidad actualizada correctamente'
            });
        });
    });
});

/**
 * DELETE - Eliminar unidad (Ruta Protegida)
 */
router.delete('/:id', verificarToken, (req, res) => {
    const { id } = req.params;

    if (isNaN(id)) {
        return res.status(400).json({
            success: false,
            message: 'ID inválido'
        });
    }

    const deleteSql = `
        DELETE FROM unidades_negocio
        WHERE id = ?
    `;

    db.query(deleteSql, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar unidad:', err);
            return res.status(500).json({
                success: false,
                message: 'Error al eliminar la unidad',
                error: err.message
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Unidad no encontrada'
            });
        }
        
        try {
            registrarBitacora(req.usuario.id, 'ELIMINAR_UNIDAD_NEGOCIO', `Eliminó la unidad de negocio ID: ${id}`, req);
        } catch (bitErr) {}

        res.status(200).json({
            success: true,
            message: 'Unidad eliminada correctamente'
        });
    });
});

module.exports = router;