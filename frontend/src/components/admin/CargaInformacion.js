import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';
import { theme } from '../../styles/theme';

function CargaInformacion() {
  const [tabActiva, setTabActiva] = useState('dinamicas');
  const [dinamicas, setDinamicas] = useState([]);
  const [dinamicaId, setDinamicaId] = useState('');
  const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
  const esSuperAdmin = usuarioActual.rol === 'superadmin';
  const [pais, setPais] = useState(usuarioActual.pais || '');
  const [archivo, setArchivo] = useState(null);
  const [archivoCatalogo, setArchivoCatalogo] = useState(null);
  const [archivoVentas, setArchivoVentas] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [cargandoVentas, setCargandoVentas] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [resultadoCatalogo, setResultadoCatalogo] = useState(null);
  const [resultadoVentas, setResultadoVentas] = useState(null);
  const [analisis, setAnalisis] = useState(null);
  const [error, setError] = useState('');
  const [errorCatalogo, setErrorCatalogo] = useState('');
  const [errorVentas, setErrorVentas] = useState('');
  const [statsCatalogo, setStatsCatalogo] = useState(null);
  const [statsVentas, setStatsVentas] = useState(null);
  const [mostrarNuevaDinamica, setMostrarNuevaDinamica] = useState(false);
  const [nuevaDinamica, setNuevaDinamica] = useState({
    nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: ''
  });
  const [paso, setPaso] = useState(1);
  const [mesVentas, setMesVentas] = useState(new Date().getMonth() + 1);
  const [anioVentas, setAnioVentas] = useState(new Date().getFullYear());

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);
  const [cargandoPaises, setCargandoPaises] = useState(true);

  // ── Catálogo de tiendas — dinámico, viene de /tiendas, depende del país ──
  const [tiendas, setTiendas] = useState([]);
  const [cargandoTiendas, setCargandoTiendas] = useState(true);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState('');

  // ── Resumen de campañas (Word) ────────────────────────
  const [archivoResumen, setArchivoResumen] = useState(null);
  const [dinamicaResumenId, setDinamicaResumenId] = useState('');
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [resultadoResumen, setResultadoResumen] = useState(null);
  const [errorResumen, setErrorResumen] = useState('');

  // ── Gestión de registros (CRUD) ───────────────────────
  const [vistaDinamicas, setVistaDinamicas] = useState('cargar'); // 'cargar' | 'gestionar'
  const [vistaCatalogo, setVistaCatalogo] = useState('cargar');
  const [vistaVentas, setVistaVentas] = useState('cargar');

  // Dinámicas — gestión
  const [registrosDinamica, setRegistrosDinamica] = useState([]);
  const [cargandoRegistrosDinamica, setCargandoRegistrosDinamica] = useState(false);
  const [busquedaDinamica, setBusquedaDinamica] = useState('');
  const [paginaDinamica, setPaginaDinamica] = useState(1);
  const [totalPaginasDinamica, setTotalPaginasDinamica] = useState(1);
  const [registroEditando, setRegistroEditando] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Catálogo — gestión
  const [registrosCatalogo, setRegistrosCatalogo] = useState([]);
  const [cargandoCatalogoGestion, setCargandoCatalogoGestion] = useState(false);
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [paginaCatalogo, setPaginaCatalogo] = useState(1);
  const [totalPaginasCatalogo, setTotalPaginasCatalogo] = useState(1);

  // Ventas — gestión
  const [registrosVentas, setRegistrosVentas] = useState([]);
  const [cargandoVentasGestion, setCargandoVentasGestion] = useState(false);
  const [busquedaVentas, setBusquedaVentas] = useState('');
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [totalPaginasVentas, setTotalPaginasVentas] = useState(1);
  const [mesGestionVentas, setMesGestionVentas] = useState(new Date().getMonth() + 1);
  const [anioGestionVentas, setAnioGestionVentas] = useState(new Date().getFullYear());

  // Confirmación de eliminación (compartida entre las 3 secciones)
  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { tipo, id, label }
  const [eliminando, setEliminando] = useState(false);

  // Cargar catálogo de países una sola vez al montar
  useEffect(() => {
    const cargarPaises = async () => {
      try {
        const res = await api.get('/paises');
        setPaises(res.data);
        if (!usuarioActual.pais && res.data.length > 0) {
          setPais(res.data[0].codigo);
        }
      } catch (err) {
        console.error('Error cargando catálogo de países:', err);
      } finally {
        setCargandoPaises(false);
      }
    };
    cargarPaises();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarga todo lo relevante cada vez que cambia el país seleccionado
  useEffect(() => {
    if (!pais) return;
    cargarDinamicas();
    cargarStatsCatalogo();
    cargarStatsVentas();
    cargarTiendas();
    setRegistrosCatalogo([]);
    setRegistrosVentas([]);
    setRegistrosDinamica([]);
    setTiendaSeleccionada('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pais]);

  useEffect(() => {
    if (!mostrarNuevaDinamica) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setMostrarNuevaDinamica(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mostrarNuevaDinamica]);

  useEffect(() => {
    if (!registroEditando && !confirmarEliminar) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setRegistroEditando(null);
        setConfirmarEliminar(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [registroEditando, confirmarEliminar]);

  const cargarDinamicas = async () => {
    try {
      const res = await api.get(`/admin/dinamicas?pais=${pais}`);
      setDinamicas(res.data);
      if (res.data.length > 0) {
        setDinamicaId(res.data[0].id);
      } else {
        setDinamicaId('');
      }
    } catch (err) {
      console.error('Error cargando dinámicas:', err);
    }
  };

  const cargarTiendas = async () => {
    setCargandoTiendas(true);
    try {
      const res = await api.get(`/tiendas?pais=${pais}`);
      setTiendas(res.data);
      if (res.data.length > 0) {
        setTiendaSeleccionada(prev => prev || res.data[0].codigo);
      } else {
        setTiendaSeleccionada('');
      }
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    } finally {
      setCargandoTiendas(false);
    }
  };

  const cargarStatsCatalogo = async () => {
    try {
      const res = await api.get(`/dinamicas/catalogo/stats?pais=${pais}`);
      setStatsCatalogo(res.data);
    } catch (err) {
      console.error('Error cargando stats catálogo:', err);
    }
  };

  const cargarStatsVentas = async () => {
    try {
      const res = await api.get(`/dinamicas/ventas/stats?pais=${pais}`);
      setStatsVentas(res.data);
    } catch (err) {
      console.error('Error cargando stats ventas:', err);
    }
  };

  const crearDinamica = async () => {
    try {
      await api.post(
        `/admin/dinamicas/crear?nombre=${encodeURIComponent(nuevaDinamica.nombre)}&fecha_inicio=${nuevaDinamica.fecha_inicio}&fecha_fin=${nuevaDinamica.fecha_fin}&descripcion=${encodeURIComponent(nuevaDinamica.descripcion)}&pais=${pais}`,
        {}
      );
      setMostrarNuevaDinamica(false);
      setNuevaDinamica({ nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' });
      cargarDinamicas();
    } catch (err) {
      setError('Error creando dinámica');
    }
  };

  const handleAnalizarExcel = async () => {
    if (!archivo) { setError('Seleccioná un archivo Excel'); return; }
    if (!tiendaSeleccionada) { setError('Seleccioná una tienda antes de analizar'); return; }
    setAnalizando(true);
    setError('');
    setAnalisis(null);
    const formData = new FormData();
    formData.append('file', archivo);
    if (dinamicaId) formData.append('dinamica_id', dinamicaId);
    formData.append('pais', pais);
    formData.append('tienda_codigo', tiendaSeleccionada);
    try {
      const res = await api.post('/dinamicas/analizar', formData);
      setAnalisis(res.data);
      setPaso(2);
    } catch (err) {
      setError('Error analizando el archivo. Verificá el formato.');
    } finally {
      setAnalizando(false);
    }
  };

  const handleCargar = async () => {
    if (!archivo) { setError('Seleccioná un archivo Excel'); return; }
    if (!dinamicaId) { setError('Seleccioná una dinámica'); return; }
    if (!tiendaSeleccionada) { setError('Seleccioná una tienda'); return; }
    setCargando(true);
    setError('');
    setResultado(null);
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('dinamica_id', dinamicaId);
    formData.append('pais', pais);
    formData.append('tienda_codigo', tiendaSeleccionada);
    try {
      const res = await api.post('/dinamicas/cargar', formData);
      setResultado(res.data);
      setPaso(3);
      setArchivo(null);
      setAnalisis(null);
      document.getElementById('inputArchivo').value = '';
      try {
        await api.post(`/notificaciones/nueva-carga?archivo=${encodeURIComponent(res.data.archivo)}&dinamica_id=${res.data.dinamica_id}&registros=${res.data.registros_cargados}&pais=${res.data.pais}`);
      } catch (errNotif) {
        console.log('Error en notificaciones:', errNotif);
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('La carga está tardando más de lo esperado. Es posible que se haya completado en segundo plano — revisá la lista de dinámicas en unos segundos.');
      } else if (err.response?.status === 403) {
        setError('No tenés permisos para cargar dinámicas de este país.');
      } else if (!err.response) {
        setError('No se pudo conectar al servidor. Verificá que el backend esté corriendo.');
      } else {
        setError(err.response?.data?.detail || 'Error cargando el archivo. Verificá el formato.');
      }
    } finally {
      setCargando(false);
    }
  };

  const handleCargarCatalogo = async () => {
    if (!archivoCatalogo) { setErrorCatalogo('Seleccioná un archivo Excel'); return; }
    setCargandoCatalogo(true);
    setErrorCatalogo('');
    setResultadoCatalogo(null);
    const formData = new FormData();
    formData.append('file', archivoCatalogo);
    formData.append('pais', pais);
    try {
      const res = await api.post('/dinamicas/catalogo/cargar', formData);
      setResultadoCatalogo(res.data);
      setArchivoCatalogo(null);
      document.getElementById('inputCatalogo').value = '';
      cargarStatsCatalogo();
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setErrorCatalogo('La carga está tardando más de lo esperado. Es posible que se haya completado en segundo plano — revisá las estadísticas del catálogo en unos segundos.');
      } else if (err.response?.status === 403) {
        setErrorCatalogo('No tenés permisos para cargar el catálogo de este país.');
      } else if (!err.response) {
        setErrorCatalogo('No se pudo conectar al servidor. Verificá que el backend esté corriendo.');
      } else {
        setErrorCatalogo('Error cargando el catálogo. Verificá el formato del archivo.');
      }
    } finally {
      setCargandoCatalogo(false);
    }
  };

  const handleCargarVentas = async () => {
    if (!archivoVentas) { setErrorVentas('Seleccioná un archivo Excel'); return; }
    setCargandoVentas(true);
    setErrorVentas('');
    setResultadoVentas(null);
    const formData = new FormData();
    formData.append('file', archivoVentas);
    formData.append('pais', pais);
    formData.append('mes', mesVentas);
    formData.append('anio', anioVentas);
    try {
      const res = await api.post('/dinamicas/ventas/cargar', formData);
      setResultadoVentas(res.data);
      setArchivoVentas(null);
      document.getElementById('inputVentas').value = '';
      cargarStatsVentas();
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setErrorVentas('La carga está tardando más de lo esperado. Es posible que se haya completado en segundo plano — revisá las estadísticas de ventas en unos segundos.');
      } else if (err.response?.status === 403) {
        setErrorVentas('No tenés permisos para cargar ventas de este país.');
      } else if (!err.response) {
        setErrorVentas('No se pudo conectar al servidor. Verificá que el backend esté corriendo.');
      } else {
        setErrorVentas('Error cargando el archivo. Verificá el formato.');
      }
    } finally {
      setCargandoVentas(false);
    }
  };

  const handleCargarResumen = async () => {
    if (!archivoResumen) { setErrorResumen('Seleccioná un archivo Word (.docx)'); return; }
    if (!dinamicaResumenId) { setErrorResumen('Seleccioná la dinámica a la que corresponde este resumen'); return; }
    setCargandoResumen(true);
    setErrorResumen('');
    setResultadoResumen(null);
    const formData = new FormData();
    formData.append('file', archivoResumen);
    formData.append('dinamica_id', dinamicaResumenId);
    formData.append('pais', pais);
    try {
      const res = await api.post('/dinamicas/resumen/cargar', formData);
      setResultadoResumen(res.data);
      setArchivoResumen(null);
      document.getElementById('inputResumen').value = '';
    } catch (err) {
      if (err.response?.status === 403) {
        setErrorResumen('No tenés permisos para cargar resúmenes de este país.');
      } else if (!err.response) {
        setErrorResumen('No se pudo conectar al servidor. Verificá que el backend esté corriendo.');
      } else {
        setErrorResumen(err.response?.data?.detail || 'Error cargando el archivo. Verificá el formato.');
      }
    } finally {
      setCargandoResumen(false);
    }
  };

  const reiniciar = () => {
    setPaso(1);
    setArchivo(null);
    setAnalisis(null);
    setResultado(null);
    setError('');
    const input = document.getElementById('inputArchivo');
    if (input) input.value = '';
  };

  // ── Dinámicas: buscar/editar/eliminar registros ───────
  const buscarRegistrosDinamica = async (pagina = 1) => {
    if (!dinamicaId) return;
    setCargandoRegistrosDinamica(true);
    try {
      const params = new URLSearchParams({ pagina, por_pagina: 20 });
      if (busquedaDinamica.trim()) params.append('busqueda', busquedaDinamica.trim());
      const res = await api.get(`/dinamicas/${dinamicaId}/detalle?${params}`);
      setRegistrosDinamica(res.data.registros);
      setPaginaDinamica(res.data.pagina);
      setTotalPaginasDinamica(res.data.total_paginas || 1);
    } catch (err) {
      console.error('Error buscando registros:', err);
    } finally {
      setCargandoRegistrosDinamica(false);
    }
  };

  const guardarEdicionDinamica = async () => {
    if (!registroEditando) return;
    setGuardandoEdicion(true);
    try {
      await api.put(`/dinamicas/detalle/${registroEditando.id}`, {
        descripcion: registroEditando.descripcion,
        porcentaje_descuento: registroEditando.porcentaje_descuento !== '' && registroEditando.porcentaje_descuento != null
          ? parseFloat(registroEditando.porcentaje_descuento)
          : null,
        precio_dinamica: parseFloat(registroEditando.precio_dinamica) || 0,
        ubicacion_dinamica: registroEditando.ubicacion_dinamica,
        ubicacion_tienda: registroEditando.ubicacion_tienda,
        tienda: registroEditando.tienda,
        tipo_campana: registroEditando.tipo_campana,
      });
      setRegistroEditando(null);
      buscarRegistrosDinamica(paginaDinamica);
    } catch (err) {
      console.error('Error guardando edición:', err);
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // ── Catálogo: buscar/eliminar registros ───────────────
  const buscarRegistrosCatalogo = async (pagina = 1) => {
    if (!busquedaCatalogo.trim() || busquedaCatalogo.trim().length < 2) return;
    setCargandoCatalogoGestion(true);
    try {
      const params = new URLSearchParams({ busqueda: busquedaCatalogo.trim(), pagina, por_pagina: 20, pais });
      const res = await api.get(`/dinamicas/catalogo/articulos?${params}`);
      setRegistrosCatalogo(res.data.registros);
      setPaginaCatalogo(res.data.pagina);
      setTotalPaginasCatalogo(res.data.total_paginas || 1);
    } catch (err) {
      console.error('Error buscando catálogo:', err);
    } finally {
      setCargandoCatalogoGestion(false);
    }
  };

  // ── Ventas: buscar/eliminar registros ─────────────────
  const buscarRegistrosVentas = async (pagina = 1) => {
    setCargandoVentasGestion(true);
    try {
      const params = new URLSearchParams({
        mes: mesGestionVentas, anio: anioGestionVentas,
        pagina, por_pagina: 20, pais
      });
      if (busquedaVentas.trim()) params.append('busqueda', busquedaVentas.trim());
      const res = await api.get(`/dinamicas/ventas/registros?${params}`);
      setRegistrosVentas(res.data.registros);
      setPaginaVentas(res.data.pagina);
      setTotalPaginasVentas(res.data.total_paginas || 1);
    } catch (err) {
      console.error('Error buscando ventas:', err);
    } finally {
      setCargandoVentasGestion(false);
    }
  };

  // ── Eliminación compartida ─────────────────────────────
  const confirmarYEliminar = async () => {
    if (!confirmarEliminar) return;
    setEliminando(true);
    try {
      if (confirmarEliminar.tipo === 'dinamica') {
        await api.delete(`/dinamicas/detalle/${confirmarEliminar.id}`);
        buscarRegistrosDinamica(paginaDinamica);
      } else if (confirmarEliminar.tipo === 'catalogo') {
        await api.delete(`/dinamicas/catalogo/articulos/${confirmarEliminar.id}?pais=${pais}`);
        buscarRegistrosCatalogo(paginaCatalogo);
      } else if (confirmarEliminar.tipo === 'catalogo_completo') {
        await api.delete(`/dinamicas/catalogo/pais/${confirmarEliminar.id}`);
        setRegistrosCatalogo([]);
        cargarStatsCatalogo();
      } else if (confirmarEliminar.tipo === 'venta') {
        await api.delete(`/dinamicas/ventas/registros/${confirmarEliminar.id}`);
        buscarRegistrosVentas(paginaVentas);
      } else if (confirmarEliminar.tipo === 'venta_periodo') {
        await api.delete(`/dinamicas/ventas/periodo?mes=${confirmarEliminar.mes}&anio=${confirmarEliminar.anio}&pais=${pais}`);
        setRegistrosVentas([]);
        cargarStatsVentas();
      }
      setConfirmarEliminar(null);
    } catch (err) {
      console.error('Error eliminando:', err);
    } finally {
      setEliminando(false);
    }
  };

  const paisActual = paises.find(p => p.codigo === pais);
  const paisLabelActual = paisActual ? paisActual.label : pais;

  const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  if (cargandoPaises) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: theme.color.textMuted }}>
        Cargando países disponibles...
      </div>
    );
  }

  return (
    <div>
      <p style={styles.descripcion}>
        Cargá la información del sistema. Actualizá dinámicas, catálogo de artículos, ventas del mes y resúmenes de campañas.
      </p>

      {esSuperAdmin && (
        <div style={styles.paisSelectorBanner}>
          <span style={styles.paisSelectorLabel}>🌎 Gestionando información de:</span>
          <select
            className="pd-hoverable"
            style={styles.paisSelectorSelect}
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            aria-label="País a gestionar"
          >
            {paises.map(p => (
              <option key={p.codigo} value={p.codigo}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs} role="tablist">
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'dinamicas' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('dinamicas')}
          role="tab"
          aria-selected={tabActiva === 'dinamicas'}
        >
          📦 Dinámicas Comerciales
        </button>
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'catalogo' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('catalogo')}
          role="tab"
          aria-selected={tabActiva === 'catalogo'}
        >
          📋 Catálogo de Artículos
        </button>
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'ventas' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('ventas')}
          role="tab"
          aria-selected={tabActiva === 'ventas'}
        >
          📊 Ventas del Mes
        </button>
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'resumen' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('resumen')}
          role="tab"
          aria-selected={tabActiva === 'resumen'}
        >
          🎉 Resumen de Campañas
        </button>
      </div>

      {/* ── TAB DINÁMICAS ─────────────────────────────── */}
      {tabActiva === 'dinamicas' && (
        <div role="tabpanel">
          <div style={styles.pasos}>
            {[
              { num: 1, label: 'Configurar' },
              { num: 2, label: 'Analizar con IA' },
              { num: 3, label: 'Resultado' },
            ].map(p => (
              <div key={p.num} style={styles.pasoWrapper}>
                <div style={{
                  ...styles.pasoCirculo,
                  background: paso >= p.num ? theme.color.primary : theme.color.border,
                  color: paso >= p.num ? theme.color.textOnPrimary : theme.color.textMuted,
                }}>
                  {paso > p.num ? '✓' : p.num}
                </div>
                <span style={{
                  ...styles.pasoLabel,
                  color: paso >= p.num ? theme.color.primary : theme.color.textMuted,
                  fontWeight: paso === p.num ? theme.font.weight.bold : theme.font.weight.regular,
                }}>
                  {p.label}
                </span>
                {p.num < 3 && <div style={{
                  ...styles.pasoLinea,
                  background: paso > p.num ? theme.color.primary : theme.color.border,
                }} />}
              </div>
            ))}
          </div>

          {/* PASO 1 */}
          {paso === 1 && (
            <>
              <div style={styles.formatoCard}>
                <h3 style={styles.formatoTitulo}>📋 Formato esperado del Excel</h3>
                <div style={styles.columnas}>
                  {['SKU', 'Descripcion', 'Ubicacion Dinamica', 'Ubicacion Tienda', 'Tipo de Campana', 'Porcentaje', 'Precio Dinamica'].map(col => (
                    <span key={col} style={styles.columnaTag}>{col}</span>
                  ))}
                </div>
                <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: '10px', marginBottom: 0 }}>
                  💡 La tienda se elige abajo, no va en el Excel — un archivo por tienda para la misma dinámica.
                  <strong> Ubicacion Dinamica</strong> es el tipo de exhibición (Isla, Cabecera, Botadero, etc.) y
                  <strong> Ubicacion Tienda</strong> es dónde queda físicamente en esa sucursal.
                </p>
              </div>

              <div className="pd-grid-2">
                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>⚙️ Configuración</h3>

                  <div style={styles.campo}>
                    <label style={styles.label}>País</label>
                    <div style={styles.paisFijo}>
                      {paisLabelActual}
                      <span style={styles.paisFijoTag}>{esSuperAdmin ? 'Seleccionado arriba' : 'Asignado a tu cuenta'}</span>
                    </div>
                  </div>

                  <div style={styles.campo}>
                    <label htmlFor="dinamica-select" style={styles.label}>Dinámica comercial</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        id="dinamica-select"
                        className="pd-hoverable"
                        style={{ ...styles.select, flex: '1 1 160px' }}
                        value={dinamicaId}
                        onChange={(e) => setDinamicaId(e.target.value)}
                      >
                        {dinamicas.length === 0 && <option value="">Sin dinámicas para este país</option>}
                        {dinamicas.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.nombre} ({d.total_articulos} arts.)
                          </option>
                        ))}
                      </select>
                      <button className="pd-pressable" style={styles.btnNueva} onClick={() => setMostrarNuevaDinamica(true)}>
                        + Nueva
                      </button>
                    </div>
                  </div>

                  <div style={styles.campo}>
                    <label htmlFor="tienda-select" style={styles.label}>Tienda</label>
                    <select
                      id="tienda-select"
                      className="pd-hoverable"
                      style={styles.select}
                      value={tiendaSeleccionada}
                      onChange={(e) => setTiendaSeleccionada(e.target.value)}
                      disabled={cargandoTiendas}
                    >
                      {tiendas.length === 0 && <option value="">Sin tiendas — agregalas en Usuarios &gt; Tiendas</option>}
                      {tiendas.map(t => (
                        <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                      ))}
                    </select>
                    <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: '6px', marginBottom: 0 }}>
                      💡 Este archivo cargará solo los artículos de <strong>esta</strong> tienda — subí un archivo por tienda a la misma dinámica
                    </p>
                  </div>

                  <div style={styles.campo}>
                    <label htmlFor="inputArchivo" style={styles.label}>Archivo Excel</label>
                    <div style={styles.dropZone}>
                      <input
                        id="inputArchivo"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => {
                          setArchivo(e.target.files[0]);
                          setAnalisis(null);
                          setError('');
                        }}
                        style={styles.inputFile}
                        aria-label="Archivo Excel de dinámicas"
                      />
                      <div style={styles.dropTexto}>
                        {archivo ? (
                          <>
                            <span style={{ fontSize: '32px' }} aria-hidden="true">📊</span>
                            <p style={styles.dropNombre}>{archivo.name}</p>
                            <p style={styles.dropSize}>{(archivo.size / 1024).toFixed(1)} KB</p>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '32px' }} aria-hidden="true">📤</span>
                            <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                            <p style={styles.dropSize}>.xlsx o .xls</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

                  <button
                    className="pd-pressable"
                    style={{
                      ...styles.btnAnalizar,
                      opacity: analizando || !archivo ? 0.7 : 1,
                      cursor: analizando || !archivo ? 'not-allowed' : 'pointer'
                    }}
                    onClick={handleAnalizarExcel}
                    disabled={analizando || !archivo}
                  >
                    {analizando ? '🤖 Analizando con IA...' : '🤖 Analizar con IA'}
                  </button>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>💡 ¿Cómo funciona el análisis?</h3>
                  <div style={styles.instrucciones}>
                    {[
                      { icon: '📊', titulo: 'Lectura del archivo', desc: 'El sistema lee todas las filas y columnas automáticamente.' },
                      { icon: '🔍', titulo: 'Detección de problemas', desc: 'Identifica SKUs sin datos, duplicados reales dentro del archivo y columnas incompletas.' },
                      { icon: '🔄', titulo: 'Verificación en BD', desc: 'Cruza los SKUs con otras dinámicas activas para informarte, sin bloquear la carga.' },
                      { icon: '🤖', titulo: 'Análisis con IA', desc: 'La IA genera un reporte con recomendaciones específicas.' },
                      { icon: '✅', titulo: 'Decisión de carga', desc: 'Con base en el análisis, podés cargar o corregir primero.' },
                    ].map((item, i) => (
                      <div key={i} className="pd-stagger-item" style={{ ...styles.instruccionItem, animationDelay: `calc(var(--stagger) * ${i})` }}>
                        <span style={styles.instruccionIcon} aria-hidden="true">{item.icon}</span>
                        <div>
                          <p style={styles.instruccionTitulo}>{item.titulo}</p>
                          <p style={styles.instruccionDesc}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* PASO 2 */}
          {paso === 2 && analisis && (
            <div>
              <div style={{
                ...styles.veredictoBox,
                background: analisis.listo_para_cargar ? theme.color.successBg : theme.color.warningBg,
                border: `2px solid ${analisis.listo_para_cargar ? theme.color.successAccent : theme.color.warningBorder}`,
              }}>
                <span style={{ fontSize: '48px' }} aria-hidden="true">
                  {analisis.listo_para_cargar ? '✅' : '⚠️'}
                </span>
                <div>
                  <p style={{
                    ...styles.veredictoTitulo,
                    color: analisis.listo_para_cargar ? theme.color.successStrong : theme.color.warning,
                  }}>
                    {analisis.listo_para_cargar ? '¡Archivo listo para cargar!' : 'El archivo necesita revisión'}
                  </p>
                  <p style={styles.veredictoSub}>
                    {analisis.total_filas} filas · {analisis.columnas_detectadas.length} columnas
                  </p>
                </div>
              </div>

              <div className="pd-grid-2">
                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>📊 Resultados del análisis</h3>
                  <div style={styles.metricasAnalisis}>
                    {[
                      { label: 'Total filas', valor: analisis.total_filas, color: theme.color.primary, icon: '📋' },
                      { label: 'Sin SKU', valor: analisis.problemas.sin_codigo, color: analisis.problemas.sin_codigo > 0 ? theme.color.error : theme.color.successStrong, icon: '🔢' },
                      { label: 'Sin Precio Dinámica', valor: analisis.problemas.sin_precio, color: analisis.problemas.sin_precio > 0 ? theme.color.warning : theme.color.successStrong, icon: '💲' },
                      { label: 'Sin Porcentaje', valor: analisis.problemas.sin_porcentaje, color: analisis.problemas.sin_porcentaje > 0 ? theme.color.warning : theme.color.successStrong, icon: '％' },
                      { label: 'Duplicados en archivo', valor: analisis.problemas.duplicados_archivo, color: analisis.problemas.duplicados_archivo > 0 ? theme.color.error : theme.color.successStrong, icon: '📄' },
                      { label: 'En otra dinámica activa', valor: analisis.problemas.duplicados_bd, color: theme.color.accent, icon: 'ℹ️' },
                    ].map((m, i) => (
                      <div key={i} className="pd-stagger-item" style={{ ...styles.metricaAnalisisCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                        <span style={styles.metricaAnalisisIcon} aria-hidden="true">{m.icon}</span>
                        <p style={{ ...styles.metricaAnalisisValor, color: m.color }}>{m.valor}</p>
                        <p style={styles.metricaAnalisisLabel}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                  {analisis.columnas_faltantes?.length > 0 && (
                    <p style={{ fontSize: theme.font.size.sm, color: theme.color.warning, marginTop: '12px', marginBottom: 0 }}>
                      ⚠️ Columnas no detectadas: {analisis.columnas_faltantes.join(', ')}
                    </p>
                  )}
                </div>

                <div style={styles.card}>
                  <div style={styles.iaHeader}>
                    <div style={styles.iaAvatar} aria-hidden="true">🤖</div>
                    <div>
                      <p style={styles.iaTitulo}>Análisis de PromoIQ IA</p>
                      <p style={styles.iaSub}>Recomendaciones automáticas</p>
                    </div>
                  </div>
                  <div style={styles.iaRespuesta}>
                    <ReactMarkdown>{analisis.analisis_ia}</ReactMarkdown>
                  </div>
                </div>
              </div>

              <div style={styles.botonesAccion}>
                <button className="pd-pressable" style={styles.btnVolver} onClick={reiniciar}>← Volver y corregir</button>
                <button
                  className="pd-pressable"
                  style={{
                    ...styles.btnCargar,
                    opacity: cargando ? 0.7 : 1,
                    cursor: cargando ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleCargar}
                  disabled={cargando}
                >
                  {cargando ? '⏳ Cargando...' : `🚀 ${analisis.listo_para_cargar ? 'Cargar información' : 'Cargar de todas formas'}`}
                </button>
              </div>
              {error && <div style={{ ...styles.errorBox, marginTop: '12px' }} role="alert">⚠️ {error}</div>}
            </div>
          )}

          {/* PASO 3 */}
          {paso === 3 && resultado && (
            <div style={styles.resultadoFinal}>
              <div style={styles.exitoBox}>
                <span style={{ fontSize: '64px' }} aria-hidden="true">🎉</span>
                <h2 style={styles.exitoTitulo}>¡Información cargada exitosamente!</h2>
                <p style={styles.exitoSub}>{resultado.archivo}</p>
              </div>
              <div style={styles.statsGrid}>
                {[
                  { label: 'Registros cargados', valor: resultado.registros_cargados, icon: '✅', color: theme.color.successStrong },
                  { label: 'Tienda', valor: resultado.tienda || '-', icon: '🏪', color: theme.color.accent },
                  { label: 'País', valor: resultado.pais, icon: '🌎', color: theme.color.accent },
                  { label: 'Dinámica ID', valor: resultado.dinamica_id, icon: '📦', color: theme.color.primary },
                ].map((s, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.statCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                    <span style={{ fontSize: '32px' }} aria-hidden="true">{s.icon}</span>
                    <p style={{ ...styles.statValor, color: s.color }}>{s.valor}</p>
                    <p style={styles.statLabel}>{s.label}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: theme.font.size.base, color: theme.color.textMuted, marginBottom: '20px' }}>
                💡 Si te falta cargar otra tienda para esta misma dinámica, elegí la tienda siguiente y subí su archivo — no hace falta crear una dinámica nueva.
              </p>
              <button className="pd-pressable" style={styles.btnNuevaCarga} onClick={reiniciar}>+ Nueva carga</button>
            </div>
          )}

          {/* Toggle Cargar / Gestionar */}
          <div style={styles.tabs} role="tablist" aria-label="Modo dinámicas">
            <button
              className="pd-pressable"
              style={{ ...styles.tab, ...(vistaDinamicas === 'cargar' ? styles.tabActiva : {}) }}
              onClick={() => setVistaDinamicas('cargar')}
            >
              📤 Cargar
            </button>
            <button
              className="pd-pressable"
              style={{ ...styles.tab, ...(vistaDinamicas === 'gestionar' ? styles.tabActiva : {}) }}
              onClick={() => { setVistaDinamicas('gestionar'); if (dinamicaId) buscarRegistrosDinamica(1); }}
            >
              📝 Gestionar
            </button>
          </div>

          {vistaDinamicas === 'gestionar' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📝 Gestionar artículos de la dinámica</h3>

              <div style={styles.campo}>
                <label htmlFor="dinamica-gestion-select" style={styles.label}>Dinámica</label>
                <select
                  id="dinamica-gestion-select"
                  className="pd-hoverable"
                  style={styles.select}
                  value={dinamicaId}
                  onChange={(e) => { setDinamicaId(e.target.value); setPaginaDinamica(1); }}
                >
                  {dinamicas.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} ({d.total_articulos} arts.)</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  className="pd-hoverable"
                  style={{ ...styles.input, flex: '1 1 200px' }}
                  type="text"
                  placeholder="Buscar por código o descripción..."
                  value={busquedaDinamica}
                  onChange={(e) => setBusquedaDinamica(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarRegistrosDinamica(1)}
                  aria-label="Buscar artículo en la dinámica"
                />
                <button className="pd-pressable" style={styles.btnNueva} onClick={() => buscarRegistrosDinamica(1)}>
                  🔍 Buscar
                </button>
              </div>

              {cargandoRegistrosDinamica ? (
                <p style={{ color: theme.color.textMuted }}>Cargando...</p>
              ) : registrosDinamica.length === 0 ? (
                <p style={{ color: theme.color.textMuted }}>No hay artículos que coincidan.</p>
              ) : (
                <>
                  <div className="pd-table-scroll">
                    <table style={styles.tabla}>
                      <caption style={{ position: 'absolute', left: '-9999px' }}>Artículos de la dinámica seleccionada</caption>
                      <thead>
                        <tr>
                          <th scope="col" style={styles.th}>Código</th>
                          <th scope="col" style={styles.th}>Descripción</th>
                          <th scope="col" style={styles.th}>P. Dinámica</th>
                          <th scope="col" style={styles.th}>Ubicación</th>
                          <th scope="col" style={styles.th}>Ubic. Tienda</th>
                          <th scope="col" style={styles.th}>Tienda</th>
                          <th scope="col" style={styles.th}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrosDinamica.map(r => (
                          <tr key={r.id}>
                            <td style={styles.td}>{r.codigo}</td>
                            <td style={styles.td}>{r.descripcion}</td>
                            <td style={styles.td}>${r.precio_dinamica?.toFixed(2)}</td>
                            <td style={styles.td}>{r.ubicacion_dinamica}</td>
                            <td style={styles.td}>{r.ubicacion_tienda || '-'}</td>
                            <td style={styles.td}>{r.tienda}</td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="pd-pressable"
                                  style={styles.btnAccionSm}
                                  onClick={() => setRegistroEditando(r)}
                                  aria-label={`Editar ${r.codigo}`}
                                >✏️</button>
                                <button
                                  className="pd-pressable"
                                  style={{ ...styles.btnAccionSm, color: theme.color.error }}
                                  onClick={() => setConfirmarEliminar({ tipo: 'dinamica', id: r.id, label: `${r.codigo} — ${r.descripcion}` })}
                                  aria-label={`Eliminar ${r.codigo}`}
                                >🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={styles.paginacion}>
                    <button className="pd-pressable" style={styles.btnPagina} disabled={paginaDinamica <= 1} onClick={() => buscarRegistrosDinamica(paginaDinamica - 1)}>← Anterior</button>
                    <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>Página {paginaDinamica} de {totalPaginasDinamica}</span>
                    <button className="pd-pressable" style={styles.btnPagina} disabled={paginaDinamica >= totalPaginasDinamica} onClick={() => buscarRegistrosDinamica(paginaDinamica + 1)}>Siguiente →</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CATÁLOGO ──────────────────────────────── */}
      {tabActiva === 'catalogo' && (
        <div role="tabpanel">
          {statsCatalogo && (
            <div style={styles.statsActuales}>
              <div style={styles.statsActualesHeader}>
                <h3 style={styles.statsActualesTitulo}>📊 Estado actual del catálogo — {paisLabelActual}</h3>
                {statsCatalogo.ultima_actualizacion && (
                  <span style={styles.ultimaActualizacion}>
                    🕐 Última actualización: {new Date(statsCatalogo.ultima_actualizacion).toLocaleString('es-CR')}
                  </span>
                )}
              </div>
              <div className="pd-grid-4">
                {[
                  { label: 'Total artículos', valor: statsCatalogo.total_articulos.toLocaleString(), icon: '🏷️', color: theme.color.primary },
                  { label: 'Departamentos', valor: statsCatalogo.departamentos, icon: '📂', color: theme.color.accent },
                  { label: 'Sucursales', valor: statsCatalogo.sucursales, icon: '🏪', color: theme.color.successStrong },
                  { label: 'Marcas', valor: statsCatalogo.marcas, icon: '🏷️', color: theme.color.warning },
                ].map((s, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.statsActualesCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                    <span style={{ fontSize: '24px' }} aria-hidden="true">{s.icon}</span>
                    <p style={{ ...styles.statsActualesValor, color: s.color }}>{s.valor}</p>
                    <p style={styles.statsActualesLabel}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pd-grid-2">
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📋 Cargar Catálogo de Artículos</h3>

              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                <div style={styles.paisFijo}>
                  {paisLabelActual}
                  <span style={styles.paisFijoTag}>{esSuperAdmin ? 'Seleccionado arriba' : 'Asignado a tu cuenta'}</span>
                </div>
              </div>

              <div style={styles.campo}>
                <label htmlFor="inputCatalogo" style={styles.label}>Archivo Excel del catálogo</label>
                <div style={styles.dropZone}>
                  <input
                    id="inputCatalogo"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      setArchivoCatalogo(e.target.files[0]);
                      setErrorCatalogo('');
                      setResultadoCatalogo(null);
                    }}
                    style={styles.inputFile}
                    aria-label="Archivo Excel del catálogo"
                  />
                  <div style={styles.dropTexto}>
                    {archivoCatalogo ? (
                      <>
                        <span style={{ fontSize: '32px' }} aria-hidden="true">📊</span>
                        <p style={styles.dropNombre}>{archivoCatalogo.name}</p>
                        <p style={styles.dropSize}>{(archivoCatalogo.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '32px' }} aria-hidden="true">📋</span>
                        <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                        <p style={styles.dropSize}>.xlsx o .xls — se reemplaza el catálogo completo</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {errorCatalogo && <div style={styles.errorBox} role="alert">⚠️ {errorCatalogo}</div>}

              {resultadoCatalogo && (
                <div style={styles.exitoCatalogoBox}>
                  <span style={{ fontSize: '24px' }} aria-hidden="true">✅</span>
                  <div>
                    <p style={styles.exitoCatalogoTitulo}>¡Catálogo actualizado!</p>
                    <p style={styles.exitoCatalogoSub}>
                      {resultadoCatalogo.registros_cargados.toLocaleString()} artículos únicos cargados
                      {resultadoCatalogo.errores > 0 && ` · ${resultadoCatalogo.errores} errores omitidos`}
                    </p>
                  </div>
                </div>
              )}

              <button
                className="pd-pressable"
                style={{
                  ...styles.btnAnalizar,
                  opacity: cargandoCatalogo || !archivoCatalogo ? 0.7 : 1,
                  cursor: cargandoCatalogo || !archivoCatalogo ? 'not-allowed' : 'pointer',
                  background: `linear-gradient(135deg, ${theme.color.successStrong} 0%, ${theme.color.accent} 100%)`,
                }}
                onClick={handleCargarCatalogo}
                disabled={cargandoCatalogo || !archivoCatalogo}
              >
                {cargandoCatalogo ? '⏳ Cargando catálogo...' : '📋 Cargar catálogo'}
              </button>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>ℹ️ Sobre el catálogo de artículos</h3>
              <div style={styles.instrucciones}>
                {[
                  { icon: '📅', titulo: 'Actualización diaria', desc: 'El catálogo se actualiza todos los días con el archivo exportado del sistema.' },
                  { icon: '🔄', titulo: 'Reemplazo completo', desc: 'Cada carga reemplaza el catálogo del país — se deduplicar por SKU automáticamente.' },
                  { icon: '🤖', titulo: 'Base de conocimiento IA', desc: 'La IA usa el catálogo para responder consultas sobre artículos, precios e inventarios.' },
                  { icon: '🔍', titulo: 'Búsqueda por SKU', desc: 'El SKU es el identificador principal para todas las búsquedas del sistema.' },
                  { icon: '🏪', titulo: 'Sucursales', desc: 'Se guardan todas las sucursales por SKU para consultas detalladas de inventario.' },
                ].map((item, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.instruccionItem, animationDelay: `calc(var(--stagger) * ${i})` }}>
                    <span style={styles.instruccionIcon} aria-hidden="true">{item.icon}</span>
                    <div>
                      <p style={styles.instruccionTitulo}>{item.titulo}</p>
                      <p style={styles.instruccionDesc}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.tabs} role="tablist" aria-label="Modo catálogo">
            <button className="pd-pressable" style={{ ...styles.tab, ...(vistaCatalogo === 'cargar' ? styles.tabActiva : {}) }} onClick={() => setVistaCatalogo('cargar')}>📤 Cargar</button>
            <button className="pd-pressable" style={{ ...styles.tab, ...(vistaCatalogo === 'gestionar' ? styles.tabActiva : {}) }} onClick={() => setVistaCatalogo('gestionar')}>📝 Gestionar</button>
          </div>

          {vistaCatalogo === 'gestionar' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📝 Gestionar artículos del catálogo — {paisLabelActual}</h3>

              <div style={{ ...styles.veredictoBox, background: theme.color.errorBg, border: `2px solid ${theme.color.errorBorder}`, marginBottom: '20px' }}>
                <span style={{ fontSize: '32px' }} aria-hidden="true">⚠️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ ...styles.veredictoTitulo, fontSize: theme.font.size.lg, color: theme.color.error }}>
                    Zona de peligro
                  </p>
                  <p style={styles.veredictoSub}>
                    Elimina todos los artículos del catálogo de {paisLabelActual} de una sola vez. Útil antes de recargar un catálogo completo desde cero.
                  </p>
                </div>
                <button
                  className="pd-pressable"
                  style={{ ...styles.btnNueva, background: theme.color.error, color: theme.color.textOnPrimary, border: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => setConfirmarEliminar({
                    tipo: 'catalogo_completo',
                    id: pais,
                    label: `TODO el catálogo de ${paisLabelActual}`
                  })}
                >
                  🗑️ Eliminar catálogo completo
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  className="pd-hoverable"
                  style={{ ...styles.input, flex: '1 1 200px' }}
                  type="text"
                  placeholder="Buscar por SKU o descripción (mín. 2 caracteres)..."
                  value={busquedaCatalogo}
                  onChange={(e) => setBusquedaCatalogo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarRegistrosCatalogo(1)}
                  aria-label="Buscar artículo en el catálogo"
                />
                <button className="pd-pressable" style={styles.btnNueva} onClick={() => buscarRegistrosCatalogo(1)}>🔍 Buscar</button>
              </div>

              {cargandoCatalogoGestion ? (
                <p style={{ color: theme.color.textMuted }}>Buscando...</p>
              ) : registrosCatalogo.length === 0 ? (
                <p style={{ color: theme.color.textMuted }}>Ingresá un término de búsqueda para ver resultados.</p>
              ) : (
                <>
                  <div className="pd-table-scroll">
                    <table style={styles.tabla}>
                      <caption style={{ position: 'absolute', left: '-9999px' }}>Artículos del catálogo maestro</caption>
                      <thead>
                        <tr>
                          <th scope="col" style={styles.th}>SKU</th>
                          <th scope="col" style={styles.th}>Descripción</th>
                          <th scope="col" style={styles.th}>Estado</th>
                          <th scope="col" style={styles.th}>Precio</th>
                          <th scope="col" style={styles.th}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registrosCatalogo.map(r => (
                          <tr key={r.sku}>
                            <td style={styles.td}>{r.sku}</td>
                            <td style={styles.td}>{r.descripcion}</td>
                            <td style={styles.td}>{r.estado}</td>
                            <td style={styles.td}>${r.precio_unitario?.toFixed(2)}</td>
                            <td style={styles.td}>
                              <button
                                className="pd-pressable"
                                style={{ ...styles.btnAccionSm, color: theme.color.error }}
                                onClick={() => setConfirmarEliminar({ tipo: 'catalogo', id: r.sku, label: `${r.sku} — ${r.descripcion}` })}
                                aria-label={`Eliminar ${r.sku}`}
                              >🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={styles.paginacion}>
                    <button className="pd-pressable" style={styles.btnPagina} disabled={paginaCatalogo <= 1} onClick={() => buscarRegistrosCatalogo(paginaCatalogo - 1)}>← Anterior</button>
                    <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>Página {paginaCatalogo} de {totalPaginasCatalogo}</span>
                    <button className="pd-pressable" style={styles.btnPagina} disabled={paginaCatalogo >= totalPaginasCatalogo} onClick={() => buscarRegistrosCatalogo(paginaCatalogo + 1)}>Siguiente →</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB VENTAS ────────────────────────────────── */}
      {tabActiva === 'ventas' && (
        <div role="tabpanel">
          {statsVentas && statsVentas.total_registros > 0 && (
            <div style={styles.statsActuales}>
              <div style={styles.statsActualesHeader}>
                <h3 style={styles.statsActualesTitulo}>📊 Ventas del mes cargadas — {paisLabelActual}</h3>
                {statsVentas.ultima_carga && (
                  <span style={styles.ultimaActualizacion}>
                    🕐 Última carga: {new Date(statsVentas.ultima_carga).toLocaleString('es-CR')}
                  </span>
                )}
              </div>
              <div className="pd-grid-3">
                {[
                  { label: 'Total registros', valor: statsVentas.total_registros.toLocaleString(), icon: '📋', color: theme.color.primary },
                  { label: 'Total unidades', valor: statsVentas.total_ventas.toLocaleString(), icon: '🛒', color: theme.color.accent },
                  { label: 'Meses cargados', valor: statsVentas.meses_cargados, icon: '📅', color: theme.color.successStrong },
                ].map((s, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.statsActualesCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                    <span style={{ fontSize: '24px' }} aria-hidden="true">{s.icon}</span>
                    <p style={{ ...styles.statsActualesValor, color: s.color }}>{s.valor}</p>
                    <p style={styles.statsActualesLabel}>{s.label}</p>
                  </div>
                ))}
              </div>
              {statsVentas.meses_disponibles?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 8px 0', fontWeight: theme.font.weight.bold, textTransform: 'uppercase' }}>
                    Períodos disponibles:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {statsVentas.meses_disponibles.map((m, i) => (
                      <span key={i} style={styles.periodoTag}>
                        {MESES[m.mes - 1]} {m.anio}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pd-grid-2">
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📊 Cargar Ventas del Mes</h3>

              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                <div style={styles.paisFijo}>
                  {paisLabelActual}
                  <span style={styles.paisFijoTag}>{esSuperAdmin ? 'Seleccionado arriba' : 'Asignado a tu cuenta'}</span>
                </div>
              </div>

              <div className="pd-grid-2">
                <div style={styles.campo}>
                  <label htmlFor="mes-ventas" style={styles.label}>Mes</label>
                  <select
                    id="mes-ventas"
                    className="pd-hoverable"
                    style={styles.select}
                    value={mesVentas}
                    onChange={(e) => setMesVentas(parseInt(e.target.value))}
                  >
                    {MESES.map((m, i) => (
                      <option key={i+1} value={i+1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.campo}>
                  <label htmlFor="anio-ventas" style={styles.label}>Año</label>
                  <select
                    id="anio-ventas"
                    className="pd-hoverable"
                    style={styles.select}
                    value={anioVentas}
                    onChange={(e) => setAnioVentas(parseInt(e.target.value))}
                  >
                    {[2024, 2025, 2026, 2027].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.campo}>
                <label htmlFor="inputVentas" style={styles.label}>Archivo Excel de ventas</label>
                <div style={styles.dropZone}>
                  <input
                    id="inputVentas"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      setArchivoVentas(e.target.files[0]);
                      setErrorVentas('');
                      setResultadoVentas(null);
                    }}
                    style={styles.inputFile}
                    aria-label="Archivo Excel de ventas"
                  />
                  <div style={styles.dropTexto}>
                    {archivoVentas ? (
                      <>
                        <span style={{ fontSize: '32px' }} aria-hidden="true">📊</span>
                        <p style={styles.dropNombre}>{archivoVentas.name}</p>
                        <p style={styles.dropSize}>{(archivoVentas.size / 1024).toFixed(1)} KB</p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '32px' }} aria-hidden="true">📊</span>
                        <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                        <p style={styles.dropSize}>.xlsx o .xls</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {errorVentas && <div style={styles.errorBox} role="alert">⚠️ {errorVentas}</div>}

              {resultadoVentas && (
                <div style={styles.exitoCatalogoBox}>
                  <span style={{ fontSize: '24px' }} aria-hidden="true">✅</span>
                  <div>
                    <p style={styles.exitoCatalogoTitulo}>¡Ventas cargadas!</p>
                    <p style={styles.exitoCatalogoSub}>
                      {resultadoVentas.registros_cargados.toLocaleString()} registros ·{' '}
                      {MESES[resultadoVentas.mes - 1]} {resultadoVentas.anio}
                      {resultadoVentas.errores > 0 && ` · ${resultadoVentas.errores} omitidos`}
                    </p>
                  </div>
                </div>
              )}

              <button
                className="pd-pressable"
                style={{
                  ...styles.btnAnalizar,
                  opacity: cargandoVentas || !archivoVentas ? 0.7 : 1,
                  cursor: cargandoVentas || !archivoVentas ? 'not-allowed' : 'pointer',
                  background: `linear-gradient(135deg, ${theme.color.primary} 0%, ${theme.color.successStrong} 100%)`,
                }}
                onClick={handleCargarVentas}
                disabled={cargandoVentas || !archivoVentas}
              >
                {cargandoVentas ? '⏳ Cargando ventas...' : '📊 Cargar ventas del mes'}
              </button>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>ℹ️ Sobre las ventas del mes</h3>
              <div style={styles.instrucciones}>
                {[
                  { icon: '📋', titulo: 'Formato del archivo', desc: 'SKU | Descripcion | Vidri Express | Mostrador | Externo | E-Commerce | Total general' },
                  { icon: '🔄', titulo: 'SKU especial 00000', desc: 'Cuando el SKU es 00000, el sistema extrae el SKU real del inicio de la descripción automáticamente.' },
                  { icon: '📅', titulo: 'Por mes y año', desc: 'Cada carga corresponde a un mes. Podés tener múltiples meses simultáneamente.' },
                  { icon: '🤖', titulo: 'Análisis con IA', desc: 'La IA cruza las ventas con el catálogo y las dinámicas para generar análisis de impacto.' },
                  { icon: '🔁', titulo: 'Reemplazo por período', desc: 'Si cargás el mismo mes dos veces los datos anteriores se reemplazan automáticamente.' },
                ].map((item, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.instruccionItem, animationDelay: `calc(var(--stagger) * ${i})` }}>
                    <span style={styles.instruccionIcon} aria-hidden="true">{item.icon}</span>
                    <div>
                      <p style={styles.instruccionTitulo}>{item.titulo}</p>
                      <p style={styles.instruccionDesc}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.tabs} role="tablist" aria-label="Modo ventas">
            <button className="pd-pressable" style={{ ...styles.tab, ...(vistaVentas === 'cargar' ? styles.tabActiva : {}) }} onClick={() => setVistaVentas('cargar')}>📤 Cargar</button>
            <button className="pd-pressable" style={{ ...styles.tab, ...(vistaVentas === 'gestionar' ? styles.tabActiva : {}) }} onClick={() => setVistaVentas('gestionar')}>📝 Gestionar</button>
          </div>

          {vistaVentas === 'gestionar' && (
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📝 Gestionar registros de ventas — {paisLabelActual}</h3>

              {statsVentas?.meses_disponibles?.length > 0 ? (
                <div style={{ marginBottom: '20px' }}>
                  <p style={styles.label}>Períodos cargados — hacé clic para gestionar</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {statsVentas.meses_disponibles.map((m, i) => {
                      const esActivo = mesGestionVentas === m.mes && anioGestionVentas === m.anio;
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <button
                            className="pd-pressable"
                            style={{
                              ...styles.periodoTag,
                              cursor: 'pointer',
                              border: 'none',
                              fontSize: theme.font.size.base,
                              padding: '8px 16px',
                              borderRadius: `${theme.radius.pill} 0 0 ${theme.radius.pill}`,
                              background: esActivo ? theme.color.primary : theme.color.accentSoft,
                              color: esActivo ? theme.color.textOnPrimary : theme.color.primary,
                            }}
                            onClick={() => {
                              setMesGestionVentas(m.mes);
                              setAnioGestionVentas(m.anio);
                              setBusquedaVentas('');
                              buscarRegistrosVentas(1);
                            }}
                          >
                            {MESES[m.mes - 1]} {m.anio}
                          </button>
                          <button
                            className="pd-pressable"
                            style={{
                              ...styles.periodoTag,
                              cursor: 'pointer',
                              border: 'none',
                              padding: '8px 10px',
                              borderRadius: `0 ${theme.radius.pill} ${theme.radius.pill} 0`,
                              background: esActivo ? theme.color.primary : theme.color.accentSoft,
                              color: theme.color.error,
                            }}
                            onClick={() => setConfirmarEliminar({
                              tipo: 'venta_periodo',
                              mes: m.mes,
                              anio: m.anio,
                              label: `TODAS las ventas de ${MESES[m.mes - 1]} ${m.anio}`
                            })}
                            aria-label={`Eliminar todas las ventas de ${MESES[m.mes - 1]} ${m.anio}`}
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ color: theme.color.textMuted, marginBottom: '16px' }}>
                  Todavía no hay ventas cargadas para ningún período.
                </p>
              )}

              {statsVentas?.meses_disponibles?.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <input
                      className="pd-hoverable"
                      style={{ ...styles.input, flex: '1 1 200px' }}
                      type="text"
                      placeholder="Buscar por SKU o descripción (opcional)..."
                      value={busquedaVentas}
                      onChange={(e) => setBusquedaVentas(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && buscarRegistrosVentas(1)}
                      aria-label="Buscar registro de venta"
                    />
                    <button className="pd-pressable" style={styles.btnNueva} onClick={() => buscarRegistrosVentas(1)}>🔍 Buscar</button>
                  </div>

                  {cargandoVentasGestion ? (
                    <p style={{ color: theme.color.textMuted }}>Cargando...</p>
                  ) : registrosVentas.length === 0 ? (
                    <p style={{ color: theme.color.textMuted }}>Seleccioná un período arriba para ver sus registros.</p>
                  ) : (
                    <>
                      <div className="pd-table-scroll">
                        <table style={styles.tabla}>
                          <caption style={{ position: 'absolute', left: '-9999px' }}>Registros de ventas del período seleccionado</caption>
                          <thead>
                            <tr>
                              <th scope="col" style={styles.th}>SKU</th>
                              <th scope="col" style={styles.th}>Descripción</th>
                              <th scope="col" style={styles.th}>Total vendido</th>
                              <th scope="col" style={styles.th}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {registrosVentas.map(r => (
                              <tr key={r.id}>
                                <td style={styles.td}>{r.sku}</td>
                                <td style={styles.td}>{r.descripcion}</td>
                                <td style={styles.td}>{r.venta_total}</td>
                                <td style={styles.td}>
                                  <button
                                    className="pd-pressable"
                                    style={{ ...styles.btnAccionSm, color: theme.color.error }}
                                    onClick={() => setConfirmarEliminar({ tipo: 'venta', id: r.id, label: `${r.sku} — ${r.descripcion}` })}
                                    aria-label={`Eliminar registro de ${r.sku}`}
                                  >🗑️</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={styles.paginacion}>
                        <button className="pd-pressable" style={styles.btnPagina} disabled={paginaVentas <= 1} onClick={() => buscarRegistrosVentas(paginaVentas - 1)}>← Anterior</button>
                        <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>Página {paginaVentas} de {totalPaginasVentas}</span>
                        <button className="pd-pressable" style={styles.btnPagina} disabled={paginaVentas >= totalPaginasVentas} onClick={() => buscarRegistrosVentas(paginaVentas + 1)}>Siguiente →</button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB RESUMEN DE CAMPAÑAS ───────────────────── */}
      {tabActiva === 'resumen' && (
        <div role="tabpanel">
          <div className="pd-grid-2">
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>🎉 Cargar Resumen de Campaña</h3>

              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                <div style={styles.paisFijo}>
                  {paisLabelActual}
                  <span style={styles.paisFijoTag}>{esSuperAdmin ? 'Seleccionado arriba' : 'Asignado a tu cuenta'}</span>
                </div>
                <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: '6px', marginBottom: 0 }}>
                  💡 El resumen aplica a toda la campaña en este país — no se filtra por tienda.
                </p>
              </div>

              <div style={styles.campo}>
                <label htmlFor="dinamica-resumen-select" style={styles.label}>Dinámica</label>
                <select
                  id="dinamica-resumen-select"
                  className="pd-hoverable"
                  style={styles.select}
                  value={dinamicaResumenId}
                  onChange={(e) => setDinamicaResumenId(e.target.value)}
                >
                  {dinamicas.length === 0 && <option value="">Sin dinámicas para este país</option>}
                  <option value="">Seleccioná una dinámica...</option>
                  {dinamicas.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={styles.campo}>
                <label htmlFor="inputResumen" style={styles.label}>Archivo Word (.docx)</label>
                <div style={styles.dropZone}>
                  <input
                    id="inputResumen"
                    type="file"
                    accept=".docx"
                    onChange={(e) => {
                      setArchivoResumen(e.target.files[0]);
                      setErrorResumen('');
                      setResultadoResumen(null);
                    }}
                    style={styles.inputFile}
                    aria-label="Archivo Word con el resumen de la campaña"
                  />
                  <div style={styles.dropTexto}>
                    {archivoResumen ? (
                      <>
                        <span style={{ fontSize: '32px' }} aria-hidden="true">📄</span>
                        <p style={styles.dropNombre}>{archivoResumen.name}</p>
                        <p style={styles.dropSize}>{(archivoResumen.size / 1024).toFixed(1)} KB</p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '32px' }} aria-hidden="true">🎉</span>
                        <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                        <p style={styles.dropSize}>.docx — puede traer varias tarjetas de promoción</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {errorResumen && <div style={styles.errorBox} role="alert">⚠️ {errorResumen}</div>}

              {resultadoResumen && (
                <div style={styles.exitoCatalogoBox}>
                  <span style={{ fontSize: '24px' }} aria-hidden="true">✅</span>
                  <div>
                    <p style={styles.exitoCatalogoTitulo}>¡Resumen cargado para "{resultadoResumen.dinamica_nombre}"!</p>
                    <p style={styles.exitoCatalogoSub}>
                      {resultadoResumen.total_tarjetas} tarjeta{resultadoResumen.total_tarjetas !== 1 ? 's' : ''} detectada{resultadoResumen.total_tarjetas !== 1 ? 's' : ''} · {resultadoResumen.vista_previa}
                    </p>
                  </div>
                </div>
              )}

              <button
                className="pd-pressable"
                style={{
                  ...styles.btnAnalizar,
                  opacity: cargandoResumen || !archivoResumen || !dinamicaResumenId ? 0.7 : 1,
                  cursor: cargandoResumen || !archivoResumen || !dinamicaResumenId ? 'not-allowed' : 'pointer',
                  background: `linear-gradient(135deg, ${theme.color.accent} 0%, ${theme.color.successStrong} 100%)`,
                }}
                onClick={handleCargarResumen}
                disabled={cargandoResumen || !archivoResumen || !dinamicaResumenId}
              >
                {cargandoResumen ? '⏳ Cargando resumen...' : '🎉 Cargar resumen de campaña'}
              </button>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>ℹ️ Sobre el resumen de campañas</h3>
              <div style={styles.instrucciones}>
                {[
                  { icon: '📄', titulo: 'Word con el flyer completo', desc: 'Subí el mismo documento que usás para imprimir o compartir la promoción — el sistema extrae cada tarjeta de información automáticamente.' },
                  { icon: '🎴', titulo: 'Varias tarjetas por archivo', desc: 'Si el Word trae varias promociones distintas, cada una se muestra por separado en Resumen Campañas — no se mezclan.' },
                  { icon: '🔁', titulo: 'Se limpia lo repetido', desc: 'Si una tarjeta aparece copiada varias veces (típico para imprimir en una hoja), el sistema guarda una sola copia.' },
                  { icon: '🌎', titulo: 'Alcance por país', desc: 'El resumen aplica a la campaña completa en el país — no varía por tienda.' },
                  { icon: '🔄', titulo: 'Reemplaza el anterior', desc: 'Cargar un Word nuevo para la misma dinámica reemplaza el resumen anterior por completo.' },
                ].map((item, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.instruccionItem, animationDelay: `calc(var(--stagger) * ${i})` }}>
                    <span style={styles.instruccionIcon} aria-hidden="true">{item.icon}</span>
                    <div>
                      <p style={styles.instruccionTitulo}>{item.titulo}</p>
                      <p style={styles.instruccionDesc}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva dinámica */}
      {mostrarNuevaDinamica && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setMostrarNuevaDinamica(false); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-nueva-dinamica-titulo"
          >
            <h3 id="modal-nueva-dinamica-titulo" style={styles.modalTitulo}>➕ Nueva Dinámica — {paisLabelActual}</h3>
            <div style={styles.campo}>
              <label htmlFor="nueva-dinamica-nombre" style={styles.label}>Nombre</label>
              <input
                id="nueva-dinamica-nombre"
                className="pd-hoverable"
                style={styles.input}
                type="text"
                placeholder="Ej: Dinámica Julio 2026"
                value={nuevaDinamica.nombre}
                onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, nombre: e.target.value })}
                autoFocus
              />
            </div>
            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="nueva-dinamica-inicio" style={styles.label}>Fecha inicio</label>
                <input
                  id="nueva-dinamica-inicio"
                  className="pd-hoverable"
                  style={styles.input}
                  type="date"
                  value={nuevaDinamica.fecha_inicio}
                  onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, fecha_inicio: e.target.value })}
                />
              </div>
              <div style={styles.campo}>
                <label htmlFor="nueva-dinamica-fin" style={styles.label}>Fecha fin</label>
                <input
                  id="nueva-dinamica-fin"
                  className="pd-hoverable"
                  style={styles.input}
                  type="date"
                  value={nuevaDinamica.fecha_fin}
                  onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, fecha_fin: e.target.value })}
                />
              </div>
            </div>
            <div style={styles.campo}>
              <label htmlFor="nueva-dinamica-desc" style={styles.label}>Descripción (opcional — también podés cargarla luego como Word)</label>
              <textarea
                id="nueva-dinamica-desc"
                className="pd-hoverable"
                style={{ ...styles.input, minHeight: '90px', resize: 'vertical', fontFamily: theme.font.family }}
                placeholder="Descripción breve de la campaña"
                value={nuevaDinamica.descripcion}
                onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, descripcion: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button className="pd-pressable" style={styles.btnCargar} onClick={crearDinamica}>Crear dinámica</button>
              <button className="pd-pressable" style={styles.btnVolver} onClick={() => setMostrarNuevaDinamica(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar artículo de dinámica */}
      {registroEditando && (
        <div className="pd-modal-overlay" style={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setRegistroEditando(null); }}>
          <div className="pd-modal-card" style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-editar-titulo">
            <h3 id="modal-editar-titulo" style={styles.modalTitulo}>✏️ Editar artículo — {registroEditando.codigo}</h3>

            <div style={styles.campo}>
              <label htmlFor="editar-descripcion" style={styles.label}>Descripción</label>
              <input id="editar-descripcion" className="pd-hoverable" style={styles.input} type="text"
                value={registroEditando.descripcion || ''}
                onChange={(e) => setRegistroEditando({ ...registroEditando, descripcion: e.target.value })} />
            </div>

            <div style={styles.campo}>
              <label style={styles.label}>Precio regular (catálogo)</label>
              <div style={{ ...styles.paisFijo, fontWeight: theme.font.weight.regular }}>
                ${registroEditando.precio_regular?.toFixed(2) ?? '0.00'}
                <span style={styles.paisFijoTag}>Viene del catálogo maestro — no editable acá</span>
              </div>
            </div>
            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="editar-porcentaje-descuento" style={styles.label}>% Descuento</label>
                <input id="editar-porcentaje-descuento" className="pd-hoverable" style={styles.input} type="number" step="0.01"
                  value={registroEditando.porcentaje_descuento ?? ''}
                  onChange={(e) => setRegistroEditando({ ...registroEditando, porcentaje_descuento: e.target.value })} />
              </div>
              <div style={styles.campo}>
                <label htmlFor="editar-precio-dinamica" style={styles.label}>Precio dinámica</label>
                <input id="editar-precio-dinamica" className="pd-hoverable" style={styles.input} type="number" step="0.01"
                  value={registroEditando.precio_dinamica ?? ''}
                  onChange={(e) => setRegistroEditando({ ...registroEditando, precio_dinamica: e.target.value })} />
              </div>
            </div>
            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="editar-ubicacion-dinamica" style={styles.label}>Ubicación dinámica</label>
                <input id="editar-ubicacion-dinamica" className="pd-hoverable" style={styles.input} type="text"
                  value={registroEditando.ubicacion_dinamica || ''}
                  onChange={(e) => setRegistroEditando({ ...registroEditando, ubicacion_dinamica: e.target.value })} />
              </div>
              <div style={styles.campo}>
                <label htmlFor="editar-ubicacion-tienda" style={styles.label}>Ubicación en tienda</label>
                <input id="editar-ubicacion-tienda" className="pd-hoverable" style={styles.input} type="text"
                  value={registroEditando.ubicacion_tienda || ''}
                  onChange={(e) => setRegistroEditando({ ...registroEditando, ubicacion_tienda: e.target.value })} />
              </div>
            </div>
            <div style={styles.campo}>
              <label htmlFor="editar-tipo-campana" style={styles.label}>Tipo campaña</label>
              <input id="editar-tipo-campana" className="pd-hoverable" style={styles.input} type="text"
                value={registroEditando.tipo_campana || ''}
                onChange={(e) => setRegistroEditando({ ...registroEditando, tipo_campana: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button className="pd-pressable" style={{ ...styles.btnCargar, opacity: guardandoEdicion ? 0.7 : 1 }} onClick={guardarEdicionDinamica} disabled={guardandoEdicion}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button className="pd-pressable" style={styles.btnVolver} onClick={() => setRegistroEditando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmarEliminar && (
        <div className="pd-modal-overlay" style={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmarEliminar(null); }}>
          <div className="pd-modal-card" style={{ ...styles.modal, maxWidth: '420px' }} role="dialog" aria-modal="true" aria-labelledby="modal-eliminar-titulo">
            <h3 id="modal-eliminar-titulo" style={styles.modalTitulo}>⚠️ Confirmar eliminación</h3>
            <p style={{ color: theme.color.text, fontSize: theme.font.size.base, marginBottom: '20px' }}>
              ¿Seguro que querés eliminar <strong>{confirmarEliminar.label}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnCargar, background: theme.color.error, opacity: eliminando ? 0.7 : 1 }}
                onClick={confirmarYEliminar}
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="pd-pressable" style={styles.btnVolver} onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  paisSelectorBanner: {
    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
    background: theme.color.primary, padding: '14px 20px', borderRadius: theme.radius.lg,
    marginBottom: '20px',
  },
  paisSelectorLabel: { color: theme.color.textOnPrimary, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold },
  paisSelectorSelect: {
    padding: '8px 14px', borderRadius: theme.radius.sm, border: 'none',
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold,
    color: theme.color.primary, background: theme.color.surface, cursor: 'pointer',
  },
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', background: theme.color.background, padding: '4px', borderRadius: theme.radius.lg, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' },
  tab: { padding: '10px 20px', borderRadius: theme.radius.md, border: 'none', background: 'transparent', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.textMuted, cursor: 'pointer', fontFamily: theme.font.family, whiteSpace: 'nowrap' },
  tabActiva: { background: theme.color.surface, color: theme.color.primary, boxShadow: theme.shadow.sm },
  pasos: { display: 'flex', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' },
  pasoWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
  pasoCirculo: { width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  pasoLabel: { fontSize: theme.font.size.base, whiteSpace: 'nowrap' },
  pasoLinea: { height: '2px', width: '40px', margin: '0 8px' },
  formatoCard: { background: theme.color.accentSoft, border: `1px solid ${theme.color.accentSoftBorder}`, borderRadius: theme.radius.md, padding: '16px 20px', marginBottom: '20px' },
  formatoTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 10px 0' },
  columnas: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  columnaTag: { background: theme.color.primary, color: theme.color.textOnPrimary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, padding: '4px 10px', borderRadius: theme.radius.pill, fontFamily: 'monospace' },
  card: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '16px' },
  cardTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 20px 0' },
  campo: { marginBottom: '16px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  input: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box', fontFamily: theme.font.family },
  paisFijo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, background: theme.color.background, fontSize: theme.font.size.md, color: theme.color.text, fontWeight: theme.font.weight.semibold, flexWrap: 'wrap', gap: '4px' },
  paisFijoTag: { fontSize: theme.font.size.sm, color: theme.color.textMuted, background: theme.color.border, padding: '2px 8px', borderRadius: theme.radius.pill, fontWeight: theme.font.weight.regular },
  dropZone: { border: `2px dashed ${theme.color.dropBorder}`, borderRadius: theme.radius.md, padding: '24px', cursor: 'pointer', position: 'relative', background: theme.color.surfaceMuted },
  inputFile: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' },
  dropTexto: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', pointerEvents: 'none' },
  dropNombre: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.primary, margin: '4px 0 0 0' },
  dropSize: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, textAlign: 'center' },
  btnNueva: { padding: '10px 14px', background: theme.color.accentSoft, border: `1px solid ${theme.color.accentSoftBorder}`, borderRadius: theme.radius.sm, color: theme.color.primary, fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnAnalizar: { width: '100%', padding: '14px', background: theme.color.gradient, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '12px' },
  instrucciones: { display: 'flex', flexDirection: 'column', gap: '16px' },
  instruccionItem: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  instruccionIcon: { fontSize: '24px', flexShrink: 0 },
  instruccionTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 2px 0' },
  instruccionDesc: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, lineHeight: '1.5' },
  veredictoBox: { display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px', borderRadius: theme.radius.xl, marginBottom: '20px', flexWrap: 'wrap' },
  veredictoTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, margin: '0 0 4px 0' },
  veredictoSub: { fontSize: theme.font.size.base, color: theme.color.textMuted, margin: 0 },
  metricasAnalisis: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' },
  metricaAnalisisCard: { background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '14px', textAlign: 'center' },
  metricaAnalisisIcon: { fontSize: '20px' },
  metricaAnalisisValor: { fontSize: '24px', fontWeight: theme.font.weight.black, margin: '4px 0 2px', lineHeight: 1 },
  metricaAnalisisLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: 0 },
  iaHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${theme.color.border}` },
  iaAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: theme.color.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xxl, flexShrink: 0 },
  iaTitulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0 },
  iaSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  iaRespuesta: { fontSize: theme.font.size.base, color: theme.color.text, lineHeight: '1.7', maxHeight: '300px', overflow: 'auto' },
  botonesAccion: { display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' },
  btnCargar: { flex: '1 1 200px', padding: '14px', background: theme.color.gradient, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },
  btnVolver: { padding: '14px 20px', background: theme.color.background, color: theme.color.primary, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.md, cursor: 'pointer', fontWeight: theme.font.weight.semibold },
  resultadoFinal: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' },
  exitoBox: { textAlign: 'center', marginBottom: '32px' },
  exitoTitulo: { fontSize: '24px', fontWeight: theme.font.weight.black, color: theme.color.primary, margin: '16px 0 8px' },
  exitoSub: { fontSize: theme.font.size.md, color: theme.color.textMuted, margin: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', width: '100%', maxWidth: '600px', marginBottom: '16px' },
  statCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', textAlign: 'center', boxShadow: theme.shadow.sm },
  statValor: { fontSize: '20px', fontWeight: theme.font.weight.black, margin: '8px 0 4px', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 },
  btnNuevaCarga: { padding: '14px 32px', background: theme.color.gradient, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, cursor: 'pointer' },
  statsActuales: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', marginBottom: '20px', boxShadow: theme.shadow.sm },
  statsActualesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' },
  statsActualesTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0 },
  ultimaActualizacion: { fontSize: theme.font.size.sm, color: theme.color.textMuted, background: theme.color.background, padding: '4px 10px', borderRadius: theme.radius.pill },
  statsActualesCard: { background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '16px', textAlign: 'center' },
  statsActualesValor: { fontSize: '24px', fontWeight: theme.font.weight.black, margin: '6px 0 4px', lineHeight: 1 },
  statsActualesLabel: { fontSize: theme.font.size.md, color: theme.color.textMuted, margin: 0 },
  periodoTag: { background: theme.color.accentSoft, color: theme.color.primary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, padding: '4px 10px', borderRadius: theme.radius.pill },
  exitoCatalogoBox: { display: 'flex', alignItems: 'center', gap: '12px', background: theme.color.successBg, border: `1px solid ${theme.color.successBorder}`, borderRadius: theme.radius.md, padding: '14px 16px', marginBottom: '12px' },
  exitoCatalogoTitulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.success, margin: 0 },
  exitoCatalogoSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', boxSizing: 'border-box' },
  modal: { background: theme.color.surface, borderRadius: theme.radius.xxl, padding: 'clamp(16px, 4vw, 32px)', width: '100%', maxWidth: '480px', boxShadow: theme.shadow.modal, maxHeight: '90vh', overflow: 'auto' },
  modalTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: '0 0 24px 0' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 12px', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, borderBottom: `2px solid ${theme.color.border}`, textTransform: 'uppercase' },
  td: { padding: '10px 12px', fontSize: theme.font.size.base, color: theme.color.text, borderBottom: `1px solid ${theme.color.border}` },
  btnAccionSm: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' },
  paginacion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '8px' },
  btnPagina: { padding: '8px 14px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, color: theme.color.primary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, cursor: 'pointer' },
};

export default CargaInformacion;