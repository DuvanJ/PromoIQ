// ============================================================
// Componente: OportunidadesSinExplotar.js
// Descripción: Códigos del catálogo nunca promocionados y con
// venta real, agrupados por departamento — exclusivo de Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function BarraProgreso({ pct, color }) {
  return (
    <div className="pd-bar-track" style={{ flex: 1, height: '8px', background: theme.color.background, borderRadius: '4px' }}>
      <div
        className="pd-bar-fill"
        style={{ height: '100%', borderRadius: '4px', background: color, transform: `scaleX(${Math.min(pct, 100) / 100})` }}
      />
    </div>
  );
}

function OportunidadesSinExplotar({ tema }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtroDepto, setFiltroDepto] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await api.get('/pais/oportunidades-sin-explotar');
      setDatos(res.data);
    } catch (err) {
      console.error('Error cargando oportunidades:', err);
    } finally {
      setCargando(false);
    }
  };

  const exportarExcel = async () => {
    setExportando(true);
    try {
      const params = filtroDepto ? `?departamento=${encodeURIComponent(filtroDepto)}` : '';
      const res = await api.get(`/exportar/oportunidades-sin-explotar${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Oportunidades${filtroDepto ? '_' + filtroDepto : ''}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando:', err);
    } finally {
      setExportando(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;
  const colorSecundario = tema?.secondary || theme.color.accent;

  const departamentosFiltrados = datos?.departamentos
    ? (filtroDepto ? datos.departamentos.filter(d => d.departamento === filtroDepto) : datos.departamentos)
    : [];

  const totalCodigos = departamentosFiltrados.reduce((acc, d) => acc + d.total_codigos_sin_explotar, 0);
  const totalUnidades = departamentosFiltrados.reduce((acc, d) => acc + d.total_unidades, 0);
  const maxUnidades = departamentosFiltrados[0]?.total_unidades || 1;
  const medallas = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <InstruccionesModulo
        id="oportunidades-sin-explotar"
        texto="Códigos de tu catálogo que nunca estuvieron en ninguna dinámica pero igual venden por su cuenta — candidatos naturales para tu próxima campaña. Filtrá por departamento o exportá la lista completa a Excel."
      />

      <p style={styles.descripcion}>
        Códigos de tu catálogo que nunca estuvieron en ninguna dinámica pero sí venden por su cuenta —
        {datos?.periodo && ` datos de ${MESES[datos.periodo.mes]} ${datos.periodo.anio}, sin ninguna promoción.`}
      </p>

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">💡</span>
          <p>Buscando oportunidades...</p>
        </div>
      ) : !datos || datos.departamentos.length === 0 ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">🎉</span>
          <p>No se encontraron códigos sin explotar con venta real este mes.</p>
        </div>
      ) : (
        <>
          {/* Banda resumen + controles */}
          <div style={{ ...styles.bandaResumen, background: `linear-gradient(135deg, ${colorAcento} 0%, ${colorSecundario} 100%)` }}>
            <div style={styles.bandaMetricas}>
              <div>
                <p style={styles.bandaValor}>{departamentosFiltrados.length}</p>
                <p style={styles.bandaLabel}>Departamento{departamentosFiltrados.length !== 1 ? 's' : ''}</p>
              </div>
              <div style={styles.bandaDivider} />
              <div>
                <p style={styles.bandaValor}>{totalCodigos}</p>
                <p style={styles.bandaLabel}>Códigos sin explotar</p>
              </div>
              <div style={styles.bandaDivider} />
              <div>
                <p style={styles.bandaValor}>{totalUnidades.toLocaleString()}</p>
                <p style={styles.bandaLabel}>Unidades vendidas igual</p>
              </div>
            </div>

            <div style={styles.bandaControles}>
              <select
                className="pd-hoverable"
                style={styles.selectFiltro}
                value={filtroDepto}
                onChange={(e) => setFiltroDepto(e.target.value)}
                aria-label="Filtrar por departamento"
              >
                <option value="">Todos los departamentos</option>
                {datos.departamentos.map(d => (
                  <option key={d.departamento} value={d.departamento}>{d.departamento}</option>
                ))}
              </select>
              <button
                className="pd-pressable"
                style={{ ...styles.btnExportar, opacity: exportando ? 0.7 : 1 }}
                onClick={exportarExcel}
                disabled={exportando}
              >
                {exportando ? '⏳' : '📥'} Excel
              </button>
            </div>
          </div>

          <div className="pd-grid-2">
            {departamentosFiltrados.map((d, i) => (
              <div key={i} className="pd-stagger-item pd-hoverable" style={{ ...styles.card, animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})` }}>
                <div style={styles.cardHeader}>
                  <div style={styles.cardHeaderIzq}>
                    {i < 3 && <span style={styles.medalla} aria-hidden="true">{medallas[i]}</span>}
                    <div>
                      <p style={styles.nombre}>{d.departamento}</p>
                      <p style={styles.subLabel}>{d.total_codigos_sin_explotar} código{d.total_codigos_sin_explotar !== 1 ? 's' : ''} sin explotar</p>
                    </div>
                  </div>
                </div>

                <div style={styles.barraFila}>
                  <BarraProgreso pct={(d.total_unidades / maxUnidades) * 100} color={colorAcento} />
                  <span style={{ ...styles.barraValor, color: colorAcento }}>{d.total_unidades.toLocaleString()} uds</span>
                </div>

                <div style={styles.topLista}>
                  <p style={styles.topTitulo}>🎯 Candidatos sugeridos</p>
                  {d.candidatos.map((c, j) => (
                    <div key={j} style={styles.productoRow}>
                      <span style={{ ...styles.productoRank, background: colorAcento + '15', color: colorAcento }}>{j + 1}</span>
                      <span style={styles.productoSku}>{c.sku}</span>
                      <span style={styles.productoDesc}>{c.descripcion}</span>
                      <span style={styles.productoUnidades}>{c.unidades} uds</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  bandaResumen: {
    borderRadius: theme.radius.xxl, padding: '22px 26px', marginBottom: '20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px',
    boxShadow: theme.shadow.floating,
  },
  bandaMetricas: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
  bandaDivider: { width: '1px', height: '36px', background: 'rgba(255,255,255,0.3)' },
  bandaValor: { color: '#fff', fontSize: '28px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  bandaLabel: { color: 'rgba(255,255,255,0.85)', fontSize: theme.font.size.sm, margin: '4px 0 0 0', fontWeight: theme.font.weight.medium },
  bandaControles: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  selectFiltro: { padding: '9px 14px', borderRadius: theme.radius.md, border: 'none', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.text, background: 'rgba(255,255,255,0.95)', cursor: 'pointer' },
  btnExportar: { padding: '9px 16px', borderRadius: theme.radius.md, border: 'none', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.text, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },

  card: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '18px', boxShadow: theme.shadow.sm },
  cardHeader: { marginBottom: '14px' },
  cardHeaderIzq: { display: 'flex', alignItems: 'center', gap: '10px' },
  medalla: { fontSize: '28px', flexShrink: 0 },
  nombre: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  subLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },

  barraFila: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
  barraValor: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, whiteSpace: 'nowrap' },

  topLista: { borderTop: `1px solid ${theme.color.background}`, paddingTop: '12px' },
  topTitulo: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px 0' },
  productoRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: theme.font.size.sm },
  productoRank: { width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, flexShrink: 0 },
  productoSku: { fontWeight: theme.font.weight.bold, color: theme.color.text, flexShrink: 0 },
  productoDesc: { flex: 1, color: theme.color.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  productoUnidades: { color: theme.color.textMuted, flexShrink: 0, fontWeight: theme.font.weight.semibold },
};

export default OportunidadesSinExplotar;