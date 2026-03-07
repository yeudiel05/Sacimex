const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

router.get('/', verificarToken, (req, res) => {
    const query = 'SELECT * FROM catalogo_tasas ORDER BY estatus_activo DESC, tasa_anual_esperada DESC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { nombre_tasa, tasa_anual_esperada, porcentaje_penalizacion, descripcion } = req.body;
    const query = 'INSERT INTO catalogo_tasas (nombre_tasa, tasa_anual_esperada, porcentaje_penalizacion, descripcion) VALUES (?, ?, ?, ?)';
    
    db.query(query, [nombre_tasa, tasa_anual_esperada, porcentaje_penalizacion, descripcion], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al crear la tasa.' });
        registrarBitacora(req.usuario.id, 'NUEVA_TASA', `Se creó el producto financiero: ${nombre_tasa} al ${tasa_anual_esperada}%`);
        res.json({ success: true, message: 'Producto financiero creado.' });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { nombre_tasa, tasa_anual_esperada, porcentaje_penalizacion, descripcion } = req.body;
    const query = 'UPDATE catalogo_tasas SET nombre_tasa=?, tasa_anual_esperada=?, porcentaje_penalizacion=?, descripcion=? WHERE id=?';
    
    db.query(query, [nombre_tasa, tasa_anual_esperada, porcentaje_penalizacion, descripcion, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al actualizar.' });
        registrarBitacora(req.usuario.id, 'EDITAR_TASA', `Se actualizó el producto ID ${req.params.id}`);
        res.json({ success: true, message: 'Producto financiero actualizado.' });
    });
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_tasas SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'ESTATUS_TASA', `Producto ID ${req.params.id} cambió a estatus ${estatus_activo}`);
        res.json({ success: true });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    db.query('DELETE FROM catalogo_tasas WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                message: 'No se puede eliminar este producto porque ya tiene contratos activos. Mejor desactívelo.' 
            });
        }
        registrarBitacora(req.usuario.id, 'ELIMINAR_TASA', `Producto financiero ID ${req.params.id} eliminado`);
        res.json({ success: true, message: 'Producto financiero eliminado.' });
    });
});

module.exports = router;