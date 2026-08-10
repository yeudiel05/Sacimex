const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, registrarBitacora } = require('../middlewares/auth');
const { autorizar } = require('../middlewares/autorizar');

// ==========================================
// APIS DE CATÁLOGO DE CONCEPTOS DE PAGO
// ==========================================

router.get('/conceptos', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O'), (req, res) => {
    db.query('SELECT * FROM conceptos_pago ORDER BY id ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/conceptos', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { clave, descripcion, uso_cfdi, metodo_pago, requiere_vobo, area_visto_bueno } = req.body;
    db.query('INSERT INTO conceptos_pago (clave, descripcion, uso_cfdi, metodo_pago, requiere_vobo, area_visto_bueno) VALUES (?, ?, ?, ?, ?, ?)', 
    [clave, descripcion, uso_cfdi || null, metodo_pago || null, requiere_vobo ? 1 : 0, requiere_vobo ? area_visto_bueno : null], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'La clave ya existe o hubo un error.' });
        registrarBitacora(req.usuario.id, 'CREAR_CONCEPTO', `Creo la cuenta de gasto: ${descripcion}`, req);
        res.json({ success: true, message: 'Concepto creado exitosamente.' });
    });
});

router.put('/conceptos/:clave', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { descripcion, uso_cfdi, metodo_pago, requiere_vobo, area_visto_bueno } = req.body;
    db.query(`UPDATE conceptos_pago 
              SET descripcion = ?, 
                  uso_cfdi = COALESCE(?, uso_cfdi), 
                  metodo_pago = COALESCE(?, metodo_pago), 
                  requiere_vobo = ?, 
                  area_visto_bueno = ? 
              WHERE clave = ?`, 
    [descripcion, uso_cfdi, metodo_pago, requiere_vobo ? 1 : 0, requiere_vobo ? area_visto_bueno : null, req.params.clave], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_CONCEPTO', `Modifico la cuenta de gasto: ${descripcion}`, req);
        res.json({ success: true, message: 'Concepto actualizado.' });
    });
});

router.put('/conceptos/:clave/estatus', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE conceptos_pago SET estatus_activo = ? WHERE clave = ?', [estatus_activo, req.params.clave], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al cambiar estatus' });
        registrarBitacora(req.usuario.id, 'ESTATUS_CONCEPTO', `Cambio estatus del concepto ${req.params.clave} a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
        res.json({ success: true, message: 'Estatus actualizado' });
    });
});

router.delete('/conceptos/:clave', verificarToken, autorizar('ADMIN'), (req, res) => {
    db.query('DELETE FROM conceptos_pago WHERE clave = ?', [req.params.clave], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este concepto ya fue usado en solicitudes pasadas.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_CONCEPTO', `Elimino la cuenta de gasto con clave: ${req.params.clave}`, req);
        res.json({ success: true, message: 'Concepto eliminado.' });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE BANCOS
// ==========================================

router.get('/bancos', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O'), (req, res) => {
    db.query('SELECT * FROM catalogo_bancos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/bancos', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre } = req.body;
    db.query('INSERT INTO catalogo_bancos (nombre) VALUES (?)', [nombre.toUpperCase().trim()], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El banco ya existe o hubo un error.' });
        registrarBitacora(req.usuario.id, 'CREAR_BANCO', `Agrego el banco al catalogo: ${nombre}`, req);
        res.json({ success: true, message: 'Banco agregado exitosamente.' });
    });
});

router.put('/bancos/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre } = req.body;
    db.query('UPDATE catalogo_bancos SET nombre = ? WHERE id = ?', [nombre.toUpperCase().trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_BANCO', `Modifico el banco ID ${req.params.id} a: ${nombre}`, req);
        res.json({ success: true, message: 'Banco actualizado.' });
    });
});

router.put('/bancos/:id/estatus', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_bancos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_BANCO', `Cambio estatus del banco ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
        res.json({ success: true });
    });
});

router.delete('/bancos/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    db.query('DELETE FROM catalogo_bancos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este banco ya esta asignado a cuentas o proveedores.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_BANCO', `Elimino un banco del catalogo (ID: ${req.params.id})`, req);
        res.json({ success: true, message: 'Banco eliminado.' });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE DEPARTAMENTOS / AREAS
// ==========================================

router.get('/departamentos', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O'), (req, res) => {
    db.query('SELECT * FROM catalogo_departamentos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/departamentos', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre } = req.body;
    db.query('INSERT INTO catalogo_departamentos (nombre) VALUES (?)', [nombre.toUpperCase().trim()], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El departamento ya existe.' });
        registrarBitacora(req.usuario.id, 'CREAR_DEPTO', `Agrego el departamento: ${nombre}`, req);
        res.json({ success: true, message: 'Departamento agregado exitosamente.' });
    });
});

