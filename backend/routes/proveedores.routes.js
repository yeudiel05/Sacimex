const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');

const uploadDir = path.join(__dirname, '../uploads');
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prov-' + (req.body.id_proveedor || 'fondeo') + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const uploadExcel = multer({ storage: multer.memoryStorage() });

// ==========================================
// UTILERÍAS GENERALES Y MOTOR FINANCIERO (FIFO)
// ==========================================

function numeroALetras(num) {
    const unidades = ['Cero', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve'];
    const decenas = ['Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciseis', 'Diecisiete', 'Dieciocho', 'Diecinueve'];
    const decenasMultiplos = ['', '', 'Veinte', 'Treinta', 'Cuarenta', 'Cincuenta', 'Sesenta', 'Setenta', 'Ochenta', 'Noventa'];
    const centenas = ['', 'Ciento', 'Doscientos', 'Trescientos', 'Cuatrocientos', 'Quinientos', 'Seiscientos', 'Setecientos', 'Ochocientos', 'Novecientos'];

    function convertirGrupo(n) {
        let texto = '';
        let c = Math.floor(n / 100);
        let d = Math.floor((n % 100) / 10);
        let u = n % 10;
        if (c > 0) { if (c === 1 && d === 0 && u === 0) texto += 'Cien '; else texto += centenas[c] + ' '; }
        if (d === 1) texto += decenas[u] + ' ';
        else if (d > 1) { texto += decenasMultiplos[d] + ' '; if (u > 0) texto += 'y ' + unidades[u] + ' '; } 
        else if (u > 0) { if (u === 1) texto += 'Un '; else texto += unidades[u] + ' '; }
        return texto.trim();
    }

    let enteros = Math.floor(num);
    let centavos = Math.round((num - enteros) * 100);
    let textoFinal = '';

    if (enteros === 0) textoFinal = 'Cero';
    else if (enteros > 999) {
        let miles = Math.floor(enteros / 1000);
        let resto = enteros % 1000;
        if (miles === 1) textoFinal += 'Mil ';
        else textoFinal += convertirGrupo(miles) + ' Mil ';
        if (resto > 0) textoFinal += convertirGrupo(resto);
    } else { textoFinal = convertirGrupo(enteros); }

    return `${textoFinal.toUpperCase()} PESOS ${centavos.toString().padStart(2, '0')}/100 M.N.`;
}

function cleanDateStr(dateVal) {
    if (!dateVal) return new Date().toISOString().split('T')[0];
    try {
        if (typeof dateVal === 'string') return dateVal.split('T')[0];
        if (dateVal instanceof Date) {
            if (isNaN(dateVal.getTime())) return new Date().toISOString().split('T')[0];
            return dateVal.toISOString().split('T')[0];
        }
        return new Date().toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
}

const parseMontoLocal = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    return parseFloat(String(val).replace(/,/g, '')) || 0;
};

function calcularAmortizacionBackend(contratoObj) {
    const m = parseFloat(contratoObj.monto_inicial) || 0;
    const t = parseFloat(contratoObj.tasa_anual_esperada) || 0;
    const tipoReal = String(contratoObj.tipo_amortizacion || 'frances').toLowerCase().trim();
    const cobraIva = contratoObj.cobra_iva === 1;

    let planBaseGuardado = [];
    if (contratoObj.plan_json) {
        try {
            let temp = contratoObj.plan_json;
            while (typeof temp === 'string') temp = JSON.parse(temp);
            if (Array.isArray(temp)) planBaseGuardado = temp;
        } catch (e) {}
    }

    let inyecciones = [];
    if (contratoObj.pagos_irregulares_json) {
        try {
            let temp = contratoObj.pagos_irregulares_json;
            while (typeof temp === 'string') temp = JSON.parse(temp);
            if (Array.isArray(temp)) inyecciones = temp;
        } catch (e) {}
    }

    const tasaAnual = t / 100; const tasaMensual = tasaAnual / 12;
    let saldo = m; let tablaRes = [];

    const fInicioStr = cleanDateStr(contratoObj.fecha_inicio);
    let fechaAnterior = new Date(`${fInicioStr}T12:00:00`);

    let timelineUnificado = [];

    if (tipoReal === 'personalizado' && planBaseGuardado.length > 0) {
        timelineUnificado = planBaseGuardado.map((row, i) => ({
            indexUI: `base_${i}`, numero: row.numero || (i + 1).toString(), fechaStr: cleanDateStr(row.fecha),
            abonoFijo: parseMontoLocal(row.abono), anticipoFijo: parseMontoLocal(row.anticipo), esIrregular: false, excluirDia: false
        }));
    } else {
        const fFinStr = cleanDateStr(contratoObj.fecha_fin);
        let fFin = new Date(`${fFinStr}T12:00:00`);
        if(isNaN(fFin.getTime())) { fFin = new Date(fechaAnterior); fFin.setMonth(fechaAnterior.getMonth() + 12); }
        let plazoMeses = Math.max(1, Math.round((fFin - fechaAnterior) / (1000 * 60 * 60 * 24 * 30.44)));
        if (isNaN(plazoMeses) || plazoMeses < 1) plazoMeses = 12;
        
        let fTemp = new Date(fechaAnterior);
        for(let i=1; i<=plazoMeses; i++){
            fTemp.setMonth(fTemp.getMonth() + 1);
            let capFijo = tipoReal === 'aleman' ? m / plazoMeses : 0;
            timelineUnificado.push({ indexUI: `base_${i}`, numero: i.toString(), fechaStr: fTemp.toISOString().split('T')[0], abonoFijo: capFijo, anticipoFijo: 0, esIrregular: false, excluirDia: false });
        }
    }

    inyecciones.forEach(pago => {
        if (pago.fecha && parseMontoLocal(pago.monto) > 0) {
            timelineUnificado.push({ indexUI: `irreg_${pago.id || Date.now()}`, numero: 'N/A', fechaStr: cleanDateStr(pago.fecha), abonoFijo: 0, anticipoFijo: parseMontoLocal(pago.monto), esIrregular: true, excluirDia: pago.excluirDia === true || pago.excluirDia === 'true' || false });
        }
    });

    timelineUnificado.sort((a,b) => new Date(`${a.fechaStr}T12:00:00`) - new Date(`${b.fechaStr}T12:00:00`));

    let p_frances_meses_restantes = timelineUnificado.filter(r => !r.esIrregular).length;

    timelineUnificado.forEach((row) => {
        let fechaActual = new Date(`${row.fechaStr}T12:00:00`);
        if(isNaN(fechaActual.getTime())) fechaActual = new Date(fechaAnterior);
        
        let diffTime = Math.abs(Date.UTC(fechaActual.getFullYear(), fechaActual.getMonth(), fechaActual.getDate()) - Date.UTC(fechaAnterior.getFullYear(), fechaAnterior.getMonth(), fechaAnterior.getDate()));
        let diasTranscurridos = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
        
        let diasParaInteres = diasTranscurridos;
        if (row.esIrregular && row.excluirDia && diasTranscurridos > 0) {
            diasParaInteres = diasTranscurridos - 1;
        }
        
        let interes = (saldo * tasaAnual / 360) * diasParaInteres;
        let abonoReal = row.abonoFijo;
        
        if (tipoReal === 'frances' && !row.esIrregular && p_frances_meses_restantes > 0) {
            let cuotaPura = (saldo * (tasaMensual / (1 - Math.pow(1 + tasaMensual, -p_frances_meses_restantes))));
            abonoReal = cuotaPura - interes;
            p_frances_meses_restantes--;
        }

        let anticipoReal = row.anticipoFijo;
        let capital = abonoReal + anticipoReal;
        
        if (capital > saldo) {
            capital = saldo;
            if (abonoReal > saldo) { abonoReal = saldo; anticipoReal = 0; } else { anticipoReal = saldo - abonoReal; }
        }
        
        let iva = cobraIva ? (interes * 0.16) : 0;
        let totalPago = capital + interes + iva;
        saldo -= capital; if (saldo < 0.01) saldo = 0;

        tablaRes.push({
            numero: row.numero, 
            pagoTotal: totalPago, 
            fechaPura: fechaActual,
            fechaStr: fechaActual.toISOString().split('T')[0]
        });
        fechaAnterior = new Date(fechaActual);
    });

    return tablaRes;
}

// ==========================================
// REPORTES MAESTROS DE EGRESOS Y GASTOS (CON FIFO Y FILTROS DE LIMPIEZA)
// ==========================================
router.get('/reportes/lista-gastos', verificarToken, (req, res) => {
    const mesFiltro = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const anioFiltro = parseInt(req.query.anio) || new Date().getFullYear();

    // 1. Obtener gastos operativos del mes actual
    const queryOperativos = `
        SELECT 
            s.id, s.fecha_limite_pago AS fecha_recepcion, cp.descripcion AS tipo_gasto,
            COALESCE(pprov.nombre_razon_social, 'Sin Proveedor') AS proveedor,
            s.descripcion AS concepto, s.monto AS monto, 'PENDIENTE' AS estatus_pago,
            'OPERATIVO' AS origen_dato, MONTH(s.fecha_limite_pago) AS mes_origen,
            YEAR(s.fecha_limite_pago) AS anio_origen, NULL AS id_contrato
        FROM solicitudes_recursos s
        LEFT JOIN conceptos_pago cp ON s.concepto_id = cp.clave
        LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
        LEFT JOIN personas pprov ON prov.id_persona = pprov.id
        WHERE s.estatus NOT IN ('PAGADO', 'COMPLETADO', 'RECHAZADO', 'CANCELADO')
        AND (MONTH(s.fecha_limite_pago) = ? AND YEAR(s.fecha_limite_pago) = ?)
    `;

    // 2. Obtener gastos arrastrados
    const queryOperativosArrastrados = `
        SELECT 
            s.id, s.fecha_limite_pago AS fecha_recepcion, cp.descripcion AS tipo_gasto,
            COALESCE(pprov.nombre_razon_social, 'Sin Proveedor') AS proveedor,
            s.descripcion AS concepto, s.monto AS monto, 'PENDIENTE' AS estatus_pago,
            'OPERATIVO' AS origen_dato, MONTH(s.fecha_limite_pago) AS mes_origen,
            YEAR(s.fecha_limite_pago) AS anio_origen, NULL AS id_contrato
        FROM solicitudes_recursos s
        LEFT JOIN conceptos_pago cp ON s.concepto_id = cp.clave
        LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
        LEFT JOIN personas pprov ON prov.id_persona = pprov.id
        WHERE s.estatus NOT IN ('PAGADO', 'COMPLETADO', 'RECHAZADO', 'CANCELADO')
        AND (YEAR(s.fecha_limite_pago) < ? OR (YEAR(s.fecha_limite_pago) = ? AND MONTH(s.fecha_limite_pago) < ?))
    `;

    Promise.all([
        new Promise((resolve, reject) => {
            db.query(queryOperativos, [mesFiltro, anioFiltro], (err, results) => {
                if (err) reject(err); else resolve(results);
            });
        }),
        new Promise((resolve, reject) => {
            db.query(queryOperativosArrastrados, [anioFiltro, anioFiltro, mesFiltro], (err, results) => {
                if (err) reject(err); else resolve(results);
            });
        })
    ]).then(([operativosActuales, operativosArrastrados]) => {
        
        const queryFondeadores = `
            SELECT 
                ci.id AS id_contrato, ci.plan_json, ci.pagos_irregulares_json, 
                ci.monto_inicial, ci.fecha_inicio, ci.fecha_fin, ci.tipo_amortizacion, ci.numero_disposicion,
                t.tasa_anual_esperada, t.cobra_iva, p.nombre_razon_social AS proveedor,
                COALESCE((
                    SELECT SUM(monto) FROM movimientos_inversion mi 
                    WHERE mi.id_contrato = ci.id AND (mi.tipo = 'PAGO_INTERES' OR mi.tipo = 'DEPOSITO') AND mi.estatus_movimiento = 'COMPLETADO'
                ), 0) AS total_pagado
            FROM contratos_inversion ci
            JOIN inversores i ON ci.id_inversor = i.id_persona
            JOIN personas p ON i.id_persona = p.id
            JOIN catalogo_tasas t ON ci.id_tasa = t.id
            WHERE ci.estatus = 'ACTIVO' AND p.eliminado = FALSE AND i.estatus_activo = 1
        `;

        db.query(queryFondeadores, (err2, resContratos) => {
            if (err2) return res.status(500).json({ success: false, message: 'Error DB Fondeadores' });

            let fondeadoresActuales = [];
            let fondeadoresArrastrados = [];

            resContratos.forEach(contrato => {
                let bolsaTotal = parseFloat(contrato.total_pagado) || 0;
                const tabla = calcularAmortizacionBackend(contrato);

                tabla.forEach(pago => {
                    if (pago.pagoTotal > 0.01) {
                        if (bolsaTotal >= pago.pagoTotal - 0.5) {
                            pago.pagado = true;
                            bolsaTotal -= pago.pagoTotal;
                        } else {
                            pago.pagado = false;
                        }
                    } else {
                        pago.pagado = true;
                    }
                });

                tabla.forEach(pago => {
                    if (pago.pagoTotal <= 0.01 || pago.pagado) return; 

                    const mesEvt = pago.fechaPura.getMonth() + 1;
                    const anioEvt = pago.fechaPura.getFullYear();
                    
                    const pagoItem = {
                        id_contrato: contrato.id_contrato,
                        fecha_recepcion: pago.fechaStr,
                        tipo_gasto: pago.numero === 'N/A' ? 'RETIRO / PAGO ESPECIAL' : 'PAGOS INTERES DE CRED',
                        proveedor: contrato.proveedor,
                        concepto: pago.numero === 'N/A' ? `Inyección a Capital Disp. ${contrato.numero_disposicion || 'S/N'}` : `Pago Rendimiento (Cuota ${pago.numero}) Disp. ${contrato.numero_disposicion || 'S/N'}`,
                        monto: pago.pagoTotal,
                        estatus_pago: 'PENDIENTE',
                        origen_dato: 'FONDEADOR',
                        mes_origen: mesEvt,
                        anio_origen: anioEvt
                    };

                    if (mesEvt === mesFiltro && anioEvt === anioFiltro) {
                        fondeadoresActuales.push(pagoItem);
                    } else if (anioEvt < anioFiltro || (anioEvt === anioFiltro && mesEvt < mesFiltro)) {
                        fondeadoresArrastrados.push(pagoItem);
                    }
                });
            });

            const gastosActuales = [...operativosActuales, ...fondeadoresActuales];
            const gastosArrastrados = [...operativosArrastrados, ...fondeadoresArrastrados];
            
            const dataFinal = [...gastosArrastrados, ...gastosActuales].sort((a, b) => {
                const fechaA = a.fecha_recepcion ? new Date(a.fecha_recepcion) : new Date(0);
                const fechaB = b.fecha_recepcion ? new Date(b.fecha_recepcion) : new Date(0);
                return fechaA - fechaB;
            });

            const totalPendiente = dataFinal.reduce((sum, r) => sum + parseFloat(r.monto), 0);
            const totalArrastrado = gastosArrastrados.reduce((sum, r) => sum + parseFloat(r.monto), 0);

            res.json({ 
                success: true, 
                data: dataFinal,
                resumen: {
                    total_pendiente: totalPendiente,
                    total_arrastrado: totalArrastrado
                }
            });
        });
    }).catch(err => {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error al procesar la lista de gastos' });
    });
});

router.get('/reportes/pagos-del-mes', verificarToken, (req, res) => {
    const mesFiltro = parseInt(req.query.mes) || new Date().getMonth() + 1;
    const anioFiltro = parseInt(req.query.anio) || new Date().getFullYear();

    const queryOperativos = `
        SELECT 
            s.fecha_limite_pago AS fecha_recepcion, cp.descripcion AS tipo_gasto, COALESCE(pprov.nombre_razon_social, 'Sin Proveedor') AS proveedor,
            s.descripcion AS concepto, s.monto AS monto, IF(s.estatus IN ('PAGADO', 'COMPLETADO'), 'PAGADO', 'PENDIENTE') AS estatus_pago,
            'OPERATIVO' AS origen_dato, s.id AS id_contrato
        FROM solicitudes_recursos s
        LEFT JOIN conceptos_pago cp ON s.concepto_id = cp.clave
        LEFT JOIN proveedores prov ON s.id_proveedor = prov.id_persona
        LEFT JOIN personas pprov ON prov.id_persona = pprov.id
        WHERE MONTH(s.fecha_limite_pago) = ? AND YEAR(s.fecha_limite_pago) = ?
        AND s.estatus NOT IN ('RECHAZADO', 'CANCELADO')
    `;

    db.query(queryOperativos, [mesFiltro, anioFiltro], (err, resOperativos) => {
        if (err) return res.status(500).json({ success: false, message: 'Error DB Operativos' });

        const queryFondeadores = `
            SELECT 
                ci.id AS id_contrato, ci.plan_json, ci.pagos_irregulares_json, 
                ci.monto_inicial, ci.fecha_inicio, ci.fecha_fin, ci.tipo_amortizacion, ci.numero_disposicion,
                t.tasa_anual_esperada, t.cobra_iva, p.nombre_razon_social AS proveedor,
                COALESCE((
                    SELECT SUM(monto) FROM movimientos_inversion mi 
                    WHERE mi.id_contrato = ci.id AND (mi.tipo = 'PAGO_INTERES' OR mi.tipo = 'DEPOSITO') AND mi.estatus_movimiento = 'COMPLETADO'
                ), 0) AS total_pagado
            FROM contratos_inversion ci
            JOIN inversores i ON ci.id_inversor = i.id_persona
            JOIN personas p ON i.id_persona = p.id
            JOIN catalogo_tasas t ON ci.id_tasa = t.id
            WHERE ci.estatus = 'ACTIVO' AND p.eliminado = FALSE AND i.estatus_activo = 1
        `;

        db.query(queryFondeadores, (err2, resContratos) => {
            if (err2) return res.status(500).json({ success: false, message: 'Error DB Fondeadores' });

            let fondeadoresCalculados = [];

            resContratos.forEach(contrato => {
                let bolsaTotal = parseFloat(contrato.total_pagado) || 0;
                const tabla = calcularAmortizacionBackend(contrato);

                tabla.forEach(pago => {
                    if (pago.pagoTotal > 0.01) {
                        if (bolsaTotal >= pago.pagoTotal - 0.5) {
                            pago.pagado = true;
                            bolsaTotal -= pago.pagoTotal;
                        } else {
                            pago.pagado = false;
                        }
                    } else {
                        pago.pagado = true;
                    }
                });

                tabla.forEach(pago => {
                    if (pago.pagoTotal <= 0.01) return;
                    
                    const mesEvt = pago.fechaPura.getMonth() + 1;
                    const anioEvt = pago.fechaPura.getFullYear();
                    
                    if (mesEvt === mesFiltro && anioEvt === anioFiltro) {
                        fondeadoresCalculados.push({
                            id_contrato: contrato.id_contrato,
                            fecha_recepcion: pago.fechaStr,
                            tipo_gasto: pago.numero === 'N/A' ? 'RETIRO / PAGO ESPECIAL' : 'PAGOS INTERES DE CRED',
                            proveedor: contrato.proveedor,
                            concepto: pago.numero === 'N/A' ? `Inyección a Capital Disp. ${contrato.numero_disposicion || 'S/N'}` : `Pago Rendimiento (Cuota ${pago.numero}) Disp. ${contrato.numero_disposicion || 'S/N'}`,
                            monto: pago.pagoTotal,
                            estatus_pago: pago.pagado ? 'PAGADO' : 'PENDIENTE',
                            origen_dato: 'FONDEADOR'
                        });
                    }
                });
            });

            const dataFinal = [...resOperativos, ...fondeadoresCalculados].sort((a, b) => new Date(a.fecha_recepcion) - new Date(b.fecha_recepcion));

            const resumen = {
                total_pagado: dataFinal.filter(r => r.estatus_pago === 'PAGADO').reduce((sum, r) => sum + parseFloat(r.monto), 0),
                total_pendiente: dataFinal.filter(r => r.estatus_pago === 'PENDIENTE').reduce((sum, r) => sum + parseFloat(r.monto), 0),
            };
            resumen.gran_total = resumen.total_pagado + resumen.total_pendiente;

            const desglose = {};
            dataFinal.forEach(item => {
                const cat = item.tipo_gasto || 'OTROS';
                if(!desglose[cat]) desglose[cat] = 0;
                desglose[cat] += parseFloat(item.monto);
            });

            res.json({ success: true, data: dataFinal, resumen, desglose });
        });
    });
});

router.get('/reportes/pagos-por-vencer', verificarToken, (req, res) => {
    const query = `
        SELECT 
            pp.id AS id_pago, p.nombre_razon_social AS proveedor, pp.concepto, pp.monto_pago, pp.estatus,
            DATE(pp.fecha_solicitud) as fecha_solicitud, pr.dias_credito,
            DATE_ADD(pp.fecha_solicitud, INTERVAL pr.dias_credito DAY) AS fecha_vencimiento,
            DATEDIFF(DATE_ADD(pp.fecha_solicitud, INTERVAL pr.dias_credito DAY), CURDATE()) AS dias_restantes
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        WHERE pp.estatus NOT IN ('PAGADO', 'COMPLETADO', 'RECHAZADO', 'CANCELADO')
        ORDER BY fecha_vencimiento ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error de base de datos' });
        res.json({ success: true, data: results });
    });
});

router.post('/reportes/postergar-pago', verificarToken, (req, res) => {
    const { id, tipo, nueva_fecha } = req.body;

    if (!id || !tipo || !nueva_fecha) return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });

    if (tipo === 'OPERATIVO') {
        const query = `UPDATE solicitudes_recursos SET fecha_limite_pago = ? WHERE id = ?`;
        db.query(query, [nueva_fecha, id], (err, result) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'POSTERGAR_PAGO', `Postergó el pago de la solicitud #${id} para la fecha ${nueva_fecha}`);
            res.json({ success: true, message: 'Pago postergado correctamente' });
        });
    } 
    else if (tipo === 'FONDEADOR') {
        const queryGetContrato = `SELECT plan_json, pagos_irregulares_json FROM contratos_inversion WHERE id = ?`;
        db.query(queryGetContrato, [id], (err, results) => {
            if (err || results.length === 0) return res.status(500).json({ success: false, message: 'Contrato no encontrado' });
            
            let contrato = results[0];
            let actualizado = false;
            
            if (contrato.pagos_irregulares_json) {
                try {
                    let pagosIrregulares = JSON.parse(contrato.pagos_irregulares_json);
                    for (let pago of pagosIrregulares) {
                        if (pago.estatus_pago !== 'PAGADO' && (!pago.fecha_postergada || pago.fecha_postergada !== true)) {
                            pago.fecha = nueva_fecha;
                            pago.fecha_postergada = true;
                            pago.fecha_original = pago.fecha_original || pago.fecha;
                            actualizado = true;
                            break;
                        }
                    }
                    
                    if (actualizado) {
                        const updateQuery = `UPDATE contratos_inversion SET pagos_irregulares_json = ? WHERE id = ?`;
                        db.query(updateQuery, [JSON.stringify(pagosIrregulares), id], (err) => {
                            if (err) return res.status(500).json({ success: false, message: err.message });
                            registrarBitacora(req.usuario.id, 'POSTERGAR_PAGO_FONDEADOR', `Postergó el pago del fondeador contrato #${id} para la fecha ${nueva_fecha}`);
                            res.json({ success: true, message: 'Pago de fondeador postergado correctamente' });
                        });
                    } else {
                        res.json({ success: false, message: 'No se encontraron pagos pendientes para postergar' });
                    }
                } catch(e) {
                    res.status(500).json({ success: false, message: 'Error al procesar los datos del contrato' });
                }
            } else {
                res.json({ success: false, message: 'No se encontraron pagos pendientes para postergar' });
            }
        });
    }
    else {
        res.status(400).json({ success: false, message: 'Tipo de pago no válido' });
    }
});

