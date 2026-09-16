// ============================================================
// Componente: CandidatosProximaCampana.js
// Descripción: Productos con buen margen y buena cobertura de
// inventario, candidatos para una futura campaña — excluye lo
// que ya está en dinámica activa. Filtros ajustables (margen,
// cobertura, departamento) + buscador puntual por SKU.
// Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function CandidatosProximaCampana({ tema }) {
  const [margenMinimo, setMargenMinimo] = useState(20);
  const [coberturaMinima, setCoberturaMinima] = useState(1);
  const [filtroDepto, setFiltroDepto] = useState('');
  const [departamentosDisponibles, setDepartamentosDisponibles] = useState([]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  // ── Buscador puntual por SKU ───────────────────────────
  const [skuBuscado, setSkuBuscado] = useState('');
  const [resultadoSku, setResultadoSku] = useState(null);
  const [buscandoSku, setBuscandoSku] = useState(false);
  const [errorSku, setErrorSku] = useState('');

  useEffect(() => {
    cargarDepartamentos();
    buscar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDepartamentos = async () => {
    try {
      const res = await api.get('/pais/departamentos-catalogo');
      setDepartamentosDisponibles(res.data);
    } catch (err) {
      console.error('Error cargando departamentos:', err);
    }
  };

  const buscar = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ margen_minimo: margenMinimo, cobertura_minima: coberturaMinima });
      if (filtroDepto) params.append('departamento', filtroDepto);
      const res = await api.get(`/pais/candidatos-proxima-campana?${params}`);
      setDatos(res.data);
    } catch (err) {
      console.error('Error cargando candidatos:', err);
    } finally {
      setCargando(false);
    }
  };

  const buscarPorSku = async () => {
    if (!skuBuscado.trim()) return;
    setBuscandoSku(true);
    setErrorSku('');
    setResultadoSku(null);
    try {
      const res = await api.get(`/pais/consultar-margen-cobertura/${skuBuscado.trim()}`);
      setResultadoSku(res.data);
    } catch (err) {
      setErrorSku(err.response?.data?.detail || 'Error consultando el SKU');
    } finally {
      setBuscandoSku(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;
  const candidatosFiltrados = datos ? datos.candidatos : [];

  return (
    <div>
      <p style={styles.descripcion}>
        Productos con buen margen y buena cobertura de inventario que hoy NO están en ninguna
        dinámica activa — candidatos concretos para tu próxima campaña. Ajustá los filtros según
        qué tan exigente querés ser, o consultá un código puntual.
      </p>

      {/* ── Buscador puntual por SKU ─────────────────────── */}
      <div style={styles.buscadorCard}>
        <label htmlFor="buscador-sku" style={styles.label}>🔍 Consultar un código puntual</label>
        <div style={styles.buscadorRow}>
          <input
            id="buscador-sku"
            className="pd-hoverable"
            style={styles.input}
            type="text"
            placeholder="Ej: 12345"
            value={skuBuscado}
            onChange={(e) => setSkuBuscado(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscarPorSku()}
          />
          <button
            className="pd-pressable"
            style={{ ...styles.btnConsultarSku, opacity: buscandoSku ? 0.7 : 1 }}
            onClick={buscarPorSku}
            disabled={buscandoSku}
          >
            {buscandoSku ? '⏳' : 'Consultar'}
          </button>
        </div>

        {errorSku && <div style={styles.errorBox} role="alert">⚠️ {errorSku}</div>}

        {resultadoSku && (
          <div style={{ ...styles.resultadoSkuBox, borderLeft: `4px solid ${colorAcento}` }}>
            <div style={styles.resultadoSkuHeader}>
              <p style={styles.resultadoSkuNombre}>{resultadoSku.sku} — {resultadoSku.descripcion}</p>
              <span style={styles.resultadoSkuDepto}>{resultadoSku.departamento}</span>
            </div>

            <div style={styles.resultadoSkuMetricas}>
              <div style={styles.resultadoSkuMetrica}>
                <p style={{ ...styles.resultadoSkuValor, color: resultadoSku.margen_pct != null ? theme.color.successStrong : theme.color.textMuted }}>
                  {resultadoSku.margen_pct != null ? `${resultadoSku.margen_pct}%` : '—'}
                </p>
                <p style={styles.resultadoSkuLabel}>Margen</p>
              </div>
              <div style={styles.resultadoSkuMetrica}>
                <p style={styles.resultadoSkuValor}>
                  {resultadoSku.cobertura_meses != null ? `${resultadoSku.cobertura_meses} mes${resultadoSku.cobertura_meses !== 1 ? 'es' : ''}` : '—'}
                </p>
                <p style={styles.resultadoSkuLabel}>Cobertura</p>
              </div>
              <div style={styles.resultadoSkuMetrica}>
                <p style={styles.resultadoSkuValor}>${resultadoSku.precio.toFixed(2)}</p>
                <p style={styles.resultadoSkuLabel}>Precio</p>
              </div>
              <div style={styles.resultadoSkuMetrica}>
                <p style={styles.resultadoSkuValor}>{resultadoSku.existencia_bodega.toLocaleString()}</p>
                <p style={styles.resultadoSkuLabel}>Existencia</p>
              </div>
            </div>

            {resultadoSku.en_dinamica_activa.length > 0 ? (
              <div style={styles.avisoDinamica}>
                ⚠️ Este código ya está en {resultadoSku.en_dinamica_activa.length} dinámica{resultadoSku.en_dinamica_activa.length !== 1 ? 's' : ''} activa{resultadoSku.en_dinamica_activa.length !== 1 ? 's' : ''} — por eso no aparecería en el listado de candidatos:
                {resultadoSku.en_dinamica_activa.map((d, i) => (
                  <span key={i} style={styles.avisoDinamicaItem}> {d.dinamica} ({d.ubicacion})</span>
                ))}
              </div>
            ) : (
              <p style={styles.avisoLibre}>✅ No está en ninguna dinámica activa — es elegible como candidato</p>
            )}
          </div>
        )}
      </div>

      {/* ── Filtros generales ─────────────────────────────── */}
      <div style={styles.filtrosCard}>
        <div className="pd-grid-3">
          <div>
            <label htmlFor="margen-minimo" style={styles.label}>Margen mínimo (%)</label>
            <input
              id="margen-minimo"
              className="pd-hoverable"
              style={styles.input}
              type="number"
              min="0"
              max="100"
              step="1"
              value={margenMinimo}
              onChange={(e) => setMargenMinimo(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cobertura-minima" style={styles.label}>Cobertura mínima (meses)</label>
            <input
              id="cobertura-minima"
              className="pd-hoverable"
              style={styles.input}
              type="number"
              min="0"
              step="0.5"
              value={coberturaMinima}
              onChange={(e) => setCoberturaMinima(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="filtro-depto-candidatos" style={styles.label}>Departamento</label>
            <select
              id="filtro-depto-candidatos"
              className="pd-hoverable"
              style={styles.input}
              value={filtroDepto}
              onChange={(e) => setFiltroDepto(e.target.value)}
            >
              <option value="">Todos los departamentos</option>
              {departamentosDisponibles.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="pd-pressable"
          style={{ ...styles.btnBuscar, background: tema?.gradient || theme.color.gradient, opacity: cargando ? 0.7 : 1 }}
          onClick={buscar}
          disabled={cargando}
        >
          {cargando ? '⏳ Buscando...' : '🚀 Buscar candidatos'}
        </button>
      </div>

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">🚀</span>
          <p>Buscando candidatos...</p>
        </div>
      ) : !datos || datos.candidatos.length === 0 ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📭</span>
          <p>Ningún producto cumple estos criterios — probá bajar los mínimos.</p>
        </div>
      ) : (
        <>
          <div style={{ ...styles.bandaResumen, background: colorAcento + '10', borderLeft: `4px solid ${colorAcento}` }}>
            <span style={{ fontSize: '28px' }} aria-hidden="true">🎯</span>
            <p style={styles.bandaTitulo}>
              {datos.candidatos.length} candidato{datos.candidatos.length !== 1 ? 's' : ''} encontrado{datos.candidatos.length !== 1 ? 's' : ''}
              {' '}con margen ≥ {datos.filtros.margen_minimo}% y cobertura ≥ {datos.filtros.cobertura_minima} mes{datos.filtros.cobertura_minima !== 1 ? 'es' : ''}
              {datos.filtros.departamento && ` en ${datos.filtros.departamento}`}
            </p>
          </div>

          <div className="pd-table-scroll">
            <table style={styles.tabla}>
              <caption style={styles.srOnly}>Candidatos para próxima campaña</caption>
              <thead>
                <tr>
                  {['SKU', 'Descripción', 'Departamento', 'Precio', 'Margen', 'Existencia', 'Consumo/mes', 'Cobertura'].map(h => (
                    <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidatosFiltrados.map((c, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                    <td style={styles.td}><strong>{c.sku}</strong></td>
                    <td style={styles.td}>{c.descripcion}</td>
                    <td style={styles.td}>{c.departamento}</td>
                    <td style={styles.td}>${c.precio.toFixed(2)}</td>
                    <td style={{ ...styles.td, color: theme.color.successStrong, fontWeight: theme.font.weight.bold }}>{c.margen_pct}%</td>
                    <td style={styles.td}>{c.existencia_bodega.toLocaleString()}</td>
                    <td style={styles.td}>{c.consumo_mensual}</td>
                    <td style={{ ...styles.td, fontWeight: theme.font.weight.bold }}>{c.cobertura_meses} mes{c.cobertura_meses !== 1 ? 'es' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px', lineHeight: '1.6' },

  buscadorCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  buscadorRow: { display: 'flex', gap: '10px' },
  btnConsultarSku: { padding: '10px 20px', background: theme.color.accent, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginTop: '12px' },

  resultadoSkuBox: { marginTop: '16px', background: theme.color.surfaceMuted, borderRadius: theme.radius.lg, padding: '16px 18px' },
  resultadoSkuHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' },
  resultadoSkuNombre: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  resultadoSkuDepto: { fontSize: theme.font.size.sm, color: theme.color.textMuted, background: theme.color.surface, padding: '3px 10px', borderRadius: theme.radius.pill },

  resultadoSkuMetricas: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' },
  resultadoSkuMetrica: { textAlign: 'center', background: theme.color.surface, borderRadius: theme.radius.sm, padding: '10px 4px' },
  resultadoSkuValor: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  resultadoSkuLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '2px 0 0 0' },

  avisoDinamica: { fontSize: theme.font.size.sm, color: theme.color.warning, background: theme.color.warningSoftBg, borderRadius: theme.radius.sm, padding: '10px 12px', lineHeight: '1.5' },
  avisoDinamicaItem: { fontWeight: theme.font.weight.semibold },
  avisoLibre: { fontSize: theme.font.size.sm, color: theme.color.successStrong, margin: 0, fontWeight: theme.font.weight.semibold },

  filtrosCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  btnBuscar: { width: '100%', padding: '12px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '16px', fontFamily: theme.font.family },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '16px' },
  bandaTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text, margin: 0 },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '820px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
};

export default CandidatosProximaCampana;