const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Asegurar que el directorio uploads existe
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) { 
        cb(null, uploadDir); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const idContrato = (req.body && req.body.id_contrato) ? req.body.id_contrato : 'temp';
        cb(null, idContrato + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// CONFIGURACIÓN DE CORREO INSTITUCIONAL (SMTP)
// ==========================================
const transportadorSMTP = nodemailer.createTransport({
    host: 'smtp.gmail.com', 
    port: 465, 
    secure: true, 
    auth: {
        user: 'ordazruudvan@gmail.com', 
        pass: 'ejci wnas ugjg yans' 
    },
    tls: {
        rejectUnauthorized: false
    }
});

// ==========================================
// UTILERÍAS
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

        if (c > 0) {
            if (c === 1 && d === 0 && u === 0) texto += 'Cien ';
            else texto += centenas[c] + ' ';
        }
        if (d === 1) texto += decenas[u] + ' ';
        else if (d > 1) {
            texto += decenasMultiplos[d] + ' ';
            if (u > 0) texto += 'y ' + unidades[u] + ' ';
        } else if (u > 0) {
            if (u === 1) texto += 'Un ';
            else texto += unidades[u] + ' ';
        }
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
    } else {
        textoFinal = convertirGrupo(enteros);
    }

    const centavosTexto = centavos.toString().padStart(2, '0');
    return `${textoFinal.toUpperCase()} PESOS ${centavosTexto}/100 M.N.`;
}

function formatMoney(n) { 
    return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); 
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

// Validación de Disposición Única
function checkDisposicionUnica(db, numero_disposicion, id_exclude, callback) {
    if (!numero_disposicion) return callback(true);
    let q = 'SELECT id FROM CONTRATOS_INVERSION WHERE numero_disposicion = ?';
    let p = [numero_disposicion];
    if (id_exclude) {
        q += ' AND id != ?';
        p.push(id_exclude);
    }
    db.query(q, p, (err, results) => {
        if (err) return callback(false);
        callback(results.length === 0);
    });
}

// ==========================================
// RUTAS CRUD (FONDEADORES)
// ==========================================

