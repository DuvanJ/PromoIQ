// ============================================================
// Componente: ComparadorCampanas.js
// Descripción: Compara dos dinámicas FINALIZADAS lado a lado —
// unidades, monto, margen y top 5 productos de cada una.
// Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function ComparadorCampanas({ tema, usuario }) {
  const [dinamicas, setDinamicas] = useState([]);
  const [cargandoDinamicas, setCargandoDinamicas] = useState(true);
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [comparando, setComparando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarDinamicas();
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

  const comparar = async () => {
    if (!idA || !idB) { setError('Elegí las dos campañas a comparar'); return; }
    if (idA === idB) { setError('Elegí dos campañas distintas'); return; }
    setComparando(true);
    setError('');
    setResultado(null);
    try {
      const res = await api.get(`/pais/comparador-campanas?dinamica_id_1=${idA}&dinamica_id_2=${idB}`);
      setResultado(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error comparando las campañas');
    } finally {
      setComparando(false);
    }
  };

    const exportarExcel = async () => {
    try {
      const res = await api.get(`/exportar/comparador-campanas?dinamica_id_1=${idA}&dinamica_id_2=${idB}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Comparador_${resultado.campana_1.nombre}_vs_${resultado.campana_2.nombre}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando comparador:', err);
    }
  };

  const formatoMoneda = (valor) => (valor || 0).toLocaleString('es-CR', { maximumFractionDigits: 0 });

  const Tarjeta = ({ campana, colorAcento, esGanadora, campo }) => (
    <div style={{ ...styles.tarjeta, border: esGanadora ? `2px solid ${colorAcento}` : `1px solid ${theme.color.border}` }}>
      {esGanadora && (
        <div style={{ ...styles.badgeGanadora, background: colorAcento }}>🏆 Mejor en {campo}</div>
      )}
      <p style={styles.tarjetaNombre}>{campana.nombre}</p>
      <p style={styles.tarjetaFechas}>
        {new Date(campana.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(campana.fecha_fin).toLocaleDateString('es-CR')}
      </p>

      <div style={styles.metricaGrande}>
        <p style={{ ...styles.metricaGrandeValor, color: colorAcento }}>${formatoMoneda(campana.resumen.monto_vendido)}</p>
        <p style={styles.metricaGrandeLabel}>Monto vendido</p>
      </div>

      <div style={styles.metricasFila}>
        <div style={styles.metricaChica}>
          <p style={styles.metricaChicaValor}>{campana.resumen.unidades_vendidas}</p>
          <p style={styles.metricaChicaLabel}>Unidades</p>
        </div>
        <div style={styles.metricaChica}>
          <p style={styles.metricaChicaValor}>{campana.resumen.margen_promedio}%</p>
          <p style={styles.metricaChicaLabel}>Margen prom.</p>
        </div>
        <div style={styles.metricaChica}>
          <p style={styles.metricaChicaValor}>{campana.resumen.cantidad_articulos}</p>
          <p style={styles.metricaChicaLabel}>Artículos</p>
        </div>
        <div style={styles.metricaChica}>
          <p style={styles.metricaChicaValor}>{campana.resumen.cantidad_tiendas}</p>
          <p style={styles.metricaChicaLabel}>Tiendas</p>
        </div>
      </div>

      <p style={styles.topTitulo}>Top 5 productos</p>
      {campana.top_ventas.length === 0 ? (
        <p style={styles.sinVentas}>Sin ventas registradas en el período</p>
      ) : (
        campana.top_ventas.map((p, i) => (
          <div key={i} style={styles.productoRow}>
            <span style={styles.productoSku}>{p.sku}</span>
            <span style={styles.productoDesc}>{p.descripcion || '—'}</span>
            <span style={{ ...styles.productoMonto, color: colorAcento }}>${formatoMoneda(p.venta_total)}</span>
          </div>
        ))
      )}
    </div>
  );

  const gananciaMonto = resultado
    ? (resultado.campana_1.resumen.monto_vendido >= resultado.campana_2.resumen.monto_vendido ? '1' : '2')
    : null;
  const gananciaMargen = resultado
    ? (resultado.campana_1.resumen.margen_promedio >= resultado.campana_2.resumen.margen_promedio ? '1' : '2')
    : null;

  return (
    <div>
      <p style={styles.descripcion}>
        Compará dos campañas ya finalizadas para ver cuál vendió más, con mejor margen, y qué productos destacaron en cada una.
      </p>

      <div style={styles.selectoresCard}>
        {cargandoDinamicas ? (
          <p style={styles.cargandoTexto}>Cargando campañas finalizadas...</p>
        ) : dinamicas.length < 2 ? (
          <p style={styles.cargandoTexto}>Necesitás al menos 2 campañas finalizadas para poder comparar.</p>
        ) : (
          <div className="pd-grid-2">
            <div>
              <label htmlFor="campana-a" style={styles.label}>Campaña A</label>
              <select id="campana-a" className="pd-hoverable" style={styles.select} value={idA} onChange={(e) => setIdA(e.target.value)}>
                <option value="">Seleccioná una campaña...</option>
                {dinamicas.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre} ({new Date(d.fecha_fin).toLocaleDateString('es-CR')})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="campana-b" style={styles.label}>Campaña B</label>
              <select id="campana-b" className="pd-hoverable" style={styles.select} value={idB} onChange={(e) => setIdB(e.target.value)}>
                <option value="">Seleccioná una campaña...</option>
                {dinamicas.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre} ({new Date(d.fecha_fin).toLocaleDateString('es-CR')})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

        <button
          className="pd-pressable"
          style={{ ...styles.btnComparar, background: tema?.gradient || theme.color.gradient, opacity: comparando ? 0.7 : 1 }}
          onClick={comparar}
          disabled={comparando || dinamicas.length < 2}
        >
          {comparando ? '⏳ Comparando...' : '⚖️ Comparar campañas'}
        </button>
      </div>

      {resultado && (
        <div className="pd-grid-2" style={{ marginTop: '20px' }}>
          <Tarjeta
            campana={resultado.campana_1}
            colorAcento={tema?.primary || theme.color.primary}
            esGanadora={gananciaMonto === '1'}
            campo="ventas"
          />
          <Tarjeta
            campana={resultado.campana_2}
            colorAcento={tema?.secondary || theme.color.accent}
            esGanadora={gananciaMonto === '2'}
            campo="ventas"
          />
        </div>
      )}

        {resultado && (
        <div style={styles.resumenComparativo}>
          <div style={styles.resumenHeader}>
            <div>
              <p style={styles.resumenTitulo}>📊 Resumen de la comparación</p>
              <p style={styles.resumenTexto}>
                <strong>{gananciaMonto === '1' ? resultado.campana_1.nombre : resultado.campana_2.nombre}</strong> vendió más en total.{' '}
                <strong>{gananciaMargen === '1' ? resultado.campana_1.nombre : resultado.campana_2.nombre}</strong> tuvo mejor margen promedio.
              </p>
            </div>
            <button className="pd-pressable" style={styles.btnExportar} onClick={exportarExcel}>
              📥 Descargar Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  selectoresCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  cargandoTexto: { color: theme.color.textMuted, fontSize: theme.font.size.base, textAlign: 'center', padding: '12px' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginTop: '14px' },
  btnComparar: { width: '100%', padding: '14px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '16px', fontFamily: theme.font.family },

  tarjeta: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, position: 'relative' },
  badgeGanadora: { position: 'absolute', top: '-10px', right: '16px', color: '#fff', fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, padding: '4px 10px', borderRadius: theme.radius.pill, textTransform: 'uppercase', letterSpacing: '0.5px' },
  tarjetaNombre: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: '4px 0 2px 0' },
  tarjetaFechas: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 16px 0' },

  metricaGrande: { textAlign: 'center', padding: '16px 0', borderBottom: `1px solid ${theme.color.background}`, marginBottom: '14px' },
  metricaGrandeValor: { fontSize: '32px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  metricaGrandeLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0' },

  metricasFila: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '18px' },
  metricaChica: { textAlign: 'center', background: theme.color.surfaceMuted, borderRadius: theme.radius.sm, padding: '8px 4px' },
  metricaChicaValor: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  metricaChicaLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '2px 0 0 0' },

  topTitulo: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  sinVentas: { fontSize: theme.font.size.sm, color: theme.color.textMuted, fontStyle: 'italic' },
  productoRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${theme.color.background}`, fontSize: theme.font.size.sm },
  productoSku: { fontWeight: theme.font.weight.bold, color: theme.color.text, flexShrink: 0 },
  productoDesc: { flex: 1, color: theme.color.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  productoMonto: { fontWeight: theme.font.weight.bold, flexShrink: 0 },

  resumenComparativo: { background: theme.color.accentSoft, borderRadius: theme.radius.lg, padding: '16px 20px', marginTop: '16px' },
  resumenTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 6px 0' },
  resumenTexto: { fontSize: theme.font.size.base, color: theme.color.text, margin: 0, lineHeight: '1.5' },
    resumenHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  btnExportar: { padding: '10px 18px', background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', color: theme.color.primary, whiteSpace: 'nowrap', flexShrink: 0 },
};

export default ComparadorCampanas;