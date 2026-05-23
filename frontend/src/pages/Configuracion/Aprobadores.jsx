import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Proveedores/Proveedores.css'; // Reutilizamos los mismos estilos corporativos

function Aprobadores() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [aprobadores, setAprobadores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    nombre_completo: '',
    puesto: '',
    correo: '',
    rol_sistema: 'SOLICITANTE'
  });
  const [fileFirma, setFileFirma] = useState(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchAprobadores = async () => {
    const headers = getAuthHeaders(); if (!headers) return;
    try {
      const response = await fetch('http://localhost:3001/api/aprobadores', { headers });
      if (response.status === 403) return navigate('/'); // Si no es admin, pa' fuera
      const data = await response.json();
      if (data.success) setAprobadores(data.data);
    } catch (error) { console.error("Error:", error); }
  };

  useEffect(() => { fetchAprobadores(); }, []);

  const openNewModal = () => {
    setIsEditing(false); setEditId(null); setFormError('');
    setFormData({ nombre_completo: '', puesto: '', correo: '', rol_sistema: 'SOLICITANTE' });
    setFileFirma(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setIsEditing(true); setEditId(user.id); setFormError('');
    setFormData({ nombre_completo: user.nombre_completo, puesto: user.puesto, correo: user.correo, rol_sistema: user.rol_sistema });
    setFileFirma(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!formData.nombre_completo || !formData.correo) return setFormError('El nombre y el correo son obligatorios');
    if (!isEditing && !fileFirma) return setFormError('Debes adjuntar la firma en formato PNG transparente');

    const headers = getAuthHeaders(); if (!headers) return;
    setIsLoading(true);

    const formDataUpload = new FormData();
    formDataUpload.append('nombre_completo', formData.nombre_completo);
    formDataUpload.append('puesto', formData.puesto);
    formDataUpload.append('correo', formData.correo);
    formDataUpload.append('rol_sistema', formData.rol_sistema);
    if (fileFirma) formDataUpload.append('firma_png', fileFirma);

    const url = isEditing ? `http://localhost:3001/api/aprobadores/${editId}` : 'http://localhost:3001/api/aprobadores';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: { Authorization: headers.Authorization }, body: formDataUpload });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchAprobadores();
      } else {
        setFormError(data.message || 'Error al guardar');
      }
    } catch (error) {
      setFormError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("¿Seguro que deseas eliminar este aprobador? Si ya firmó solicitudes, el sistema no lo permitirá por auditoría.")) return;
    const headers = getAuthHeaders();
    const res = await fetch(`http://localhost:3001/api/aprobadores/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if(data.success) fetchAprobadores();
    else alert(data.message);
  };

  // Ayudante visual para el color del Rol
  const renderBadgeRol = (rol) => {
    const colores = {
        'SOLICITANTE': { bg: '#f1f5f9', color: '#475569' },
        'REVISOR': { bg: '#fef3c7', color: '#d97706' },
        'AUT_1': { bg: '#dbeafe', color: '#2563eb' },
        'AUT_2': { bg: '#e0e7ff', color: '#4f46e5' },
        'AUT_3': { bg: '#fce7f3', color: '#7c3aed' },
        'TESORERIA': { bg: '#dcfce3', color: '#16a34a' }
    };
    const style = colores[rol] || colores['SOLICITANTE'];
    return (
        <span style={{ backgroundColor: style.bg, color: style.color, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>
            {rol.replace('_', ' ')}
        </span>
    );
  };

  return (
    <div className="inversores-container">
      <div className="page-header stagger-1 fade-in-up">
        <div>
          <h1>Matriz de Autorizaciones</h1>
          <p>Gestión de firmas digitales y niveles de aprobación (Workflow)</p>
        </div>
        <button className="btn-primary" onClick={openNewModal}>+ Nuevo Aprobador</button>
      </div>

      <div className="inversores-list-container fade-in-up">
        <div className="list-header">
            <h2>Personal Autorizado</h2>
        </div>
        <div className="table-responsive">
            <table className="data-table">
                <thead>
                    <tr>
                        <th style={{width: '25%'}}>Personal</th>
                        <th style={{width: '25%'}}>Contacto Corporativo</th>
                        <th style={{width: '20%', textAlign: 'center'}}>Nivel de Autoridad</th>
                        <th style={{width: '20%', textAlign: 'center'}}>Firma Digital</th>
                        <th style={{width: '10%', textAlign: 'right'}}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {aprobadores.map(user => (
                        <tr key={user.id}>
                            <td>
                                <strong>{user.nombre_completo}</strong>
                                <span style={{display: 'block', fontSize: '12px', color: 'var(--text-muted)'}}>{user.puesto}</span>
                            </td>
                            <td>{user.correo}</td>
                            <td style={{textAlign: 'center'}}>{renderBadgeRol(user.rol_sistema)}</td>
                            <td style={{textAlign: 'center'}}>
                                {user.ruta_firma_png ? (
                                    <div style={{ backgroundColor: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'inline-block' }}>
                                        <img src={`http://localhost:3001/uploads/${user.ruta_firma_png}`} alt="Firma" style={{ height: '30px', objectFit: 'contain' }} />
                                    </div>
                                ) : (
                                    <span style={{fontSize:'12px', color: '#ef4444'}}>Sin firma</span>
                                )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="btn-icon-edit" onClick={() => openEditModal(user)} title="Editar">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button className="btn-icon-edit btn-icon-delete" onClick={() => handleDelete(user.id)} title="Eliminar">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '18px'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {aprobadores.length === 0 && (
                        <tr><td colSpan="5" className="empty-state">No hay usuarios en la matriz de aprobación.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- MODAL ALTA / EDICIÓN --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in-down" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Editar Aprobador' : 'Agregar a la Matriz'}</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column'}}>
              <div className="modal-form" style={{padding: '24px 32px'}}>
                <div className="form-group">
                    <label>Nombre Completo</label>
                    <input type="text" required placeholder="Ej. L.C.P. Mariam Itzel Ramirez..." value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} />
                </div>
                <div className="form-group">
                    <label>Puesto o Cargo Oficial</label>
                    <input type="text" required placeholder="Ej. Gerente de Contabilidad" value={formData.puesto} onChange={e => setFormData({...formData, puesto: e.target.value})} />
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label>Correo Electrónico (Notificaciones)</label>
                        <input type="email" required value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Nivel de Autoridad</label>
                        <select className="custom-select" value={formData.rol_sistema} onChange={e => setFormData({...formData, rol_sistema: e.target.value})}>
                            <option value="SOLICITANTE">Crear Solicitudes (Gerente Suc.)</option>
                            <option value="REVISOR">Paso 1: Revisor (Contabilidad)</option>
                            <option value="AUT_1">Paso 2: Autorización Nivel 1</option>
                            <option value="AUT_2">Paso 3: Autorización Nivel 2</option>
                            <option value="AUT_3">Paso 4: Autorización (Director)</option>
                            <option value="TESORERIA">Paso 5: Tesorería (Liquidador)</option>
                        </select>
                    </div>
                </div>
                <div className="form-group" style={{marginTop: '16px'}}>
                    <label>Firma Digitalizada (Requisito: PNG Transparente)</label>
                    <div style={{ padding: '16px', border: '2px dashed var(--brand-green)', borderRadius: '8px', backgroundColor: 'var(--brand-green-light)', textAlign: 'center' }}>
                        <input type="file" accept=".png" onChange={e => setFileFirma(e.target.files[0])} style={{ display: 'none' }} ref={fileInputRef} />
                        <button type="button" className="btn-view" style={{ borderColor: 'var(--brand-green)', color: 'var(--brand-green)', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => fileInputRef.current.click()}>
                            {fileFirma ? fileFirma.name : 'Subir Archivo .PNG'}
                        </button>
                        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                            Para que el documento Excel/PDF final se genere correctamente, la firma no debe tener fondo blanco.
                        </p>
                    </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '20px 32px' }}>
                {formError && <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 'bold' }}>{formError}</span>}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Guardando...' : 'Guardar y Autorizar'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Aprobadores;