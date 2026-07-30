import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './MatrizAutorizacion.css';

const API = 'http://localhost:3001/api';

const COLORES_DEPTO = ['#10d440', '#4338ca', '#c2410c', '#0891b2', '#be185d', '#7c3aed', '#b45309', '#0f766e', '#dc2626'];
const colorParaDepto = (idDepto) => COLORES_DEPTO[(idDepto || 0) % COLORES_DEPTO.length];

function MatrizAutorizacion() {
  const navigate = useNavigate();

  const [reglas, setReglas] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const vacio = { id_departamento: '', nivel: 0, etiqueta_nivel: '', id_rol: '', id_usuario: '' };
  const [formData, setFormData] = useState(vacio);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchAll = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const [resMatriz, resDeptos, resRoles, resUsuarios] = await Promise.all([
        fetch(`${API}/configuracion/matriz-autorizacion`, { headers }),
        fetch(`${API}/configuracion/departamentos`, { headers }),
        fetch(`${API}/roles`, { headers }),
        fetch(`${API}/usuarios`, { headers }),
      ]);
      const [dMatriz, dDeptos, dRoles, dUsuarios] = await Promise.all([
        resMatriz.json(), resDeptos.json(), resRoles.json(), resUsuarios.json()
      ]);
      if (dMatriz.success) setReglas(dMatriz.data);
      if (dDeptos.success) setDepartamentos(dDeptos.data);
      if (dRoles.success) setRoles(dRoles.data);
      if (dUsuarios.success) setUsuarios(dUsuarios.data);
    } catch (err) {
      console.error('Error cargando la matriz de autorización', err);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const reglasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return reglas;
    return reglas.filter(r =>
      (r.departamento_nombre || '').toLowerCase().includes(q) ||
      (r.etiqueta_nivel || '').toLowerCase().includes(q) ||
      (r.nombre_rol || '').toLowerCase().includes(q) ||
      (r.username || '').toLowerCase().includes(q)
    );
  }, [reglas, busqueda]);

  const abrirNuevo = () => {
    setIsEditing(false); setEditId(null); setFormError('');
    setFormData(vacio);
    setIsModalOpen(true);
  };

  const abrirEditar = (regla) => {
    setIsEditing(true); setEditId(regla.id); setFormError('');
    setFormData({
      id_departamento: regla.id_departamento || '',
      nivel: regla.nivel,
      etiqueta_nivel: regla.etiqueta_nivel,
      id_rol: regla.id_rol || '',
      id_usuario: regla.id_usuario || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.id_rol && !formData.id_usuario) {
      setFormError('Debes elegir un rol habilitado para firmar, o un usuario específico como excepción.');
      return;
    }

    setIsLoading(true);
    const headers = getAuthHeaders(); if (!headers) { setIsLoading(false); return; }
    const url = isEditing
      ? `${API}/configuracion/matriz-autorizacion/${editId}`
      : `${API}/configuracion/matriz-autorizacion`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method, headers,
        body: JSON.stringify({
          id_departamento: formData.id_departamento || null,
          nivel: formData.nivel,
          etiqueta_nivel: formData.etiqueta_nivel,
          id_rol: formData.id_rol || null,
          id_usuario: formData.id_usuario || null,
        })
      });
      const data = await res.json();
      if (!data.success) { setFormError(data.message || 'No se pudo guardar.'); return; }
      setIsModalOpen(false);
      fetchAll();
    } catch (err) {
      setFormError('Error de conexión al guardar.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEstatus = async (regla) => {
    const headers = getAuthHeaders(); if (!headers) return;
    await fetch(`${API}/configuracion/matriz-autorizacion/${regla.id}/estatus`, {
      method: 'PUT', headers,
      body: JSON.stringify({ estatus_activo: regla.estatus_activo ? 0 : 1 })
    });
    fetchAll();
  };

  const eliminar = async (regla) => {
    if (!window.confirm(`¿Eliminar la regla "${regla.etiqueta_nivel}"? Esta acción no se puede deshacer.`)) return;
    const headers = getAuthHeaders(); if (!headers) return;
    const res = await fetch(`${API}/configuracion/matriz-autorizacion/${regla.id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (!data.success) { alert(data.message || 'No se pudo eliminar.'); return; }
    fetchAll();
  };

  return (
    <div className="matriz-container fade-in-up">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Matriz de Autorización</h1>
          <p>Define quién firma cada nivel de una solicitud. El nivel -1 (Visto Bueno) lo resuelve automáticamente el departamento dueño del concepto de pago.</p>
        </div>
        <button className="btn-primary" onClick={abrirNuevo}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nueva Regla
        </button>
      </div>

      <div className="matriz-toolbar stagger-2 fade-in-up">
        <div className="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            type="text"
            placeholder="Buscar por departamento, rol o usuario..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper stagger-2 fade-in-up">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Nivel</th>
                <th>Etiqueta</th>
                <th>Quién firma</th>
                <th>Estatus</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reglasFiltradas.map(r => (
                <tr key={r.id}>
                  <td>
                    {r.departamento_nombre ? (
                      <span className="dept-pill">
                        <span className="dept-dot" style={{ backgroundColor: colorParaDepto(r.id_departamento) }}></span>
                        {r.departamento_nombre}
                      </span>
                    ) : (
                      <span className="dept-general">Regla general (todos)</span>
                    )}
                  </td>
                  <td><span className="nivel-badge">{r.nivel}</span></td>
                  <td>{r.etiqueta_nivel}</td>
                  <td>
                    {r.id_usuario
                      ? <span className="quien-firma-usuario">Solo {r.username}</span>
                      : <span className="quien-firma-rol">{r.nombre_rol}</span>}
                  </td>
                  <td>
                    <button
                      className={`badge-estatus ${r.estatus_activo ? 'badge-activo-dark' : 'badge-inactivo'}`}
                      onClick={() => toggleEstatus(r)}
                    >
                      {r.estatus_activo ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td>
                    <div className="acciones-cell">
                      <button className="btn-icon-edit" onClick={() => abrirEditar(r)} title="Editar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button className="btn-icon-delete" onClick={() => eliminar(r)} title="Eliminar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {reglasFiltradas.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <h3>{reglas.length === 0 ? 'No hay reglas configuradas todavía' : 'Sin resultados para tu búsqueda'}</h3>
              <p>{reglas.length === 0 ? 'Crea la primera regla con el botón "Nueva Regla".' : 'Intenta con otro término.'}</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Regla' : 'Nueva Regla de Autorización'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">

                <div className="form-group">
                  <label>Departamento</label>
                  <select
                    value={formData.id_departamento}
                    onChange={e => setFormData({ ...formData, id_departamento: e.target.value })}
                  >
                    <option value="">— Regla general (todos los departamentos) —</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                  <small>Déjalo vacío para que aplique a cualquier departamento.</small>
                </div>

                <div className="form-group">
                  <label>Nivel</label>
                  <input
                    type="number" required
                    value={formData.nivel}
                    onChange={e => setFormData({ ...formData, nivel: parseInt(e.target.value) || 0 })}
                  />
                  <small>0 = Revisor, 1 = Autorizador nivel 1, 2 = Autorizador nivel 2, etc.</small>
                </div>

                <div className="form-group">
                  <label>Etiqueta</label>
                  <input
                    type="text" required
                    value={formData.etiqueta_nivel}
                    onChange={e => setFormData({ ...formData, etiqueta_nivel: e.target.value })}
                    placeholder='Ej. "Autorizador nivel 1"'
                  />
                </div>

                <div className="firmante-box">
                  <div className="form-group">
                    <label>Rol habilitado para firmar</label>
                    <select
                      value={formData.id_rol}
                      onChange={e => setFormData({ ...formData, id_rol: e.target.value, id_usuario: e.target.value ? '' : formData.id_usuario })}
                    >
                      <option value="">— Ninguno —</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nombre_rol}</option>)}
                    </select>
                  </div>

                  <div className="firmante-divider">o excepción puntual</div>

                  <div className="form-group">
                    <label>Solo esta persona puede firmar</label>
                    <select
                      value={formData.id_usuario}
                      onChange={e => setFormData({ ...formData, id_usuario: e.target.value, id_rol: e.target.value ? '' : formData.id_rol })}
                    >
                      <option value="">— Ninguno —</option>
                      {usuarios.map(u => <option key={u.id_usuario} value={u.id_usuario}>{u.username}</option>)}
                    </select>
                  </div>
                </div>

                {formError && <div className="error-message">{formError}</div>}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Guardando...' : 'Guardar Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MatrizAutorizacion;