router.put('/departamentos/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre } = req.body;
    db.query('UPDATE catalogo_departamentos SET nombre = ? WHERE id = ?', [nombre.toUpperCase().trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_DEPTO', `Modifico el depto ID ${req.params.id} a: ${nombre}`, req);
        res.json({ success: true, message: 'Departamento actualizado.' });
    });
});

router.put('/departamentos/:id/estatus', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_departamentos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_DEPTO', `Cambio estatus del departamento ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
        res.json({ success: true });
    });
});

router.delete('/departamentos/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    db.query('DELETE FROM catalogo_departamentos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este departamento esta en uso por usuarios o reglas de VoBo.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_DEPTO', `Elimino un departamento (ID: ${req.params.id})`, req);
        res.json({ success: true, message: 'Departamento eliminado.' });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE PUESTOS
// ==========================================

router.get('/puestos', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O'), (req, res) => {
    db.query('SELECT * FROM catalogo_puestos ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/puestos', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('INSERT INTO catalogo_puestos (nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default) VALUES (?, ?, ?, ?, ?)', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'El puesto ya existe.' });
        registrarBitacora(req.usuario.id, 'CREAR_PUESTO', `Agrego el puesto: ${nombre}`, req);
        res.json({ success: true, message: 'Puesto agregado exitosamente.' });
    });
});

router.put('/puestos/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre, departamento_default, nivel_default, rol_default, puede_solicitar_default } = req.body;
    db.query('UPDATE catalogo_puestos SET nombre = ?, departamento_default = ?, nivel_default = ?, rol_default = ?, puede_solicitar_default = ? WHERE id = ?', 
    [nombre.toUpperCase().trim(), departamento_default, nivel_default || 0, rol_default || 'AUXILIAR', puede_solicitar_default || 0, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_PUESTO', `Modifico el puesto ID ${req.params.id} a: ${nombre}`, req);
        res.json({ success: true, message: 'Puesto actualizado.' });
    });
});

router.put('/puestos/:id/estatus', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE catalogo_puestos SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_PUESTO', `Cambio estatus del puesto ID ${req.params.id} a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
        res.json({ success: true });
    });
});

router.delete('/puestos/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    db.query('SELECT nombre FROM catalogo_puestos WHERE id = ?', [req.params.id], (err, results) => {
        const nombrePuesto = (results && results.length > 0) ? results[0].nombre : 'Puesto Desconocido';
        
        db.query('DELETE FROM catalogo_puestos WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque este puesto esta en uso.' });
            registrarBitacora(req.usuario.id, 'ELIMINAR_PUESTO', `Elimino el puesto: ${nombrePuesto}`, req);
            res.json({ success: true, message: 'Puesto eliminado.' });
        });
    });
});

// ==========================================
// APIS DE CATÁLOGO DE CATEGORIAS DE PROVEEDOR
// ==========================================

router.get('/categorias', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O'), (req, res) => {
    db.query('SELECT * FROM catalogo_categorias_proveedor ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al cargar categorias' });
        res.json({ success: true, data: results });
    });
});

router.post('/categorias', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre } = req.body;
    db.query('INSERT INTO catalogo_categorias_proveedor (nombre) VALUES (?)', [nombre.toUpperCase().trim()], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'La categoria ya existe o hubo un error.' });
        registrarBitacora(req.usuario.id, 'CREAR_CATEGORIA', `Agrego la categoria: ${nombre}`, req);
        res.json({ success: true, message: 'Categoria agregada exitosamente.' });
    });
});

router.put('/categorias/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { nombre } = req.body;
    db.query('UPDATE catalogo_categorias_proveedor SET nombre = ? WHERE id = ?', [nombre.toUpperCase().trim(), req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'EDITAR_CATEGORIA', `Modifico la categoria ID ${req.params.id} a: ${nombre}`, req);
        res.json({ success: true, message: 'Categoria actualizada.' });
    });
});

router.put('/categorias/:id/estatus', verificarToken, autorizar('ADMIN'), (req, res) => {
    const { estatus_activo } = req.body;
    
    db.query('SELECT nombre FROM catalogo_categorias_proveedor WHERE id = ?', [req.params.id], (err, results) => {
        const nombreCat = (results && results.length > 0) ? results[0].nombre : 'Categoria Desconocida';
        
        db.query('UPDATE catalogo_categorias_proveedor SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'ESTATUS_CATEGORIA', `Cambio estatus de la categoria '${nombreCat}' a ${estatus_activo ? 'Activo' : 'Inactivo'}`, req);
            res.json({ success: true });
        });
    });
});