router.get('/', verificarToken, (req, res) => {
    const query = `
        SELECT p.id, p.tipo_persona, p.nombre_razon_social AS nombre, p.rfc, p.direccion AS ubicacion, 
               p.telefono, p.email_contacto AS email, i.clabe_bancaria, i.numero_cuenta, i.banco, 
               i.origen_fondos, i.estatus_activo, i.limite_credito
        FROM PERSONAS p INNER JOIN INVERSORES i ON p.id = i.id_persona
        WHERE p.eliminado = FALSE ORDER BY p.id DESC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/', verificarToken, (req, res) => {
    const { 
        tipo_persona,
        nombre, apellidos, rfc, direccion, telefono, email, 
        clabe_bancaria, numero_cuenta, banco, origen_fondos, limite_credito,
        ben_nombre, ben_parentesco, ben_telefono 
    } = req.body;

    const tipoPersonaReal = tipo_persona || 'FISICA';
    const nombreCompleto = tipoPersonaReal === 'MORAL' ? nombre.trim() : `${nombre} ${apellidos || ''}`.trim();
    const rfcFinal = rfc ? rfc.toUpperCase() : 'XAXX010101000';

    db.beginTransaction(err => {
        if (err) {
            console.error("Error al iniciar transacción:", err);
            return res.status(500).json({ success: false, message: "Error interno del servidor." });
        }
        
        db.query('INSERT INTO PERSONAS (tipo_persona, nombre_razon_social, rfc, direccion, telefono, email_contacto) VALUES (?, ?, ?, ?, ?, ?)',
            [tipoPersonaReal, nombreCompleto, rfcFinal, direccion, telefono, email], (err, resultPersona) => {
            if (err) {
                console.error("Error en INSERT PERSONAS:", err.sqlMessage || err);
                return db.rollback(() => res.status(500).json({ success: false, message: `Error en Personas: ${err.sqlMessage}` }));
            }
            
            const idNuevaPersona = resultPersona.insertId;
            
            db.query('INSERT INTO INVERSORES (id_persona, clabe_bancaria, numero_cuenta, banco, origen_fondos, estatus_activo, limite_credito) VALUES (?, ?, ?, ?, ?, 1, ?)',
                [idNuevaPersona, clabe_bancaria, numero_cuenta, banco, origen_fondos || 'AHORRO PERSONAL', limite_credito || 0], (err) => {
                if (err) {
                    console.error("Error en INSERT INVERSORES:", err.sqlMessage || err);
                    return db.rollback(() => res.status(500).json({ success: false, message: `Error en Inversores: ${err.sqlMessage}` }));
                }
                
                if (ben_nombre) {
                    db.query('INSERT INTO BENEFICIARIOS (id_inversor, nombre_completo, parentesco, telefono, porcentaje) VALUES (?, ?, ?, ?, 100)', 
                        [idNuevaPersona, ben_nombre, ben_parentesco, ben_telefono], (err) => {
                        if (err) {
                            console.error("Error en INSERT BENEFICIARIOS:", err.sqlMessage || err);
                            return db.rollback(() => res.status(500).json({ success: false, message: `Error en Beneficiarios: ${err.sqlMessage}` }));
                        }
                        commitFondeador();
                    });
                } else {
                    commitFondeador();
                }

                function commitFondeador() {
                    db.commit(err => {
                        if (err) {
                            console.error("Error en COMMIT:", err.sqlMessage || err);
                            return db.rollback(() => res.status(500).json({ success: false, message: "Error al guardar todo." }));
                        }
                        
                        try {
                            registrarBitacora(req.usuario.id, 'CREAR_FONDEADOR', `Se registró al fondeador: ${nombreCompleto} con límite de ${formatMoney(limite_credito)}`);
                        } catch (bitErr) {
                            console.error("Aviso: Fondeador guardado, pero falló la bitácora:", bitErr);
                        }
                        
                        res.json({ success: true, message: 'Fondeador registrado exitosamente.' });
                    });
                }
            });
        });
    });
});

router.put('/:id_persona/estatus', verificarToken, (req, res) => {
    const { id_persona } = req.params;
    const { estatus_activo } = req.body;

    db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_persona], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false, error: err?.message });
        const nombreFondeador = results[0].nombre_razon_social;
        
        db.query('UPDATE INVERSORES SET estatus_activo = ? WHERE id_persona = ?', [estatus_activo, id_persona], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            registrarBitacora(req.usuario.id, 'CAMBIO_ESTATUS', `Cambió el estatus a ${estatus_activo ? 'Activo' : 'Inactivo'} del fondeador: ${nombreFondeador}`);
            res.json({ success: true });
        });
    });
});

router.put('/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    const { tipo_persona, nombre, rfc, direccion, telefono, email, clabe_bancaria, numero_cuenta, banco, origen_fondos, limite_credito } = req.body;
    
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        db.query('UPDATE PERSONAS SET tipo_persona=?, nombre_razon_social=?, rfc=?, direccion=?, telefono=?, email_contacto=? WHERE id=?', 
            [tipo_persona, nombre, rfc, direccion, telefono, email, id], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ success: false, error: err.message }));
            
            db.query('UPDATE INVERSORES SET clabe_bancaria=?, numero_cuenta=?, banco=?, origen_fondos=?, limite_credito=? WHERE id_persona=?', 
                [clabe_bancaria, numero_cuenta, banco, origen_fondos, limite_credito, id], (err) => {
                if (err) return db.rollback(() => res.status(500).json({ success: false, error: err.message }));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json({ success: false, error: err.message }));
                    registrarBitacora(req.usuario.id, 'EDITAR_FONDEADOR', `Actualizó los datos del fondeador: ${nombre}. Nuevo límite: ${formatMoney(limite_credito)}`);
                    res.json({ success: true, message: 'Fondeador actualizado.' });
                });
            });
        });
    });
});

router.delete('/:id', verificarToken, (req, res) => {
    const id = req.params.id;
    db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ success: false, error: err?.message });
        const nombreFondeador = results[0].nombre_razon_social;
        
        db.query('UPDATE PERSONAS SET eliminado = TRUE WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            registrarBitacora(req.usuario.id, 'ELIMINAR_FONDEADOR', `Eliminó del directorio al fondeador: ${nombreFondeador}`);
            res.json({ success: true });
        });
    });
});

// ==========================================
// TASAS Y CONTRATOS DE INVERSIÓN
// ==========================================

router.get('/tasas', verificarToken, (req, res) => {
    db.query('SELECT * FROM CATALOGO_TASAS WHERE estatus_activo = 1', (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: results });
    });
});

router.get('/contratos/:id_inversor', verificarToken, (req, res) => {
    db.query('SELECT c.*, t.nombre_tasa, t.tasa_anual_esperada FROM CONTRATOS_INVERSION c JOIN CATALOGO_TASAS t ON c.id_tasa = t.id WHERE c.id_inversor = ? ORDER BY c.fecha_inicio DESC', 
        [req.params.id_inversor], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/contratos', verificarToken, (req, res) => {
    const { id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion, reinversion_automatica, fecha_inicio, fecha_fin, plan_json, numero_disposicion } = req.body;
  
    checkDisposicionUnica(db, numero_disposicion, null, (esValido) => {
        if (!esValido) return res.status(400).json({ success: false, message: 'El Número de Disposición ya se encuentra registrado.' });

        db.query('INSERT INTO CONTRATOS_INVERSION (id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion, plan_json, reinversion_automatica, fecha_inicio, fecha_fin, estatus, numero_disposicion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "ACTIVO", ?)',
          [id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion || 'frances', plan_json || null, reinversion_automatica, fecha_inicio, fecha_fin, numero_disposicion || null], (err) => {
            if (err) {
                console.error("Error al guardar contrato estático:", err);
                return res.status(500).json({ success: false, message: 'Error de servidor' });
            }
            res.json({ success: true });
        });
    });
});

router.put('/contratos/:id', verificarToken, (req, res) => {
    const { fecha_inicio, numero_disposicion } = req.body;
    
    checkDisposicionUnica(db, numero_disposicion, req.params.id, (esValido) => {
        if (!esValido) return res.status(400).json({ success: false, message: 'El Número de Disposición ya se encuentra registrado en otro contrato.' });

        db.query('UPDATE CONTRATOS_INVERSION SET fecha_inicio = ?, numero_disposicion = ? WHERE id = ?', 
            [fecha_inicio, numero_disposicion, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: "Error al actualizar contrato" });
            registrarBitacora(req.usuario.id, 'EDITAR_CONTRATO', `Actualizó información del contrato #${req.params.id}`);
            res.json({ success: true, message: 'Contrato actualizado' });
        });
    });
});

router.post('/inversion', verificarToken, (req, res) => {
    const { id_inversor, id_tasa, monto_inicial, frecuencia_pagos, plazo_meses, tipo_amortizacion, plan_json, fecha_inicio, numero_disposicion } = req.body;

    const fInicio = fecha_inicio ? new Date(fecha_inicio + 'T12:00:00') : new Date();
    const fFin = new Date(fInicio);
    fFin.setMonth(fInicio.getMonth() + parseInt(plazo_meses || 12));

    checkDisposicionUnica(db, numero_disposicion, null, (esValido) => {
        if (!esValido) return res.status(400).json({ success: false, message: 'El Número de Disposición ya se encuentra registrado.' });

        db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_inversor], (err, results) => {
            const nombreFondeador = (results && results.length > 0) ? results[0].nombre_razon_social : 'Fondeador Desconocido';

            const query = `
                INSERT INTO CONTRATOS_INVERSION 
                (id_inversor, id_tasa, monto_inicial, frecuencia_pagos, tipo_amortizacion, plan_json, fecha_inicio, fecha_fin, estatus, numero_disposicion) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?)
            `;

            db.query(query, [
                id_inversor, 
                id_tasa, 
                monto_inicial, 
                frecuencia_pagos, 
                tipo_amortizacion || 'frances', 
                plan_json || null, 
                fInicio.toISOString().split('T')[0], 
                fFin.toISOString().split('T')[0],
                numero_disposicion || null
            ], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ success: false, message: 'Error al registrar la inversión' });
                }
                registrarBitacora(req.usuario.id, 'NUEVO_FONDEO', `Ingreso de capital de $${monto_inicial} registrado para: ${nombreFondeador}`);
                res.json({ success: true, message: 'Fondeo registrado correctamente' });
            });
        });
    });
});

// ==========================================
// PAGOS IRREGULARES Y ALERTAS REALES (SMTP)
// ==========================================

