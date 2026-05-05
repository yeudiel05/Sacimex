const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// ==========================================
// OBTENER TODOS LOS PRODUCTOS FINANCIEROS
// ==========================================
router.get('/', verificarToken, (req, res) => {
    // Traemos todos los campos, incluyendo los nuevos (tipo_producto, cobra_iva)
    const query = 'SELECT * FROM catalogo_tasas ORDER BY estatus_activo DESC, tasa_anual_esperada DESC';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

// ==========================================
// CREAR UN NUEVO PRODUCTO FINANCIERO
// ==========================================
router.post('/', verificarToken, (req, res) => {
    const { nombre_tasa, tipo_producto, tasa_anual_esperada, porcentaje_penalizacion, cobra_iva, descripcion } = req.body;
    
    // Se agregan los campos tipo_producto y cobra_iva a la consulta
    const query = 'INSERT INTO catalogo_tasas (nombre_tasa, tipo_producto, tasa_anual_esperada, porcentaje_penalizacion, cobra_iva, descripcion) VALUES (?, ?, ?, ?, ?, ?)';
    
    db.query(query, [nombre_tasa, tipo_producto, tasa_anual_esperada, porcentaje_penalizacion, cobra_iva, descripcion], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al crear la tasa. Verifica los datos.' });
        registrarBitacora(req.usuario.id, 'NUEVA_TASA', `Se creó el producto de ${tipo_producto}: ${nombre_tasa} al ${tasa_anual_esperada}%`);
        res.json({ success: true, message: 'Producto financiero creado.' });
    });
});

// ==========================================
// EDITAR UN PRODUCTO EXISTENTE
// ==========================================
router.put('/:id', verificarToken, (req, res) => {
    const { nombre_tasa, tipo_producto, tasa_anual_esperada, porcentaje_penalizacion, cobra_iva, descripcion } = req.body;
    
    // Se agregan los campos a la actualización
    const query = 'UPDATE catalogo_tasas SET nombre_tasa=?, tipo_producto=?, tasa_anual_esperada=?, porcentaje_penalizacion=?, cobra_iva=?, descripcion=? WHERE id=?';
    
    db.query(query, [nombre_tasa, tipo_producto, tasa_anual_esperada, porcentaje_penalizacion, cobra_iva, descripcion, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al actualizar el producto.' });
        registrarBitacora(req.usuario.id, 'EDITAR_TASA', `Se actualizó el producto ID ${req.params.id}`);
        res.json({ success: true, message: 'Producto financiero actualizado.' });
    });
});

// ==========================================
// CAMBIAR ESTATUS (ACTIVAR / DESACTIVAR)
// ==========================================
router.put('/:id/estatus', verificarToken, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_tasas SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false });
        registrarBitacora(req.usuario.id, 'ESTATUS_TASA', `Producto ID ${req.params.id} cambió a estatus ${estatus_activo ? 'Activo' : 'Inactivo'}`);
        res.json({ success: true });
    });
});

// ==========================================
// ELIMINAR UN PRODUCTO FINANCIERO
// ==========================================
router.delete('/:id', verificarToken, (req, res) => {
    db.query('DELETE FROM catalogo_tasas WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            // Si el error es por una llave foránea (ER_ROW_IS_REFERENCED), es porque hay contratos activos usando esta tasa
            return res.status(500).json({ 
                success: false, 
                message: 'No se puede eliminar este producto porque ya tiene contratos o clientes activos. Mejor desactívelo para ocultarlo.' 
            });
        }
        registrarBitacora(req.usuario.id, 'ELIMINAR_TASA', `Producto financiero ID ${req.params.id} eliminado`);
        res.json({ success: true, message: 'Producto financiero eliminado exitosamente.' });
    });
});

module.exports = router;