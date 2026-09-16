// ============================================================
// Componente: ImpactoCampanaCobertura.js
// Descripción: Cobertura resultante, POST-campaña, de cada SKU+tienda
// que participó en una dinámica ya finalizada. Ayuda a detectar
// sobre-stock o déficit que dejó la campaña al terminar. Filtros
// opcionales de departamento, tienda y estado(s) del catálogo actual.
// Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

const COLOR_BANDA = {
  critico: '#DC2626',
  bajo: '#D97706',
  normal: '#16A34A',
  alto: '#2563EB',
  excesivo: '#6B7280',
  sin_datos: '#9CA3AF',
};

function SelectorEstadosMultiple({ id, label, opciones, seleccionados, onChange, colorAcento }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  const toggleEstado = (estado) => {
    if (seleccionados.includes(estado)) {
      onChange(seleccionados.filter(e => e !== estado));
    } else {
      onChange([...seleccionados, estado]);
    }
  };

  const etiqueta = seleccionados.length > 0 ? seleccionados.join(', ') : 'Todos los estados';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label htmlFor={id} style={styles.label}>{label}</label>
      <button
        id={id}
        type="button"
        className="pd-hoverable"
        style={{ ...styles.selectorEstadoBtn, color: seleccionados.length > 0 ? theme.color.text : theme.color.textMuted }}
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
      >
        <span style={styles.selectorEstadoTexto}>{etiqueta}</span>
        <span aria-hidden="true">{abierto ? '▲' : '▾'}</span>
      </button>
      {abierto && (
        <div className="pd-dropdown" style={styles.dropdownEstados}>
          {opciones.length === 0 ? (
            <p style={{ ...styles.cargandoTexto, padding: '10px 14px' }}>No hay estados disponibles</p>
          ) : (
            opciones.map(estado => (
              <label key={estado} style={styles.opcionCheckbox} className="pd-hoverable">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(estado)}
                  onChange={() => toggleEstado(estado)}
                  style={{ accentColor: colorAcento }}
                />
                {estado}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ImpactoCampanaCobertura({ tema, usuario }) {
  const [dinamicas, setDinamicas] = useState([]);
  const [cargandoDinamicas, setCargandoDinamicas] = useState(true);
  const [dinamicaId, setDinamicaId] = useState('');
  const [bandaFiltro, setBandaFiltro] = useState('');

  const [departamentos, setDepartamentos] = useState([]);
  const [deptoFiltro, setDeptoFiltro] = useState('');
  const [tiendas, setTiendas] = useState([]);
  const [tiendaFiltro, setTiendaFiltro] = useState('');
  const [estadosDisponibles, setEstadosDisponibles] = useState([]);
  const [estadosFiltro, setEstadosFiltro] = useState([]);

  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargarDinamicas();
    cargarFiltros();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDinamicas = async () => {
    setCargandoDinamicas(true);
    try {
      const res = await api.get('/pais/dinamicas-finalizadas');
      setDinamicas(res.data);
    } catch (err) {
      console.error('Error cargando dinámicas finalizadas:', err);
    } finally {
      setCargandoDinamicas(false);
    }
  };

  const cargarFiltros = async () => {
    try {
      const [resDeptos, resTiendas] = await Promise.all([
        api.get('/pais/departamentos-catalogo'),
        api.get(`/tiendas?pais=${usuario.pais}`),
      ]);
      setDepartamentos(resDeptos.data);
      setTiendas(resTiendas.data);
      if (resTiendas.data.length > 0) {
        const resEstados = await api.get(`/pais/estados-catalogo-tienda?tienda_codigo=${resTiendas.data[0].codigo}`);
        setEstadosDisponibles(resEstados.data);
      }
    } catch (err) {
      console.error('Error cargando filtros:', err);
    }
  };

  const construirParams = () => {
    const params = new URLSearchParams({ dinamica_id: dinamicaId });
    if (bandaFiltro) params.append('banda', bandaFiltro);
    if (deptoFiltro) params.append('departamento', deptoFiltro);
    if (tiendaFiltro) params.append('tienda_codigo', tiendaFiltro);
    if (estadosFiltro.length > 0) params.append('estados', estadosFiltro.join(','));
    return params;
  };

  const consultar = async () => {
    if (!dinamicaId) { setError('Elegí una campaña finalizada'); return; }
    setConsultando(true);
    setError('');
    setResultado(null);
    try {
      const res = await api.get(`/pais/impacto-campana-cobertura?${construirParams()}`);
      setResultado(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error consultando el impacto de la campaña');
    } finally {
      setConsultando(false);
    }
  };

  const exportarExcel = async () => {
    if (!dinamicaId) return;
    setExportando(true);
    try {
      const res = await api.get(`/exportar/impacto-campana-cobertura?${construirParams()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Impacto_Campana_${resultado.dinamica.nombre}.xlsx`.replace(/\s+/g, '_'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando impacto de campaña:', err);
    } finally {
      setExportando(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;
  const nombreTienda = (codigo) => tiendas.find(t => t.codigo === codigo)?.nombre || codigo;

  return (
    <div>
      <p style={styles.descripcion}>
        Elegí una campaña ya finalizada para ver cómo quedó la cobertura de inventario de cada
        SKU en cada tienda donde participó — útil para detectar sobre-stock o déficit que dejó la promoción.
        Los filtros de departamento, tienda y estado se aplican sobre el catálogo actual.
      </p>

      <div style={styles.selectoresCard}>
        {cargandoDinamicas ? (
          <p style={styles.cargandoTexto}>Cargando campañas finalizadas...</p>
        ) : dinamicas.length === 0 ? (
          <p style={styles.cargandoTexto}>Todavía no hay campañas finalizadas para consultar.</p>
        ) : (
          <>
            <div className="pd-grid-2">
              <div>
                <label htmlFor="campana-impacto" style={styles.label}>Campaña finalizada</label>
                <select
                  id="campana-impacto"
                  className="pd-hoverable"
                  style={styles.select}
                  value={dinamicaId}
                  onChange={(e) => { setDinamicaId(e.target.value); setResultado(null); }}
                >
                  <option value="">Seleccioná una campaña...</option>
                  {dinamicas.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} ({new Date(d.fecha_fin).toLocaleDateString('es-CR')})</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="banda-impacto" style={styles.label}>Filtrar por banda (opcional)</label>
                <select
                  id="banda-impacto"
                  className="pd-hoverable"
                  style={styles.select}
                  value={bandaFiltro}
                  onChange={(e) => { setBandaFiltro(e.target.value); setResultado(null); }}
                >
                  <option value="">Todas las bandas</option>
                  <option value="critico">🔴 Crítico</option>
                  <option value="bajo">🟠 Bajo</option>
                  <option value="normal">🟢 Normal</option>
                  <option value="alto">🔵 Alto</option>
                  <option value="excesivo">⚫ Excesivo</option>
                </select>
              </div>
            </div>

            <div className="pd-grid-2" style={{ marginTop: '16px' }}>
              <div>
                <label htmlFor="depto-impacto" style={styles.label}>Departamento (opcional)</label>
                <select
                  id="depto-impacto"
                  className="pd-hoverable"
                  style={styles.select}
                  value={deptoFiltro}
                  onChange={(e) => { setDeptoFiltro(e.target.value); setResultado(null); }}
                >
                  <option value="">Todos los departamentos</option>
                  {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="tienda-impacto" style={styles.label}>Tienda (opcional)</label>
                <select
                  id="tienda-impacto"
                  className="pd-hoverable"
                  style={styles.select}
                  value={tiendaFiltro}
                  onChange={(e) => { setTiendaFiltro(e.target.value); setResultado(null); }}
                >
                  <option value="">Todas las tiendas</option>
                  {tiendas.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <SelectorEstadosMultiple
                id="estados-impacto"
                label="Estados del artículo (opcional)"
                opciones={estadosDisponibles}
                seleccionados={estadosFiltro}
                onChange={setEstadosFiltro}
                colorAcento={colorAcento}
              />
            </div>
          </>
        )}

        {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

        <button
          className="pd-pressable"
          style={{ ...styles.btnConsultar, background: tema?.gradient || theme.color.gradient, opacity: consultando || dinamicas.length === 0 ? 0.7 : 1 }}
          onClick={consultar}
          disabled={consultando || dinamicas.length === 0}
        >
          {consultando ? '⏳ Consultando...' : '📦 Ver impacto en cobertura'}
        </button>
      </div>

      {resultado && (
        <>
          <div style={styles.encabezadoResultado}>
            <div>
              <p style={styles.encabezadoNombre}>{resultado.dinamica.nombre}</p>
              <p style={styles.encabezadoFechas}>
                {new Date(resultado.dinamica.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(resultado.dinamica.fecha_fin).toLocaleDateString('es-CR')}
              </p>
            </div>
            <button
              className="pd-pressable"
              style={{ ...styles.btnExportar, color: colorAcento, borderColor: colorAcento, opacity: exportando ? 0.7 : 1 }}
              onClick={exportarExcel}
              disabled={exportando}
            >
              {exportando ? '⏳ Generando...' : '📥 Descargar Excel'}
            </button>
          </div>

          {Object.keys(resultado.resumen_bandas).length > 0 && (
            <div style={styles.bandasResumen}>
              {Object.entries(resultado.resumen_bandas).map(([banda, cantidad]) => (
                <div key={banda} style={{ ...styles.bandaCard, borderTop: `4px solid ${COLOR_BANDA[banda]}` }}>
                  <p style={{ ...styles.bandaValor, color: COLOR_BANDA[banda] }}>{cantidad}</p>
                  <p style={styles.bandaLabel}>{banda.charAt(0).toUpperCase() + banda.slice(1).replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          )}

          {resultado.productos.length === 0 ? (
            <div style={styles.cargando}>
              <span style={{ fontSize: '40px' }} aria-hidden="true">🤷</span>
              <p>No hay productos que coincidan con los filtros seleccionados para esta campaña.</p>
            </div>
          ) : (
            <div className="pd-table-scroll">
              <table style={styles.tabla}>
                <caption style={styles.srOnly}>Cobertura post-campaña por SKU y tienda</caption>
                <thead>
                  <tr>
                    {['SKU', 'Descripción', 'Tienda', 'Ubicación Campaña', 'Precio Dinámica', 'Estado', 'Existencia', 'Consumo/mes', 'Cobertura', 'Banda'].map(h => (
                      <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.productos.map((p, i) => (
                    <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                      <td style={styles.td}><strong>{p.sku}</strong></td>
                      <td style={styles.td}>{p.descripcion}</td>
                      <td style={styles.td}>{nombreTienda(p.tienda)}</td>
                      <td style={styles.td}>{p.ubicacion_campana}</td>
                      <td style={styles.td}>${p.precio_dinamica.toFixed(2)}</td>
                      <td style={styles.td}>{p.estado}</td>
                      <td style={styles.td}>{p.existencia_actual.toLocaleString()}</td>
                      <td style={styles.td}>{p.consumo_mensual}</td>
                      <td style={styles.td}>{p.cobertura_meses != null ? `${p.cobertura_meses} m` : '—'}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.bandaBadge, background: COLOR_BANDA[p.banda] + '20', color: COLOR_BANDA[p.banda] }}>{p.banda_label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px', lineHeight: '1.6' },
  selectoresCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  cargandoTexto: { color: theme.color.textMuted, fontSize: theme.font.size.base, textAlign: 'center', padding: '12px' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginTop: '14px' },
  btnConsultar: { width: '100%', padding: '14px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '16px', fontFamily: theme.font.family },

  selectorEstadoBtn: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
    width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm,
    border: `1.5px solid ${theme.color.border}`, background: theme.color.surfaceMuted,
    fontSize: theme.font.size.md, cursor: 'pointer', boxSizing: 'border-box', textAlign: 'left',
    fontFamily: theme.font.family,
  },
  selectorEstadoTexto: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dropdownEstados: {
    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 20,
    background: theme.color.surface, border: `1.5px solid ${theme.color.border}`,
    borderRadius: theme.radius.md, boxShadow: theme.shadow.floating,
    maxHeight: '220px', overflowY: 'auto', padding: '6px',
  },
  opcionCheckbox: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
    borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: theme.font.size.md, color: theme.color.text,
  },

  encabezadoResultado: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginTop: '22px', marginBottom: '14px' },
  encabezadoNombre: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  encabezadoFechas: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  btnExportar: { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: theme.color.surface, border: '1.5px solid', borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },

  bandasResumen: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '18px' },
  bandaCard: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '14px', textAlign: 'center', boxShadow: theme.shadow.sm },
  bandaValor: { fontSize: '26px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  bandaLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '4px 0 0 0', textTransform: 'capitalize' },
  bandaBadge: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap' },

  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '900px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
};

export default ImpactoCampanaCobertura;