router.put('/contratos/:id/pagos-irregulares', verificarToken, (req, res) => {
    const { pagos_irregulares } = req.body;
    const jsonStr = JSON.stringify(pagos_irregulares);
    
    db.query('UPDATE CONTRATOS_INVERSION SET pagos_irregulares_json = ? WHERE id = ?', [jsonStr, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al guardar abonos a capital.' });
        registrarBitacora(req.usuario.id, 'ABONO_CAPITAL', `Se registraron abonos a capital y se reestructuró el saldo del contrato #${req.params.id}`);
        res.json({ success: true, message: 'Abonos a capital guardados correctamente.' });
    });
});

// ENVÍO MANUAL DE ALERTA POR CORREO
router.post('/alertas-correo', verificarToken, (req, res) => {
    const { email, id_inversor } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'El correo destino es obligatorio.' });
    }

    const queryFondeador = `
        SELECT 
            ci.id AS id_contrato, 
            ci.plan_json, 
            ci.pagos_irregulares_json, 
            ci.fecha_inicio,
            ci.fecha_fin,
            ci.monto_inicial,
            ci.tipo_amortizacion,
            ci.numero_disposicion,
            t.tasa_anual_esperada,
            t.cobra_iva,
            p.nombre_razon_social AS proveedor,
            COALESCE((
                SELECT SUM(monto) 
                FROM movimientos_inversion mi 
                WHERE mi.id_contrato = ci.id AND (mi.tipo = 'PAGO_INTERES' OR mi.tipo = 'DEPOSITO') AND mi.estatus_movimiento = 'COMPLETADO'
            ), 0) AS total_pagado
        FROM contratos_inversion ci
        JOIN inversores i ON ci.id_inversor = i.id_persona
        JOIN personas p ON i.id_persona = p.id
        JOIN catalogo_tasas t ON ci.id_tasa = t.id
        WHERE ci.id_inversor = ? AND ci.estatus = 'ACTIVO' AND p.eliminado = FALSE
    `;

    db.query(queryFondeador, [id_inversor], (err, resContratos) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al consultar contratos para la alerta.' });
        if (resContratos.length === 0) return res.status(404).json({ success: false, message: 'No hay contratos activos para notificar.' });

        const nombreFondeador = resContratos[0].proveedor;
        let filasHtml = '';
        const hoy = new Date();
        hoy.setHours(0,0,0,0);

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
                }
            });

            tabla.forEach(pago => {
                if (!pago.pagado && pago.pagoTotal > 0.01) {
                    const diasRestantes = Math.ceil((pago.fechaPura - hoy) / (1000 * 60 * 60 * 24));
                    
                    if (diasRestantes <= 15) {
                        const esInyeccion = pago.numero === 'N/A';
                        const estatusTexto = diasRestantes < 0 ? `Vencido por ${Math.abs(diasRestantes)} días` : diasRestantes === 0 ? 'Vence Hoy' : `Por vencer en ${diasRestantes} días`;
                        const colorEstatus = diasRestantes < 0 ? '#ef4444' : diasRestantes === 0 ? '#f59e0b' : '#3b82f6';

                        filasHtml += `
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 12px; font-weight: bold;">${contrato.numero_disposicion || 'S/N'}</td>
                                <td style="padding: 12px;">${esInyeccion ? 'Pago Inyección Extra a Capital' : 'Rendimiento Mensual (Cuota ' + pago.numero + ')'}</td>
                                <td style="padding: 12px; text-align: center;">${pago.fechaStr}</td>
                                <td style="padding: 12px; text-align: right; font-weight: bold;">$${Number(pago.pagoTotal).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                                <td style="padding: 12px; text-align: center; color: ${colorEstatus}; font-weight: bold;">${estatusTexto}</td>
                            </tr>
                        `;
                    }
                }
            });
        });

        if (filasHtml === '') {
            return res.json({ success: true, message: 'No hay saldos pendientes urgentes para reportar de este fondeador.' });
        }

        const cuerpoCorreo = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #0F6B38; border-bottom: 2px solid #0F6B38; padding-bottom: 10px; margin-top: 0;">Reporte de Saldos y Vencimientos de Fondeo</h2>
                <p>Estimada C.P. Trinidad,</p>
                <p>A continuación se detalla la relación de rendimientos y obligaciones pendientes de pago correspondientes al fondeador <strong>${nombreFondeador}</strong> para su revisión y correspondiente programación en el presupuesto de egresos:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                    <thead>
                        <tr style="background-color: #0F6B38; color: white;">
                            <th style="padding: 12px; text-align: left;">Disposición</th>
                            <th style="padding: 12px; text-align: left;">Concepto</th>
                            <th style="padding: 12px; text-align: center;">Fecha Límite</th>
                            <th style="padding: 12px; text-align: right;">Total de Salida</th>
                            <th style="padding: 12px; text-align: center;">Estatus</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHtml}
                    </tbody>
                </table>
                
                <div style="margin-top: 30px; padding: 15px; background-color: #f8fafc; border-left: 4px solid #0F6B38; font-size: 12px; color: #64748b;">
                    <strong>Nota del Sistema:</strong> Este desglose contempla de forma exacta el capital remanente, el interés devengado a la fecha de corte y la aplicación de IVA correspondiente según las condiciones contractuales vigentes.
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">Sistema de Gestión de Fondeadores - Módulo de Tesorería</p>
            </div>
        `;

        const opcionesCorreo = {
            from: '"Sistema de Alertas Sacimex" <ordazruudvan@gmail.com>',
            to: email, 
            subject: `Urgente: Calendario de Pagos Pendientes - Fondeador: ${nombreFondeador}`,
            html: cuerpoCorreo
        };

        transportadorSMTP.sendMail(opcionesCorreo, (mailErr, info) => {
            if (mailErr) {
                console.error("Error SMTP:", mailErr);
                return res.status(500).json({ success: false, message: 'Error al enviar el correo a través del servidor SMTP.' });
            }
            registrarBitacora(req.usuario.id, 'ENVIO_ALERTAS_SMTP', `Se notificó exitosamente a la Coordinación Contable sobre saldos de: ${nombreFondeador}`);
            res.json({ success: true, message: 'El reporte de proyección fue enviado exitosamente a la Coordinación Contable.' });
        });
    });
});

// ==========================================
// RUTA DE BANDEJA DE ALERTAS GLOBALES (FIFO UNIFICADO)
// ==========================================
router.get('/reportes/pagos-por-vencer', verificarToken, (req, res) => {
    
    const queryFondeadores = `
        SELECT 
            ci.id AS id_contrato, 
            ci.plan_json, 
            ci.pagos_irregulares_json, 
            ci.fecha_inicio,
            ci.fecha_fin,
            ci.monto_inicial,
            ci.tipo_amortizacion,
            ci.numero_disposicion,
            t.tasa_anual_esperada,
            t.cobra_iva,
            p.nombre_razon_social AS proveedor,
            COALESCE((
                SELECT SUM(monto) 
                FROM movimientos_inversion mi 
                WHERE mi.id_contrato = ci.id AND (mi.tipo = 'PAGO_INTERES' OR mi.tipo = 'DEPOSITO') AND mi.estatus_movimiento = 'COMPLETADO'
            ), 0) AS total_pagado
        FROM contratos_inversion ci
        JOIN inversores i ON ci.id_inversor = i.id_persona
        JOIN personas p ON i.id_persona = p.id
        JOIN catalogo_tasas t ON ci.id_tasa = t.id
        WHERE ci.estatus = 'ACTIVO' AND p.eliminado = FALSE
    `;

    db.query(queryFondeadores, (err, resContratos) => {
        if (err) return res.status(500).json({ success: false, message: 'Error DB Fondeadores' });

        let pagosAlerta = [];
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
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
                }
            });

            tabla.forEach(pago => {
                if (!pago.pagado && pago.pagoTotal > 0.01) {
                    const diasRestantes = Math.ceil((pago.fechaPura - hoy) / (1000 * 60 * 60 * 24));
                    
                    if (diasRestantes <= 15) {
                        pagosAlerta.push({
                            id_pago: `c${contrato.id_contrato}_n${pago.numero}_${pago.fechaPura.getTime()}`,
                            proveedor: contrato.proveedor,
                            concepto: pago.numero === 'N/A' ? `Inyección a Capital Disp. ${contrato.numero_disposicion || 'S/N'}` : `Rendimiento (Cuota ${pago.numero}) Disp. ${contrato.numero_disposicion || 'S/N'}`,
                            monto_pago: pago.pagoTotal,
                            fecha_solicitud: pago.fechaStr, 
                            dias_restantes: diasRestantes
                        });
                    }
                }
            });
        });

        pagosAlerta.sort((a,b) => a.dias_restantes - b.dias_restantes);
        res.json({ success: true, data: pagosAlerta });
    });
});

function calcularAmortizacionBackend(contratoObj) {
    const m = parseFloat(contratoObj.monto_inicial) || 0;
    const t = parseFloat(contratoObj.tasa_anual_esperada) || 0;
    const tipoReal = String(contratoObj.tipo_amortizacion || 'frances').toLowerCase().trim();
    const cobraIva = contratoObj.cobra_iva === 1;

    const parseMontoLocal = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        return parseFloat(String(val).replace(/,/g, '')) || 0;
    };

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
            fechaStr: fechaActual.toLocaleDateString('es-MX')
        });
        fechaAnterior = new Date(fechaActual);
    });

    return tablaRes;
}

// ==========================================
// BENEFICIARIOS Y MOVIMIENTOS
// ==========================================

router.get('/beneficiarios/:id_inversor', verificarToken, (req, res) => {
    db.query('SELECT * FROM BENEFICIARIOS WHERE id_inversor = ?', [req.params.id_inversor], (err, results) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, data: results });
    });
});

router.post('/beneficiarios', verificarToken, upload.single('ine'), (req, res) => {
    const { id_inversor, nombre_completo, parentesco, telefono, porcentaje, fecha_nacimiento } = req.body;
    const url_ine = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!id_inversor) return res.status(400).json({ success: false, message: 'Falta el campo requerido: id_inversor' });
    if (!nombre_completo) return res.status(400).json({ success: false, message: 'Falta el campo requerido: nombre_completo' });
    
    db.query('SELECT id_persona FROM INVERSORES WHERE id_persona = ?', [id_inversor], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al verificar inversor', error: err.message });
        if (results.length === 0) return res.status(404).json({ success: false, message: `No se encontró el inversor con ID: ${id_inversor}` });
        
        db.query('SELECT COALESCE(SUM(porcentaje), 0) as total FROM BENEFICIARIOS WHERE id_inversor = ?', [id_inversor], (err, sumResults) => {
            if (err) return res.status(500).json({ success: false, message: 'Error al verificar porcentajes', error: err.message });
            
            const porcentajeActual = parseFloat(porcentaje || 100);
            const totalActual = parseFloat(sumResults[0].total || 0);
            const nuevoTotal = totalActual + porcentajeActual;
            
            if (nuevoTotal > 100) {
                return res.status(400).json({ success: false, message: `Los porcentajes suman ${nuevoTotal}%. No puede exceder el 100%`});
            }
            
            const query = `INSERT INTO BENEFICIARIOS (id_inversor, nombre_completo, parentesco, telefono, porcentaje, fecha_nacimiento, ine_url) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            db.query(query, [id_inversor, nombre_completo, parentesco || null, telefono || null, porcentaje || 100, fecha_nacimiento || null, url_ine], (err, result) => {
                if (err) return res.status(500).json({ success: false, message: 'Error al guardar el beneficiario', error: err.message });
                
                db.query('SELECT nombre_razon_social FROM PERSONAS WHERE id = ?', [id_inversor], (err, resPer) => {
                    const nombreFondeador = (resPer && resPer.length > 0) ? resPer[0].nombre_razon_social : 'Desconocido';
                    try { registrarBitacora(req.usuario.id, 'AGREGAR_BENEFICIARIO', `Agregó a ${nombre_completo} como beneficiario de: ${nombreFondeador}`); } catch (bitErr) {}
                    res.json({ success: true, message: 'Beneficiario registrado exitosamente', id_beneficiario: result.insertId });
                });
            });
        });
    });
});

