// ============================================================
// Componente: SobreStockDepartamento.js
// Descripción: Sobre-stock evaluado por TIENDA, con filtros de
// estado del artículo (Vigente, Descontinuado, etc.) y
// departamento. Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function SobreStockDepartamento({ tema, usuario }) {
  const [tiendas, setTiendas] = useState([]);
  const [cargandoTiendas, setCargandoTiendas] = useState(true);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState('');

  const [estados, setEstados] = useState([]);
  const [cargandoEstados, setCargandoEstados] = useState(false);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('');

  const [departamentos, setDepartamentos] = useState([]);
  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(false);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState('');

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
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
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    } finally {
      setCargandoTiendas(false);
    }
  };

  const cambiarTienda = async (codigo) => {
    setTiendaSeleccionada(codigo);
    setEstadoSeleccionado('');
    setDeptoSeleccionado('');
    setDatos(null);
    setEstados([]);
    setDepartamentos([]);
    if (!codigo) return;

    setCargandoEstados(true);
    try {
      const res = await api.get(`/pais/estados-catalogo-tienda?tienda_codigo=${codigo}`);
      setEstados(res.data);
    } catch (err) {
      console.error('Error cargando estados:', err);
    } finally {
      setCargandoEstados(false);
    }

    await cargarDepartamentos(codigo, '');
  };

  const cambiarEstado = async (estado) => {
    setEstadoSeleccionado(estado);
    setDeptoSeleccionado('');
    setDatos(null);
    await cargarDepartamentos(tiendaSeleccionada, estado);
  };

  const cargarDepartamentos = async (codigoTienda, estado) => {
    setCargandoDepartamentos(true);
    try {
      const params = new URLSearchParams({ tienda_codigo: codigoTienda });
      if (estado) params.append('estado', estado);
      const res = await api.get(`/pais/sobre-stock-departamentos-lista?${params}`);
      setDepartamentos(res.data);
    } catch (err) {
      console.error('Error cargando departamentos:', err);
    } finally {
      setCargandoDepartamentos(false);
    }
  };

  const calcular = async () => {
    if (!tiendaSeleccionada || !deptoSeleccionado) return;
    setCargando(true);
    setError('');
    setDatos(null);
    try {
      const params = new URLSearchParams({ tienda_codigo: tiendaSeleccionada, departamento: deptoSeleccionado });
      if (estadoSeleccionado) params.append('estado', estadoSeleccionado);
      const res = await api.get(`/pais/sobre-stock-departamento?${params}`);
      setDatos(res.data.departamentos[0] || null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error calculando el sobre-stock');
    } finally {
      setCargando(false);
    }
  };

  const exportarExcel = async () => {
    if (!tiendaSeleccionada || !deptoSeleccionado) return;
    setExportando(true);
    try {
      const params = new URLSearchParams({ tienda_codigo: tiendaSeleccionada, departamento: deptoSeleccionado });
      if (estadoSeleccionado) params.append('estado', estadoSeleccionado);
      const res = await api.get(`/exportar/sobre-stock-departamento?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const nombreTienda = tiendas.find(t => t.codigo === tiendaSeleccionada)?.nombre || tiendaSeleccionada;
      link.setAttribute('download', `Sobre_Stock_${nombreTienda}_${deptoSeleccionado}.xlsx`.replace(/\s+/g, '_'));
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
  const formatoMoneda = (v) => (v || 0).toLocaleString('es-CR', { maximumFractionDigits: 0 });

  return (
    <div>
      <p style={styles.descripcion}>
        Productos con existencia actual por encima del máximo definido en una tienda específica —
        elegí tienda, opcionalmente el estado del artículo, y el departamento para calcular el detalle.
      </p>

      <div style={styles.selectorCard}>
        <div className="pd-grid-3">
          <div>
            <label htmlFor="tienda-sobre-stock" style={styles.label}>Tienda</label>
            {cargandoTiendas ? (
              <p style={styles.cargandoTexto}>Cargando tiendas...</p>
            ) : (
              <select
                id="tienda-sobre-stock"
                className="pd-hoverable"
                style={styles.select}
                value={tiendaSeleccionada}
                onChange={(e) => cambiarTienda(e.target.value)}
              >
                <option value="">Seleccioná una tienda...</option>
                {tiendas.map(t => (
                  <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="estado-sobre-stock" style={styles.label}>Estado del artículo</label>
            {!tiendaSeleccionada ? (
              <p style={styles.cargandoTexto}>Elegí una tienda primero</p>
            ) : cargandoEstados ? (
              <p style={styles.cargandoTexto}>Cargando...</p>
            ) : (
              <select
                id="estado-sobre-stock"
                className="pd-hoverable"
                style={styles.select}
                value={estadoSeleccionado}
                onChange={(e) => cambiarEstado(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {estados.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="depto-sobre-stock" style={styles.label}>Departamento</label>
            {!tiendaSeleccionada ? (
              <p style={styles.cargandoTexto}>Elegí una tienda primero</p>
            ) : cargandoDepartamentos ? (
              <p style={styles.cargandoTexto}>Cargando...</p>
            ) : departamentos.length === 0 ? (
              <p style={styles.cargandoTexto}>Sin sobre-stock con estos filtros</p>
            ) : (
              <select
                id="depto-sobre-stock"
                className="pd-hoverable"
                style={styles.select}
                value={deptoSeleccionado}
                onChange={(e) => { setDeptoSeleccionado(e.target.value); setDatos(null); }}
              >
                <option value="">Seleccioná un departamento...</option>
                {departamentos.map(d => (
                  <option key={d.departamento} value={d.departamento}>
                    {d.departamento} ({d.total_skus} caso{d.total_skus !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <button
          className="pd-pressable"
          style={{ ...styles.btnCalcular, background: tema?.gradient || theme.color.gradient, opacity: cargando || !tiendaSeleccionada || !deptoSeleccionado ? 0.7 : 1 }}
          onClick={calcular}
          disabled={cargando || !tiendaSeleccionada || !deptoSeleccionado}
        >
          {cargando ? '⏳ Calculando...' : '🔍 Calcular sobre-stock'}
        </button>
      </div>

      {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📦</span>
          <p>Calculando sobre-stock...</p>
        </div>
      ) : datos && (
        <>
          <div style={{ ...styles.bandaResumen, background: theme.color.warningSoftBg, borderLeft: `4px solid ${theme.color.warning}` }}>
            <span style={{ fontSize: '28px' }} aria-hidden="true">💰</span>
            <div style={{ flex: 1 }}>
              <p style={styles.bandaTitulo}>{datos.departamento} — ${formatoMoneda(datos.monto_total)} en monto inmovilizado</p>
              <p style={styles.bandaSub}>
                {tiendas.find(t => t.codigo === tiendaSeleccionada)?.nombre}
                {estadoSeleccionado && ` · ${estadoSeleccionado}`} · {datos.total_registros} SKU{datos.total_registros !== 1 ? 's' : ''} con exceso
              </p>
            </div>
            <button
              className="pd-pressable"
              style={{ ...styles.btnExportar, opacity: exportando ? 0.7 : 1 }}
              onClick={exportarExcel}
              disabled={exportando}
            >
              {exportando ? '⏳' : '📥'} Excel completo
            </button>
          </div>

          <div className="pd-table-scroll">
            <table style={styles.tabla}>
              <caption style={styles.srOnly}>Productos con sobre-stock en {datos.departamento}</caption>
              <thead>
                <tr>
                  {['SKU', 'Descripción', 'Estado', 'Existencia Actual', 'Mínimo', 'Máximo', 'Exceso en Unidades', 'Monto Inmovilizado'].map(h => (
                    <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.productos.map((p, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                    <td style={styles.td}><strong>{p.sku}</strong></td>
                    <td style={styles.td}>{p.descripcion}</td>
                    <td style={styles.td}>{p.estado}</td>
                    <td style={styles.td}>{p.existencia_actual.toLocaleString()}</td>
                    <td style={styles.td}>{p.minimo.toLocaleString()}</td>
                    <td style={styles.td}>{p.maximo.toLocaleString()}</td>
                    <td style={{ ...styles.td, color: theme.color.warning, fontWeight: theme.font.weight.bold }}>+{p.exceso_unidades.toLocaleString()}</td>
                    <td style={{ ...styles.td, fontWeight: theme.font.weight.bold }}>${formatoMoneda(p.monto_inmovilizado)}</td>
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
  selectorCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  cargandoTexto: { color: theme.color.textMuted, fontSize: theme.font.size.sm, margin: '10px 0 0 0' },
  btnCalcular: { width: '100%', padding: '12px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '16px', fontFamily: theme.font.family },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '16px' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  bandaResumen: { display: 'flex', alignItems: 'center', gap: '14px', borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '18px', flexWrap: 'wrap' },
  bandaTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  bandaSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  btnExportar: { padding: '9px 16px', background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', color: theme.color.primary, whiteSpace: 'nowrap', flexShrink: 0 },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '780px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
};

export default SobreStockDepartamento;