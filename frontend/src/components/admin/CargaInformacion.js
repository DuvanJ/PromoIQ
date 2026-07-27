import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';

function CargaInformacion() {
  const [tabActiva, setTabActiva] = useState('dinamicas');
  const [dinamicas, setDinamicas] = useState([]);
  const [dinamicaId, setDinamicaId] = useState('');
  const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
  const esSuperAdmin = usuarioActual.rol === 'superadmin';
  const [pais, setPais] = useState(usuarioActual.pais || 'CR');
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

  useEffect(() => {
    cargarDinamicas();
    cargarStatsCatalogo();
    cargarStatsVentas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDinamicas = async () => {
    try {
      const res = await api.get('/admin/dinamicas');
      setDinamicas(res.data);
      if (res.data.length > 0) setDinamicaId(res.data[0].id);
    } catch (err) {
      console.error('Error cargando dinámicas:', err);
    }
  };

  const cargarStatsCatalogo = async () => {
    try {
      const res = await api.get('/dinamicas/catalogo/stats');
      setStatsCatalogo(res.data);
    } catch (err) {
      console.error('Error cargando stats catálogo:', err);
    }
  };

  const cargarStatsVentas = async () => {
    try {
      const res = await api.get('/dinamicas/ventas/stats');
      setStatsVentas(res.data);
    } catch (err) {
      console.error('Error cargando stats ventas:', err);
    }
  };

  const crearDinamica = async () => {
    try {
      await api.post(
        `/admin/dinamicas/crear?nombre=${encodeURIComponent(nuevaDinamica.nombre)}&fecha_inicio=${nuevaDinamica.fecha_inicio}&fecha_fin=${nuevaDinamica.fecha_fin}&descripcion=${encodeURIComponent(nuevaDinamica.descripcion)}`,
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
    setAnalizando(true);
    setError('');
    setAnalisis(null);
    const formData = new FormData();
    formData.append('file', archivo);
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
    setCargando(true);
    setError('');
    setResultado(null);
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('dinamica_id', dinamicaId);
    formData.append('pais', pais);
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
      setError('Error cargando el archivo. Verificá el formato.');
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
      setErrorCatalogo('Error cargando el catálogo. Verificá el formato.');
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
      setErrorVentas('Error cargando el archivo. Verificá el formato.');
    } finally {
      setCargandoVentas(false);
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

  const paisLabel = {
    CR: '🇨🇷 Costa Rica',
    GT: '🇬🇹 Guatemala',
    SV: '🇸🇻 El Salvador'
  };

  const MESES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  return (
    <div>
      <p style={styles.descripcion}>
        Cargá la información del sistema. Actualizá dinámicas, catálogo de artículos y ventas del mes.
      </p>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tabActiva === 'dinamicas' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('dinamicas')}
        >
          📦 Dinámicas Comerciales
        </button>
        <button
          style={{ ...styles.tab, ...(tabActiva === 'catalogo' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('catalogo')}
        >
          📋 Catálogo de Artículos
        </button>
        <button
          style={{ ...styles.tab, ...(tabActiva === 'ventas' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('ventas')}
        >
          📊 Ventas del Mes
        </button>
      </div>

      {/* ── TAB DINÁMICAS ─────────────────────────────── */}
      {tabActiva === 'dinamicas' && (
        <div>
          <div style={styles.pasos}>
            {[
              { num: 1, label: 'Configurar' },
              { num: 2, label: 'Analizar con IA' },
              { num: 3, label: 'Resultado' },
            ].map(p => (
              <div key={p.num} style={styles.pasoWrapper}>
                <div style={{
                  ...styles.pasoCirculo,
                  background: paso >= p.num ? '#1E2761' : '#E2E8F0',
                  color: paso >= p.num ? '#ffffff' : '#8892A4',
                }}>
                  {paso > p.num ? '✓' : p.num}
                </div>
                <span style={{
                  ...styles.pasoLabel,
                  color: paso >= p.num ? '#1E2761' : '#8892A4',
                  fontWeight: paso === p.num ? '700' : '400'
                }}>
                  {p.label}
                </span>
                {p.num < 3 && <div style={{
                  ...styles.pasoLinea,
                  background: paso > p.num ? '#1E2761' : '#E2E8F0'
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
                  {['SKU', 'Descripcion', 'Promo'].map(col => (
                    <span key={col} style={styles.columnaTag}>{col}</span>
                  ))}
                </div>
                <p style={{ fontSize: '12px', color: '#8892A4', marginTop: '10px', marginBottom: 0 }}>
                  💡 En <strong>Promo</strong> podés poner: Isla, Isla1, Cabecera, Botadero, Punta de Góndola o el nombre de campaña del mes
                </p>
              </div>

              <div style={styles.grid}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>⚙️ Configuración</h3>

                  <div style={styles.campo}>
                    <label style={styles.label}>País</label>
                    {esSuperAdmin ? (
                      <select style={styles.select} value={pais} onChange={(e) => setPais(e.target.value)}>
                        <option value="CR">🇨🇷 Costa Rica</option>
                        <option value="GT">🇬🇹 Guatemala</option>
                        <option value="SV">🇸🇻 El Salvador</option>
                      </select>
                    ) : (
                      <div style={styles.paisFijo}>
                        {paisLabel[pais]}
                        <span style={styles.paisFijoTag}>Asignado a tu cuenta</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.campo}>
                    <label style={styles.label}>Dinámica comercial</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        style={{ ...styles.select, flex: 1 }}
                        value={dinamicaId}
                        onChange={(e) => setDinamicaId(e.target.value)}
                      >
                        {dinamicas.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.nombre} ({d.total_articulos} arts.)
                          </option>
                        ))}
                      </select>
                      <button style={styles.btnNueva} onClick={() => setMostrarNuevaDinamica(true)}>
                        + Nueva
                      </button>
                    </div>
                  </div>

                  <div style={styles.campo}>
                    <label style={styles.label}>Archivo Excel</label>
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
                      />
                      <div style={styles.dropTexto}>
                        {archivo ? (
                          <>
                            <span style={{ fontSize: '32px' }}>📊</span>
                            <p style={styles.dropNombre}>{archivo.name}</p>
                            <p style={styles.dropSize}>{(archivo.size / 1024).toFixed(1)} KB</p>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '32px' }}>📤</span>
                            <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                            <p style={styles.dropSize}>.xlsx o .xls</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {error && <div style={styles.errorBox}>⚠️ {error}</div>}

                  <button
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
                      { icon: '🔍', titulo: 'Detección de problemas', desc: 'Identifica SKUs sin datos, duplicados reales y valores inconsistentes en Promo.' },
                      { icon: '🔄', titulo: 'Verificación en BD', desc: 'Cruza los SKUs con dinámicas activas para detectar conflictos.' },
                      { icon: '🤖', titulo: 'Análisis con IA', desc: 'La IA genera un reporte con recomendaciones específicas.' },
                      { icon: '✅', titulo: 'Decisión de carga', desc: 'Con base en el análisis, podés cargar o corregir primero.' },
                    ].map((item, i) => (
                      <div key={i} style={styles.instruccionItem}>
                        <span style={styles.instruccionIcon}>{item.icon}</span>
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
                background: analisis.listo_para_cargar ? '#F0FDF4' : '#FFF8F0',
                border: `2px solid ${analisis.listo_para_cargar ? '#06D6A0' : '#F9C74F'}`
              }}>
                <span style={{ fontSize: '48px' }}>
                  {analisis.listo_para_cargar ? '✅' : '⚠️'}
                </span>
                <div>
                  <p style={{
                    ...styles.veredictoTitulo,
                    color: analisis.listo_para_cargar ? '#06847A' : '#B45309'
                  }}>
                    {analisis.listo_para_cargar ? '¡Archivo listo para cargar!' : 'El archivo necesita revisión'}
                  </p>
                  <p style={styles.veredictoSub}>
                    {analisis.total_filas} filas · {analisis.columnas_detectadas.length} columnas
                  </p>
                </div>
              </div>

              <div style={styles.grid}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>📊 Resultados del análisis</h3>
                  <div style={styles.metricasAnalisis}>
                    {[
                      { label: 'Total filas', valor: analisis.total_filas, color: '#1E2761', icon: '📋' },
                      { label: 'Sin SKU', valor: analisis.problemas.sin_codigo, color: analisis.problemas.sin_codigo > 0 ? '#B91C1C' : '#06847A', icon: '🔢' },
                      { label: 'Duplicados reales', valor: analisis.problemas.duplicados_archivo, color: analisis.problemas.duplicados_archivo > 0 ? '#B45309' : '#06847A', icon: '📄' },
                      { label: 'En BD activa', valor: analisis.problemas.duplicados_bd, color: analisis.problemas.duplicados_bd > 0 ? '#B91C1C' : '#06847A', icon: '🗄️' },
                    ].map((m, i) => (
                      <div key={i} style={styles.metricaAnalisisCard}>
                        <span style={styles.metricaAnalisisIcon}>{m.icon}</span>
                        <p style={{ ...styles.metricaAnalisisValor, color: m.color }}>{m.valor}</p>
                        <p style={styles.metricaAnalisisLabel}>{m.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.iaHeader}>
                    <div style={styles.iaAvatar}>🤖</div>
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
                <button style={styles.btnVolver} onClick={reiniciar}>← Volver y corregir</button>
                <button
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
              {error && <div style={{ ...styles.errorBox, marginTop: '12px' }}>⚠️ {error}</div>}
            </div>
          )}

          {/* PASO 3 */}
          {paso === 3 && resultado && (
            <div style={styles.resultadoFinal}>
              <div style={styles.exitoBox}>
                <span style={{ fontSize: '64px' }}>🎉</span>
                <h2 style={styles.exitoTitulo}>¡Información cargada exitosamente!</h2>
                <p style={styles.exitoSub}>{resultado.archivo}</p>
              </div>
              <div style={styles.statsGrid}>
                {[
                  { label: 'Registros cargados', valor: resultado.registros_cargados, icon: '✅', color: '#06847A' },
                  { label: 'País', valor: resultado.pais, icon: '🌎', color: '#0077B6' },
                  { label: 'Dinámica ID', valor: resultado.dinamica_id, icon: '📦', color: '#1E2761' },
                ].map((s, i) => (
                  <div key={i} style={styles.statCard}>
                    <span style={{ fontSize: '32px' }}>{s.icon}</span>
                    <p style={{ ...styles.statValor, color: s.color }}>{s.valor}</p>
                    <p style={styles.statLabel}>{s.label}</p>
                  </div>
                ))}
              </div>
              <button style={styles.btnNuevaCarga} onClick={reiniciar}>+ Nueva carga</button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CATÁLOGO ──────────────────────────────── */}
      {tabActiva === 'catalogo' && (
        <div>
          {statsCatalogo && (
            <div style={styles.statsActuales}>
              <div style={styles.statsActualesHeader}>
                <h3 style={styles.statsActualesTitulo}>📊 Estado actual del catálogo</h3>
                {statsCatalogo.ultima_actualizacion && (
                  <span style={styles.ultimaActualizacion}>
                    🕐 Última actualización: {new Date(statsCatalogo.ultima_actualizacion).toLocaleString('es-CR')}
                  </span>
                )}
              </div>
              <div style={styles.statsActualesGrid}>
                {[
                  { label: 'Total artículos', valor: statsCatalogo.total_articulos.toLocaleString(), icon: '🏷️', color: '#1E2761' },
                  { label: 'Departamentos', valor: statsCatalogo.departamentos, icon: '📂', color: '#0077B6' },
                  { label: 'Sucursales', valor: statsCatalogo.sucursales, icon: '🏪', color: '#06847A' },
                  { label: 'Marcas', valor: statsCatalogo.marcas, icon: '🏷️', color: '#B45309' },
                ].map((s, i) => (
                  <div key={i} style={styles.statsActualesCard}>
                    <span style={{ fontSize: '24px' }}>{s.icon}</span>
                    <p style={{ ...styles.statsActualesValor, color: s.color }}>{s.valor}</p>
                    <p style={styles.statsActualesLabel}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📋 Cargar Catálogo de Artículos</h3>

              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                {esSuperAdmin ? (
                  <select style={styles.select} value={pais} onChange={(e) => setPais(e.target.value)}>
                    <option value="CR">🇨🇷 Costa Rica</option>
                    <option value="GT">🇬🇹 Guatemala</option>
                    <option value="SV">🇸🇻 El Salvador</option>
                  </select>
                ) : (
                  <div style={styles.paisFijo}>
                    {paisLabel[pais]}
                    <span style={styles.paisFijoTag}>Asignado a tu cuenta</span>
                  </div>
                )}
              </div>

              <div style={styles.campo}>
                <label style={styles.label}>Archivo Excel del catálogo</label>
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
                  />
                  <div style={styles.dropTexto}>
                    {archivoCatalogo ? (
                      <>
                        <span style={{ fontSize: '32px' }}>📊</span>
                        <p style={styles.dropNombre}>{archivoCatalogo.name}</p>
                        <p style={styles.dropSize}>{(archivoCatalogo.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '32px' }}>📋</span>
                        <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                        <p style={styles.dropSize}>.xlsx o .xls — se reemplaza el catálogo completo</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {errorCatalogo && <div style={styles.errorBox}>⚠️ {errorCatalogo}</div>}

              {resultadoCatalogo && (
                <div style={styles.exitoCatalogoBox}>
                  <span style={{ fontSize: '24px' }}>✅</span>
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
                style={{
                  ...styles.btnAnalizar,
                  opacity: cargandoCatalogo || !archivoCatalogo ? 0.7 : 1,
                  cursor: cargandoCatalogo || !archivoCatalogo ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #06847A 0%, #0077B6 100%)'
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
                  <div key={i} style={styles.instruccionItem}>
                    <span style={styles.instruccionIcon}>{item.icon}</span>
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

      {/* ── TAB VENTAS ────────────────────────────────── */}
      {tabActiva === 'ventas' && (
        <div>
          {statsVentas && statsVentas.total_registros > 0 && (
            <div style={styles.statsActuales}>
              <div style={styles.statsActualesHeader}>
                <h3 style={styles.statsActualesTitulo}>📊 Ventas del mes cargadas</h3>
                {statsVentas.ultima_carga && (
                  <span style={styles.ultimaActualizacion}>
                    🕐 Última carga: {new Date(statsVentas.ultima_carga).toLocaleString('es-CR')}
                  </span>
                )}
              </div>
              <div style={styles.statsActualesGrid}>
                {[
                  { label: 'Total registros', valor: statsVentas.total_registros.toLocaleString(), icon: '📋', color: '#1E2761' },
                  { label: 'Total unidades', valor: statsVentas.total_ventas.toLocaleString(), icon: '🛒', color: '#0077B6' },
                  { label: 'Meses cargados', valor: statsVentas.meses_cargados, icon: '📅', color: '#06847A' },
                ].map((s, i) => (
                  <div key={i} style={styles.statsActualesCard}>
                    <span style={{ fontSize: '24px' }}>{s.icon}</span>
                    <p style={{ ...styles.statsActualesValor, color: s.color }}>{s.valor}</p>
                    <p style={styles.statsActualesLabel}>{s.label}</p>
                  </div>
                ))}
              </div>
              {statsVentas.meses_disponibles?.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#8892A4', margin: '0 0 8px 0', fontWeight: '700', textTransform: 'uppercase' }}>
                    Períodos disponibles:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {statsVentas.meses_disponibles.map((m, i) => (
                      <span key={i} style={{
                        background: '#EEF2FF', color: '#1E2761',
                        fontSize: '12px', fontWeight: '600',
                        padding: '4px 10px', borderRadius: '20px'
                      }}>
                        {MESES[m.mes - 1]} {m.anio}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={styles.cardTitulo}>📊 Cargar Ventas del Mes</h3>

              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                {esSuperAdmin ? (
                  <select style={styles.select} value={pais} onChange={(e) => setPais(e.target.value)}>
                    <option value="CR">🇨🇷 Costa Rica</option>
                    <option value="GT">🇬🇹 Guatemala</option>
                    <option value="SV">🇸🇻 El Salvador</option>
                  </select>
                ) : (
                  <div style={styles.paisFijo}>
                    {paisLabel[pais]}
                    <span style={styles.paisFijoTag}>Asignado a tu cuenta</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={styles.campo}>
                  <label style={styles.label}>Mes</label>
                  <select
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
                  <label style={styles.label}>Año</label>
                  <select
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
                <label style={styles.label}>Archivo Excel de ventas</label>
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
                  />
                  <div style={styles.dropTexto}>
                    {archivoVentas ? (
                      <>
                        <span style={{ fontSize: '32px' }}>📊</span>
                        <p style={styles.dropNombre}>{archivoVentas.name}</p>
                        <p style={styles.dropSize}>{(archivoVentas.size / 1024).toFixed(1)} KB</p>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '32px' }}>📊</span>
                        <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                        <p style={styles.dropSize}>.xlsx o .xls</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {errorVentas && <div style={styles.errorBox}>⚠️ {errorVentas}</div>}

              {resultadoVentas && (
                <div style={styles.exitoCatalogoBox}>
                  <span style={{ fontSize: '24px' }}>✅</span>
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
                style={{
                  ...styles.btnAnalizar,
                  opacity: cargandoVentas || !archivoVentas ? 0.7 : 1,
                  cursor: cargandoVentas || !archivoVentas ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #1E2761 0%, #06847A 100%)'
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
                  <div key={i} style={styles.instruccionItem}>
                    <span style={styles.instruccionIcon}>{item.icon}</span>
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
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitulo}>➕ Nueva Dinámica</h3>
            <div style={styles.campo}>
              <label style={styles.label}>Nombre</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Ej: Dinámica Julio 2026"
                value={nuevaDinamica.nombre}
                onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, nombre: e.target.value })}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={styles.campo}>
                <label style={styles.label}>Fecha inicio</label>
                <input
                  style={styles.input}
                  type="date"
                  value={nuevaDinamica.fecha_inicio}
                  onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, fecha_inicio: e.target.value })}
                />
              </div>
              <div style={styles.campo}>
                <label style={styles.label}>Fecha fin</label>
                <input
                  style={styles.input}
                  type="date"
                  value={nuevaDinamica.fecha_fin}
                  onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, fecha_fin: e.target.value })}
                />
              </div>
            </div>
            <div style={styles.campo}>
              <label style={styles.label}>Descripción</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Descripción opcional"
                value={nuevaDinamica.descripcion}
                onChange={(e) => setNuevaDinamica({ ...nuevaDinamica, descripcion: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button style={styles.btnCargar} onClick={crearDinamica}>Crear dinámica</button>
              <button style={styles.btnVolver} onClick={() => setMostrarNuevaDinamica(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: '14px', color: '#8892A4', marginBottom: '20px' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '24px', background: '#F4F7FB', padding: '4px', borderRadius: '12px', width: 'fit-content' },
  tab: { padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'transparent', fontSize: '14px', fontWeight: '600', color: '#8892A4', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  tabActiva: { background: '#ffffff', color: '#1E2761', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  pasos: { display: 'flex', alignItems: 'center', marginBottom: '24px' },
  pasoWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
  pasoCirculo: { width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 },
  pasoLabel: { fontSize: '13px', whiteSpace: 'nowrap' },
  pasoLinea: { height: '2px', width: '60px', margin: '0 8px' },
  formatoCard: { background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' },
  formatoTitulo: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: '0 0 10px 0' },
  columnas: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  columnaTag: { background: '#1E2761', color: '#ffffff', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', fontFamily: 'monospace' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' },
  card: { background: '#ffffff', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  cardTitulo: { fontSize: '15px', fontWeight: '700', color: '#1E2761', margin: '0 0 20px 0' },
  campo: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#1E2761', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#333', background: '#F8FAFC', outline: 'none', boxSizing: 'border-box' },
  input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '14px', color: '#333', background: '#F8FAFC', outline: 'none', boxSizing: 'border-box', fontFamily: 'Calibri, sans-serif' },
  paisFijo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #E2E8F0', background: '#F4F7FB', fontSize: '14px', color: '#333', fontWeight: '600' },
  paisFijoTag: { fontSize: '11px', color: '#8892A4', background: '#E2E8F0', padding: '2px 8px', borderRadius: '20px', fontWeight: '400' },
  dropZone: { border: '2px dashed #CADCFC', borderRadius: '10px', padding: '24px', cursor: 'pointer', position: 'relative', background: '#F8FAFC' },
  inputFile: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' },
  dropTexto: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', pointerEvents: 'none' },
  dropNombre: { fontSize: '14px', fontWeight: '600', color: '#1E2761', margin: '4px 0 0 0' },
  dropSize: { fontSize: '12px', color: '#8892A4', margin: 0, textAlign: 'center' },
  btnNueva: { padding: '10px 14px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', color: '#1E2761', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnAnalizar: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', color: '#D32F2F', fontSize: '13px', marginBottom: '12px' },
  instrucciones: { display: 'flex', flexDirection: 'column', gap: '16px' },
  instruccionItem: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  instruccionIcon: { fontSize: '24px', flexShrink: 0 },
  instruccionTitulo: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: '0 0 2px 0' },
  instruccionDesc: { fontSize: '12px', color: '#8892A4', margin: 0, lineHeight: '1.5' },
  veredictoBox: { display: 'flex', alignItems: 'center', gap: '20px', padding: '20px 24px', borderRadius: '14px', marginBottom: '20px' },
  veredictoTitulo: { fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0' },
  veredictoSub: { fontSize: '13px', color: '#8892A4', margin: 0 },
  metricasAnalisis: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' },
  metricaAnalisisCard: { background: '#F8FAFC', borderRadius: '10px', padding: '14px', textAlign: 'center' },
  metricaAnalisisIcon: { fontSize: '20px' },
  metricaAnalisisValor: { fontSize: '24px', fontWeight: '900', margin: '4px 0 2px', lineHeight: 1 },
  metricaAnalisisLabel: { fontSize: '11px', color: '#8892A4', margin: 0 },
  iaHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' },
  iaAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 },
  iaTitulo: { fontSize: '14px', fontWeight: '700', color: '#1E2761', margin: 0 },
  iaSub: { fontSize: '12px', color: '#8892A4', margin: '2px 0 0 0' },
  iaRespuesta: { fontSize: '13px', color: '#333', lineHeight: '1.7', maxHeight: '300px', overflow: 'auto' },
  botonesAccion: { display: 'flex', gap: '12px', marginTop: '8px' },
  btnCargar: { flex: 1, padding: '14px', background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  btnVolver: { padding: '14px 20px', background: '#F4F7FB', color: '#1E2761', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  resultadoFinal: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' },
  exitoBox: { textAlign: 'center', marginBottom: '32px' },
  exitoTitulo: { fontSize: '24px', fontWeight: '800', color: '#1E2761', margin: '16px 0 8px' },
  exitoSub: { fontSize: '14px', color: '#8892A4', margin: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '500px', marginBottom: '32px' },
  statCard: { background: '#ffffff', borderRadius: '14px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  statValor: { fontSize: '28px', fontWeight: '900', margin: '8px 0 4px', lineHeight: 1 },
  statLabel: { fontSize: '12px', color: '#8892A4', margin: 0 },
  btnNuevaCarga: { padding: '14px 32px', background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' },
  statsActuales: { background: '#ffffff', borderRadius: '14px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  statsActualesHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  statsActualesTitulo: { fontSize: '15px', fontWeight: '700', color: '#1E2761', margin: 0 },
  ultimaActualizacion: { fontSize: '12px', color: '#8892A4', background: '#F4F7FB', padding: '4px 10px', borderRadius: '20px' },
  statsActualesGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  statsActualesCard: { background: '#F8FAFC', borderRadius: '10px', padding: '16px', textAlign: 'center' },
  statsActualesValor: { fontSize: '24px', fontWeight: '900', margin: '6px 0 4px', lineHeight: 1 },
  statsActualesLabel: { fontSize: '12px', color: '#8892A4', margin: 0 },
  exitoCatalogoBox: { display: 'flex', alignItems: 'center', gap: '12px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' },
  exitoCatalogoTitulo: { fontSize: '14px', fontWeight: '700', color: '#15803D', margin: 0 },
  exitoCatalogoSub: { fontSize: '12px', color: '#8892A4', margin: '2px 0 0 0' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: '16px', padding: '32px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitulo: { fontSize: '18px', fontWeight: '800', color: '#1E2761', margin: '0 0 24px 0' },
};

export default CargaInformacion;