router.delete('/beneficiarios/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    db.query('SELECT nombre_completo FROM BENEFICIARIOS WHERE id = ?', [id], (err, results) => {
        const nombreBen = (results && results.length > 0) ? results[0].nombre_completo : 'Beneficiario';
        db.query('DELETE FROM BENEFICIARIOS WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ success: false });
            registrarBitacora(req.usuario.id, 'ELIMINAR_BENEFICIARIO', `Eliminó al beneficiario: ${nombreBen}`);
            res.json({ success: true });
        });
    });
});

router.get('/movimientos/:id_inversor', verificarToken, (req, res) => {
    db.query('SELECT m.*, c.id as contrato_id FROM MOVIMIENTOS_INVERSION m JOIN CONTRATOS_INVERSION c ON m.id_contrato = c.id WHERE c.id_inversor = ? ORDER BY m.fecha_movimiento DESC', 
        [req.params.id_inversor], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/movimientos', verificarToken, upload.single('comprobante'), (req, res) => {
    const { id_contrato, tipo, monto } = req.body;
    let recibo = req.file ? `uploads/${req.file.filename}` : null;
    db.query('INSERT INTO MOVIMIENTOS_INVERSION (id_contrato, tipo, monto, recibo_comprobante, estatus_movimiento) VALUES (?, ?, ?, ?, "COMPLETADO")', [id_contrato, tipo, monto, recibo], (err) => {
        if (err) return res.status(500).json({ success: false });
        
        db.query('SELECT p.nombre_razon_social FROM CONTRATOS_INVERSION c JOIN PERSONAS p ON c.id_inversor = p.id WHERE c.id = ?', [id_contrato], (err, results) => {
           const nombreFondeador = (results && results.length > 0) ? results[0].nombre_razon_social : 'Desconocido';
           registrarBitacora(req.usuario.id, 'REGISTRAR_MOVIMIENTO', `Registró un movimiento de $${monto} (${tipo}) para: ${nombreFondeador}`);
           res.json({ success: true });
        });
    });
});

// =========================================================================
// RUTA GENERADORA DE CONSTANCIA DE DEPÓSITO EN PDF
// =========================================================================
router.get('/contratos/:id/pdf', verificarToken, (req, res) => {
    const idContrato = req.params.id;

    const query = `
        SELECT c.id as contrato_id, c.monto_inicial, c.fecha_inicio, c.fecha_fin, c.numero_disposicion,
               t.nombre_tasa, t.tasa_anual_esperada,
               p.nombre_razon_social as inversor, p.direccion, p.rfc
        FROM contratos_inversion c
        JOIN catalogo_tasas t ON c.id_tasa = t.id
        JOIN personas p ON c.id_inversor = p.id
        WHERE c.id = ?
    `;

    db.query(query, [idContrato], (err, results) => {
        if (err) {
            console.error("Error en SQL de Constancia PDF:", err);
            return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        }

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
        }

        const contrato = results[0];

        const fInicio = new Date(contrato.fecha_inicio);
        const fFin = new Date(contrato.fecha_fin);
        const plazoDias = Math.ceil((fFin - fInicio) / (1000 * 60 * 60 * 24));

        const doc = new PDFDocument({ size: 'LETTER', margin: 50 });

        res.setHeader('Content-disposition', `attachment; filename=Constancia_Sacimex_${contrato.contrato_id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 50, 40, { width: 50 });
        }

        doc.fontSize(11).font('Helvetica-Bold')
           .text('OPCIONES SACIMEX S.A. DE C.V. SOFOM E.N.R.', 110, 45, { align: 'center' });
        doc.fontSize(10).font('Helvetica-Bold')
           .text('CONSTANCIA DE FONDEO TÍTULOS CLASE III', 110, 60, { align: 'center' });
        
        doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
        
        let currentY = 100;
        doc.text('SUCURSAL:', 50, currentY);
        doc.font('Helvetica').text('01.CORPORATIVO', 120, currentY);
        doc.font('Helvetica-Bold').text('NÚMERO DE CONSTANCIA:', 320, currentY);
        doc.font('Helvetica').text(String(contrato.contrato_id).padStart(5, '0'), 460, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('FECHA DE DEPÓSITO:', 50, currentY);
        doc.font('Helvetica').text(fInicio.toLocaleDateString('es-MX'), 170, currentY);
        doc.font('Helvetica-Bold').text('FECHA DE VENCIMIENTO:', 320, currentY);
        doc.font('Helvetica').text(fFin.toLocaleDateString('es-MX'), 460, currentY);

        currentY += 20;
        doc.font('Helvetica-Bold').text('NOMBRE:', 50, currentY);
        doc.font('Helvetica').text(contrato.inversor.toUpperCase(), 110, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('DOMICILIO:', 50, currentY);
        doc.font('Helvetica').text(contrato.direccion?.toUpperCase() || 'NO REGISTRADO', 110, currentY, { width: 450 });

        currentY += 30;

        doc.rect(50, currentY, 510, 15).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').text('DATOS DE LA OPERACIÓN', 50, currentY + 4, { align: 'center' });
        
        currentY += 25;
        doc.fillColor('black'); 
        doc.font('Helvetica-Bold').text('MONTO DE FONDEO:', 50, currentY);
        doc.font('Helvetica').text(`$${Number(contrato.monto_inicial).toLocaleString('es-MX', {minimumFractionDigits: 2})}`, 175, currentY);
        
        doc.font('Helvetica-Bold').text('TASA NOMINAL:', 280, currentY);
        doc.font('Helvetica').text(`${contrato.tasa_anual_esperada}% Anual`, 360, currentY);
        
        doc.font('Helvetica-Bold').text('PLAZO:', 440, currentY);
        doc.font('Helvetica').text(`${plazoDias} Días`, 480, currentY);

        currentY += 20;
        doc.font('Helvetica-Bold').text('CANTIDAD CON LETRA:', 50, currentY);
        doc.font('Helvetica').text(numeroALetras(contrato.monto_inicial), 175, currentY);
        
        currentY += 20;
        doc.font('Helvetica-Bold').text('MONTO DE INTERÉS A RECIBIR AL VENCIMIENTO:', 50, currentY);
        doc.font('Helvetica').text('DE ACUERDO AL ESTADO DE CUENTA MENSUAL FECHA CORTE DIA CADA MES.', 305, currentY, { width: 255 });

        currentY += 30;
        doc.x = 50;
        doc.y = currentY;

        doc.font('Helvetica').fontSize(8);
        
        doc.text(`LA PRESENTE CONSTANCIA DE FONDEO QUE SE EMITE A FAVOR DE C. `, 50, doc.y, { continued: true, align: 'justify', width: 510 });
        doc.font('Helvetica-Bold').text(`${contrato.inversor.toUpperCase()} `, { continued: true });
        doc.font('Helvetica').text(`(EN ADELANTE "FONDEADOR") POR CONDUCTO DE OPCIONES SACIMEX® S.A. DE C.V. SOFOM E.N.R. (EN ADELANTE "SACIMEX®") SE SUJETARÁ A LAS SIGUIENTES:`);
        doc.moveDown(1);

        doc.font('Helvetica-Bold').text('CLÁUSULAS', 50, doc.y, { width: 510, align: 'center' });
        doc.moveDown(0.5);

        const clausulas = [
            "LA CANTIDAD DEPOSITADA DE LA PRESENTE CONSTANCIA SOLO PODRÁ RETIRARSE HASTA SU VENCIMIENTO.",
            "EN LA SUCURSAL DONDE EL (LA) FONDEADOR DEPOSITE, SERÁ EL LUGAR DONDE DEBE RETIRAR EL DEPÓSITO.",
            "LA PRESENTE CONSTANCIA NO SERÁ NEGOCIABLE, EN FORMA ALGUNA, POR LO CUAL EL IMPORTE DEL MISMO, ASÍ COMO LOS INTERESES CORRESPONDIENTES, ÚNICAMENTE LE SERÁN ENTREGADOS AL TITULAR, APODERADO, O BENEFICIARIO EN CASO DE FALLECIMIENTO DEL (LA) FONDEADOR.",
            "LA PRESENTE CONSTANCIA SERÁ FIRMADA POR EL (LA) FONDEADOR EN DUPLICADO, QUEDANDO EL ORIGINAL PARA EL (LA) FONDEADOR, SALVO EN CASO DE GARANTIZAR CRÉDITOS AUTOMÁTICOS.",
            "LOS PORCENTAJES DE INTERÉS SERÁN FIJADOS POR EL CONSEJO DE ADMINISTRACIÓN O EN SU CASO POR EL COMITÉ DE CRÉDITO SEGÚN CORRESPONDA, NOTIFICANDO A EL FONDEADOR, POR MEDIO DE CIRCULAR O EN AVISO QUE SE FIJARÁ EN LAS OFICINAS DE SACIMEX®.",
            "EL BENEFICIARIO DEBERÁ SER MAYOR DE EDAD CUMPLIDOS AL MOMENTO DE LA FIRMA DEL CONTRATO Y LA PRESENTE CONSTANCIA DEBERÁ PRESENTAR SU IDENTIFICACIÓN OFICIAL AL MOMENTO DE EJERCER SU DERECHO.",
            "LOS INTERESES SERÁN PAGADOS TOTALMENTE AL DEPOSITANTE AL VENCIMIENTO DE LA CONSTANCIA, SI A LA FECHA DEL VENCIMIENTO EL (LA) FONDEADOR NO SE PRESENTA, SÉ REINVERTIRÁ LA CANTIDAD DEPOSITADA MÁS EL RENDIMIENTO TOTAL AL MISMO PLAZO Y A LA TASA DE INTERÉS VIGENTE.",
            "TODO LO RELATIVO A LOS DERECHOS Y OBLIGACIONES QUE SE DERIVEN DE ESTA CONSTANCIA SE CUMPLIRÁN DE ACUERDO A LO ESTABLECIDO EN EL CONTRATO DE FONDEO A PLAZO FIJO CELEBRADO ENTRE EL (LA) FONDEADOR Y SACIMEX®."
        ];

        doc.font('Helvetica').fontSize(8);
        clausulas.forEach((texto, i) => {
            doc.text(`${i + 1}.- ${texto}`, 50, doc.y, { width: 510, align: 'justify', paragraphGap: 2 });
        });

        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(8).text(`DE LO ANTES EXPUESTO, AMBAS PARTES CONOCEN EL ALCANCE Y VALOR LEGAL DE LA PRESENTE CONSTANCIA, POR LO QUE UNA VEZ LEÍDO EL CONTENIDO DE LA MISMA EL DÍA ${new Date().toLocaleDateString('es-MX').toUpperCase()} PROCEDEN A FIRMARLA.`, 50, doc.y, { width: 510, align: 'justify' });

        doc.moveDown(3);

        const sigY = doc.y;
        
        doc.moveTo(80, sigY).lineTo(250, sigY).stroke();
        doc.font('Helvetica-Bold').text('FONDEADOR', 80, sigY + 5, { width: 170, align: 'center' });
        doc.font('Helvetica').text(`C. ${contrato.inversor.toUpperCase()}`, 80, sigY + 15, { width: 170, align: 'center' });

        doc.moveTo(350, sigY).lineTo(520, sigY).stroke();
        doc.font('Helvetica-Bold').text('PERSONAL AUTORIZADO', 350, sigY + 5, { width: 170, align: 'center' });
        doc.font('Helvetica').text('C. ELIZABETH CRUZ CANO', 350, sigY + 15, { width: 170, align: 'center' });

        doc.end();
        
        try {
            registrarBitacora(req.usuario.id, 'EXPORTAR_CONTRATO', `Descargó constancia del contrato #${contrato.contrato_id} perteneciente a: ${contrato.inversor}`);
        } catch (e) {
            console.error("Aviso: No se pudo registrar en bitácora", e);
        }
    });
});

