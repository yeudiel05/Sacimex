import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Reportes.css';

function Reportes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/'); return null; }
    return { 'Authorization': `Bearer ${token}` };
  };

 const handleDownload = async (tipo) => {
    const headers = getAuthHeaders(); if (!headers) return;
    setLoading(tipo);

    try {
      const response = await fetch(`http://localhost:3001/api/reportes/${tipo}`, {
        method: 'GET',
        headers: headers
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.clear(); navigate('/'); return;
      }

      if (!response.ok) {
        alert(`Error del servidor. Verifica que la base de datos esté conectada y la ruta exista.`);
        setLoading(false);
        return; 
      }

      const blob = await response.blob();
      
      if (blob.type.includes('json') || blob.type.includes('text')) {
        alert("El servidor no devolvió un archivo Excel válido.");
        setLoading(false);
        return;
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const fecha = new Date().toISOString().split('T')[0];
      link.download = `Sacimex_${tipo.charAt(0).toUpperCase() + tipo.slice(1)}_${fecha}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error("Error al descargar el reporte:", error);
      alert("Hubo un error de conexión al generar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  const reportesList = [
    {
      id: 'clientes',
      titulo: 'Directorio de Clientes',
      desc: 'Exporta toda la cartera de clientes, RFCs, datos de contacto y líneas de crédito asignadas.',
      icon: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    },
    {
      id: 'inversores',
      titulo: 'Padrón de Inversores',
      desc: 'Lista completa de capitalistas, datos bancarios (CLABE) y origen de fondos.',
      icon: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
    },
    {
      id: 'proveedores',
      titulo: 'Cuentas por Pagar (Proveedores)',
      desc: 'Directorio de proveedores, cuentas receptoras y categorías de servicio contratadas.',
      icon: <rect x="1" y="3" width="15" height="13" rx="2"></rect>
    }
  ];

  return (
    <div className="reportes-container fade-in-up">
      <div className="page-header stagger-1">
        <div>
          <h1>Centro de Exportaciones</h1>
          <p>Descarga la información de tu base de datos en formato Excel (.xlsx)</p>
        </div>
      </div>

      <div className="reportes-grid stagger-2">
        {reportesList.map((rep) => (
          <div className="report-card" key={rep.id}>
            <div className="report-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {rep.icon}
                <circle cx="9" cy="7" r="4" display={rep.id === 'clientes' ? 'block' : 'none'}></circle>
                <polyline points="17 6 23 6 23 12" display={rep.id === 'inversores' ? 'block' : 'none'}></polyline>
                <polygon points="16 8 20 8 23 11 23 16 16 16 8" display={rep.id === 'proveedores' ? 'block' : 'none'}></polygon>
              </svg>
            </div>
            
            <div className="report-content">
              <h3>{rep.titulo}</h3>
              <p>{rep.desc}</p>
            </div>

            <div className="report-footer">
              <button 
                className="btn-download" 
                onClick={() => handleDownload(rep.id)}
                disabled={loading === rep.id}
              >
                {loading === rep.id ? (
                  <span>Generando...</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Descargar Excel
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Reportes;