// ==========================================
// PAGO RÁPIDO DE FONDEADOR DESDE REPORTE
// ==========================================
router.post('/pagos-fondeador', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_contrato, monto } = req.body;
    let url = req.file ? `uploads/${req.file.filename}` : null;
    
    const query = `
        INSERT INTO movimientos_inversion 
        (id_contrato, tipo, monto, recibo_comprobante, estatus_movimiento) 
        VALUES (?, 'PAGO_INTERES', ?, ?, 'COMPLETADO')
    `;
    db.query(query, [id_contrato, monto, url], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'PAGO_FONDEADOR', `Registró pago de rendimiento desde Reporte al contrato #${id_contrato}`);
        res.json({ success: true, message: 'Pago de inversor registrado exitosamente' });
    });
});

// ==========================================
// CRUD NORMAL DE PROVEEDORES (CORREGIDO)
// ==========================================
router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT 
            p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, 
            p.direccion AS ubicacion, p.telefono, p.email_contacto AS email, 
            pr.categoria, pr.numero_cuenta, pr.numero_cuenta AS clabe_bancaria, 
            pr.banco, pr.dias_credito, pr.estatus_activo 
        FROM personas p 
        INNER JOIN proveedores pr ON p.id = pr.id_persona 
        WHERE p.eliminado = 0 
        ORDER BY p.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.log("🚨 ERROR SQL EN GET PROVEEDORES:", err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    
    // Unificamos en una sola variable para guardar
    const cuentaFinal = numero_cuenta || clabe_bancaria || '';

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo al iniciar transacción BD.' });
        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', 
        [tipo_persona, nombre, rfc, direccion, telefono, email], (err, resultPersona) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: `El RFC ya existe o formato inválido.` }));
            const idNuevaPersona = resultPersona.insertId;
            const catLimpia = categoria || 'OTROS';
            
            // Insertamos sin la columna 'cuenta_bancaria'
            db.query('INSERT INTO proveedores (id_persona, categoria, numero_cuenta, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, 1)', 
            [idNuevaPersona, catLimpia, cuentaFinal, banco, dias_credito || 0], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: `Error en BD Proveedores: ${err.message}` }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, message: 'Fallo al hacer COMMIT.' }));
                    registrarBitacora(req.usuario.id, 'CREAR_PROVEEDOR', `Se registró al proveedor: ${nombre}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, categoria, numero_cuenta, clabe_bancaria, banco, dias_credito } = req.body;
    
    const cuentaFinal = numero_cuenta || clabe_bancaria || '';

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, message: 'Fallo en BD' });
        db.query('UPDATE personas SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', 
        [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, message: err.message }));
            const catLimpia = categoria || 'OTROS';
            
            // Actualizamos sin la columna 'cuenta_bancaria'
            db.query('UPDATE proveedores SET categoria=?, numero_cuenta=?, banco=?, dias_credito=? WHERE id_persona=?', 
            [catLimpia, cuentaFinal, banco, dias_credito, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, message: err.message }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false }));
                    registrarBitacora(req.usuario.id, 'EDITAR_PROVEEDOR', `Actualizó los datos de: ${nombre}`);
                    res.json({ success: true });
                });
            });
        });
    });
});

router.put('/:id/estatus', verificarToken, (req, res) => {
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const nombreProveedor = results[0].nombre_razon_social;
        db.query('UPDATE proveedores SET estatus_activo = ? WHERE id_persona = ?', [req.body.estatus_activo, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Cambió el estatus a ${req.body.estatus_activo ? 'Activo' : 'Suspendido'} del proveedor: ${nombreProveedor}`);
            res.json({ success: true });
        });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false });
        const nombreProveedor = results[0].nombre_razon_social;
        db.query('UPDATE personas SET eliminado = 1 WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'ELIMINAR_PROVEEDOR', `Eliminó del directorio al proveedor: ${nombreProveedor}`);
            res.json({ success: true });
        });
    });
});