router.delete('/categorias/:id', verificarToken, autorizar('ADMIN'), (req, res) => {
    db.query('SELECT nombre FROM catalogo_categorias_proveedor WHERE id = ?', [req.params.id], (err, results) => {
        const nombreCat = (results && results.length > 0) ? results[0].nombre : 'Categoria';
        
        db.query('DELETE FROM catalogo_categorias_proveedor WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'No se puede eliminar porque esta categoria esta en uso por algunos proveedores.' });
            registrarBitacora(req.usuario.id, 'ELIMINAR_CATEGORIA', `Elimino la categoria: ${nombreCat}`, req);
            res.json({ success: true, message: 'Categoria eliminada.' });
        });
    });
});

// ==========================================
// APIS DE MATRIZ DE AUTORIZACION
// (quién firma cada nivel; reemplaza los ifs hardcodeados del código)
// ==========================================

// Nombres amigables para los módulos en los logs
const NOMBRES_MODULO = {
    dashboard: 'Dashboard', clientes: 'Clientes', inversores: 'Fondeadores',
    proveedores: 'Proveedores', solicitudes: 'Solicitudes', historial: 'Historial de Solicitudes',
    autorizaciones: 'Autorizar Pagos', viaticos: 'Viáticos', bandeja_dho: 'Bandeja D.H.O.',
    reportes: 'Reportes', auditoria: 'Auditoría', usuarios: 'Usuarios y Roles',
    configuracion: 'Configuración', matriz: 'Matriz de Autorización',
};

const soloAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'ADMIN') return res.status(403).json({ success: false, message: 'Solo un administrador puede modificar la matriz de autorización.' });
    next();
};

router.get('/matriz-autorizacion', verificarToken, autorizar('ADMIN', 'CONTADOR', 'REVISOR', 'AUTORIZADOR_1', 'AUTORIZADOR_2', 'TESORERIA', 'D.H.O'), (req, res) => {
    db.query(`
        SELECT m.id, m.id_departamento, cd.nombre AS departamento_nombre,
               m.nivel, m.etiqueta_nivel,
               m.id_rol, r.nombre_rol,
               m.id_usuario, u.username,
               m.estatus_activo
        FROM matriz_autorizacion m
        LEFT JOIN catalogo_departamentos cd ON m.id_departamento = cd.id
        LEFT JOIN catalogo_roles r ON m.id_rol = r.id
        LEFT JOIN usuarios u ON m.id_usuario = u.id
        ORDER BY (m.id_departamento IS NULL) DESC, cd.nombre ASC, m.nivel ASC
    `, (err, results) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        res.json({ success: true, data: results });
    });
});

router.post('/matriz-autorizacion', verificarToken, autorizar('ADMIN'), soloAdmin, (req, res) => {
    const { id_departamento, nivel, etiqueta_nivel, id_rol, id_usuario } = req.body;
    db.query(
        'INSERT INTO matriz_autorizacion (id_departamento, nivel, etiqueta_nivel, id_rol, id_usuario) VALUES (?, ?, ?, ?, ?)',
        [id_departamento || null, nivel, etiqueta_nivel, id_rol || null, id_usuario || null],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'CREAR_REGLA_AUTORIZACION', `Creó regla de autorización: nivel ${nivel} - "${etiqueta_nivel}"`, req);
            res.json({ success: true, message: 'Regla de autorización creada.' });
        }
    );
});

router.put('/matriz-autorizacion/:id', verificarToken, autorizar('ADMIN'), soloAdmin, (req, res) => {
    const { id_departamento, nivel, etiqueta_nivel, id_rol, id_usuario } = req.body;
    db.query(
        'UPDATE matriz_autorizacion SET id_departamento = ?, nivel = ?, etiqueta_nivel = ?, id_rol = ?, id_usuario = ? WHERE id = ?',
        [id_departamento || null, nivel, etiqueta_nivel, id_rol || null, id_usuario || null, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'EDITAR_REGLA_AUTORIZACION', `Modificó la regla de autorización "${etiqueta_nivel || req.params.id}"`, req);
            res.json({ success: true, message: 'Regla actualizada.' });
        }
    );
});

router.put('/matriz-autorizacion/:id/estatus', verificarToken, autorizar('ADMIN'), soloAdmin, (req, res) => {
    const { estatus_activo } = req.body;
    db.query('UPDATE matriz_autorizacion SET estatus_activo = ? WHERE id = ?', [estatus_activo, req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        registrarBitacora(req.usuario.id, 'ESTATUS_REGLA_AUTORIZACION', `Cambió estatus de regla de autorización a ${estatus_activo ? 'Activa' : 'Inactiva'}`, req);
        res.json({ success: true });
    });
});

