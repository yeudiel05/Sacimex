const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken } = require('../middlewares/auth');
const { autorizar } = require('../middlewares/autorizar');
const { puedeFirmarAsync } = require('../utils/motorAutorizacion');

// Pequeño helper para usar db.query (callback) con async/await sin tocar db.js
const queryAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

const formatMoney = (n) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

router.get('/', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O', 'GERENTE', 'DIRECTOR', 'AUXILIAR'), async (req, res) => {
    const notificaciones = [];
    const usuario = req.usuario;
    const rolUsuario = usuario.rol;

    try {
        // ------------------------------------------------------------------
        // 1) Contratos de fondeo por vencer (próximos 30 días)
        // ------------------------------------------------------------------
        const resultadosContratos = await queryAsync(`
            SELECT c.id as contrato_id, c.fecha_fin, p.nombre_razon_social as inversor, c.monto_inicial
            FROM contratos_inversion c
            JOIN inversores i ON c.id_inversor = i.id_persona
            JOIN personas p ON i.id_persona = p.id
            WHERE c.estatus = 'ACTIVO' AND c.fecha_fin BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ORDER BY c.fecha_fin ASC
        `);
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

        // ------------------------------------------------------------------
        // 2) Clientes pendientes de revisión
        // ------------------------------------------------------------------
        const resultadosClientes = await queryAsync(`
            SELECT p.nombre_razon_social as cliente, c.id_persona
            FROM clientes c
            JOIN personas p ON c.id_persona = p.id
            WHERE c.estatus = 'En revision'
        `);
        resultadosClientes.forEach((cli) => {
            notificaciones.push({
                id: `cli_${cli.id_persona}`,
                tipo: 'info',
                titulo: 'Cliente Pendiente ',
                mensaje: `El expediente de ${cli.cliente} requiere tu revisión para ser activado.`,
                fecha: new Date().toISOString()
            });
        });

        // ------------------------------------------------------------------
        // 3) Pagos a proveedores pendientes de firma (Tesorería / Admin)
        // ------------------------------------------------------------------
        if (rolUsuario === 'ADMIN' || rolUsuario === 'TESORERIA') {
            const resPagos = await queryAsync(`SELECT COUNT(*) as total FROM pagos_a_proveedores WHERE estatus = 'PENDIENTE'`);
            if (resPagos[0].total > 0) {
                notificaciones.push({
                    id: `auth_pagos`,
                    tipo: 'urgente',
                    titulo: 'Autorizaciones de Pago ',
                    mensaje: `Tienes ${resPagos[0].total} pago(s) a proveedores esperando tu firma digital.`,
                    fecha: new Date().toISOString()
                });
            }
        }

        // ------------------------------------------------------------------
        // 4) Solicitudes de Recursos: solo las que le toca firmar A ESTE USUARIO
        //    (Visto Bueno por departamento, Revisor, Autorizador 1/2, Tesorería...)
        //    Replica exactamente la misma regla de "me_toca_firmar" que ya usa
        //    GET /solicitudes/pendientes (incluyendo el caso especial de Tesorería
        //    en AUTORIZADO_FINAL), para que la campana y la página de
        //    Autorizaciones siempre muestren lo mismo.
        // ------------------------------------------------------------------
        const solicitudes = await queryAsync(`
            SELECT s.id, s.folio, s.monto, s.nivel_actual, s.estatus, cp.id_area_visto_bueno
            FROM solicitudes_recursos s
            LEFT JOIN conceptos_pago cp ON (
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.clave COLLATE utf8mb4_unicode_ci OR
                s.concepto_id COLLATE utf8mb4_unicode_ci = CAST(cp.id AS CHAR) COLLATE utf8mb4_unicode_ci OR
                s.concepto_id COLLATE utf8mb4_unicode_ci = cp.descripcion COLLATE utf8mb4_unicode_ci
            )
            WHERE s.estatus NOT IN ('PAGADO', 'RECHAZADO') AND s.solicitante_id != ?
        `, [usuario.id]);

        for (const sol of solicitudes) {
            let mostrar = false;
            let etiqueta = null;
            let listaParaPago = false;

            if (usuario.rol === 'ADMIN') {
                mostrar = true;
            } else if (usuario.rol === 'TESORERIA' && sol.estatus === 'AUTORIZADO_FINAL') {
                mostrar = true;
                listaParaPago = true;
            } else if (sol.estatus === 'AUTORIZADO_FINAL') {
                mostrar = false; // ya solo falta que Tesorería/Admin la pague
            } else {
                const resultado = await puedeFirmarAsync({
                    usuario,
                    nivel: sol.nivel_actual,
                    idDepartamentoVoBo: sol.id_area_visto_bueno
                });
                mostrar = resultado.puede;
                etiqueta = resultado.etiqueta;
            }

            if (mostrar) {
                notificaciones.push({
                    id: `sol_${sol.id}`,
                    tipo: 'urgente',
                    titulo: listaParaPago ? 'Solicitud Lista para Pago' : (sol.nivel_actual === -1 ? 'Visto Bueno Requerido' : 'Autorización Requerida'),
                    mensaje: listaParaPago
                        ? `La solicitud folio ${sol.folio} (${formatMoney(sol.monto)}) ya está autorizada y espera que la proceses en Tesorería.`
                        : `La solicitud folio ${sol.folio} (${formatMoney(sol.monto)}) espera tu ${etiqueta || 'autorización'}.`,
                    fecha: new Date().toISOString()
                });
            }
        }

        // ------------------------------------------------------------------
        // 5) Viáticos: solo las que le toca firmar A ESTE USUARIO
        //    (incluye el caso especial de Jefe Inmediato por nombre, igual que /pendientes)
        // ------------------------------------------------------------------
        const viaticos = await queryAsync(`
            SELECT sv.id, sv.nivel_actual, sv.estatus, sv.destino, sv.total_solicitado, sv.jefe_inmediato
            FROM solicitudes_viaticos sv
            WHERE sv.estatus NOT IN ('PAGADO', 'RECIBIDO', 'COMPROBADO', 'RECHAZADO') AND sv.id_usuario != ?
        `, [usuario.id]);

        for (const sol of viaticos) {
            const resultado = await puedeFirmarAsync({ usuario, nivel: sol.nivel_actual, tipoFlujo: 'viaticos' });
            let puede = resultado.puede;
            if (resultado.esJefeNivel) {
                const jefeNombrado = (sol.jefe_inmediato || '').trim().toUpperCase();
                const nombreUsuario = (usuario.nombre_completo || usuario.username || '').trim().toUpperCase();
                puede = !!jefeNombrado && !!nombreUsuario && jefeNombrado === nombreUsuario;
            }
            if (puede) {
                notificaciones.push({
                    id: `via_${sol.id}`,
                    tipo: 'urgente',
                    titulo: 'Viático por Autorizar',
                    mensaje: `Solicitud de viáticos${sol.destino ? ` a ${sol.destino}` : ''} por $${Number(sol.total_solicitado || 0).toLocaleString('es-MX')} (folio #${sol.id}) espera tu autorización.`,
                    fecha: new Date().toISOString()
                });
            }
        }

        res.json({ success: true, data: notificaciones });
    } catch (err) {
        console.error('Error al generar notificaciones:', err);
        res.status(500).json({ success: false, message: 'Error al generar las notificaciones' });
    }
});

module.exports = router;