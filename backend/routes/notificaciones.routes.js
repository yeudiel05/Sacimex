const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken } = require('../middlewares/auth');

router.get('/', verificarToken, (req, res) => {
    const notificaciones = [];

    const queryContratos = `
        SELECT c.id as contrato_id, c.fecha_fin, p.nombre_razon_social as inversor, c.monto_inicial
        FROM contratos_inversion c
        JOIN inversores i ON c.id_inversor = i.id_persona
        JOIN personas p ON i.id_persona = p.id
        WHERE c.estatus = 'ACTIVO' AND c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        ORDER BY c.fecha_fin ASC
    `;

    db.query(queryContratos, (err, resultadosContratos) => {
        if (!err && resultadosContratos.length > 0) {
            resultadosContratos.forEach(c => {
                const dias = Math.ceil((new Date(c.fecha_fin) - new Date()) / (1000 * 60 * 60 * 24));
                notificaciones.push({
                    id: `cont_${c.contrato_id}`,
                    tipo: 'urgente',
                    titulo: 'Contrato por Vencer ',
                    mensaje: `El contrato de ${c.inversor} por $${Number(c.monto_inicial).toLocaleString('es-MX')} vence en ${dias} días.`,
                    fecha: c.fecha_fin
                });
            });
        }

        const queryClientes = `
            SELECT p.nombre_razon_social as cliente, c.id_persona
            FROM clientes c
            JOIN personas p ON c.id_persona = p.id
            WHERE c.estatus = 'En revision'
        `;

        db.query(queryClientes, (err, resultadosClientes) => {
            if (!err && resultadosClientes.length > 0) {
                resultadosClientes.forEach((cli) => {
                    notificaciones.push({
                        id: `cli_${cli.id_persona}`,
                        tipo: 'info',
                        titulo: 'Cliente Pendiente ',
                        mensaje: `El expediente de ${cli.cliente} requiere tu revisión para ser activado.`,
                        fecha: new Date().toISOString()
                    });
                });
            }

            const queryPagos = `SELECT COUNT(*) as total FROM pagos_a_proveedores WHERE estatus = 'PENDIENTE'`;
            db.query(queryPagos, (err, resPagos) => {
                if (!err && resPagos[0].total > 0) {
                    notificaciones.push({
                        id: `auth_pagos`,
                        tipo: 'urgente',
                        titulo: 'Autorizaciones de Pago ',
                        mensaje: `Tienes ${resPagos[0].total} pago(s) a proveedores esperando tu firma digital.`,
                        fecha: new Date().toISOString()
                    });
                }

                res.json({ success: true, data: notificaciones });
            });
        });
    });
});

module.exports = router;