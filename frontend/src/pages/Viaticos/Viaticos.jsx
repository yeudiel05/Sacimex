import React, { useState, useEffect, useRef } from 'react';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import './Viaticos.css';

const AREAS = ['NORMATIVA', 'OPERATIVA', 'ADMINISTRATIVA'];

const DEPARTAMENTOS = [
  'TESORERIA', 'CONTABILIDAD', 'D.H.O', 'TIC´S', 'INNOVACION Y NUEVOS PROYECTOS TI', 
  'MESA DE CONTROL', 'COMITE DE CREDITO', 'CONTRALORIA', 'JURIDICO', 'COORDINACION PROMOTORIAS', 
  'COORDINACION PRODUCTO COMUNAL', 'COORDINACION PRODUCTO GRUPAL', 'COORDINACION PRODUCTO INDIVIDUAL Y NOMINA', 
  'GERENCIA DE OPERACIONES', 'GERENCIA GENERAL'
];

const AUTORIZADORES = [
  'KENIA VARGAS LOPEZ', 'YEDANI BERENICE SANCHEZ QUINTERO', 'ANDRES ELOY CRUZ CANO', 
  'VERONICA LOPEZ LUIS', 'MARIELA FANNY CRUZ CASTELLANOS', 'JUAN MANUEL RIVERA ORTIGOZA', 
  'EDGAR JAVIER MORALES RAMIREZ', 'LETICIA CRUZ ANGULO', 'ROSA ELIA CORTÉS MARTINEZ', 
  'ELVIRA GARCIA GARZON', 'EBER ZABDIEL ALVAREZ MIRANDA', 'ELIZABETH CRUZ CANO', 'ISAAC CRUZ CANO'
];


const RUBROS = ['Hospedaje', 'Alimentos', 'Transporte', 'Otros gastos'];

const partidasVacias = () => Array.from({ length: 8 }, () => ({
  fecha: '', importe: '', folio_fiscal: '', rfc_proveedor: '',
  nombre_proveedor: '', rubro: 'Otros gastos', descripcion: ''
}));