// ==========================================
// HISTORIAL UNIFICADO PARA EL EXPEDIENTE DEL PROVEEDOR
// ==========================================
router.get('/:id/pagos', verificarToken, (req, res) => {
    const query = `
        SELECT 
            id, concepto, monto_pago, num_factura_ref, fecha_solicitud, estatus, url_comprobante_pago, 'PAGO DIRECTO' AS origen_movimiento
        FROM pagos_a_proveedores 
        WHERE id_proveedor = ?
        
        UNION ALL
        
        SELECT 
            id, descripcion AS concepto, monto AS monto_pago, 'S/N' AS num_factura_ref, COALESCE(fecha_limite_pago, NOW()) AS fecha_solicitud, estatus, '' AS url_comprobante_pago, 'SOLICITUD DE RECURSO' AS origen_movimiento
        FROM solicitudes_recursos 
        WHERE id_proveedor = ?
        ORDER BY fecha_solicitud DESC
    `;
    db.query(query, [req.params.id, req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al obtener historial unificado.' });
        res.json({ success: true, data: results });
    });
});

router.post('/pagos', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_proveedor, concepto, monto_pago, num_factura_ref } = req.body;
    let url = req.file ? `uploads/${req.file.filename}` : null;
    const estatus = req.usuario.rol === 'ADMIN' ? 'PAGADO' : 'PENDIENTE_VALIDACION';
    const id_autoriza = req.usuario.rol === 'ADMIN' ? req.usuario.id : null;

    db.query('SELECT nombre_razon_social FROM personas WHERE id = ?', [id_proveedor], (err, results) => {
        const nombreProveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Desconocido';
        db.query('INSERT INTO pagos_a_proveedores (id_proveedor, id_usuario_solicita, id_usuario_autoriza, monto_pago, concepto, num_factura_ref, url_comprobante_pago, estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
        [id_proveedor, req.usuario.id, id_autoriza, monto_pago, concepto, num_factura_ref, url, estatus], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            if(estatus === 'PAGADO'){
                registrarBitacora(req.usuario.id, 'PAGO_PROVEEDOR', `Registró y autorizó pago directo a favor de: ${nombreProveedor}`);
            } else {
                registrarBitacora(req.usuario.id, 'SOLICITUD_PAGO', `Envió solicitud de pago para validación a favor de: ${nombreProveedor}`);
            }
            res.json({ success: true, message: estatus === 'PAGADO' ? 'Pago registrado y autorizado' : 'Solicitud enviada para validación' });
        });
    });
});

