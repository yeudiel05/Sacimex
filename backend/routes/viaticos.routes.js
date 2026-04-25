const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');

// Guardar nueva solicitud de viáticos
router.post('/', verificarToken, (req, res) => {
    const id_usuario = req.usuario.id;
    const { 
        puesto, jefe_inmediato, departamento, ubicacion, 
        origen, destino, motivo, fecha_salida, fecha_regreso, dias_comision, 
        medio_transporte, monto_alimentos, monto_hospedaje, monto_pasajes, 
        monto_taxis, monto_gasolina, monto_otros, total_solicitado 
    } = req.body;

    // --- SANITIZACIÓN DE DATOS (El escudo protector) ---
    // Si un usuario deja un campo de dinero en blanco en React, lo convertimos a 0 para que MySQL no truene.
    const num = (valor) => parseFloat(valor) || 0;

    const query = `
        INSERT INTO solicitudes_viaticos 
        (id_usuario, puesto, jefe_inmediato, departamento, ubicacion, origen, destino, motivo, fecha_salida, fecha_regreso, dias_comision, medio_transporte, monto_alimentos, monto_hospedaje, monto_pasajes, monto_taxis, monto_gasolina, monto_otros, total_solicitado) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Pasamos los valores numéricos por nuestra función num()
    const values = [
        id_usuario, 
        puesto, jefe_inmediato, departamento, ubicacion, 
        origen, destino, motivo, fecha_salida, fecha_regreso, 
        parseInt(dias_comision) || 0, // Aseguramos que los días sean enteros
        medio_transporte, 
        num(monto_alimentos), 
        num(monto_hospedaje), 
        num(monto_pasajes), 
        num(monto_taxis), 
        num(monto_gasolina), 
        num(monto_otros), 
        num(total_solicitado)
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error("Error MySQL en Viáticos:", err);
            return res.status(500).json({ success: false, message: 'Error al guardar la solicitud en la base de datos.' });
        }
        
        registrarBitacora(id_usuario, 'SOLICITUD_VIATICOS', `Solicitó viáticos por $${num(total_solicitado).toFixed(2)} para viaje a ${destino}`);
        res.json({ success: true, message: 'Solicitud enviada correctamente' });
    });
});

module.exports = router;