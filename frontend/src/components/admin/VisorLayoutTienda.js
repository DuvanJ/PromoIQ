// ============================================================
// Componente: VisorLayoutTienda.js
// Descripción: Muestra el layout de una tienda como un plano
// visual — cada bloque del Excel original se dibuja como una zona
// coloreada en su posición y tamaño real. El texto completo de cada
// bloque NO se fuerza dentro de la celda (son demasiado chicas para
// texto legible) — se muestra en un panel de detalle al hacer clic,
// como en un mapa de centro comercial. Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

const NOMBRES_ZONA = {
  HO: 'Hogar', JA: 'Jardín', CE: 'Cerrajería', FO: 'Fontanería',
  LU: 'Iluminación', EL: 'Eléctrico', HE: 'Herramientas',
  HM: 'Herramienta Manual', FE: 'Ferretería', AU: 'Automotriz', PI: 'Pinturas',
};

function nombreZona(prefijo) {
  return NOMBRES_ZONA[prefijo] || `Zona ${prefijo}`;
}

function prefijoDe(codigo) {
  const match = codigo?.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '?';
}

const PALETA_ZONAS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
];

const ANCHO_COL_BASE = 26;
const ALTO_FILA_BASE = 20;

function colorPorProximidad(bloque, codigos, colorPorCodigoPrefijo) {
  let mejor = null;
  let mejorSolape = 0;
  for (const cod of codigos) {
    const inicio = Math.max(bloque.columna, cod.columna);
    const fin = Math.min(bloque.columna + bloque.columnas_span, cod.columna + cod.columnas_span);
    const solape = Math.max(0, fin - inicio);
    if (solape > mejorSolape) { mejorSolape = solape; mejor = cod; }
  }
  return mejor ? colorPorCodigoPrefijo[prefijoDe(mejor.codigo)] : null;
}

