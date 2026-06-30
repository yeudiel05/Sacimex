const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken } = require('../middlewares/auth');

router.get('/stats', verificarToken, async (req, res) => {
    try {
        // --- FUNCIÓN HELPER PARA USAR ASYNC/AWAIT CON MYSQL ---
        const dbQuery = (query, params = []) => {
            return new Promise((resolve, reject) => {
                db.query(query, params, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
        };

        const añoActual = new Date().getFullYear();

        // Ejecutamos las consultas en paralelo uniendo con la tabla PERSONAS (p.eliminado = 0)
        const [
            clientes, 
            fondeadores, 
            proveedores, 
            pagosPendientes,
            graficaFondeos,
            graficaColocacion,
            actividadReciente
        ] = await Promise.all([
            // 1. Total de Clientes (Excluye los eliminados lógicamente)
            dbQuery(`
                SELECT COUNT(c.id_persona) AS total, SUM(c.limite_credito) AS capital_colocado 
                FROM clientes c 
                JOIN personas p ON c.id_persona = p.id 
                WHERE c.estatus = 'Activo' AND p.eliminado = 0
            `),
            
            // 2. Total de Fondeadores (Excluye los eliminados en la tabla personas)
            dbQuery(`
                SELECT COUNT(i.id_persona) AS total 
                FROM inversores i 
                JOIN personas p ON i.id_persona = p.id 
                WHERE i.estatus_activo = 1 AND p.eliminado = 0
            `),
            
            // 3. Proveedores Activos (Excluye los eliminados)
            dbQuery(`
                SELECT COUNT(pr.id_persona) AS total 
                FROM proveedores pr 
                JOIN personas p ON pr.id_persona = p.id 
                WHERE pr.estatus_activo = 1 AND p.eliminado = 0
            `),

            // 4. Pagos por Autorizar
            dbQuery(`
                SELECT COUNT(id) AS total, SUM(monto_pago) AS monto_pendiente 
                FROM pagos_a_proveedores 
                WHERE estatus IN ('PENDIENTE_VALIDACION', 'PENDIENTE_AUTORIZACION')
            `),

            // 5. Gráfica: Crecimiento de Fondeo por Mes (Año Actual) - Asegurando que el fondeador no esté eliminado
            dbQuery(`
                SELECT MONTH(c.fecha_inicio) as mes, SUM(c.monto_inicial) as total
                FROM contratos_inversion c
                JOIN personas p ON c.id_inversor = p.id
                WHERE YEAR(c.fecha_inicio) = ? AND c.estatus = 'ACTIVO' AND p.eliminado = 0
                GROUP BY MONTH(c.fecha_inicio)
                ORDER BY mes ASC
            `, [añoActual]),

            // 6. Gráfica: Nuevos Clientes
            dbQuery(`
                SELECT MONTH(fecha) as mes, COUNT(id) as total_nuevos
                FROM bitacora_auditoria
                WHERE YEAR(fecha) = ? AND accion = 'CREAR_CLIENTE'
                GROUP BY MONTH(fecha)
                ORDER BY mes ASC
            `, [añoActual]),

            // 7. Bitácora de Actividad Reciente
            dbQuery(`
                SELECT b.id, b.accion, b.detalle, b.fecha, 
                       IFNULL(u.username, 'SISTEMA') as usuario
                FROM bitacora_auditoria b
                LEFT JOIN usuarios u ON b.id_usuario = u.id
                ORDER BY b.fecha DESC 
                LIMIT 6
            `)
        ]);

        // Obtenemos el capital activo total (solo de fondeadores que no están eliminados)
        const capitalAct = await dbQuery(`
            SELECT SUM(c.monto_inicial) AS total_capital 
            FROM contratos_inversion c
            JOIN personas p ON c.id_inversor = p.id
            WHERE c.estatus = 'ACTIVO' AND p.eliminado = 0
        `);

        // Armamos el objeto JSON final
        const stats = {
            metricas: {
                clientesActivos: clientes[0].total || 0,
                capitalColocado: clientes[0].capital_colocado || 0,
                fondeadoresActivos: fondeadores[0].total || 0,
                capitalActivo: capitalAct[0].total_capital || 0,
                proveedoresActivos: proveedores[0].total || 0,
                pagosPendientesCount: pagosPendientes[0].total || 0,
                pagosPendientesMonto: pagosPendientes[0].monto_pendiente || 0
            },
            graficas: {
                fondeos: graficaFondeos,
                colocacion: graficaColocacion
            },
            actividadReciente: actividadReciente
        };

        res.json({ success: true, data: stats });

    } catch (error) {
        console.error("Error cargando Dashboard:", error);
        res.status(500).json({ success: false, message: 'Error interno al cargar métricas del Dashboard' });
    }
});

module.exports = router;