router.put('/pagos/:id_pago/autorizacion', verificarToken, (req, res) => {
    const { id_pago } = req.params;
    const { accion } = req.body; 
    const id_usuario = req.usuario.id;

    let nuevoEstatus = '';
    let queryUpdate = '';
    let params = [];
    let accionBitacora = '';

    if (accion === 'VALIDAR') {
        nuevoEstatus = 'PENDIENTE_AUTORIZACION';
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ?, id_usuario_validador = ?, fecha_validacion = NOW() WHERE id = ?';
        params = [nuevoEstatus, id_usuario, id_pago];
        accionBitacora = 'VALIDACIÓN_PAGO';
    } else if (accion === 'AUTORIZAR') {
        nuevoEstatus = 'PAGADO'; 
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ?, id_usuario_autoriza = ?, fecha_autorizacion = NOW() WHERE id = ?';
        params = [nuevoEstatus, id_usuario, id_pago];
        accionBitacora = 'AUTORIZACIÓN_FINAL';
    } else if (accion === 'RECHAZAR') {
        nuevoEstatus = 'RECHAZADO';
        queryUpdate = 'UPDATE pagos_a_proveedores SET estatus = ? WHERE id = ?';
        params = [nuevoEstatus, id_pago];
        accionBitacora = 'RECHAZO_PAGO';
    } else {
        return res.status(400).json({ success: false, message: 'Acción no válida' });
    }

    db.query(queryUpdate, params, (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: 'Pago no encontrado.' });

        db.query('SELECT pp.concepto, pp.monto_pago, p.nombre_razon_social FROM pagos_a_proveedores pp JOIN personas p ON pp.id_proveedor = p.id WHERE pp.id = ?', [id_pago], (err, row) => {
            if (!err && row.length > 0) {
                const estatusLegible = nuevoEstatus.replace('_', ' ');
                registrarBitacora(id_usuario, accionBitacora, `Marcó como ${estatusLegible} el pago de $${row[0].monto_pago} a favor de: ${row[0].nombre_razon_social}`);
            }
            res.json({ success: true });
        });
    });
});

