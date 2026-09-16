// ============================================================
// Componente: DescuentosSinImpacto.js
// Descripción: Productos que estuvieron en descuento durante una
// campaña FINALIZADA pero no vendieron más que en el mes anterior
// a que empezara — descuentos que no generaron impacto real.
// Filtrable por departamento. Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function DescuentosSinImpacto({ tema }) {
  const [dinamicas, setDinamicas] = useState([]);
  const [cargandoDinamicas, setCargandoDinamicas] = useState(true);
  const [dinamicaSeleccionada, setDinamicaSeleccionada] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('');

  useEffect(() => {
    cargarDinamicas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDinamicas = async () => {
    setCargandoDinamicas(true);
    try {
      const res = await api.get('/pais/dinamicas-finalizadas');
      setDinamicas(res.data);
      if (res.data.length > 0) {
        setDinamicaSeleccionada(res.data[0].id);
        buscar(res.data[0].id);
      }
    } catch (err) {
      console.error('Error cargando dinámicas finalizadas:', err);
    } finally {
      setCargandoDinamicas(false);
    }
  };

  const buscar = async (id) => {
    setCargando(true);
    setError('');
    setDatos(null);
    setFiltroDepto('');
    try {
      const res = await api.get(`/pais/descuentos-sin-impacto?dinamica_id=${id}`);
      setDatos(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error consultando la campaña');
    } finally {
      setCargando(false);
    }
  };

  const cambiarDinamica = (id) => {
    setDinamicaSeleccionada(id);
    buscar(id);
  };

  const colorAcento = tema?.primary || theme.color.primary;

  return (
    <div>
      <p style={styles.descripcion}>
        Productos que estuvieron en descuento durante una campaña finalizada pero no vendieron
        más que antes de empezar — descuento que probablemente no valió la pena.
      </p>

      <div style={styles.selectorCard}>
        {cargandoDinamicas ? (
          <p style={styles.cargandoTexto}>Cargando campañas finalizadas...</p>
        ) : dinamicas.length === 0 ? (
          <p style={styles.cargandoTexto}>No hay campañas finalizadas todavía para analizar.</p>
        ) : (
          <div>
            <label htmlFor="dinamica-descuentos" style={styles.label}>Campaña finalizada</label>
            <select
              id="dinamica-descuentos"
              className="pd-hoverable"
              style={styles.select}
              value={dinamicaSeleccionada}
              onChange={(e) => cambiarDinamica(e.target.value)}
            >
              {dinamicas.map(d => (
                <option key={d.id} value={d.id}>
                  {d.nombre} ({new Date(d.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(d.fecha_fin).toLocaleDateString('es-CR')})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📉</span>
          <p>Analizando impacto de la campaña...</p>
        </div>
      ) : datos && (
        <>
          <div style={{ ...styles.bandaResumen, background: colorAcento + '10', borderLeft: `4px solid ${colorAcento}` }}>
            <span style={{ fontSize: '28px' }} aria-hidden="true">📊</span>
            <div>
              <p style={styles.bandaTitulo}>
                {datos.productos.length} producto{datos.productos.length !== 1 ? 's' : ''} sin impacto real
              </p>
              <p style={styles.bandaSub}>
                Comparado contra {datos.dinamica.mes_base} — el mes antes de que empezara "{datos.dinamica.nombre}"
              </p>
            </div>
          </div>

          {datos.productos.length === 0 ? (
            <div style={styles.cargando}>
              <span style={{ fontSize: '40px' }} aria-hidden="true">🎉</span>
              <p>Todos los productos de esta campaña vendieron más que antes — buen resultado.</p>
            </div>
          ) : (
            <>
              <div style={styles.filtroDeptoWrapper}>
                <label htmlFor="filtro-depto-descuentos" style={styles.filtroDeptoLabel}>📂 Departamento</label>
                <select
                  id="filtro-depto-descuentos"
                  className="pd-hoverable"
                  style={styles.filtroDeptoSelect}
                  value={filtroDepto}
                  onChange={(e) => setFiltroDepto(e.target.value)}
                >
                  <option value="">Todos los departamentos ({datos.productos.length})</option>
                  {[...new Set(datos.productos.map(p => p.departamento))].sort().map(depto => {
                    const cantidad = datos.productos.filter(p => p.departamento === depto).length;
                    return <option key={depto} value={depto}>{depto} ({cantidad})</option>;
                  })}
                </select>
              </div>

              <div className="pd-table-scroll">
                <table style={styles.tabla}>
                  <caption style={styles.srOnly}>Productos con descuento sin impacto real</caption>
                  <thead>
                    <tr>
                      {['SKU', 'Descripción', 'Departamento', '% Descuento', 'Precio Dinámica', `Antes (${datos.dinamica.mes_base})`, 'Durante (prom. mensual)', 'Variación'].map(h => (
                        <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datos.productos
                      .filter(p => !filtroDepto || p.departamento === filtroDepto)
                      .map((p, i) => (
                        <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                          <td style={styles.td}><strong>{p.sku}</strong></td>
                          <td style={styles.td}>{p.descripcion}</td>
                          <td style={styles.td}>{p.departamento}</td>
                          <td style={{ ...styles.td, fontWeight: theme.font.weight.bold }}>{p.descuento_pct}%</td>
                          <td style={styles.td}>${p.precio_dinamica?.toFixed(2)}</td>
                          <td style={styles.td}>{p.ventas_antes_mensual} uds</td>
                          <td style={styles.td}>{p.ventas_durante_mensual} uds</td>
                          <td style={{ ...styles.td, color: p.variacion_pct < 0 ? theme.color.error : theme.color.textMuted, fontWeight: theme.font.weight.bold }}>
                            {p.variacion_pct > 0 ? '+' : ''}{p.variacion_pct}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
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

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '20px' },
  bandaTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  bandaSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },

  filtroDeptoWrapper: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
  filtroDeptoLabel: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted },
  filtroDeptoSelect: { padding: '9px 14px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text, background: theme.color.surface, cursor: 'pointer', minWidth: '220px' },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '820px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
};

export default DescuentosSinImpacto;