function Viaticos() {
  const [tabActiva, setTabActiva] = useState('NUEVA');
  const [solicitudesPendientesJefe, setSolicitudesPendientesJefe] = useState([]);
  const [cargandoJefe, setCargandoJefe] = useState(false);
  const [historialFirmas, setHistorialFirmas] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [todasSolicitudes, setTodasSolicitudes] = useState([]);
  const [cargandoTodas, setCargandoTodas] = useState(false);
  const [filtroEstatus, setFiltroEstatus] = useState('TODAS');
  const [tabuladorDinamico, setTabuladorDinamico] = useState({});
  const [listaEmpleados, setListaEmpleados] = useState([]); // para select de acompañantes
  const rolUsuario = (localStorage.getItem('rol') || '').toUpperCase();
  const [desgloseGrid, setDesgloseGrid] = useState({});
  const [fechasDesglose, setFechasDesglose] = useState([]);
  const [acompanantes, setAcompanantes] = useState([]); // [{ nombre, sexo }]
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const fileInputRefs = useRef({});
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [destinoOtro, setDestinoOtro] = useState('');
  const [unidadesNegocio, setUnidadesNegocio] = useState([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [archivosRecepcion, setArchivosRecepcion] = useState({});
  const [subiendoRecepcion, setSubiendoRecepcion] = useState({});

  const [formData, setFormData] = useState({
    solicitante_nombre: '', puesto: '', unidad_negocio: '', area: '', departamento: '', jefe_inmediato: '', 
    origen: '', destino: '', motivo: '', fecha_salida: '', fecha_regreso: '', dias_comision: 0,
    num_acompanantes: '0', nombres_acompanantes: '', sexo_solicitante: 'M', medio_transporte: '', 
    monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', monto_taxis: '', monto_gasolina: '', monto_otros: '', 
    observaciones: '', total_solicitado: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // =========================================================
  // ESTADO: COMPROBACIÓN UNIVERSAL DE GASTOS (por solicitud)
  // =========================================================
  const [comprobacionesAbiertas, setComprobacionesAbiertas] = useState({});
  const [comprobaciones, setComprobaciones] = useState({});
  const [guardandoComp, setGuardandoComp] = useState({});

  const compVacia = (sol) => ({
    responsable: sol.puesto || '',
    nombre_proveedor_header: '',
    fecha_inicial: sol.fecha_salida ? sol.fecha_salida.split('T')[0] : '',
    fecha_final: sol.fecha_regreso ? sol.fecha_regreso.split('T')[0] : '',
    lugar: sol.destino || '',
    recursos_otorgados: sol.total_solicitado || '',
    fondo_fijo: '',
    unidad_negocio: sol.ubicacion || '',
    objeto: sol.motivo || '',
    personas_adicionales: sol.num_acompanantes || '0',
    partidas: partidasVacias(),
    cargada: false
  });

  // Abrir/cerrar comprobación y cargar desde BD la primera vez
  const abrirComprobacion = async (sol) => {
    const yaAbierto = comprobacionesAbiertas[sol.id];
    if (yaAbierto) {
      setComprobacionesAbiertas(prev => ({ ...prev, [sol.id]: false }));
      return;
    }
    if (comprobaciones[sol.id]?.cargada) {
      setComprobacionesAbiertas(prev => ({ ...prev, [sol.id]: true }));
      return;
    }
    try {
      const res = await fetch(`/api/viaticos/${sol.id}/comprobacion-universal`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        setComprobaciones(prev => ({
          ...prev,
          [sol.id]: {
            responsable: d.responsable || '',
            nombre_proveedor_header: d.nombre_proveedor || '',
            fecha_inicial: d.fecha_inicial ? d.fecha_inicial.split('T')[0] : '',
            fecha_final: d.fecha_final ? d.fecha_final.split('T')[0] : '',
            lugar: d.lugar || '',
            recursos_otorgados: d.recursos_otorgados || '',
            fondo_fijo: d.fondo_fijo || '',
            unidad_negocio: d.unidad_negocio || '',
            objeto: d.objeto || '',
            personas_adicionales: d.personas_adicionales || '0',
            partidas: d.partidas.length > 0 ? d.partidas.map(p => ({
              fecha: p.fecha ? p.fecha.split('T')[0] : '',
              importe: p.importe || '',
              folio_fiscal: p.folio_fiscal || '',
              rfc_proveedor: p.rfc_proveedor || '',
              nombre_proveedor: p.nombre_proveedor || '',
              rubro: p.rubro || 'Otros gastos',
              descripcion: p.descripcion || ''
            })) : partidasVacias(),
            cargada: true
          }
        }));
      } else {
        setComprobaciones(prev => ({ ...prev, [sol.id]: compVacia(sol) }));
      }
    } catch (e) {
      setComprobaciones(prev => ({ ...prev, [sol.id]: compVacia(sol) }));
    }
    setComprobacionesAbiertas(prev => ({ ...prev, [sol.id]: true }));
  };

  const handleCompChange = (solId, e) => {
    setComprobaciones(prev => ({
      ...prev,
      [solId]: { ...(prev[solId] || {}), [e.target.name]: e.target.value }
    }));
  };

  const handlePartidaChange = (solId, index, field, value) => {
    setComprobaciones(prev => {
      const actual = { ...(prev[solId] || {}) };
      const partidas = [...(actual.partidas || [])];
      partidas[index] = { ...partidas[index], [field]: value };
      return { ...prev, [solId]: { ...actual, partidas } };
    });
  };

  const agregarPartida = (solId) => {
    setComprobaciones(prev => {
      const actual = prev[solId] || {};
      return { ...prev, [solId]: { ...actual, partidas: [...(actual.partidas || []), { fecha: '', importe: '', folio_fiscal: '', rfc_proveedor: '', nombre_proveedor: '', rubro: 'Otros gastos', descripcion: '' }] } };
    });
  };

  const eliminarPartida = (solId, index) => {
    setComprobaciones(prev => {
      const actual = prev[solId] || {};
      return { ...prev, [solId]: { ...actual, partidas: (actual.partidas || []).filter((_, i) => i !== index) } };
    });
  };

  const getTotalComprobado = (comp) =>
    (comp?.partidas || []).reduce((sum, p) => sum + (parseFloat(p.importe) || 0), 0);

  const getTotalPorRubro = (comp, rubro) =>
    (comp?.partidas || []).filter(p => p.rubro === rubro).reduce((s, p) => s + (parseFloat(p.importe) || 0), 0);

  // GUARDAR en BD
  const guardarComprobacion = async (sol) => {
    const comp = comprobaciones[sol.id];
    if (!comp) return;
    setGuardandoComp(prev => ({ ...prev, [sol.id]: true }));
    try {
      const res = await fetch(`/api/viaticos/${sol.id}/comprobacion-universal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(comp)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Comprobación guardada. D.H.O. ya puede verla.');
        setComprobaciones(prev => ({ ...prev, [sol.id]: { ...comp, cargada: true } }));
      } else {
        alert('Error: ' + data.message);
      }
    } catch (e) {
      alert('Error de conexión al guardar.');
    } finally {
      setGuardandoComp(prev => ({ ...prev, [sol.id]: false }));
    }
  };

  // GUARDAR Y VER COMPROBACIÓN EN PDF (con firma del empleado)
  const descargarComprobacion = async (sol) => {
    const comp = comprobaciones[sol.id];
    if (!comp) return;
    setGuardandoComp(prev => ({ ...prev, [sol.id]: true }));
    try {
      const resGuardar = await fetch(`/api/viaticos/${sol.id}/comprobacion-universal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(comp)
      });
      const dataGuardar = await resGuardar.json();
      if (!dataGuardar.success) {
        alert('Error al guardar la comprobación: ' + dataGuardar.message);
        return;
      }
      setComprobaciones(prev => ({ ...prev, [sol.id]: { ...comp, cargada: true } }));

      const resPdf = await fetch(`/api/viaticos/${sol.id}/comprobacion-universal/pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!resPdf.ok) {
        const dataErr = await resPdf.json().catch(() => null);
        alert(dataErr?.message || 'Error al generar el PDF de la comprobación.');
        return;
      }
      const blob = await resPdf.blob();
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 10000);
    } catch (e) {
      alert('Error de conexión al generar la comprobación.');
    } finally {
      setGuardandoComp(prev => ({ ...prev, [sol.id]: false }));
    }
  };

  // =========================================================
  // FUNCIONES GENERALES
  // =========================================================
  const fetchUnidadesNegocio = async () => {
    try {
      const res = await fetch('/api/unidades', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setUnidadesNegocio(data.data);
    } catch (error) {
      console.error("Error al cargar unidades de negocio:", error);
    } finally {
      setLoadingUnidades(false);
    }
  };

  const fetchTabulador = async () => {
    try {
      const res = await fetch('/api/tabulador-viaticos', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        // Convertir array a objeto { destino: { hospedaje, alimentos, ... } }
        const obj = {};
        data.data.forEach(t => {
          if (t.estatus_activo) {
            obj[t.destino] = {
              hospedaje: parseFloat(t.hospedaje) || 0,
              alimentos: parseFloat(t.alimentos) || 0,
              urban:     parseFloat(t.urban)     || 0,
              bus:       parseFloat(t.bus)        || 0,
              peaje:     parseFloat(t.peaje)      || 0,
              gasolina:  parseFloat(t.gasolina)   || 0,
              taxi:      parseFloat(t.taxi)       || 0,
            };
          }
        });
        setTabuladorDinamico(obj);
      }
    } catch (error) { console.error("Error al cargar tabulador:", error); }
  };

  useEffect(() => {
    const fetchPerfilEmpleado = async () => {
      try {
        const res = await fetch('/api/viaticos/perfil', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success) {
          const p = data.perfil;
          setFormData(prev => ({
            ...prev,
            solicitante_nombre: p.nombre_completo || localStorage.getItem('nombre_completo') || localStorage.getItem('username') || '',
            puesto:             p.puesto           || prev.puesto,
            departamento:       p.departamento     || prev.departamento,
            unidad_negocio:     p.ubicacion        || prev.unidad_negocio,
            area:               p.ubicacion        || prev.area,
            jefe_inmediato:     p.jefe_inmediato   || prev.jefe_inmediato,
            sexo_solicitante:   p.sexo             || localStorage.getItem('sexo') || 'M'
          }));
          if (data.empleados) setListaEmpleados(data.empleados);
        }
      } catch (error) { console.error("Error al cargar perfil."); }
    };
    if (tabActiva === 'NUEVA') {
      fetchPerfilEmpleado();
      fetchUnidadesNegocio();
      fetchTabulador();
    }
  }, [tabActiva]);

  useEffect(() => {
    if (formData.fecha_salida && formData.fecha_regreso) {
      const salida = new Date(formData.fecha_salida);
      const regreso = new Date(formData.fecha_regreso);
      const dias = Math.ceil((regreso.getTime() - salida.getTime()) / (1000 * 3600 * 24)) + 1;
      setFormData(prev => ({ ...prev, dias_comision: dias > 0 ? dias : 0 }));
      // Generar array de fechas para el desglose
      const fechas = [];
      for (let i = 0; i < dias; i++) {
        const f = new Date(salida);
        f.setDate(f.getDate() + i);
        fechas.push(f.toISOString().split('T')[0]);
      }
      setFechasDesglose(fechas);
      setDesgloseGrid({});
    }
  }, [formData.fecha_salida, formData.fecha_regreso]);

  // Sincronizar array de acompañantes cuando cambia el número
  useEffect(() => {
    const n = parseInt(formData.num_acompanantes) || 0;
    setAcompanantes(prev => {
      if (prev.length === n) return prev;
      if (prev.length < n) return [...prev, ...Array(n - prev.length).fill(null).map(() => ({ nombre: '', sexo: '', motivo: '' }))];
      return prev.slice(0, n);
    });
  }, [formData.num_acompanantes]);

  useEffect(() => {
    if (!formData.destino || formData.destino === 'Otro' || formData.dias_comision === 0) return;
    const tab = tabuladorDinamico[formData.destino];
    if (!tab) return;
    const dias   = formData.dias_comision;
    const noches = Math.max(0, dias - 1);
    const totalPersonas = 1 + parseInt(formData.num_acompanantes || 0);

    // Hospedaje: cuartos por sexo, máx 3 personas del mismo sexo por cuarto
    const sexoSol = formData.sexo_solicitante || 'M';
    const masc    = (sexoSol === 'M' ? 1 : 0) + acompanantes.filter(a => a.sexo === 'M').length;
    const fem     = (sexoSol === 'F' ? 1 : 0) + acompanantes.filter(a => a.sexo === 'F').length;
    const sinSexo = acompanantes.filter(a => !a.sexo).length;
    const cuartos = Math.ceil(masc / 3) + Math.ceil(fem / 3) + sinSexo;
    const calcHospedaje = tab.hospedaje * noches * Math.max(cuartos, 1);
    const calcAlimentos = tab.alimentos * dias * totalPersonas;

    let calcPasajes = 0, calcGasolina = 0, calcOtros = tab.peaje, calcTaxis = tab.taxi;
    if (formData.medio_transporte === 'Autobús' || formData.medio_transporte === 'Avión') {
      calcPasajes = (tab.bus + tab.urban) * totalPersonas;
      calcGasolina = 0; calcOtros = 0; calcTaxis = 0;
    } else if (formData.medio_transporte === 'Auto Empresa' || formData.medio_transporte === 'Auto Propio') {
      const vehiculos = Math.ceil(totalPersonas / 4);
      calcPasajes  = 0;
      calcGasolina = tab.gasolina * vehiculos; // ida+vuelta por vehículo
      calcOtros    = tab.peaje   * vehiculos;  // ida+vuelta por vehículo
      calcTaxis    = 0;
    }
    setFormData(prev => ({
      ...prev,
      monto_alimentos: calcAlimentos > 0 ? calcAlimentos : '',
      monto_hospedaje: calcHospedaje > 0 ? calcHospedaje : '',
      monto_pasajes:   calcPasajes   > 0 ? calcPasajes   : '',
      monto_gasolina:  calcGasolina  > 0 ? calcGasolina  : '',
      monto_taxis:     calcTaxis     > 0 ? calcTaxis     : '',
      monto_otros: prev.monto_otros ? prev.monto_otros : (calcOtros > 0 ? calcOtros : '')
    }));
  }, [formData.destino, formData.dias_comision, formData.medio_transporte, formData.num_acompanantes, formData.sexo_solicitante, acompanantes]);

  // Autocompletar el grid de desglose por día usando las tarifas del tabulador
  useEffect(() => {
    if (!formData.destino || formData.destino === 'Otro') return;
    if (fechasDesglose.length === 0) return;
    const tab = tabuladorDinamico[formData.destino];
    if (!tab) return;

    const personas = 1 + parseInt(formData.num_acompanantes || 0);
    const sexoSol = formData.sexo_solicitante || 'M';
    const masc2   = (sexoSol === 'M' ? 1 : 0) + acompanantes.filter(a => a.sexo === 'M').length;
    const fem2    = (sexoSol === 'F' ? 1 : 0) + acompanantes.filter(a => a.sexo === 'F').length;
    const sin2    = acompanantes.filter(a => !a.sexo).length;
    const cuartos2 = Math.max(Math.ceil(masc2/3) + Math.ceil(fem2/3) + sin2, 1);

    const nuevoGrid = {};
    const vehiculos = Math.ceil(personas / 4);
    const usaVehiculo2 = formData.medio_transporte === 'Auto Empresa' || formData.medio_transporte === 'Auto Propio';

    fechasDesglose.forEach((fecha, idx) => {
      const esUltimoDia = idx === fechasDesglose.length - 1;
      const esPrimerDia = idx === 0;

      // Hospedaje: por cuartos, excepto el último día
      if (!esUltimoDia && tab.hospedaje > 0) {
        nuevoGrid[`${fecha}_hospedaje`] = tab.hospedaje * cuartos2;
      }

      // Alimentos: tarifa diaria por persona
      if (tab.alimentos > 0) {
        nuevoGrid[`${fecha}_almuerzo`] = tab.alimentos * personas;
      }

      // Transporte:
      if (usaVehiculo2) {
        // Gasolina: la tarifa ya incluye ida+vuelta — se divide 50/50 entre primer y último día
        if (tab.gasolina > 0) {
          const mitad = (tab.gasolina * vehiculos) / 2;
          if (esPrimerDia)  nuevoGrid[`${fecha}_terrestre`] = (nuevoGrid[`${fecha}_terrestre`] || 0) + mitad;
          if (esUltimoDia)  nuevoGrid[`${fecha}_terrestre`] = (nuevoGrid[`${fecha}_terrestre`] || 0) + mitad;
        }
        // Peaje: igual, dividido 50/50 entre primer y último día
        if (tab.peaje > 0) {
          const mitadPeaje = (tab.peaje * vehiculos) / 2;
          if (esPrimerDia)  nuevoGrid[`${fecha}_terrestre`] = (nuevoGrid[`${fecha}_terrestre`] || 0) + mitadPeaje;
          if (esUltimoDia)  nuevoGrid[`${fecha}_terrestre`] = (nuevoGrid[`${fecha}_terrestre`] || 0) + mitadPeaje;
        }
      } else {
        // Bus/Avión: tarifa por persona, solo primer día (ida+vuelta ya incluido)
        if (esPrimerDia && tab.bus > 0) {
          nuevoGrid[`${fecha}_terrestre`] = tab.bus * personas;
        }
      }

      // Urban/taxi: cada día por persona
      if (tab.urban > 0) {
        nuevoGrid[`${fecha}_terrestre`] = (nuevoGrid[`${fecha}_terrestre`] || 0) + tab.urban * personas;
      }
    });

    setDesgloseGrid(nuevoGrid);
  }, [formData.destino, formData.medio_transporte, formData.num_acompanantes, formData.sexo_solicitante, acompanantes, fechasDesglose]);

  useEffect(() => {
    const total = ['monto_alimentos', 'monto_hospedaje', 'monto_pasajes', 'monto_taxis', 'monto_gasolina', 'monto_otros']
      .reduce((sum, key) => sum + (parseFloat(formData[key]) || 0), 0);
    setFormData(prev => ({ ...prev, total_solicitado: total }));
  }, [formData.monto_alimentos, formData.monto_hospedaje, formData.monto_pasajes, formData.monto_taxis, formData.monto_gasolina, formData.monto_otros]);

  // Cuando el usuario llena el grid por día, sincronizar los totales
  // por categoría con los campos de monto para que el resumen sea correcto.
  useEffect(() => {
    if (Object.keys(desgloseGrid).length === 0) return;

    const sumar = (cats) => cats.reduce((s, cat) =>
      s + fechasDesglose.reduce((s2, f) => s2 + (parseFloat(desgloseGrid[`${f}_${cat}`]) || 0), 0), 0);

    const totalAlimentos  = sumar(['almuerzo']);    const totalHospedaje  = sumar(['hospedaje']);
    const totalTransporte = sumar(['aereo', 'terrestre']);
    const totalVehiculo   = sumar(['vehiculo']);
    const totalOtros      = sumar(['otros', 'especifique', 'comunicacion']);

    setFormData(prev => {
      const next = { ...prev };
      if (totalAlimentos  > 0) next.monto_alimentos = totalAlimentos;
      if (totalHospedaje  > 0) next.monto_hospedaje = totalHospedaje;
      if (totalTransporte > 0) next.monto_pasajes   = totalTransporte;
      if (totalVehiculo   > 0) next.monto_gasolina  = totalVehiculo;
      if (totalOtros      > 0) next.monto_otros     = totalOtros;
      next.total_solicitado = Object.values(desgloseGrid).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      return next;
    });
  }, [desgloseGrid]);

  const fetchSolicitudesPendientes = async () => {
    setCargandoJefe(true);
    try {
      const res = await fetch('/api/viaticos/pendientes', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      // Solo mostrar las que me toca firmar (no las propias del usuario)
      if (data.success) setSolicitudesPendientesJefe(data.data.filter(s => s.me_toca_firmar));
    } catch {} finally { setCargandoJefe(false); }
  };

  const fetchMisSolicitudes = async () => {
    setCargandoSolicitudes(true);
    try {
      const res = await fetch('/api/viaticos/mis-solicitudes', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      const data = await res.json();
      if (data.success) setMisSolicitudes(data.data);
    } catch (error) { console.error(error); } finally { setCargandoSolicitudes(false); }
  };

  const fetchTodasSolicitudes = async () => {
    setCargandoTodas(true);
    try {
      const res = await fetch('/api/viaticos/todas', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setTodasSolicitudes(data.data);
    } catch (e) { console.error(e); }
    finally { setCargandoTodas(false); }
  };

  const fetchHistorialFirmas = async () => {
    setCargandoHistorial(true);
    try {
      const res = await fetch('/api/viaticos/historial-firmadas', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) setHistorialFirmas(data.data);
    } catch (e) { console.error(e); }
    finally { setCargandoHistorial(false); }
  };

  useEffect(() => {
    if (tabActiva === 'MIS_SOLICITUDES') fetchMisSolicitudes();
    if (tabActiva === 'JEFE') fetchSolicitudesPendientes();
    if (tabActiva === 'MIS_FIRMAS') fetchHistorialFirmas();
    if (tabActiva === 'ADMIN') fetchTodasSolicitudes();
  }, [tabActiva]);
  useAutoRefresh(fetchMisSolicitudes, 20000, tabActiva === 'MIS_SOLICITUDES');
  useAutoRefresh(fetchSolicitudesPendientes, 20000, tabActiva === 'JEFE');
  useAutoRefresh(fetchTodasSolicitudes, 30000, tabActiva === 'ADMIN');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.total_solicitado <= 0) return alert("El monto total debe ser mayor a cero.");
    const desglose_dias = Object.entries(desgloseGrid)
      .filter(([, monto]) => parseFloat(monto) > 0)
      .map(([key, monto]) => {
        const [fecha, ...catParts] = key.split('_');
        const categoria = catParts.join('_');
        return { fecha, categoria, monto: parseFloat(monto) };
      });
    const payloadFinal = { ...formData, desglose_dias, acompanantes };
    if (payloadFinal.destino === 'Otro') {
      if (!destinoOtro.trim()) return alert("Por favor especifique el destino.");
      payloadFinal.destino = destinoOtro;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/viaticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payloadFinal)
      });
      const data = await res.json();
      if (data.success) {
        alert("¡Solicitud enviada correctamente! Primero debe ser autorizada por tu jefe inmediato, luego pasará a D.H.O.");
        setTabActiva('MIS_SOLICITUDES');
        setFormData(prev => ({
          ...prev, origen: '', destino: '', motivo: '', fecha_salida: '', fecha_regreso: '', dias_comision: 0,
          num_acompanantes: '0', nombres_acompanantes: '', medio_transporte: '', observaciones: '',
          monto_alimentos: '', monto_hospedaje: '', monto_pasajes: '', monto_taxis: '', monto_gasolina: '', monto_otros: '', total_solicitado: 0
        }));
        setDestinoOtro('');
      } else alert("Hubo un error: " + data.message);
    } catch (error) { alert("Error de conexión al servidor."); } finally { setIsSubmitting(false); }
  };

  const handleAutorizar = async (id, accion) => {
    const comentario = accion === 'RECHAZAR' ? prompt('Motivo de rechazo:') : '';
    if (accion === 'RECHAZAR' && !comentario) return;
    const url = accion === 'RECHAZAR'
      ? `/api/viaticos/rechazar/${id}`
      : `/api/viaticos/autorizar/${id}`;
    const body = accion === 'RECHAZAR'
      ? JSON.stringify({ motivo: comentario })
      : JSON.stringify({ comentario: '' });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body
      });
      const data = await res.json();
      if (data.success) { alert(data.message); fetchSolicitudesPendientes(); }
      else alert(data.message);
    } catch { alert('Error de conexión.'); }
  };

  const handleConfirmarRecepcion = async (idSolicitud) => {
    const file = archivosRecepcion[idSolicitud];
    if (!file) return alert("Por favor, selecciona tu comprobante primero.");
    setSubiendoRecepcion(prev => ({ ...prev, [idSolicitud]: true }));
    const fd = new FormData();
    fd.append('comprobante_empleado', file);
    try {
      const res = await fetch(`/api/viaticos/${idSolicitud}/confirmar-recepcion`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: fd
      });
      const data = await res.json();
      if (data.success) {
        alert("¡Recepción confirmada! Tu firma ha sido estampada en el oficio.");
        setArchivosRecepcion(prev => ({ ...prev, [idSolicitud]: null }));
        fetchMisSolicitudes();
      } else alert(data.message);
    } catch (error) { alert("Error de conexión al subir el comprobante."); }
    finally { setSubiendoRecepcion(prev => ({ ...prev, [idSolicitud]: false })); }
  };

  const handleSubirGastos = async (id_solicitud, event) => {
    const file = event.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('comprobante_gastos', file);
    try {
      const res = await fetch(`/api/viaticos/${id_solicitud}/comprobante-gastos`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: fd
      });
      const data = await res.json();
      if (data.success) { alert("¡Comprobantes subidos!"); fetchMisSolicitudes(); } else alert(data.message);
    } catch (error) { alert('Error al subir el archivo.'); }
  };

  const handleVerPDF = async (id_solicitud) => {
    try {
      const res = await fetch(`/api/viaticos/${id_solicitud}/pdf`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error("Error al obtener el PDF");
      const blob = await res.blob();
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(fileURL), 10000);
    } catch (error) { alert("Error al intentar abrir el Formato PDF de Comisión."); }
  };

  const formatMoney = (amount) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="viaticos-premium-wrapper fade-in-up">
      <div className="viaticos-header-block" style={{ marginBottom: '20px' }}>
        <h1>Mis Viáticos</h1>
        <p>Complete el formulario oficial de viáticos para procesar su comisión.</p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <button onClick={() => setTabActiva('NUEVA')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'NUEVA' ? '#10b981' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'NUEVA' ? '3px solid #10b981' : '3px solid transparent', paddingBottom: '8px' }}>Nueva Solicitud +</button>
        <button onClick={() => setTabActiva('MIS_SOLICITUDES')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'MIS_SOLICITUDES' ? '#3b82f6' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'MIS_SOLICITUDES' ? '3px solid #3b82f6' : '3px solid transparent', paddingBottom: '8px' }}>Mis Solicitudes</button>
        <button onClick={() => setTabActiva('JEFE')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'JEFE' ? '#f59e0b' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'JEFE' ? '3px solid #f59e0b' : '3px solid transparent', paddingBottom: '8px' }}>
          Para Aprobar {solicitudesPendientesJefe.length > 0 && <span style={{background:'#ef4444',color:'white',borderRadius:'50%',padding:'1px 6px',fontSize:'11px',marginLeft:'4px'}}>{solicitudesPendientesJefe.length}</span>}
        </button>
        <button onClick={() => setTabActiva('MIS_FIRMAS')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'MIS_FIRMAS' ? '#8b5cf6' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'MIS_FIRMAS' ? '3px solid #8b5cf6' : '3px solid transparent', paddingBottom: '8px' }}>
          Mis Firmas {historialFirmas.length > 0 && <span style={{background:'#8b5cf6',color:'white',borderRadius:'12px',padding:'1px 7px',fontSize:'11px',marginLeft:'4px'}}>{historialFirmas.length}</span>}
        </button>
        {rolUsuario === 'ADMIN' && (
          <button onClick={() => setTabActiva('ADMIN')} style={{ background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', color: tabActiva === 'ADMIN' ? '#ef4444' : '#64748b', cursor: 'pointer', borderBottom: tabActiva === 'ADMIN' ? '3px solid #ef4444' : '3px solid transparent', paddingBottom: '8px' }}>
            Todas las Solicitudes {todasSolicitudes.length > 0 && <span style={{background:'#ef4444',color:'white',borderRadius:'12px',padding:'1px 7px',fontSize:'11px',marginLeft:'4px'}}>{todasSolicitudes.length}</span>}
          </button>
        )}
      </div>

      {tabActiva === 'NUEVA' ? (
        <form onSubmit={handleSubmit} className="viaticos-grid-layout">
          <div className="viaticos-form-column">
            <div style={{ backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '12px 16px', borderRadius: '4px', marginBottom: '20px', fontSize: '13px', color: '#b45309' }}>
              <strong>IMPORTANTE:</strong> Todas las solicitudes de viáticos deberán realizarse con al menos <strong>1 día de anticipación</strong> a su fecha de salida para poder ser gestionadas correctamente.
            </div>

            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">1</span>
                <h2>Información del Colaborador</h2>
              </div>
              <div className="form-field mb-16">
                <label>Nombre del colaborador que requiere viáticos</label>
                <input type="text" name="solicitante_nombre" value={formData.solicitante_nombre} onChange={handleChange} required style={{ backgroundColor: '#f8fafc' }} />
              </div>
              <div className="input-row-2">
                <div className="form-field">
                  <label>Unidad de Negocio</label>
                  <select name="unidad_negocio" required value={formData.unidad_negocio} onChange={handleChange} disabled={loadingUnidades}>
                    <option value="" disabled>Seleccione unidad</option>
                    {unidadesNegocio.map(unidad => (<option key={unidad.id} value={unidad.nombre}>{unidad.nombre}</option>))}
                  </select>
                  {loadingUnidades && <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>Cargando unidades...</span>}
                  {!loadingUnidades && unidadesNegocio.length === 0 && <span style={{ fontSize: '11px', color: '#dc2626', display: 'block', marginTop: '4px' }}>No hay unidades registradas.</span>}
                </div>
                <div className="form-field">
                  <label>Área a la que pertenece</label>
                  <select name="area" required value={formData.area} onChange={handleChange}>
                    <option value="" disabled>Seleccione área</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="input-row-2 mt-16">
                <div className="form-field">
                  <label>Departamento al que pertenece</label>
                  <select name="departamento" required value={formData.departamento} onChange={handleChange}>
                    <option value="" disabled>Seleccione depto.</option>
                    {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Escriba su Puesto (A mano)</label>
                  <input type="text" name="puesto" required value={formData.puesto} onChange={handleChange} placeholder="Ej. Promotor de crédito" />
                </div>
              </div>
              <div className="form-field mt-16">
                <label>Seleccione quien autorizó su comisión</label>
                <select name="jefe_inmediato" required value={formData.jefe_inmediato} onChange={handleChange}>
                  <option value="" disabled>Seleccione Autorizador</option>
                  {listaEmpleados.map((emp, i) => (
                    <option key={i} value={emp.nombre_completo}>
                      {emp.nombre_completo}{emp.puesto ? ` — ${emp.puesto}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="premium-card">
              <div className="card-title-box">
                <span className="step-number">2</span>
                <h2>Logística de la Comisión</h2>
              </div>
              <div className="input-row-2">
                <div className="form-field">
                  <label>Origen</label>
                  <input type="text" name="origen" required value={formData.origen} onChange={handleChange} placeholder="Ej. Corporativo" />
                </div>
                <div className="form-field">
                  <label>Lugar de Comisión o Ruta (Destino)</label>
                  <select name="destino" required value={formData.destino} onChange={handleChange}>
                    <option value="" disabled>Seleccione ruta</option>
                    {Object.keys(tabuladorDinamico).map(dest => <option key={dest} value={dest}>{dest}</option>)}
                    <option value="Otro">Otro (Especificar manual)</option>
                  </select>
                </div>
              </div>
              {formData.destino === 'Otro' && (
                <div className="form-field mt-16" style={{ animation: 'fadeIn 0.3s' }}>
                  <label>Especifique su Ruta o Destino</label>
                  <input type="text" value={destinoOtro} onChange={(e) => setDestinoOtro(e.target.value)} required placeholder="Ej. Tlacolula" />
                </div>
              )}
              <div className="input-row-2 mt-16">
                <div className="form-field"><label>Fecha Salida</label><input type="date" name="fecha_salida" required value={formData.fecha_salida} onChange={handleChange} /></div>
                <div className="form-field"><label>Fecha Regreso</label><input type="date" name="fecha_regreso" required value={formData.fecha_regreso} onChange={handleChange} /></div>
              </div>
              <div className="input-row-2 mt-16">
                <div className="form-field">
                  <label>¿Cuántas personas lo acompañan?</label>
                  <select name="num_acompanantes" value={formData.num_acompanantes} onChange={handleChange}>
                    {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} persona(s)</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Medio de Transporte</label>
                  <select name="medio_transporte" required value={formData.medio_transporte} onChange={handleChange}>
                    <option value="" disabled>SELECCIONAR</option>
                    <option value="Autobús">Autobús / Público</option>
                    <option value="Auto Empresa">Auto Empresa</option>
                    <option value="Auto Propio">Auto Propio</option>
                  </select>
                </div>
              </div>
              {parseInt(formData.num_acompanantes) > 0 && (
                <div className="form-field mt-16" style={{ animation: 'fadeIn 0.3s' }}>
                  <label>Datos de los acompañantes</label>
                  <div style={{ display: 'grid', gap: '10px', marginTop: '8px' }}>
                    {acompanantes.map((a, idx) => (
                      <div key={idx} style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#475569' }}>Acompañante {idx + 1}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {/* Select de empleado */}
                          <div>
                            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Colaborador</label>
                            <select
                              value={a.nombre}
                              onChange={e => {
                                const nueva = [...acompanantes];
                                const emp = listaEmpleados.find(em => em.nombre_completo === e.target.value);
                                nueva[idx] = { ...nueva[idx], nombre: e.target.value, sexo: emp?.sexo || '' };
                                setAcompanantes(nueva);
                              }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                            >
                              <option value="">Seleccionar colaborador...</option>
                              {listaEmpleados.map((emp, i) => (
                                <option key={i} value={emp.nombre_completo}>
                                  {emp.nombre_completo} {emp.puesto ? `— ${emp.puesto}` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Motivo de su participación */}
                          <div>
                            <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Motivo de su participación</label>
                            <input
                              type="text"
                              value={a.motivo || ''}
                              onChange={e => {
                                const nueva = [...acompanantes];
                                nueva[idx] = { ...nueva[idx], motivo: e.target.value };
                                setAcompanantes(nueva);
                              }}
                              placeholder="Ej. Apoyo técnico, capacitación..."
                              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>

                        {/* Sexo detectado automáticamente */}
                        {a.nombre && (
                          <p style={{ margin: '6px 0 0', fontSize: '11px', color: a.sexo ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                            {a.sexo === 'M' ? 'Masculino' : a.sexo === 'F' ? 'Femenino' : 'Sexo no registrado — no afecta el cálculo de cuartos'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Resumen de cuartos */}
                  {acompanantes.some(a => a.nombre) && (
                    <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#15803d' }}>
                      {(() => {
                        const sexoSol = formData.sexo_solicitante;
                        const masc = (sexoSol === 'M' ? 1 : 0) + acompanantes.filter(a => a.sexo === 'M').length;
                        const fem  = (sexoSol === 'F' ? 1 : 0) + acompanantes.filter(a => a.sexo === 'F').length;
                        const sin  = acompanantes.filter(a => a.nombre && !a.sexo).length;
                        const cuartos = Math.ceil(masc / 3) + Math.ceil(fem / 3) + sin;
                        return (
                          <>
                            <strong>Cuartos estimados: {cuartos}</strong>
                            {masc > 0 && ` · ${masc} hombre(s) → ${Math.ceil(masc/3)} cuarto(s)`}
                            {fem  > 0 && ` · ${fem} mujer(es) → ${Math.ceil(fem/3)} cuarto(s)`}
                            {sin  > 0 && ` · ${sin} sin sexo registrado → ${sin} cuarto(s) individual(es)`}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
              <div className="form-field mt-16"><label>Motivo de la comisión</label><textarea name="motivo" required rows="2" value={formData.motivo} onChange={handleChange}></textarea></div>
            </div>

            <div className="premium-card" style={{ borderLeft: formData.destino && formData.destino !== 'Otro' && formData.dias_comision > 0 ? '4px solid #10b981' : 'none' }}>
              <div className="card-title-box" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="step-number">3</span>
                  <h2>Desglose de Gastos</h2>
                  {formData.destino && formData.destino !== 'Otro' && formData.dias_comision > 0 && (
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>✓ Auto-calculado</span>
                  )}
                </div>
                <button type="button" onClick={() => setMostrarCatalogo(true)} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#3b82f6', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Ver Tabulador</button>
              </div>
              <div className="gastos-grid-layout">
                {['alimentos', 'hospedaje', 'pasajes', 'taxis', 'gasolina'].map(gasto => (
                  <div className="gasto-item" key={gasto}>
                    <label style={{textTransform: 'capitalize'}}>{gasto}</label>
                    <div className="money-box">
                      <i>$</i>
                      <input type="number" name={`monto_${gasto}`} min="0" step="0.01" value={formData[`monto_${gasto}`]} onChange={handleChange} placeholder="0.00" style={{ backgroundColor: formData.destino && formData.destino !== 'Otro' ? '#f8fafc' : 'white' }}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-field mt-16">
                <label>Otros Gastos / Gastos de Representación</label>
                <div className="money-box" style={{ maxWidth: '200px' }}>
                  <i>$</i>
                  <input type="number" name="monto_otros" min="0" step="0.01" value={formData.monto_otros} onChange={handleChange} placeholder="0.00"/>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Manifieste si requiere más recurso para su comisión, como peajes o representación.</span>
              </div>

              {/* TABLA DESGLOSE POR DÍAS */}
              {fechasDesglose.length > 0 && (
                <div style={{ marginTop: '16px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4' }}>
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: '700', minWidth: '130px' }}>Concepto</th>
                        {fechasDesglose.map(f => {
                          const d = new Date(f + 'T00:00:00');
                          const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                          return (
                            <th key={f} style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center', minWidth: '80px', fontWeight: '700' }}>
                              {dias[d.getDay()]}<br/><span style={{fontWeight:'400',color:'#64748b'}}>{d.getDate()}</span>
                            </th>
                          );
                        })}
                        <th style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', color: '#15803d' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[['hospedaje','Hospedaje'],['terrestre','Transporte'],['almuerzo','Alimentos'],['comunicacion','Comunicación'],['otros','Otros'],['especifique','Especifique']].map(([cat, label]) => {
                        const totalCat = fechasDesglose.reduce((s, f) => s + (parseFloat(desgloseGrid[`${f}_${cat}`]) || 0), 0);
                        return (
                          <tr key={cat} style={{ background: totalCat > 0 ? '#f0fdf4' : 'white' }}>
                            <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', fontWeight: '600' }}>{label}</td>
                            {fechasDesglose.map(f => {
                              const editable = cat === 'otros' || cat === 'especifique';
                              const val = desgloseGrid[`${f}_${cat}`] || '';
                              return (
                                <td key={f} style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={val}
                                    readOnly={!editable}
                                    onChange={editable ? e => setDesgloseGrid(prev => ({ ...prev, [`${f}_${cat}`]: e.target.value })) : undefined}
                                    style={{
                                      width: '100%', textAlign: 'right', fontSize: '12px',
                                      border: editable ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                                      borderRadius: '4px', padding: '4px 6px', boxSizing: 'border-box',
                                      background: val > 0 ? (editable ? '#f0fdf4' : '#f8fafc') : 'white',
                                      color: '#0f172a',
                                      cursor: editable ? 'text' : 'default',
                                      fontWeight: val > 0 ? '600' : '400'
                                    }}
                                    placeholder="0.00"
                                    onFocus={editable ? e => e.target.style.borderColor = '#10b981' : undefined}
                                    onBlur={editable ? e => e.target.style.borderColor = '#cbd5e1' : undefined}
                                  />
                                </td>
                              );
                            })}
                            <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', color: '#15803d' }}>
                              {totalCat > 0 ? `$${totalCat.toLocaleString('es-MX', {minimumFractionDigits: 2})}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: '#f0fdf4', fontWeight: '800' }}>
                        <td style={{ padding: '8px', border: '2px solid #10d440' }}>TOTAL</td>
                        {fechasDesglose.map(f => {
                          const totalDia = [['hospedaje'],['terrestre'],['almuerzo'],['comunicacion'],['otros'],['especifique']].reduce((s, [c]) => s + (parseFloat(desgloseGrid[`${f}_${c}`]) || 0), 0);
                          return <td key={f} style={{ padding: '8px', border: '2px solid #10d440', textAlign: 'right', color: '#15803d' }}>{totalDia > 0 ? `$${totalDia.toLocaleString('es-MX', {minimumFractionDigits: 2})}` : '-'}</td>;
                        })}
                        <td style={{ padding: '8px', border: '2px solid #10d440', textAlign: 'right', color: '#15803d' }}>
                          ${Object.values(desgloseGrid).reduce((s, v) => s + (parseFloat(v) || 0), 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                    Los importes se calculan automáticamente con base en el tabulador autorizado para el destino. Solo <strong>Otros</strong> y <strong>Especifique</strong> son editables para gastos adicionales.
                  </p>
                </div>
              )}
              <div className="form-field mt-16">
                <label>Observaciones de sus viáticos</label>
                <textarea name="observaciones" rows="2" value={formData.observaciones} onChange={handleChange} placeholder="Anotaciones adicionales para tesorería o D.H.O."></textarea>
              </div>
            </div>
          </div>

          <div className="viaticos-summary-column">
            <div className="summary-sticky-card">
              <div className="summary-header"><h3>Resumen de Solicitud</h3></div>
              <div className="summary-body">
                <div className="summary-row"><span>Días de comisión</span><strong>{formData.dias_comision}</strong></div>
                <div className="summary-row"><span>Acompañantes</span><strong>{formData.num_acompanantes}</strong></div>
                <div className="summary-row"><span>Ruta</span><strong>{formData.destino === 'Otro' ? (destinoOtro || 'Sin definir') : (formData.destino || 'Sin definir')}</strong></div>
                <div className="summary-divider"></div>
                <div className="total-display"><p>Total Solicitado</p><h2 className={formData.total_solicitado > 0 ? 'has-value' : ''}>{formatMoney(formData.total_solicitado)}</h2></div>
              </div>
              <div className="summary-footer">
                <button type="submit" className="btn-send-request" disabled={isSubmitting || formData.total_solicitado <= 0}>
                  {isSubmitting ? 'Procesando...' : 'Enviar a D.H.O'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : tabActiva === 'JEFE' ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ padding: '16px 20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', fontSize: '13px', color: '#92400e' }}>
            <strong>Solicitudes pendientes de tu autorización como Jefe Inmediato.</strong> Solo ves las solicitudes de personas que te tienen como jefe directo.
          </div>
          {cargandoJefe ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>Cargando...</p>
          ) : solicitudesPendientesJefe.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
              <p style={{ fontSize: '16px', fontWeight: '600' }}>Sin solicitudes pendientes</p>
              <p style={{ fontSize: '13px' }}>Cuando un colaborador tuyo solicite viáticos aparecerán aquí.</p>
            </div>
          ) : solicitudesPendientesJefe.map(sol => (
            <div key={sol.id} className="premium-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>{sol.nombre_solicitante}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{sol.puesto_solicitante} · {sol.departamento}</div>
                </div>
                <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>PENDIENTE TU AUTORIZACIÓN</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                <div><span style={{color:'#64748b'}}>Destino:</span> <strong>{sol.destino}</strong></div>
                <div><span style={{color:'#64748b'}}>Fechas:</span> <strong>{sol.fecha_salida} → {sol.fecha_regreso}</strong></div>
                <div><span style={{color:'#64748b'}}>Total:</span> <strong style={{color:'#10d440'}}>${parseFloat(sol.total_solicitado).toLocaleString('es-MX',{minimumFractionDigits:2})}</strong></div>
                <div><span style={{color:'#64748b'}}>Motivo:</span> <strong>{sol.motivo}</strong></div>
                <div><span style={{color:'#64748b'}}>Días:</span> <strong>{sol.dias_comision}</strong></div>
                <div><span style={{color:'#64748b'}}>Transporte:</span> <strong>{sol.medio_transporte}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => handleVerPDF(sol.id)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #dc2626', background: 'white', color: '#dc2626', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  📄 Ver Oficio
                </button>
                <button onClick={() => handleAutorizar(sol.id, 'RECHAZAR')} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  Rechazar
                </button>
                <button onClick={() => handleAutorizar(sol.id, 'AUTORIZAR')} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#10d440', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                  ✓ Autorizar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : tabActiva === 'ADMIN' ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Filtro por estatus */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Filtrar:</span>
            {['TODAS','PENDIENTE','AUTORIZADO_N0','AUTORIZADO_N1','PAGADO','RECIBIDO','COMPROBADO','RECHAZADO'].map(est => (
              <button key={est} onClick={() => setFiltroEstatus(est)}
                style={{ padding: '4px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: filtroEstatus === est ? '700' : '400',
                  background: filtroEstatus === est ? '#0f172a' : 'white', color: filtroEstatus === est ? 'white' : '#475569', cursor: 'pointer' }}>
                {est === 'AUTORIZADO_N0' ? 'Aut. Jefe' : est === 'AUTORIZADO_N1' ? 'Aut. D.H.O.' : est.charAt(0) + est.slice(1).toLowerCase()}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#94a3b8' }}>
              {todasSolicitudes.filter(s => filtroEstatus === 'TODAS' || s.estatus === filtroEstatus).length} solicitudes
            </span>
          </div>

          {cargandoTodas ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>Cargando...</p>
          ) : todasSolicitudes.filter(s => filtroEstatus === 'TODAS' || s.estatus === filtroEstatus).length === 0 ? (
            <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ fontSize: '16px', color: '#94a3b8' }}>No hay solicitudes con ese estatus.</p>
            </div>
          ) : todasSolicitudes
              .filter(s => filtroEstatus === 'TODAS' || s.estatus === filtroEstatus)
              .map(sol => {
                const colores = {
                  PENDIENTE: { bg:'#fef3c7', txt:'#f59e0b' }, AUTORIZADO_N0: { bg:'#dbeafe', txt:'#2563eb' },
                  AUTORIZADO_N1: { bg:'#dcfce7', txt:'#15803d' }, PAGADO: { bg:'#eff6ff', txt:'#3b82f6' },
                  RECIBIDO: { bg:'#ccfbf1', txt:'#0d9488' }, COMPROBADO: { bg:'#dcfce7', txt:'#16a34a' },
                  RECHAZADO: { bg:'#fee2e2', txt:'#ef4444' }
                };
                const c = colores[sol.estatus] || { bg:'#f1f5f9', txt:'#64748b' };
                const etiquetas = { AUTORIZADO_N0:'Aut. Jefe', AUTORIZADO_N1:'Aut. D.H.O.', PENDIENTE:'Pendiente', PAGADO:'Pagado', RECIBIDO:'Recibido', COMPROBADO:'Comprobado', RECHAZADO:'Rechazado' };
                return (
                  <div key={sol.id} className="premium-card" style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: c.bg, color: c.txt }}>
                          {etiquetas[sol.estatus] || sol.estatus}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{sol.id}</span>
                      </div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a' }}>
                        {sol.solicitante_nombre_completo || sol.solicitante_usuario}
                      </h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                        {sol.departamento} → <strong>{sol.destino}</strong>
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(sol.fecha_salida).toLocaleDateString('es-MX')} – {new Date(sol.fecha_regreso).toLocaleDateString('es-MX')} · {sol.dias_comision} días · {sol.medio_transporte}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '20px', fontWeight: '900', color: '#10b981' }}>{formatMoney(sol.total_solicitado)}</span>
                      <button onClick={() => handleVerPDF(sol.id)}
                        style={{ padding: '6px 14px', border: '1px solid #dc2626', color: '#dc2626', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                        📄 Ver Oficio
                      </button>
                    </div>
                  </div>
                );
              })}
        </div>
      ) : tabActiva === 'MIS_FIRMAS' ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {cargandoHistorial ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>Cargando...</p>
          ) : historialFirmas.length === 0 ? (
            <div className="premium-card" style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8' }}>No has firmado ninguna solicitud de viáticos todavía.</p>
            </div>
          ) : historialFirmas.map(sol => (
            <div key={`${sol.id}-${sol.fecha_firma}`} className="premium-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px',
                    background: sol.estatus === 'PAGADO' ? '#eff6ff' : sol.estatus === 'COMPROBADO' ? '#dcfce7' : sol.estatus === 'RECHAZADO' ? '#fee2e2' : '#f0fdf4',
                    color: sol.estatus === 'PAGADO' ? '#3b82f6' : sol.estatus === 'COMPROBADO' ? '#16a34a' : sol.estatus === 'RECHAZADO' ? '#ef4444' : '#15803d' }}>
                    {sol.estatus}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '20px', background: '#ede9fe', color: '#6d28d9' }}>
                    ✓ Firmé: {sol.etapa_firma}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#0f172a' }}>{sol.destino}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                  <strong>{sol.solicitante_nombre_completo}</strong> · {sol.departamento}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                  {new Date(sol.fecha_salida).toLocaleDateString('es-MX')} – {new Date(sol.fecha_regreso).toLocaleDateString('es-MX')} · Firmado el {new Date(sol.fecha_firma).toLocaleString('es-MX')}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span style={{ fontSize: '22px', fontWeight: '900', color: '#10b981' }}>{formatMoney(sol.total_solicitado)}</span>
                <button onClick={() => handleVerPDF(sol.id)}
                  style={{ padding: '6px 14px', border: '1px solid #dc2626', color: '#dc2626', background: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  📄 Ver Oficio
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {cargandoSolicitudes ? <p>Cargando su historial...</p> : misSolicitudes.length === 0 ? (
            <div className="premium-card" style={{ textAlign: 'center', padding: '50px' }}><h3 style={{ color: '#64748b' }}>No ha realizado ninguna solicitud aún.</h3></div>
          ) : (
            misSolicitudes.map(sol => {
              const fechaRegreso = new Date(sol.fecha_regreso);
              fechaRegreso.setHours(0, 0, 0, 0);
              const hoy = new Date();
              hoy.setHours(0, 0, 0, 0);
              const diasPasados = Math.floor((hoy - fechaRegreso) / (1000 * 60 * 60 * 24));
              const diasRestantes = 5 - diasPasados;
              const limiteVencido = diasPasados > 5;

              return (
                <div key={sol.id} className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px', backgroundColor:
                        sol.estatus === 'PENDIENTE'      ? '#fef3c7' :
                        sol.estatus === 'AUTORIZADO_JEFE'? '#dbeafe' :
                        sol.estatus === 'AUTORIZADO_DHO' ? '#dcfce7' :
                        sol.estatus === 'PAGADO'         ? '#eff6ff' :
                        sol.estatus === 'RECIBIDO'       ? '#ccfbf1' :
                        sol.estatus === 'COMPROBADO'     ? '#dcfce7' :
                        sol.estatus === 'RECHAZADO'      ? '#fee2e2' : '#e0e7ff',
                        color:
                        sol.estatus === 'PENDIENTE'      ? '#f59e0b' :
                        sol.estatus === 'AUTORIZADO_JEFE'? '#2563eb' :
                        sol.estatus === 'AUTORIZADO_DHO' ? '#15803d' :
                        sol.estatus === 'PAGADO'         ? '#3b82f6' :
                        sol.estatus === 'RECIBIDO'       ? '#0d9488' :
                        sol.estatus === 'COMPROBADO'     ? '#16a34a' :
                        sol.estatus === 'RECHAZADO'      ? '#ef4444' : '#4f46e5'
                      }}>
                        {sol.estatus === 'PENDIENTE'       ? 'PENDIENTE (En revisión jefe)' :
                         sol.estatus === 'AUTORIZADO_JEFE' ? 'AUTORIZADO POR JEFE' :
                         sol.estatus === 'AUTORIZADO_DHO'  ? 'AUTORIZADO D.H.O.' :
                         sol.estatus}
                      </span>
                      <h3 style={{ margin: '12px 0 4px 0', fontSize: '18px', color: '#0f172a' }}>{sol.destino} - {sol.motivo}</h3>
                      <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>{new Date(sol.fecha_salida).toLocaleDateString()} al {new Date(sol.fecha_regreso).toLocaleDateString()}</p>

                      {sol.estatus === 'PAGADO' && (
                        <div style={{ marginTop: '12px', color: '#ea580c', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          ¡Tesorería ha depositado tu viático! Confirma de recibido para poder comprobar gastos.
                        </div>
                      )}

                      {(sol.estatus === 'RECIBIDO' || sol.estatus === 'COMPROBADO') && (
                        <div style={{ marginTop: '12px', color: '#10b981', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width: '16px'}}><polyline points="20 6 9 17 4 12"/></svg>
                          ¡Recurso recibido y firmado digitalmente!
                        </div>
                      )}

                      {(sol.estatus === 'RECIBIDO') && !sol.url_comprobante_gastos && (
                        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6',
                          background: limiteVencido ? '#fee2e2' : diasRestantes <= 2 ? '#fff7ed' : '#f0fdf4',
                          border: `1px solid ${limiteVencido ? '#fca5a5' : diasRestantes <= 2 ? '#fdba74' : '#86efac'}`,
                          color: limiteVencido ? '#b91c1c' : diasRestantes <= 2 ? '#c2410c' : '#15803d'
                        }}>
                          {limiteVencido ? (
                            <> <strong>Plazo vencido.</strong> El máximo es de <strong>5 días naturales</strong> a partir de la fecha de regreso. Los viáticos no comprobados serán descontados de nómina.</>
                          ) : diasRestantes <= 2 ? (
                            <> <strong>¡Atención!</strong> Le queda{diasRestantes === 1 ? '' : 'n'} <strong>{diasRestantes} día{diasRestantes === 1 ? '' : 's'} natural{diasRestantes === 1 ? '' : 'es'}</strong> para subir su comprobación. El plazo máximo es de <strong>5 días naturales</strong> desde su regreso, de lo contrario los viáticos serán descontados de nómina.</>
                          ) : (
                            <> Tiene <strong>{diasRestantes} días naturales</strong> restantes para adjuntar su factura y comprobación de gastos. El plazo máximo es de <strong>5 días naturales</strong> a partir de su fecha de regreso.</>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>Monto Solicitado</p>
                      <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#10b981', fontWeight: '900' }}>{formatMoney(sol.total_solicitado)}</h2>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => handleVerPDF(sol.id)} style={{ padding: '8px 16px', border: '1px solid #dc2626', color: '#dc2626', background: 'white', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Imprimir / Ver Formato
                        </button>
                        {sol.url_comprobante_transferencia && (
                          <a href={`/${sol.url_comprobante_transferencia}`} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', border: '1px solid #cbd5e1', color: '#475569', background: 'white', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Transferencia</a>
                        )}
                        {(sol.estatus === 'RECIBIDO' || sol.estatus === 'COMPROBADO') && (
                          <>
                            <input type="file" accept=".pdf,.zip,.jpg,.png" style={{ display: 'none' }} ref={el => fileInputRefs.current[sol.id] = el} onChange={(e) => handleSubirGastos(sol.id, e)} />
                            {sol.url_comprobante_gastos ? (
                              <a href={`/${sol.url_comprobante_gastos}`} target="_blank" rel="noreferrer" style={{ padding: '8px 16px', background: '#e0e7ff', color: '#4f46e5', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontWeight: 'bold' }}>Ver Mis Gastos</a>
                            ) : limiteVencido ? (
                              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', maxWidth: '280px', lineHeight: '1.5' }}>
                                ⛔ Plazo vencido. Los viáticos no comprobados en 5 días naturales de haber regresado de comisión serán descontados de nómina.
                              </div>
                            ) : (
                              <button onClick={() => fileInputRefs.current[sol.id].click()} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>Subir Facturas</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CONFIRMACIÓN DE RECEPCIÓN */}
                  {sol.estatus === 'PAGADO' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', padding: '16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'left', width: '100%' }}>
                      <label style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>
                        Sube tu comprobante de ingreso (captura de estado de cuenta) para firmar de recibido:
                      </label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="file" accept=".pdf, image/*" onChange={(e) => setArchivosRecepcion(prev => ({ ...prev, [sol.id]: e.target.files[0] }))}
                          style={{ fontSize: '13px', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', flexGrow: 1 }} />
                        <button className="btn-success" onClick={() => handleConfirmarRecepcion(sol.id)}
                          disabled={subiendoRecepcion[sol.id] || !archivosRecepcion[sol.id]}
                          style={{ padding: '10px 20px', fontSize: '13px', justifyContent: 'center', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: subiendoRecepcion[sol.id] || !archivosRecepcion[sol.id] ? 'not-allowed' : 'pointer', opacity: subiendoRecepcion[sol.id] || !archivosRecepcion[sol.id] ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                          {subiendoRecepcion[sol.id] ? 'Firmando y Subiendo...' : (
                            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px'}}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Confirmar Recepción y Firmar</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* COMPROBACIÓN UNIVERSAL DE GASTOS */}
                  {(sol.estatus === 'RECIBIDO' || sol.estatus === 'COMPROBADO') && (() => {
                    const comp = comprobaciones[sol.id];
                    const totalComp = getTotalComprobado(comp);
                    const pendienteSol = (parseFloat(comp?.recursos_otorgados) || 0) - totalComp;
                    const abierto = comprobacionesAbiertas[sol.id];

                    return (
                      <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
                        <button type="button" onClick={() => abrirComprobacion(sol)}
                          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: abierto ? '#f5f3ff' : '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', cursor: 'pointer', marginBottom: abierto ? '16px' : 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', fontSize: '14px', color: '#6d28d9' }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '18px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            Comprobación Universal de Gastos
                            {comp?.cargada && <span style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '10px' }}>✓ Guardada en sistema</span>}
                          </span>
                          <span style={{ fontSize: '13px', color: '#6d28d9' }}>{abierto ? '▲ Cerrar' : '▼ Llenar y Guardar'}</span>
                        </button>

                        {abierto && comp && (
                          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s' }}>

                            {/* Datos Generales */}
                            <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                              <p style={{ margin: '0 0 14px 0', fontWeight: 'bold', fontSize: '13px', color: '#334155' }}>Datos Generales</p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                  { label: 'Responsable', name: 'responsable', placeholder: 'Nombre completo' },
                                  { label: 'Unidad de Negocio', name: 'unidad_negocio', placeholder: 'Ej. 02.ETL - Etla' },
                                  { label: 'Lugar / Destino', name: 'lugar', placeholder: 'Ej. Villa de Etla' },
                                  { label: 'Objeto / Motivo', name: 'objeto', placeholder: 'Ej. Visita a clientes' },
                                  { label: 'Fecha Inicial', name: 'fecha_inicial', type: 'date' },
                                  { label: 'Fecha Final', name: 'fecha_final', type: 'date' },
                                  { label: 'Fondo Fijo', name: 'fondo_fijo', placeholder: 'Fondo fijo' },
                                  { label: 'Personas Adicionales', name: 'personas_adicionales', type: 'number', placeholder: '0' },
                                ].map(({ label, name, type = 'text', placeholder }) => (
                                  <div key={name}>
                                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>{label}</label>
                                    <input type={type} name={name} value={comp[name] || ''} onChange={(e) => handleCompChange(sol.id, e)} placeholder={placeholder}
                                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                                  </div>
                                ))}
                                <div style={{ gridColumn: 'span 2' }}>
                                  <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>Recursos Otorgados $</label>
                                  <input type="number" name="recursos_otorgados" min="0" step="0.01" value={comp.recursos_otorgados || ''} onChange={(e) => handleCompChange(sol.id, e)}
                                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }} />
                                </div>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '14px' }}>
                                {[
                                  { label: 'Recursos Otorgados', value: formatMoney(parseFloat(comp.recursos_otorgados) || 0), color: '#0f172a' },
                                  { label: 'Total Comprobado', value: formatMoney(totalComp), color: '#10b981' },
                                  { label: 'Pendiente', value: formatMoney(pendienteSol), color: pendienteSol < 0 ? '#dc2626' : pendienteSol > 0 ? '#f59e0b' : '#10b981' },
                                ].map(item => (
                                  <div key={item.label} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>{item.label}</p>
                                    <p style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: item.color }}>{item.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Tabla partidas */}
                            <div style={{ background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '13px', color: '#334155' }}>Partidas de Gasto</p>
                                <button type="button" onClick={() => agregarPartida(sol.id)} style={{ padding: '5px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>+ Agregar fila</button>
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '860px' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                      {['Fecha', 'Importe $', 'Factura / Folio', 'RFC', 'Nombre Proveedor', 'Rubro', 'Descripción', ''].map(h => (
                                        <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', color: '#334155', whiteSpace: 'nowrap' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(comp.partidas || []).map((p, i) => (
                                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                        <td style={{ padding: '5px 4px' }}><input type="date" value={p.fecha} onChange={e => handlePartidaChange(sol.id, i, 'fecha', e.target.value)} style={{ width: '115px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }} /></td>
                                        <td style={{ padding: '5px 4px' }}><input type="number" value={p.importe} onChange={e => handlePartidaChange(sol.id, i, 'importe', e.target.value)} min="0" step="0.01" placeholder="0.00" style={{ width: '80px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', textAlign: 'right' }} /></td>
                                        <td style={{ padding: '5px 4px' }}><input type="text" value={p.folio_fiscal} onChange={e => handlePartidaChange(sol.id, i, 'folio_fiscal', e.target.value)} placeholder="UUID / folio" style={{ width: '120px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }} /></td>
                                        <td style={{ padding: '5px 4px' }}><input type="text" value={p.rfc_proveedor} onChange={e => handlePartidaChange(sol.id, i, 'rfc_proveedor', e.target.value)} placeholder="RFC" style={{ width: '95px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }} /></td>
                                        <td style={{ padding: '5px 4px' }}><input type="text" value={p.nombre_proveedor} onChange={e => handlePartidaChange(sol.id, i, 'nombre_proveedor', e.target.value)} placeholder="Proveedor" style={{ width: '140px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }} /></td>
                                        <td style={{ padding: '5px 4px' }}>
                                          <select value={p.rubro} onChange={e => handlePartidaChange(sol.id, i, 'rubro', e.target.value)} style={{ width: '110px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }}>
                                            {RUBROS.map(r => <option key={r} value={r}>{r}</option>)}
                                          </select>
                                        </td>
                                        <td style={{ padding: '5px 4px' }}><input type="text" value={p.descripcion} onChange={e => handlePartidaChange(sol.id, i, 'descripcion', e.target.value)} placeholder="Descripción" style={{ width: '160px', padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px' }} /></td>
                                        <td style={{ padding: '5px 4px' }}>
                                          {(comp.partidas || []).length > 1 && (
                                            <button type="button" onClick={() => eliminarPartida(sol.id, i)} style={{ padding: '3px 7px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✕</button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr style={{ borderTop: '2px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                      <td colSpan={6} style={{ padding: '8px 6px', fontWeight: 'bold', fontSize: '12px', color: '#334155', textAlign: 'right' }}>TOTAL:</td>
                                      <td style={{ padding: '8px 6px', fontWeight: '900', fontSize: '13px', color: '#10b981' }}>{formatMoney(totalComp)}</td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                              <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {RUBROS.map(rubro => (
                                  <div key={rubro} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px' }}>
                                    <p style={{ margin: '0 0 2px 0', fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>{rubro}</p>
                                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: '#0f172a' }}>{formatMoney(getTotalPorRubro(comp, rubro))}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Botones Guardar + Descargar */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                              <button type="button" onClick={() => guardarComprobacion(sol)} disabled={guardandoComp[sol.id]}
                                style={{ padding: '10px 24px', background: guardandoComp[sol.id] ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                {guardandoComp[sol.id] ? 'Guardando...' : 'Guardar en Sistema'}
                              </button>
                              <button type="button" onClick={() => descargarComprobacion(sol)} disabled={guardandoComp[sol.id]}
                                style={{ padding: '10px 24px', background: guardandoComp[sol.id] ? '#94a3b8' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                {guardandoComp[sol.id] ? 'Generando...' : 'Ver PDF'}
                              </button>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODAL DEL CATÁLOGO */}
      {mostrarCatalogo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: 'fadeIn 0.2s' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '95%', maxWidth: '950px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setMostrarCatalogo(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            <h2 style={{ marginTop: 0, color: '#0f172a', fontSize: '20px' }}>Importes Autorizados</h2>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', backgroundColor: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead><tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', fontSize: '13px' }}>DESTINO</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>HOSPEDAJE</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>ALIMENTOS</th>
                  <th style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>URBAN</th>
                  <th style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>BUS/TAXI</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>PEAJE</th>
                  <th style={{ padding: '12px', fontSize: '13px' }}>GASOLINA</th>
                </tr></thead>
                <tbody>
                  {Object.entries(tabuladorDinamico).map(([destino, fila], idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', fontSize: '13px' }}>{destino}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.hospedaje ? formatMoney(fila.hospedaje) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.alimentos ? formatMoney(fila.alimentos) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>{fila.urban ? formatMoney(fila.urban) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', backgroundColor: '#eef2ff' }}>{fila.bus ? formatMoney(fila.bus) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.peaje ? formatMoney(fila.peaje) : '-'}</td>
                      <td style={{ padding: '12px', fontSize: '13px' }}>{fila.gasolina ? formatMoney(fila.gasolina) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Viaticos;