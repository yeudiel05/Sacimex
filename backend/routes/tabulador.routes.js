const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// GET - Todos los destinos del tabulador
router.get('/', verificarToken, (req, res) => {
    db.query('SELECT * FROM tabulador_viaticos ORDER BY destino ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

// POST - Crear nuevo destino
router.post('/', verificarToken, (req, res) => {
    const { destino, hospedaje, alimentos, urban, bus, peaje, gasolina, taxi } = req.body;
    if (!destino?.trim()) return res.status(400).json({ success: false, message: 'El destino es obligatorio' });

    db.query('SELECT id FROM tabulador_viaticos WHERE destino = ? LIMIT 1', [destino.trim()], (err, existe) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (existe.length > 0) return res.status(409).json({ success: false, message: 'Ya existe ese destino' });

        db.query(
            `INSERT INTO tabulador_viaticos (destino, hospedaje, alimentos, urban, bus, peaje, gasolina, taxi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [destino.trim(), hospedaje||0, alimentos||0, urban||0, bus||0, peaje||0, gasolina||0, taxi||0],
            (err, result) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                registrarBitacora(req.usuario.id, 'CREAR_TABULADOR', `Agregó destino: ${destino}`, req);
                res.json({ success: true, message: 'Destino creado', id: result.insertId });
            }
        );
    });
});

// PUT - Actualizar destino
router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { destino, hospedaje, alimentos, urban, bus, peaje, gasolina, taxi, estatus_activo } = req.body;
    if (!destino?.trim()) return res.status(400).json({ success: false, message: 'El destino es obligatorio' });

    db.query('SELECT id FROM tabulador_viaticos WHERE destino = ? AND id <> ? LIMIT 1', [destino.trim(), id], (err, existe) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (existe.length > 0) return res.status(409).json({ success: false, message: 'Ya existe ese destino' });

        db.query(
            `UPDATE tabulador_viaticos SET destino=?, hospedaje=?, alimentos=?, urban=?, bus=?, peaje=?, gasolina=?, taxi=?, estatus_activo=? WHERE id=?`,
            [destino.trim(), hospedaje||0, alimentos||0, urban||0, bus||0, peaje||0, gasolina||0, taxi||0, estatus_activo??1, id],
            (err, result) => {
                if (err) return res.status(500).json({ success: false, message: err.message });
                if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'No encontrado' });
                registrarBitacora(req.usuario.id, 'EDITAR_TABULADOR', `Actualizó destino: ${destino}`, req);
                res.json({ success: true, message: 'Destino actualizado' });
            }
        );
    });
});

// DELETE - Eliminar destino
router.delete('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    db.query('SELECT destino FROM tabulador_viaticos WHERE id = ?', [id], (err, rows) => {
        if (err || !rows.length) return res.status(404).json({ success: false, message: 'No encontrado' });
        db.query('DELETE FROM tabulador_viaticos WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'ELIMINAR_TABULADOR', `Eliminó destino: ${rows[0].destino}`, req);
            res.json({ success: true, message: 'Destino eliminado' });
        });
    });
});

module.exports = router;