router.delete('/matriz-autorizacion/:id', verificarToken, autorizar('ADMIN'), soloAdmin, (req, res) => {
    db.query('DELETE FROM matriz_autorizacion WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'No se pudo eliminar la regla.' });
        registrarBitacora(req.usuario.id, 'ELIMINAR_REGLA_AUTORIZACION', `Eliminó una regla de autorización`, req);
        res.json({ success: true, message: 'Regla eliminada.' });
    });
});

// ============================================================
// PERMISOS GRANULARES POR USUARIO
// ============================================================

// GET /api/configuracion/mis-permisos — el usuario consulta SUS propios permisos (en tiempo real)
router.get('/mis-permisos', verificarToken, (req, res) => {
    db.query(
        `SELECT modulo, puede_ver, puede_crear, puede_editar, puede_eliminar
         FROM permisos_usuario
         WHERE id_usuario = ?`,
        [req.usuario.id],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false });
            const permisos = {};
            rows.forEach(p => {
                if (p.puede_ver) {
                    permisos[p.modulo] = {
                        ver:      !!p.puede_ver,
                        crear:    !!p.puede_crear,
                        editar:   !!p.puede_editar,
                        eliminar: !!p.puede_eliminar,
                    };
                }
            });
            res.json({ success: true, permisos });
        }
    );
});

// GET /api/configuracion/permisos/:id_usuario
router.get('/permisos/:id_usuario', verificarToken, soloAdmin, (req, res) => {
    db.query(
        `SELECT p.*, u.username, u.rol
         FROM permisos_usuario p
         JOIN usuarios u ON p.id_usuario = u.id
         WHERE p.id_usuario = ?
         ORDER BY p.modulo ASC`,
        [req.params.id_usuario],
        (err, rows) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true, data: rows });
        }
    );
});

// POST /api/configuracion/permisos — crear o actualizar permiso (upsert)
router.post('/permisos', verificarToken, soloAdmin, (req, res) => {
    const { id_usuario, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar } = req.body;
    if (!id_usuario || !modulo) return res.status(400).json({ success: false, message: 'id_usuario y modulo son requeridos' });

    const sql = `
        INSERT INTO permisos_usuario (id_usuario, modulo, puede_ver, puede_crear, puede_editar, puede_eliminar, creado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            puede_ver = VALUES(puede_ver),
            puede_crear = VALUES(puede_crear),
            puede_editar = VALUES(puede_editar),
            puede_eliminar = VALUES(puede_eliminar),
            creado_por = VALUES(creado_por)
    `;
    db.query(sql, [id_usuario, modulo, puede_ver ? 1 : 0, puede_crear ? 1 : 0, puede_editar ? 1 : 0, puede_eliminar ? 1 : 0, req.usuario.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        // Buscar el username del usuario afectado para el log
        db.query('SELECT username FROM usuarios WHERE id = ?', [id_usuario], (errU, rowsU) => {
            const nombreAfectado = (rowsU && rowsU[0]) ? rowsU[0].username : `ID ${id_usuario}`;
            const nombreModulo = NOMBRES_MODULO[modulo] || modulo;
            registrarBitacora(req.usuario.id, 'EDITAR_PERMISOS_USUARIO', `Actualizó permisos de "${nombreAfectado}" en módulo "${nombreModulo}"`, req);
        });
        res.json({ success: true, message: 'Permisos actualizados.' });
    });
});

// DELETE /api/configuracion/permisos/:id — eliminar permiso (vuelve a usar solo el rol)
router.delete('/permisos/:id', verificarToken, soloAdmin, (req, res) => {
    // Primero obtenemos el detalle del permiso para el log
    db.query(`SELECT u.username, p.modulo FROM permisos_usuario p JOIN usuarios u ON p.id_usuario = u.id WHERE p.id = ?`, [req.params.id], (errD, rowsD) => {
        const nombreMod = NOMBRES_MODULO[rowsD[0]?.modulo] || rowsD[0]?.modulo;
        const detalle = (rowsD && rowsD[0]) ? `"${rowsD[0].username}" en módulo "${nombreMod}"` : `ID ${req.params.id}`;
        db.query('DELETE FROM permisos_usuario WHERE id = ?', [req.params.id], (err) => {
            if (err) return res.status(500).json({ success: false, message: err.message });
            registrarBitacora(req.usuario.id, 'ELIMINAR_PERMISO_USUARIO', `Quitó permiso de ${detalle}`, req);
            res.json({ success: true, message: 'Permiso eliminado. El usuario queda bajo su rol.' });
        });
    });
});

module.exports = router;