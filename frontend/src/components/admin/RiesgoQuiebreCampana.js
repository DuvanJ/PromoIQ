// ============================================================
// Componente: RiesgoQuiebreCampana.js
// Descripción: Productos en campaña ACTIVA ahora mismo que están
// en riesgo de quedarse sin stock antes de terminar. Filtro
// ajustable de cobertura máxima. Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

function RiesgoQuiebreCampana({ tema }) {
  const [coberturaMaxima, setCoberturaMaxima] = useState(1);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    buscar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = async () => {
    setCargando(true);
    try {
      const res = await api.get(`/pais/riesgo-quiebre-campana?cobertura_maxima=${coberturaMaxima}`);
      setDatos(res.data);
    } catch (err) {
      console.error('Error cargando riesgo de quiebre:', err);
    } finally {
      setCargando(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;

  const diasRestantes = (fecha) => Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <InstruccionesModulo
        id="riesgo-quiebre-campana"
        texto="Productos que están en promoción activa AHORA MISMO y podrían agotarse antes de que termine la campaña. Ajustá el mínimo de cobertura considerado riesgo — cuanto más alto, más productos van a aparecer en la lista."
      />

      <p style={styles.descripcion}>
        Productos que están en promoción activa ahora mismo y podrían quedarse sin stock antes de
        que termine la campaña — a diferencia de un chequeo de inventario general, esto se enfoca
        solo en lo que ya está corriendo.
      </p>

      <div style={styles.filtroCard}>
        <label htmlFor="cobertura-maxima-riesgo" style={styles.label}>Cobertura máxima considerada riesgo (meses)</label>
        <div style={styles.filtroRow}>
          <input
            id="cobertura-maxima-riesgo"
            className="pd-hoverable"
            style={styles.input}
            type="number"
            min="0"
            step="0.5"
            value={coberturaMaxima}
            onChange={(e) => setCoberturaMaxima(e.target.value)}
          />
          <button
            className="pd-pressable"
            style={{ ...styles.btnBuscar, background: tema?.gradient || theme.color.gradient, opacity: cargando ? 0.7 : 1 }}
            onClick={buscar}
            disabled={cargando}
          >
            {cargando ? '⏳' : '🔍 Buscar'}
          </button>
        </div>
      </div>

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">🚨</span>
          <p>Buscando riesgos de quiebre...</p>
        </div>
      ) : !datos || datos.productos.length === 0 ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">✅</span>
          <p>No hay productos en riesgo de quiebre con este criterio.</p>
        </div>
      ) : (
        <>
          <div style={{ ...styles.bandaResumen, background: theme.color.errorBg, borderLeft: `4px solid ${theme.color.error}` }}>
            <span style={{ fontSize: '28px' }} aria-hidden="true">🚨</span>
            <p style={styles.bandaTitulo}>
              {datos.productos.length} producto{datos.productos.length !== 1 ? 's' : ''} en riesgo de quiebre
              (cobertura ≤ {datos.cobertura_maxima} mes{datos.cobertura_maxima !== 1 ? 'es' : ''})
            </p>
          </div>

          <div className="pd-table-scroll">
            <table style={styles.tabla}>
              <caption style={styles.srOnly}>Productos en riesgo de quiebre durante campaña activa</caption>
              <thead>
                <tr>
                  {['SKU', 'Descripción', 'Dinámica', 'Tienda', 'Existencia', 'Consumo/mes', 'Cobertura', 'Campaña vence'].map(h => (
                    <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.productos.map((p, i) => {
                  const dias = diasRestantes(p.fecha_fin_campana);
                  return (
                    <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                      <td style={styles.td}><strong>{p.sku}</strong></td>
                      <td style={styles.td}>{p.descripcion}</td>
                      <td style={styles.td}>{p.dinamica}</td>
                      <td style={styles.td}>{p.tienda}</td>
                      <td style={styles.td}>{p.existencia.toLocaleString()}</td>
                      <td style={styles.td}>{p.consumo_mensual}</td>
                      <td style={{ ...styles.td, color: theme.color.error, fontWeight: theme.font.weight.bold }}>
                        {p.cobertura_meses} mes{p.cobertura_meses !== 1 ? 'es' : ''}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.diasBadge,
                          background: dias < 7 ? theme.color.errorBg : theme.color.warningSoftBg,
                          color: dias < 7 ? theme.color.error : theme.color.warning,
                        }}>
                          {dias < 0 ? 'Vencida' : `${dias} días`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
  filtroCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  filtroRow: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  btnBuscar: { padding: '10px 20px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '18px' },
  bandaTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text, margin: 0 },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '800px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
  diasBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap' },
};

export default RiesgoQuiebreCampana;