function VisorLayoutTienda({ tema, usuario }) {
  const [tiendas, setTiendas] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoTiendas, setCargandoTiendas] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [bloqueActivo, setBloqueActivo] = useState(null);

  useEffect(() => {
    cargarTiendas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarTiendas = async () => {
    setCargandoTiendas(true);
    try {
      const res = await api.get(`/tiendas?pais=${usuario.pais}`);
      setTiendas(res.data);
      if (res.data.length > 0) {
        setTiendaSeleccionada(res.data[0].codigo);
        buscar(res.data[0].codigo);
      }
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    } finally {
      setCargandoTiendas(false);
    }
  };

  const buscar = async (codigo) => {
    setCargando(true);
    setError('');
    setDatos(null);
    setBloqueActivo(null);
    try {
      const res = await api.get(`/pais/layout-tienda-visor?tienda_codigo=${codigo}`);
      setDatos(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error consultando el layout');
    } finally {
      setCargando(false);
    }
  };

  const cambiarTienda = (codigo) => {
    setTiendaSeleccionada(codigo);
    buscar(codigo);
  };

  const colorAcento = tema?.primary || theme.color.primary;
  const bloquesCodigo = datos ? datos.bloques.filter(b => b.tipo === 'codigo') : [];
  const bloquesTexto = datos ? datos.bloques.filter(b => b.tipo !== 'codigo') : [];

  const prefijosUnicos = [...new Set(bloquesCodigo.map(b => prefijoDe(b.codigo)))].sort();
  const colorPorPrefijo = {};
  prefijosUnicos.forEach((prefijo, i) => {
    colorPorPrefijo[prefijo] = PALETA_ZONAS[i % PALETA_ZONAS.length];
  });

  const anchoCol = ANCHO_COL_BASE * zoom;
  const altoFila = ALTO_FILA_BASE * zoom;

  return (
    <div>
      <InstruccionesModulo
        id="visor-layout-tienda"
        texto="Plano visual de la tienda armado a partir del Excel de layout — hacé clic en cualquier zona coloreada para ver qué hay ahí. Es solo referencia, no reemplaza el plano físico real de distribución."
      />
      <p style={styles.descripcion}>
        Sirve de referencia para ver cómo está distribuida la tienda. Hacé clic en cualquier zona para ver el detalle completo.
      </p>

      <div style={styles.selectorCard}>
        {cargandoTiendas ? (
          <p style={styles.cargandoTexto}>Cargando tiendas...</p>
        ) : tiendas.length === 0 ? (
          <p style={styles.cargandoTexto}>No hay tiendas registradas para tu país.</p>
        ) : (
          <div>
            <label htmlFor="tienda-layout" style={styles.label}>Tienda</label>
            <select
              id="tienda-layout"
              className="pd-hoverable"
              style={styles.select}
              value={tiendaSeleccionada}
              onChange={(e) => cambiarTienda(e.target.value)}
            >
              {tiendas.map(t => (
                <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">🗺️</span>
          <p>Cargando layout...</p>
        </div>
      ) : datos && datos.requiere_recarga ? (
        <div style={styles.avisoSinCoordenadas}>
          <span style={{ fontSize: '28px' }} aria-hidden="true">ℹ️</span>
          <p style={{ margin: 0 }}>
            Este layout se cargó con una versión anterior del sistema. Volvé a subir el mismo
            archivo Excel desde Carga de Información para ver el plano visual.
          </p>
        </div>
      ) : datos && datos.bloques.length === 0 ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📭</span>
          <p>Esta tienda todavía no tiene un layout cargado.</p>
        </div>
      ) : datos && (
        <>
          <div style={{ ...styles.bandaResumen, background: colorAcento + '10', borderLeft: `4px solid ${colorAcento}` }}>
            <span style={{ fontSize: '28px' }} aria-hidden="true">🗺️</span>
            <p style={styles.bandaTitulo}>{datos.tienda}</p>
          </div>

          <div style={styles.planoWrapper}>
            <div style={styles.planoHeaderRow}>
              <div>
                <p style={styles.planoTitulo}>🏬 Plano de la tienda</p>
                <p style={styles.planoNota}>Hacé clic en una zona para ver qué hay ahí.</p>
              </div>
              <div style={styles.zoomControles}>
                <button className="pd-pressable" style={styles.btnZoom} onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} aria-label="Alejar">−</button>
                <span style={styles.zoomTexto}>{Math.round(zoom * 100)}%</span>
                <button className="pd-pressable" style={styles.btnZoom} onClick={() => setZoom(z => Math.min(2.5, z + 0.25))} aria-label="Acercar">+</button>
              </div>
            </div>

            <div style={styles.planoScroll}>
              <div
                style={{
                  ...styles.planoGrid,
                  gridTemplateRows: `repeat(${Math.max(datos.total_filas, 1)}, ${altoFila}px)`,
                  gridTemplateColumns: `repeat(${Math.max(datos.total_columnas, 1)}, ${anchoCol}px)`,
                }}
              >
                {bloquesTexto.map((b, i) => {
                  const color = colorPorProximidad(b, bloquesCodigo, colorPorPrefijo) || theme.color.textMuted;
                  const esActivo = bloqueActivo === b;
                  return (
                    <button
                      key={`texto-${i}`}
                      type="button"
                      className="pd-pressable"
                      onClick={() => setBloqueActivo(esActivo ? null : b)}
                      style={{
                        ...styles.celdaTexto,
                        gridRow: `${b.fila + 1} / span ${b.filas_span}`,
                        gridColumn: `${b.columna + 1} / span ${b.columnas_span}`,
                        background: esActivo ? color : color + '35',
                        outline: esActivo ? `2px solid ${color}` : 'none',
                        outlineOffset: '-2px',
                      }}
                      aria-label={b.descripcion}
                    />
                  );
                })}

                {bloquesCodigo.map((b, i) => {
                  const color = colorPorPrefijo[prefijoDe(b.codigo)] || colorAcento;
                  return (
                    <div
                      key={`codigo-${i}`}
                      style={{
                        ...styles.celdaCodigo,
                        gridRow: `${b.fila + 1} / span ${b.filas_span}`,
                        gridColumn: `${b.columna + 1} / span ${b.columnas_span}`,
                        background: color,
                        fontSize: `${8 * Math.min(zoom, 1.3)}px`,
                      }}
                    >
                      {b.codigo}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Panel de detalle del bloque seleccionado ── */}
            {bloqueActivo && (
              <div style={styles.panelDetalle}>
                <span style={{ fontSize: '20px' }} aria-hidden="true">📍</span>
                <div style={{ flex: 1 }}>
                  <p style={styles.panelTitulo}>{bloqueActivo.descripcion}</p>
                </div>
                <button
                  className="pd-pressable"
                  style={styles.panelCerrar}
                  onClick={() => setBloqueActivo(null)}
                  aria-label="Cerrar detalle"
                >✕</button>
              </div>
            )}

            {prefijosUnicos.length > 0 && (
              <div style={styles.leyenda}>
                {prefijosUnicos.map(prefijo => (
                  <div key={prefijo} style={styles.leyendaItem}>
                    <span style={{ ...styles.leyendaSwatch, background: colorPorPrefijo[prefijo] }} aria-hidden="true" />
                    <span>{nombreZona(prefijo)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px', lineHeight: '1.6' },
  selectorCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '18px 20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  cargandoTexto: { color: theme.color.textMuted, fontSize: theme.font.size.base, textAlign: 'center', margin: 0 },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '16px' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  avisoSinCoordenadas: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    background: theme.color.accentSoft, border: `1px solid ${theme.color.accentSoftBorder}`,
    borderRadius: theme.radius.lg, padding: '16px 20px', color: theme.color.text,
    fontSize: theme.font.size.base, lineHeight: '1.5',
  },

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '24px' },
  bandaTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },

  planoWrapper: {
    background: '#F5F1EA', borderRadius: theme.radius.xxl, padding: '24px',
    border: `2px dashed ${theme.color.border}`, boxShadow: theme.shadow.sm,
  },
  planoHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  planoTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.black, color: theme.color.text, margin: '0 0 4px 0' },
  planoNota: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, fontStyle: 'italic' },

  zoomControles: { display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', borderRadius: theme.radius.pill, padding: '4px 8px', boxShadow: theme.shadow.sm },
  btnZoom: { width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${theme.color.border}`, background: theme.color.surfaceMuted, fontSize: '16px', fontWeight: theme.font.weight.bold, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.color.text },
  zoomTexto: { fontSize: theme.font.size.sm, color: theme.color.textMuted, minWidth: '38px', textAlign: 'center' },

  planoScroll: { overflow: 'auto', paddingBottom: '8px', background: '#fff', borderRadius: theme.radius.lg, border: `1px solid ${theme.color.border}`, maxHeight: '65vh' },
  planoGrid: { display: 'grid', gap: '0px', width: 'max-content', padding: '8px' },

  celdaTexto: {
    border: '1px solid rgba(0,0,0,0.08)', padding: 0, margin: 0, cursor: 'pointer',
  },
  celdaCodigo: {
    color: '#fff', fontWeight: theme.font.weight.black,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', zIndex: 2, textAlign: 'center', pointerEvents: 'none',
  },

  panelDetalle: {
    display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px',
    background: '#fff', borderRadius: theme.radius.lg, padding: '14px 16px',
    boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`,
  },
  panelTitulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.text, margin: 0, lineHeight: '1.5' },
  panelCerrar: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: theme.color.textMuted, flexShrink: 0 },

  leyenda: { display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '18px', paddingTop: '16px', borderTop: `1px dashed ${theme.color.border}` },
  leyendaItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: theme.font.size.sm, color: theme.color.text },
  leyendaSwatch: { width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block', flexShrink: 0 },
};

export default VisorLayoutTienda;