// routes/unidades.routes.js

const express = require('express');
const router = express.Router();
const db = require('../db');

const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// GET - Obtener todas las unidades con datos bancarios
router.get('/', verificarToken, (req, res) => {
    db.query(
        `SELECT id, nombre, cuenta_bancaria, banco, clabe, estatus_activo
         FROM unidades_negocio ORDER BY id ASC`,
        (err, results) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.status(200).json({ success: true, data: results });
        }
    );
});

// POST - Crear nueva unidad
router.post('/', verificarToken, (req, res) => {
    let { nombre, cuenta_bancaria, banco, clabe } = req.body;
    nombre = nombre?.trim();
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });

    db.query('SELECT id FROM unidades_negocio WHERE nombre = ? LIMIT 1', [nombre], (err, existe) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (existe.length > 0) return res.status(409).json({ success: false, message: 'Ya existe una unidad con ese nombre' });

        db.query(
            `INSERT INTO unidades_negocio (nombre, cuenta_bancaria, banco, clabe, estatus_activo) VALUES (?, ?, ?, ?, 1)`,
            [nombre, cuenta_bancaria || null, banco || null, clabe || null],
            (err, result) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                try { registrarBitacora(req.usuario.id, 'CREAR_UNIDAD_NEGOCIO', `Creó la unidad: ${nombre}`, req); } catch {}
                res.status(201).json({ success: true, message: 'Unidad creada correctamente', id: result.insertId });
            }
        );
    });
});

// PUT - Actualizar unidad (nombre + datos bancarios)
router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    let { nombre, cuenta_bancaria, banco, clabe } = req.body;
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID inválido' });
    nombre = nombre?.trim();
    if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });

    db.query('SELECT id FROM unidades_negocio WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, id], (err, existe) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (existe.length > 0) return res.status(409).json({ success: false, message: 'Ya existe una unidad con ese nombre' });

        db.query(
            `UPDATE unidades_negocio SET nombre = ?, cuenta_bancaria = ?, banco = ?, clabe = ? WHERE id = ?`,
            [nombre, cuenta_bancaria || null, banco || null, clabe || null, id],
            (err, result) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Unidad no encontrada' });
                try { registrarBitacora(req.usuario.id, 'EDITAR_UNIDAD_NEGOCIO', `Actualizó unidad ID ${id}: ${nombre}`, req); } catch {}
                res.status(200).json({ success: true, message: 'Unidad actualizada correctamente' });
            }
        );
    });
});

// DELETE - Eliminar unidad
router.delete('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'ID inválido' });

    db.query('DELETE FROM unidades_negocio WHERE id = ?', [id], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Unidad no encontrada' });
        try { registrarBitacora(req.usuario.id, 'ELIMINAR_UNIDAD_NEGOCIO', `Eliminó unidad ID: ${id}`, req); } catch {}
        res.status(200).json({ success: true, message: 'Unidad eliminada correctamente' });
    });
});

module.exports = router;