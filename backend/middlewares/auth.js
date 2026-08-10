// backend/middlewares/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db  = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'sacimex';

// ── MAPA DE ACCIÓN → MÓDULO ───────────────────────────────────────────────────
// Clasifica cada acción en el módulo al que pertenece para poder
// filtrar en la pantalla de Auditoría.
const ACCION_MODULO = {
  // Sesión
  LOGIN: 'sesion', LOGOUT: 'sesion', LOGIN_FALLIDO: 'sesion',
  // Usuarios
  CREAR_USUARIO: 'usuarios', EDITAR_USUARIO: 'usuarios', ELIMINAR_USUARIO: 'usuarios',
  EDITAR_PERMISOS_USUARIO: 'usuarios',
  // Roles
  CREAR_ROL: 'configuracion', ELIMINAR_ROL: 'configuracion',
  // Clientes
  CREAR_CLIENTE: 'clientes', EDITAR_CLIENTE: 'clientes', ELIMINAR_CLIENTE: 'clientes',
  VER_CLIENTE: 'clientes',
  // Fondeadores / Inversores
  CREAR_FONDEADOR: 'inversores', EDITAR_FONDEADOR: 'inversores',
  ELIMINAR_FONDEADOR: 'inversores', CAMBIO_ESTATUS: 'inversores',
  NUEVA_INVERSION: 'inversores', CREAR_CONTRATO: 'inversores',
  NUEVO_FONDEO: 'inversores', EXPORTAR_CONTRATO: 'inversores',
  EXPORTAR_AMORTIZACION: 'inversores', EXPORTAR_AMORTIZACION_ESTILIZADA: 'inversores',
  INYECCION_CAPITAL: 'inversores', ABONO_CAPITAL: 'inversores',
  REESTRUCTURACION: 'inversores', REGISTRAR_MOVIMIENTO: 'inversores',
  AGREGAR_BENEFICIARIO: 'inversores', PAGO_FONDEADOR: 'inversores',
  ENVIO_ALERTAS: 'inversores', ENVIO_ALERTAS_SMTP: 'inversores',
  // Proveedores
  CREAR_PROVEEDOR: 'proveedores', EDITAR_PROVEEDOR: 'proveedores',
  ELIMINAR_PROVEEDOR: 'proveedores', IMPORTAR_PROVEEDORES: 'proveedores',
  PAGO_PROVEEDOR: 'proveedores',
  // Solicitudes
  NUEVA_SOLICITUD: 'solicitudes', AUTORIZAR: 'solicitudes',
  AUTORIZAR_SOLICITUD: 'solicitudes', RECHAZAR_SOLICITUD: 'solicitudes',
  SUBIR_COMPROBANTE: 'solicitudes', AUTORIZACIÓN_FINAL_PAGO: 'solicitudes',
  // Viáticos
  SOLICITUD_VIATICOS: 'viaticos', VIATICO_AUTORIZADO: 'viaticos',
  VIATICO_PAGADO: 'viaticos', VIATICO_RECIBIDO: 'viaticos',
  VIATICO_COMPROBADO: 'viaticos', COMPROBACION_GUARDADA: 'viaticos',
  COMPROBANTE_TRANSF: 'viaticos', COMPROBACION_GASTOS: 'viaticos',
  // Reportes
  EXPORTAR_REPORTE: 'reportes',
  // Configuración
  NUEVA_TASA: 'configuracion', EDITAR_TASA: 'configuracion',
  ELIMINAR_TASA: 'configuracion', ESTATUS_TASA: 'configuracion',
  CREAR_CONCEPTO: 'configuracion', EDITAR_CONCEPTO: 'configuracion',
  ELIMINAR_CONCEPTO: 'configuracion', ESTATUS_CONCEPTO: 'configuracion',
  CREAR_PUESTO: 'configuracion', EDITAR_PUESTO: 'configuracion',
  CREAR_CATEGORIA: 'configuracion', CREAR_REGLA_AUTORIZACION: 'configuracion',
  EDITAR_REGLA_AUTORIZACION: 'configuracion', ELIMINAR_REGLA_AUTORIZACION: 'configuracion',
  ESTATUS_REGLA_AUTORIZACION: 'configuracion',
};

// ── verificarToken ────────────────────────────────────────────────────────────
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No enviaste token de seguridad' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
}

// ── registrarBitacora ─────────────────────────────────────────────────────────
// Registra CUALQUIER acción en bitacora_auditoria con:
//   - id_usuario, nombre_completo, rol_usuario
//   - accion, modulo (clasificado automáticamente), detalle
//   - ip_address, metodo_http, ruta
//   - fecha con milisegundos exactos
//
// Uso: registrarBitacora(req.usuario.id, 'CREAR_CLIENTE', 'Creó a Juan Pérez', req)
function registrarBitacora(idUsuario, accion, detalle, req) {
  const ip      = req ? (req.ip || req.headers?.['x-forwarded-for'] || null) : null;
  const metodo  = req?.method || null;
  const ruta    = req?.originalUrl || req?.path || null;
  const modulo  = ACCION_MODULO[accion] || 'sistema';
  const fechaMs = new Date();

  // Si tenemos id de usuario, enriquecemos con nombre y rol desde la BD
  const insertarRegistro = (nombreCompleto, rolUsuario) => {
    const sql = `
      INSERT INTO bitacora_auditoria
        (id_usuario, nombre_completo, rol_usuario, accion, modulo, detalle, ip_address, metodo_http, ruta, fecha, fecha_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    db.query(sql, [
      idUsuario || null,
      nombreCompleto || null,
      rolUsuario || null,
      accion,
      modulo,
      detalle || null,
      ip,
      metodo,
      ruta,
      fechaMs,
    ], (err) => {
      if (err) console.error('[Bitácora] Error al registrar:', err.message);
    });
  };

  if (idUsuario && idUsuario > 0) {
    // Buscar nombre completo y rol del usuario
    db.query(
      `SELECT u.username, u.rol,
              COALESCE(p.nombre_razon_social, u.username) AS nombre_completo
       FROM usuarios u
       LEFT JOIN empleados e ON u.id_empleado = e.id_persona
       LEFT JOIN personas p ON e.id_persona = p.id
       WHERE u.id = ?`,
      [idUsuario],
      (err, rows) => {
        if (err || rows.length === 0) {
          insertarRegistro(null, null);
        } else {
          insertarRegistro(rows[0].nombre_completo, rows[0].rol);
        }
      }
    );
  } else {
    insertarRegistro('ANÓNIMO', null);
  }
}

module.exports = { verificarToken, registrarBitacora, JWT_SECRET };