// ==========================================
// RUTA WYSIWYG: TABLA DE AMORTIZACIÓN PDF ESTILIZADO
// ==========================================

router.post('/contratos/:id/tabla-amortizacion/generar-pdf', verificarToken, (req, res) => {
    const idContrato = req.params.id;
    const { tablaData, fondeador, montoInicial, tasa, sistema, fechaInicio, numeroDisposicion } = req.body;

    if (!tablaData || !Array.isArray(tablaData)) {
        return res.status(400).json({ success: false, message: 'Faltan los datos de la tabla.' });
    }

    try {
        const COLOR_PRIMARIO_VERDE = '#0F6B38'; 
        const COLOR_TEXTO_HEADER = '#FFFFFF';
        const COLOR_LINEAS = '#CBD5E1'; 
        const COLOR_SHADING_FILAS = '#F8FAFC'; 

        const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 30 });
        res.setHeader('Content-disposition', `attachment; filename=Amortizacion_Contrato_${idContrato}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        const logoPath = path.join(__dirname, '../../frontend/src/assets/logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, 40, 30, { width: 70 });
        }
        
        doc.fontSize(16).font('Helvetica-Bold').fillColor(COLOR_PRIMARIO_VERDE)
           .text('OPCIONES SACIMEX S.A. DE C.V. SOFOM E.N.R.', 0, 40, { align: 'center' });
        doc.fontSize(11).font('Helvetica').fillColor('black')
           .text('TABLA DE AMORTIZACIÓN DE FONDEO', 0, 60, { align: 'center' });
        
        const lineY = 115;
        doc.moveTo(40, lineY).lineTo(doc.page.width - 40, lineY).strokeColor(COLOR_LINEAS).stroke();

        let startY = 130;
        const infoRowHeight = 20;

        doc.font('Helvetica-Bold').fontSize(9).fillColor('black');
        
        doc.text('EMPRESA:', 50, startY);
        doc.font('Helvetica').text('OPCIONES SACIMEX S.A. DE C.V.', 150, startY);
        
        doc.font('Helvetica-Bold').text('CRÉDITO MAESTRO:', 50, startY + infoRowHeight);
        doc.font('Helvetica').text('1543999', 150, startY + infoRowHeight);
        
        doc.font('Helvetica-Bold').text('DISPOSICIÓN NO.:', 50, startY + (infoRowHeight * 2));
        doc.font('Helvetica').text(numeroDisposicion || 'S/N', 150, startY + (infoRowHeight * 2));

        doc.font('Helvetica-Bold').text('MONTO:', 50, startY + (infoRowHeight * 3));
        doc.font('Helvetica').text(formatMoney(montoInicial), 150, startY + (infoRowHeight * 3));

        doc.font('Helvetica-Bold').text('FONDEADOR:', 50, startY + (infoRowHeight * 4));
        doc.font('Helvetica').text(fondeador || 'N/A', 150, startY + (infoRowHeight * 4));

        const rightColX = 450;
        doc.font('Helvetica-Bold').text('MONEDA:', rightColX, startY);
        doc.font('Helvetica').text('MXN', rightColX + 110, startY);

        doc.font('Helvetica-Bold').text('TASA DE INT.:', rightColX, startY + infoRowHeight);
        doc.font('Helvetica').text(`${tasa}% Anual`, rightColX + 110, startY + infoRowHeight);

        doc.font('Helvetica-Bold').text('FECHA DISPOSICIÓN:', rightColX, startY + (infoRowHeight * 2));
        const fechaMostrar = fechaInicio ? new Date(fechaInicio + 'T12:00:00').toLocaleDateString('es-MX') : (tablaData[0] ? tablaData[0].fechaStr : 'S/N');
        doc.font('Helvetica').text(fechaMostrar, rightColX + 110, startY + (infoRowHeight * 2));

        doc.font('Helvetica-Bold').text('SISTEMA:', rightColX, startY + (infoRowHeight * 3));
        doc.font('Helvetica').text(sistema?.toUpperCase() || 'FRANCES', rightColX + 110, startY + (infoRowHeight * 3));

        let currentY = startY + (infoRowHeight * 5) + 20;

        const colWidths = [50, 80, 85, 85, 80, 60, 90, 90, 40]; 
        const tableWidth = colWidths.reduce((a, b) => a + b, 0);
        const tableStartX = (doc.page.width - tableWidth) / 2;
        
        const headers = ['NO. PAGO', 'VENCIMIENTO', 'ABONO PRINC.', 'ANTICIPO CAP.', 'INT. ORD.', 'IVA', 'TOTAL PAGO', 'SALDO INSOLUTO', 'DÍAS'];
        
        const drawTableHeader = (y) => {
            doc.rect(tableStartX, y - 6, tableWidth, 24).fillAndStroke(COLOR_PRIMARIO_VERDE, COLOR_PRIMARIO_VERDE);
            doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_TEXTO_HEADER);
            let x = tableStartX;
            headers.forEach((h, i) => { 
                doc.text(h, x, y + 2, { width: colWidths[i] - 5, align: i === 0 || i === 8 ? 'center' : 'right' }); 
                x += colWidths[i];
            });
            return y + 24;
        };

        currentY = drawTableHeader(currentY);
        doc.font('Helvetica').fontSize(8).fillColor('black');

        tablaData.forEach((row, rowIndex) => {
            let x = tableStartX;
            const isAlternateRow = rowIndex % 2 === 1;

            if (isAlternateRow) {
                doc.rect(tableStartX, currentY - 4, tableWidth, 18).fill(COLOR_SHADING_FILAS);
            }

            const vals = [
                row.numero, 
                row.fechaStr, 
                formatMoney(row.abono), 
                formatMoney(row.anticipo), 
                formatMoney(row.interes), 
                formatMoney(row.iva), 
                formatMoney(row.pagoTotal), 
                formatMoney(row.saldoFinal),
                row.dias || 30,
            ];
            
            doc.fillColor('black');
            vals.forEach((v, i) => { 
                doc.text(String(v), x, currentY + 1, { width: colWidths[i] - 5, align: i === 0 || i === 8 ? 'center' : 'right' }); 
                x += colWidths[i]; 
            });
            currentY += 18;
            
            if (currentY > doc.page.height - 60) { 
                doc.addPage({layout:'landscape', margin:30}); 
                doc.fillColor(COLOR_PRIMARIO_VERDE).fontSize(10).font('Helvetica-Bold').text('CONTINUACIÓN - CONTRATO #' + String(idContrato).padStart(5, '0'), 0, 30, { align: 'center' });
                currentY = drawTableHeader(60);
                doc.font('Helvetica').fontSize(8).fillColor('black');
            }
        });

        doc.rect(tableStartX, currentY - 4, tableWidth, 22).fill('#E2E8F0');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('black');
        
        doc.text('TOTALES:', tableStartX, currentY + 1, { width: colWidths[0] + colWidths[1] - 5, align: 'right' });
        
        const totalAbono = tablaData.reduce((acc, curr) => acc + (parseFloat(curr.abono) || 0), 0);
        const totalAnticipo = tablaData.reduce((acc, curr) => acc + (parseFloat(curr.anticipo) || 0), 0);
        const totalInteresOrd = tablaData.reduce((acc, curr) => acc + (parseFloat(curr.interes) || 0), 0);
        const totalIva = tablaData.reduce((acc, curr) => acc + (parseFloat(curr.iva) || 0), 0);
        const totalPagoGral = tablaData.reduce((acc, curr) => acc + (parseFloat(curr.pagoTotal) || 0), 0);
        const totalDias = tablaData.reduce((acc, curr) => acc + (parseInt(curr.dias) || 30), 0);

        let tx = tableStartX + colWidths[0] + colWidths[1];
        doc.text(formatMoney(totalAbono), tx, currentY + 1, { width: colWidths[2] - 5, align: 'right' }); tx += colWidths[2];
        doc.text(formatMoney(totalAnticipo), tx, currentY + 1, { width: colWidths[3] - 5, align: 'right' }); tx += colWidths[3];
        doc.text(formatMoney(totalInteresOrd), tx, currentY + 1, { width: colWidths[4] - 5, align: 'right' }); tx += colWidths[4];
        doc.text(formatMoney(totalIva), tx, currentY + 1, { width: colWidths[5] - 5, align: 'right' }); tx += colWidths[5];
        
        doc.fillColor(COLOR_PRIMARIO_VERDE);
        doc.text(formatMoney(totalPagoGral), tx, currentY + 1, { width: colWidths[6] - 5, align: 'right' }); tx += colWidths[6];
        
        doc.fillColor('black');
        doc.text('-', tx, currentY + 1, { width: colWidths[7] - 5, align: 'right' }); tx += colWidths[7];
        doc.text(String(totalDias), tx, currentY + 1, { width: colWidths[8] - 5, align: 'center' });

        doc.end();
        
        try {
            registrarBitacora(req.usuario.id, 'EXPORTAR_AMORTIZACION_ESTILIZADA', `Descargó tabla interactiva estilizada del contrato #${idContrato}`);
        } catch (e) {
            console.error("Aviso: No se pudo registrar en bitácora", e);
        }
    } catch (pdfError) {
        console.error("Error al generar PDF:", pdfError);
        res.status(500).json({ success: false, message: 'Error interno al generar PDF' });
    }
});

