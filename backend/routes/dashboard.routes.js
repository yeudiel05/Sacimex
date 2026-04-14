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

        // Ejecutamos las consultas en paralelo para máxima velocidad
        const [
            clientes, 
            fondeadores, 
            proveedores, 
            pagosPendientes,
            graficaFondeos,
            graficaColocacion,
            actividadReciente
        ] = await Promise.all([
            // 1. Total de Clientes y Capital Colocado
            dbQuery("SELECT COUNT(id_persona) AS total, SUM(limite_credito) AS capital_colocado FROM clientes WHERE estatus = 'Activo'"),
            
            // 2. Total de Inversores (Fondeadores) y Capital Captado
            dbQuery("SELECT COUNT(id_persona) AS total FROM inversores WHERE estatus_activo = 1"),
            
            // 3. Proveedores Activos
            dbQuery("SELECT COUNT(id_persona) AS total FROM proveedores WHERE estatus_activo = 1"),

            // 4. Pagos por Autorizar (Dinero atorado en autorizaciones)
            dbQuery("SELECT COUNT(id) AS total, SUM(monto_pago) AS monto_pendiente FROM pagos_a_proveedores WHERE estatus IN ('PENDIENTE_VALIDACION', 'PENDIENTE_AUTORIZACION')"),

            // 5. Gráfica: Crecimiento de Fondeo por Mes (Año Actual)
            dbQuery(`
                SELECT MONTH(fecha_inicio) as mes, SUM(monto_inicial) as total
                FROM contratos_inversion
                WHERE YEAR(fecha_inicio) = ? AND estatus = 'ACTIVO'
                GROUP BY MONTH(fecha_inicio)
                ORDER BY mes ASC
            `, [añoActual]),

            // 6. Gráfica: Nuevos Clientes por Mes (Año Actual)
            dbQuery(`
                SELECT MONTH(fecha) as mes, COUNT(id) as total_nuevos
                FROM bitacora_auditoria
                WHERE YEAR(fecha) = ? AND accion = 'CREAR_CLIENTE'
                GROUP BY MONTH(fecha)
                ORDER BY mes ASC
            `, [añoActual]),

            // 7. Bitácora de Actividad Reciente (Últimos 6 movimientos limpios)
            dbQuery(`
                SELECT b.id, b.accion, b.detalle, b.fecha, 
                       IFNULL(u.username, 'SISTEMA') as usuario
                FROM bitacora_auditoria b
                LEFT JOIN usuarios u ON b.id_usuario = u.id
                ORDER BY b.fecha DESC 
                LIMIT 6
            `)
        ]);

        // Obtenemos el capital activo total aparte para no romper la lógica
        const capitalAct = await dbQuery("SELECT SUM(monto_inicial) AS total_capital FROM contratos_inversion WHERE estatus = 'ACTIVO'");

        // Armamos el objeto JSON final súper ordenado para el Frontend
        const stats = {
            metricas: {
                clientesActivos: clientes[0].total || 0,
                capitalColocado: clientes[0].capital_colocado || 0,
                inversoresActivos: fondeadores[0].total || 0,
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