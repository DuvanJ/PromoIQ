// ============================================================
// Componente: HistorialSku.js
// Descripción: Historial completo de un SKU en dinámicas — sin
// límite temporal, todas las campañas donde participó (activas e
// históricas). Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';
import { formatoMonedaDecimales } from '../../utils/moneda';

function HistorialSku({ tema }) {
  const [skuBuscado, setSkuBuscado] = useState('');
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // ── Catálogo de países — necesario para saber la moneda del
  // país del usuario ────
  const [paises, setPaises] = useState([]);
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  useEffect(() => {
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando catálogo de países:', err));
  }, []);

  const paisInfo = paises.find(p => p.codigo === usuario?.pais);
  const formatearMonto = (valor) => formatoMonedaDecimales(valor, paisInfo);

  const buscar = async () => {
    if (!skuBuscado.trim()) return;
    setCargando(true);
    setError('');
    setDatos(null);
    try {
      const res = await api.get(`/pais/historial-sku/${skuBuscado.trim()}`);
      setDatos(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error consultando el SKU');
    } finally {
      setCargando(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;

  return (
    <div>
      <InstruccionesModulo
        id="historial-sku"
        texto="Buscá un SKU para ver en qué dinámicas participó a lo largo del tiempo, activas o ya finalizadas, en cualquier tienda del país — sin límite de fecha."
      />

      <p style={styles.descripcion}>
        Historial completo de un producto en dinámicas comerciales — sin límite de tiempo, incluye
        campañas activas e históricas, en cualquier tienda.
      </p>

      <div style={styles.buscadorCard}>
        <label htmlFor="buscador-sku-historial" style={styles.label}>SKU a consultar</label>
        <div style={styles.buscadorRow}>
          <input
            id="buscador-sku-historial"
            className="pd-hoverable"
            style={styles.input}
            type="text"
            placeholder="Ej: 12345"
            value={skuBuscado}
            onChange={(e) => setSkuBuscado(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
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

      {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

      {datos && (
        <>
          <div style={{ ...styles.fichaCard, borderLeft: `4px solid ${colorAcento}` }}>
            <div style={styles.fichaHeader}>
              <p style={styles.fichaSku}>SKU {datos.sku}</p>
              {datos.descripcion && <p style={styles.fichaDescripcion}>{datos.descripcion}</p>}
            </div>
            <div style={styles.fichaDatos}>
              {datos.departamento && <span style={styles.fichaDato}><strong>Departamento:</strong> {datos.departamento}</span>}
              {datos.categoria && <span style={styles.fichaDato}><strong>Categoría:</strong> {datos.categoria}</span>}
              {datos.marca && <span style={styles.fichaDato}><strong>Marca:</strong> {datos.marca}</span>}
              {datos.precio_regular != null && <span style={styles.fichaDato}><strong>Precio regular:</strong> {formatearMonto(datos.precio_regular)}</span>}
            </div>
          </div>

          <div style={{ ...styles.bandaResumen, background: colorAcento + '10', borderLeft: `4px solid ${colorAcento}` }}>
            <span style={{ fontSize: '28px' }} aria-hidden="true">📊</span>
            <p style={styles.bandaTitulo}>
              {datos.total_apariciones} aparici{datos.total_apariciones !== 1 ? 'ones' : 'ón'} en dinámicas
              {datos.total_activas > 0 && ` · ${datos.total_activas} activa${datos.total_activas !== 1 ? 's' : ''} ahora mismo`}
            </p>
          </div>

          {datos.historial.length === 0 ? (
            <p style={styles.sinDatos}>Este SKU nunca estuvo en ninguna dinámica.</p>
          ) : (
            <div className="pd-table-scroll">
              <table style={styles.tabla}>
                <caption style={styles.srOnly}>Historial de dinámicas del SKU consultado</caption>
                <thead>
                  <tr>
                    {['Dinámica', 'Vigencia', 'Estado', 'Tienda', 'Ubicación', 'Precio Dinámica', 'Descuento', 'Tipo Campaña'].map(h => (
                      <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.historial.map((h, i) => (
                    <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                      <td style={styles.td}><strong>{h.dinamica}</strong></td>
                      <td style={styles.td}>
                        {new Date(h.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(h.fecha_fin).toLocaleDateString('es-CR')}
                      </td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.estadoBadge,
                          background: h.activa ? theme.color.successBg : theme.color.background,
                          color: h.activa ? theme.color.successStrong : theme.color.textMuted,
                        }}>
                          {h.activa ? 'Activa' : 'Finalizada'}
                        </span>
                      </td>
                      <td style={styles.td}>{h.tienda}</td>
                      <td style={styles.td}>{h.ubicacion}</td>
                      <td style={styles.td}>{formatearMonto(h.precio_dinamica)}</td>
                      <td style={styles.td}>{h.descuento_pct}%</td>
                      <td style={styles.td}>{h.tipo_campana}</td>
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
  buscadorCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  buscadorRow: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  btnBuscar: { padding: '10px 20px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '16px' },

  fichaCard: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '16px', boxShadow: theme.shadow.sm },
  fichaHeader: { marginBottom: '10px' },
  fichaSku: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.black, color: theme.color.text, margin: 0 },
  fichaDescripcion: { fontSize: theme.font.size.base, color: theme.color.textSecondary, margin: '4px 0 0 0' },
  fichaDatos: { display: 'flex', flexWrap: 'wrap', gap: '16px' },
  fichaDato: { fontSize: theme.font.size.sm, color: theme.color.textMuted },

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '18px' },
  bandaTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text, margin: 0 },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base },

  estadoBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '800px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
};

export default HistorialSku;