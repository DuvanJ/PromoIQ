// ============================================================
// Componente: VisorLayoutTienda.js
// Descripción: Muestra el layout de una tienda como un mapa
// esquemático — agrupado por zona (según el prefijo del código de
// pasillo) con colores distintos, más las paredes aparte. No es el
// plano exacto de la tienda (no guardamos posiciones), es una
// referencia visual organizada. Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

// Nombres amigables para los prefijos más comunes — si aparece un
// prefijo nuevo que no está acá, se muestra como "Zona XX" igual.
const NOMBRES_ZONA = {
  HO: 'Hogar',
  JA: 'Jardín',
  CE: 'Cerrajería',
  FO: 'Fontanería',
  LU: 'Iluminación',
  EL: 'Eléctrico',
  HE: 'Herramientas',
  HM: 'Herramienta Manual',
  FE: 'Ferretería',
  AU: 'Automotriz',
  PI: 'Pinturas',
};

function nombreZona(prefijo) {
  return NOMBRES_ZONA[prefijo] || `Zona ${prefijo}`;
}

function prefijoDe(codigoBase) {
  const match = codigoBase?.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '?';
}

const PALETA_ZONAS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
];

function VisorLayoutTienda({ tema, usuario }) {
  const [tiendas, setTiendas] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoTiendas, setCargandoTiendas] = useState(true);
  const [error, setError] = useState('');

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
  const totalUbicaciones = datos ? datos.pasillos.length + datos.paredes.length : 0;

  // Agrupar pasillos por zona (prefijo del código base)
  const zonasMap = {};
  if (datos) {
    datos.pasillos.forEach(p => {
      const prefijo = prefijoDe(p.codigo_base);
      if (!zonasMap[prefijo]) zonasMap[prefijo] = [];
      zonasMap[prefijo].push(p);
    });
  }
  const zonas = Object.keys(zonasMap).sort().map((prefijo, i) => ({
    prefijo,
    nombre: nombreZona(prefijo),
    color: PALETA_ZONAS[i % PALETA_ZONAS.length],
    pasillos: [...zonasMap[prefijo]].sort((a, b) => a.codigo_base.localeCompare(b.codigo_base, undefined, { numeric: true })),
  }));

  return (
    <div>
      <p style={styles.descripcion}>
        Sirve de referencia para ver cómo está distribuida la tienda y cuáles son sus zonas principales.
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
      ) : datos && totalUbicaciones === 0 ? (
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

          {/* ── Mapa esquemático ─────────────────────────── */}
          <div style={styles.planoWrapper}>
            <div style={styles.planoHeader}>
              <p style={styles.planoTitulo}>🏬 Vista esquemática de la tienda</p>
              <p style={styles.planoNota}>Referencia por zonas — no es el plano exacto de la tienda</p>
            </div>

            <div style={styles.planoPiso}>
              {zonas.length === 0 ? (
                <p style={styles.sinDatos}>Sin pasillos agrupables en zonas.</p>
              ) : (
                zonas.map((zona, i) => (
                  <div key={i} style={styles.zonaFila}>
                    <div style={{ ...styles.zonaEtiqueta, background: zona.color }}>
                      {zona.nombre}
                    </div>
                    <div style={styles.zonaPasillos}>
                      {zona.pasillos.map((p, j) => (
                        <div
                          key={j}
                          className="pd-hoverable"
                          style={{
                            ...styles.pasilloBloque,
                            borderColor: zona.color,
                            background: p.descripcion ? zona.color + '15' : theme.color.surfaceMuted,
                          }}
                          title={p.descripcion || 'Sin descripción cargada'}
                        >
                          <p style={{ ...styles.pasilloCodigo, color: zona.color }}>Pasillo {p.codigo_base}</p>
                          <p style={styles.pasilloDescripcion}>
                            {p.descripcion || <em style={{ color: theme.color.textMuted }}>Sin descripción</em>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {datos.paredes.length > 0 && (
              <div style={styles.paredesFranja}>
                <p style={styles.paredesTitulo}>🧱 Paredes / Cabeceras del perímetro ({datos.paredes.length})</p>
                <div style={styles.paredesGridWrapper}>
                  <div style={styles.paredesGrid}>
                    {[...datos.paredes]
                      .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
                      .map((p, i) => (
                        <div key={i} className="pd-hoverable" style={styles.paredCard}>
                          <span style={styles.paredIcono} aria-hidden="true">▪</span>
                          <span style={styles.paredTexto}>{p.descripcion}</span>
                        </div>
                      ))}
                  </div>
                </div>
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
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base },

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '24px' },
  bandaTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },

  planoWrapper: {
    background: '#F5F1EA', borderRadius: theme.radius.xxl, padding: '24px',
    border: `2px dashed ${theme.color.border}`, boxShadow: theme.shadow.sm,
  },
  planoHeader: { textAlign: 'center', marginBottom: '20px' },
  planoTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.black, color: theme.color.text, margin: '0 0 4px 0' },
  planoNota: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, fontStyle: 'italic' },

  planoPiso: { display: 'flex', flexDirection: 'column', gap: '16px' },
  zonaFila: { display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' },
  zonaEtiqueta: {
    color: '#fff', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.black,
    padding: '8px 14px', borderRadius: theme.radius.md, whiteSpace: 'nowrap',
    minWidth: '130px', textAlign: 'center', flexShrink: 0,
  },
  zonaPasillos: { display: 'flex', gap: '10px', flexWrap: 'wrap', flex: 1 },
  pasilloBloque: {
    border: '2px solid', borderRadius: theme.radius.md, padding: '10px 14px',
    minWidth: '150px', maxWidth: '220px', cursor: 'default',
  },
  pasilloCodigo: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.black, margin: '0 0 4px 0' },
  pasilloDescripcion: {
    fontSize: theme.font.size.sm, color: theme.color.text, margin: 0, lineHeight: '1.4',
    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },

  paredesFranja: { marginTop: '24px', paddingTop: '20px', borderTop: `2px dashed ${theme.color.border}` },
  paredesTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, margin: '0 0 12px 0' },
  paredesGridWrapper: {
    maxHeight: '380px', overflowY: 'auto', borderRadius: theme.radius.lg,
    background: theme.color.surface, padding: '14px',
  },
  paredesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px',
  },
  paredCard: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    background: theme.color.surfaceMuted, borderRadius: theme.radius.md,
    padding: '10px 12px', fontSize: theme.font.size.sm, color: theme.color.text,
    lineHeight: '1.4', minHeight: '44px',
  },
  paredIcono: { color: theme.color.textMuted, flexShrink: 0, marginTop: '2px' },
  paredTexto: { flex: 1, wordBreak: 'break-word' },
};

export default VisorLayoutTienda;