// ==========================================
// AUTORIZACIONES (WORKFLOW ANTIGUO) Y PDF
// ==========================================
router.get('/autorizaciones/pendientes', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false, message: 'No autorizado' });
    const query = `
        SELECT pp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.numero_cuenta AS clabe_bancaria, u.username as solicitante
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        JOIN usuarios u ON pp.id_usuario_solicita = u.id
        WHERE pp.estatus IN ('PENDIENTE_VALIDACION', 'PENDIENTE_AUTORIZACION', 'AUTORIZADO', 'PENDIENTE', 'PAGADO')
        ORDER BY pp.estatus DESC, pp.fecha_solicitud DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.put('/autorizaciones/:id/aprobar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query('SELECT p.nombre_razon_social FROM pagos_a_proveedores pp JOIN personas p ON pp.id_proveedor = p.id WHERE pp.id = ?', [req.params.id], (err, results) => {
        const proveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Proveedor Desconocido';
        db.query("UPDATE pagos_a_proveedores SET estatus = 'PAGADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'PAGO_AUTORIZADO', `Autorizó la salida de dinero a favor de: ${proveedor}`);
            res.json({ success: true });
        });
    });
});

router.put('/autorizaciones/:id/rechazar', verificarToken, (req, res) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false });
    db.query('SELECT p.nombre_razon_social FROM pagos_a_proveedores pp JOIN personas p ON pp.id_proveedor = p.id WHERE pp.id = ?', [req.params.id], (err, results) => {
        const proveedor = (results && results.length > 0) ? results[0].nombre_razon_social : 'Proveedor Desconocido';
        db.query("UPDATE pagos_a_proveedores SET estatus = 'RECHAZADO', id_usuario_autoriza = ? WHERE id = ?", [req.usuario.id, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'PAGO_RECHAZADO', `Rechazó el pago solicitado para: ${proveedor}`);
            res.json({ success: true });
        });
    });
});

router.get('/autorizaciones/:id/pdf', verificarToken, (req, res) => {
    const query = `
        SELECT pp.*, p.nombre_razon_social as proveedor, p.rfc, pr.banco, pr.numero_cuenta, pr.numero_cuenta AS clabe_bancaria, 
               u.username as solicitante, u.rol as rol_solicitante
        FROM pagos_a_proveedores pp
        JOIN proveedores pr ON pp.id_proveedor = pr.id_persona
        JOIN personas p ON pr.id_persona = p.id
        JOIN usuarios u ON pp.id_usuario_solicita = u.id
        WHERE pp.id = ?
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).send('Pago no encontrado');
        const pago = results[0];

        const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
        res.setHeader('Content-disposition', `attachment; filename=Solicitud_Recursos_Folio_${pago.id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 40, { width: 70 });

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#16a34a').text('SOLICITUD UNIVERSAL DE RECURSOS 2026', 0, 40, { align: 'right' });
        doc.text('SAC-TSR-RCS-2026', 0, 52, { align: 'right' });
        doc.rect(480, 68, 90, 13).fill('#fef08a');
        doc.fillColor('black').fontSize(9).font('Helvetica').text('Oaxaca de Juárez, Oax., a', 350, 71, { align: 'left' });
        doc.font('Helvetica-Bold').text(new Date(pago.fecha_solicitud).toLocaleDateString('es-MX'), 485, 71);

        doc.font('Helvetica-Bold').text('C. BEATRIZ CRUZ CANO', 40, 95);
        doc.font('Helvetica').text('TESORERÍA', 40, 107);
        doc.text('OPCIONES SACIMEX SA DE CV SOFOM ENR', 40, 119);

        doc.text('Por medio del presente solicito recurso para: ', 40, 150, { continued: true }).font('Helvetica-Bold').text(pago.concepto.toUpperCase());
        doc.font('Helvetica').text('correspondiente a la unidad de negocio: ', 40, 165);
        doc.rect(230, 163, 110, 12).fill('#fef08a');
        doc.fillColor('black').font('Helvetica-Bold').text('01.CRP - Corporativo', 235, 165);

        doc.rect(40, 185, 530, 15).fill('#fef08a');
        doc.fillColor('black').font('Helvetica').text('Por la cantidad de: ', 45, 188, { continued: true }).font('Helvetica-Bold').text(`$${Number(pago.monto_pago).toLocaleString('es-MX', {minimumFractionDigits:2})}    ( ${numeroALetras(pago.monto_pago)} )`);

        doc.font('Helvetica').text('Lo cual será destinado para lo descrito en el apartado siguiente.', 40, 215);

        doc.font('Helvetica-Bold').text('DATOS DEL PROVEEDOR O BENEFICIARIO', 40, 250);
        doc.moveTo(40, 260).lineTo(570, 260).stroke('#cbd5e1'); 
        doc.fontSize(8).text('DESCRIPCIÓN ESPECÍFICA DE LA FINALIDAD DEL RECURSO:', 40, 270);
        doc.font('Helvetica').text(pago.concepto.toUpperCase(), 40, 282);
        
        doc.font('Helvetica-Bold').text('TIPO DE SOLICITUD', 40, 310);
        doc.font('Helvetica').text('TRANSFERENCIA', 40, 322);
        
        doc.font('Helvetica-Bold').text('CUENTA/CLABE/CIE', 200, 310);
        doc.font('Helvetica').text(pago.numero_cuenta || pago.clabe_bancaria || 'N/D', 200, 322);
        
        doc.font('Helvetica-Bold').text('BANCO', 360, 310);
        doc.font('Helvetica').text(pago.banco || 'N/D', 360, 322);
        
        doc.font('Helvetica-Bold').text('RFC PROVEEDOR', 40, 350);
        doc.font('Helvetica').text(pago.rfc || 'N/A', 40, 362);
        
        doc.font('Helvetica-Bold').text('NOMBRE DEL PROVEEDOR', 200, 350);
        doc.font('Helvetica').text(pago.proveedor, 200, 362);

        if(pago.num_factura_ref) {
            doc.font('Helvetica-Bold').text('FACTURA / REFERENCIA', 40, 390);
            doc.font('Helvetica').text(pago.num_factura_ref, 40, 402);
        }

        doc.fillColor('black');
        const sigY1 = 480;
        doc.moveTo(50, sigY1).lineTo(250, sigY1).stroke();
        doc.font('Helvetica-Bold').fontSize(7).text('SOLICITADO POR', 50, sigY1 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text(pago.solicitante.toUpperCase(), 50, sigY1 + 15, { width: 200, align: 'center' });

        doc.moveTo(320, sigY1).lineTo(520, sigY1).stroke();
        doc.font('Helvetica-Bold').text('REVISADO POR', 320, sigY1 + 5, { width: 200, align: 'center' });
        doc.font('Helvetica').text('LIC C.P. MARIAM ITZEL RAMIREZ CARRASCO', 320, sigY1 + 15, { width: 200, align: 'center' });

        if(pago.estatus === 'PAGADO' || pago.estatus === 'AUTORIZADO'){
            doc.save();
            doc.rotate(-20, { origin: [300, 500] });
            doc.fontSize(45).font('Helvetica-Bold').fillColor('rgba(22, 163, 74, 0.15)').text('AUTORIZADO', 160, 480);
            doc.restore();
        }
        doc.end();
        registrarBitacora(req.usuario.id, 'DESCARGA_PDF', `Descargó Solicitud Universal de Pago para: ${pago.proveedor}`);
    });
});

// ==========================================
// IMPORTAR PROVEEDORES DESDE EXCEL (ESCÁNER MULTI-PESTAÑA)
// ==========================================
router.post('/importar', verificarToken, uploadExcel.single('archivo_excel'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        
        let rawData = [];
        let headerIndex = -1;
        let colNombre = -1;
        let colRFC = -1;
        
        // 1. Escanear TODAS las pestañas del Excel
        for (const sheetName of workbook.SheetNames) {
            const tempRawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
            
            // Buscar cabeceras en las primeras 20 filas de esta pestaña
            for (let i = 0; i < Math.min(tempRawData.length, 20); i++) {
                // Convertir toda la fila a mayúsculas para buscar
                const rowText = tempRawData[i].map(cell => String(cell).toUpperCase().trim());
                
                const nIdx = rowText.findIndex(col => col.includes('NOMBRE') || col.includes('PROVEEDOR') || col.includes('RAZON SOCIAL'));
                const rIdx = rowText.findIndex(col => col.includes('RFC'));

                // Si encontramos al menos una columna clave, ¡bingo! Es la pestaña correcta.
                if (nIdx !== -1 || rIdx !== -1) {
                    headerIndex = i;
                    colNombre = nIdx !== -1 ? nIdx : 0;
                    colRFC = rIdx !== -1 ? rIdx : 1;
                    rawData = tempRawData; 
                    break;
                }
            }
            if (headerIndex !== -1) break; // Si ya encontró la pestaña, deja de buscar en las demás
        }

        if (headerIndex === -1) {
            return res.status(400).json({ success: false, message: 'Revisé todas las pestañas y no encontré ninguna columna llamada NOMBRE o RFC.' });
        }

        let procesados = 0, errores = 0;

        // 2. Empezar a guardar desde la fila siguiente a los encabezados
        for (let i = headerIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0) continue;

            const nombre = row[colNombre] ? String(row[colNombre]).trim() : null;
            const rfc_original = (colRFC !== -1 && row[colRFC]) ? String(row[colRFC]).trim().toUpperCase() : null;

            // Si la fila está en blanco o no tiene nombre, se la brinca
            if (!nombre) { 
                errores++; 
                continue; 
            }
            
            let tipo_persona = 'MORAL';
            if (rfc_original && rfc_original.length === 13) tipo_persona = 'FISICA';

            try {
                await new Promise((resolve, reject) => {
                    db.beginTransaction(err => {
                        if (err) return reject(err);
                        db.query('INSERT INTO personas (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)', 
                        [tipo_persona, nombre, rfc_original || '', '', '', ''], (err, resultPersona) => {
                            if (err) return db.rollback(() => reject(err));
                            
                            db.query('INSERT INTO proveedores (id_persona, categoria, numero_cuenta, banco, dias_credito, estatus_activo) VALUES (?, ?, ?, ?, ?, 1)', 
                            [resultPersona.insertId, 'OTROS', '', '', 0], (err) => {
                                if (err) return db.rollback(() => reject(err));
                                db.commit(err => { if (err) return db.rollback(() => reject(err)); resolve(); });
                            });
                        });
                    });
                });
                procesados++;
            } catch (err) { 
                // Error de RFC duplicado
                errores++; 
            }
        }
        registrarBitacora(req.usuario.id, 'IMPORTAR_PROVEEDORES', `Importó proveedores desde Excel: ${procesados} exitosos, ${errores} omitidos.`);
        res.json({ success: true, message: `¡Se encontró la pestaña correcta! Proveedores importados: ${procesados}. Filas vacías o duplicados omitidos: ${errores}.` });
    } catch (error) { 
        console.error(error);
        res.status(500).json({ success: false, message: 'Ocurrió un error al intentar leer el archivo Excel.' }); 
    }
});

module.exports = router;