// ==========================================
// RUTA OCULTA: DISPARAR ALERTAS AL INICIAR SESIÓN
// ==========================================
router.post('/trigger-alertas-login', (req, res) => {
    // No usamos verificarToken aquí para que el Login pueda dispararlo libremente
    console.log('🔔 Iniciando sesión: Revisando vencimientos globales...');

    const queryFondeadores = `
        SELECT 
            ci.id AS id_contrato, ci.plan_json, ci.pagos_irregulares_json, 
            ci.fecha_inicio, ci.fecha_fin, ci.monto_inicial, ci.tipo_amortizacion,
            ci.numero_disposicion, t.tasa_anual_esperada, t.cobra_iva,
            p.nombre_razon_social AS proveedor,
            COALESCE((
                SELECT SUM(monto) FROM movimientos_inversion mi 
                WHERE mi.id_contrato = ci.id AND (mi.tipo = 'PAGO_INTERES' OR mi.tipo = 'DEPOSITO') AND mi.estatus_movimiento = 'COMPLETADO'
            ), 0) AS total_pagado
        FROM contratos_inversion ci
        JOIN inversores i ON ci.id_inversor = i.id_persona
        JOIN personas p ON i.id_persona = p.id
        JOIN catalogo_tasas t ON ci.id_tasa = t.id
        WHERE ci.estatus = 'ACTIVO' AND p.eliminado = FALSE
    `;

    db.query(queryFondeadores, (err, resContratos) => {
        if (err) return res.status(500).json({ success: false });

        let pagosAlerta = [];
        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
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
                }
            });

            tabla.forEach(pago => {
                if (!pago.pagado && pago.pagoTotal > 0.01) {
                    const diasRestantes = Math.ceil((pago.fechaPura - hoy) / (1000 * 60 * 60 * 24));
                    if (diasRestantes <= 15) { 
                        pagosAlerta.push({
                            proveedor: contrato.proveedor,
                            disposicion: contrato.numero_disposicion || 'S/N',
                            concepto: pago.numero === 'N/A' ? 'Inyección a Capital' : `Rendimiento (Cuota ${pago.numero})`,
                            monto: pago.pagoTotal,
                            fecha: pago.fechaStr,
                            dias_restantes: diasRestantes
                        });
                    }
                }
            });
        });

        if (pagosAlerta.length > 0) {
            pagosAlerta.sort((a,b) => a.dias_restantes - b.dias_restantes);

            let filasHtml = '';
            pagosAlerta.forEach(p => {
                const estatusTexto = p.dias_restantes < 0 ? `Vencido por ${Math.abs(p.dias_restantes)} días` : p.dias_restantes === 0 ? 'Vence Hoy' : `En ${p.dias_restantes} días`;
                const colorEstatus = p.dias_restantes < 0 ? '#ef4444' : p.dias_restantes === 0 ? '#f59e0b' : '#3b82f6';
                
                filasHtml += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px;">${p.proveedor}</td>
                        <td style="padding: 10px; font-weight: bold;">${p.disposicion}</td>
                        <td style="padding: 10px;">${p.concepto}</td>
                        <td style="padding: 10px; text-align: center;">${p.fecha}</td>
                        <td style="padding: 10px; text-align: right; font-weight: bold;">$${Number(p.monto).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        <td style="padding: 10px; text-align: center; color: ${colorEstatus}; font-weight: bold;">${estatusTexto}</td>
                    </tr>
                `;
            });

            const cuerpoCorreo = `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 900px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #0F6B38; border-bottom: 2px solid #0F6B38; padding-bottom: 10px; margin-top: 0;">Reporte de Vencimientos de Fondeo (Inicio de Sesión)</h2>
                    <p>Estimada C.P. Trinidad,</p>
                    <p>Un usuario acaba de acceder al sistema. Este es el resumen en tiempo real de obligaciones pendientes de pago para los próximos 15 días, así como saldos vencidos:</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px;">
                        <thead>
                            <tr style="background-color: #0F6B38; color: white;">
                                <th style="padding: 12px; text-align: left;">Fondeador</th>
                                <th style="padding: 12px; text-align: left;">Disp.</th>
                                <th style="padding: 12px; text-align: left;">Concepto</th>
                                <th style="padding: 12px; text-align: center;">Fecha Límite</th>
                                <th style="padding: 12px; text-align: right;">Total Salida</th>
                                <th style="padding: 12px; text-align: center;">Estatus</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasHtml}
                        </tbody>
                    </table>
                </div>
            `;

            const opcionesCorreo = {
                from: '"Sistema de Alertas" <ordazruudvan@gmail.com>',
                to: 'ordazruudvan@gmail.com', 
                subject: `Alertas de Pago - ${pagosAlerta.length} Vencimientos Próximos`,
                html: cuerpoCorreo
            };

            transportadorSMTP.sendMail(opcionesCorreo, (err, info) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
        } else {
            res.json({ success: true, message: 'Nada pendiente' });
        }
    });
});

module.exports = router;