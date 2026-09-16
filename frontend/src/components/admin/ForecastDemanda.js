// ============================================================
// Componente: ForecastDemanda.js
// Descripción: Pronóstico de demanda por SKU — promedio móvil
// ponderado de los últimos 3 meses de ventas. Filtros opcionales
// de departamento, estado(s) y proveedor. Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

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

const MESES_CORTOS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function ForecastDemanda({ tema, usuario }) {
  const [departamentos, setDepartamentos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [estadosDisponibles, setEstadosDisponibles] = useState([]);

  const [deptoSel, setDeptoSel] = useState('');
  const [proveedorSel, setProveedorSel] = useState('');
  const [estadosSel, setEstadosSel] = useState([]);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    cargarFiltros();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarFiltros = async () => {
    try {
      const [resDeptos, resProveedores, resTiendas] = await Promise.all([
        api.get('/pais/departamentos-catalogo'),
        api.get('/pais/proveedores-catalogo'),
        api.get(`/tiendas?pais=${usuario.pais}`),
      ]);
      setDepartamentos(resDeptos.data);
      setProveedores(resProveedores.data);
      if (resTiendas.data.length > 0) {
        const resEstados = await api.get(`/pais/estados-catalogo-tienda?tienda_codigo=${resTiendas.data[0].codigo}`);
        setEstadosDisponibles(resEstados.data);
      }
    } catch (err) {
      console.error('Error cargando filtros:', err);
    }
  };

  const construirQuery = () => {
    const params = new URLSearchParams();
    if (deptoSel) params.append('departamento', deptoSel);
    if (proveedorSel) params.append('codigo_proveedor', proveedorSel);
    if (estadosSel.length > 0) params.append('estados', estadosSel.join(','));
    return params.toString();
  };

  const generarForecast = async () => {
    setCargando(true);
    setDatos(null);
    try {
      const res = await api.get(`/pais/forecast-demanda?${construirQuery()}`);
      setDatos(res.data);
    } catch (err) {
      console.error('Error generando forecast:', err);
    } finally {
      setCargando(false);
    }
  };

  const exportarForecast = async () => {
    setExportando(true);
    try {
      const res = await api.get(`/exportar/forecast-demanda?${construirQuery()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Forecast_Demanda.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando forecast:', err);
    } finally {
      setExportando(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;

  return (
    <div>
      <p style={styles.descripcion}>
        Pronóstico de demanda por SKU — promedio móvil ponderado de los últimos 3 meses de ventas
        (el mes más reciente pesa más). Filtros opcionales por departamento, estado y proveedor.
      </p>

      <div style={styles.selectorCard}>
        <div className="pd-grid-2">
          <div>
            <label htmlFor="depto-forecast" style={styles.label}>Departamento (opcional)</label>
            <select id="depto-forecast" className="pd-hoverable" style={styles.select} value={deptoSel} onChange={(e) => setDeptoSel(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="proveedor-forecast" style={styles.label}>Proveedor (opcional)</label>
            <select id="proveedor-forecast" className="pd-hoverable" style={styles.select} value={proveedorSel} onChange={(e) => setProveedorSel(e.target.value)}>
              <option value="">Todos los proveedores</option>
              {proveedores.map(p => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <SelectorEstadosMultiple
            id="estados-forecast"
            label="Estados del artículo (opcional)"
            opciones={estadosDisponibles}
            seleccionados={estadosSel}
            onChange={setEstadosSel}
            colorAcento={colorAcento}
          />
        </div>

        <button
          className="pd-pressable"
          style={{ ...styles.btnCalcular, background: tema?.gradient || theme.color.gradient, opacity: cargando ? 0.7 : 1 }}
          onClick={generarForecast}
          disabled={cargando}
        >
          {cargando ? '⏳ Calculando...' : '📈 Generar Forecast'}
        </button>
      </div>

      {datos && datos.periodos_usados.length === 0 && (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📉</span>
          <p>Todavía no hay ventas cargadas para calcular un forecast.</p>
        </div>
      )}

      {datos && datos.periodos_usados.length > 0 && (
        <>
          <div style={styles.infoBanda}>
            <span style={styles.infoBandaTexto}>
              Calculado con: {datos.periodos_usados.map(p => `${MESES_CORTOS[p.mes]} ${p.anio}`).reverse().join(' → ')}
              {datos.periodos_usados.length < 3 && ' — dato parcial (menos de 3 meses cargados)'}
            </span>
            <button
              className="pd-pressable"
              style={{ ...styles.btnExportar, color: colorAcento, borderColor: colorAcento, opacity: exportando ? 0.7 : 1 }}
              onClick={exportarForecast}
              disabled={exportando}
            >
              {exportando ? '⏳ Generando...' : '📥 Descargar Excel'}
            </button>
          </div>

          {datos.productos.length === 0 ? (
            <p style={styles.sinDatos}>No hay productos que coincidan con los filtros seleccionados.</p>
          ) : (
            <div className="pd-table-scroll">
              <table style={styles.tabla}>
                <caption style={styles.srOnly}>Forecast de demanda por SKU</caption>
                <thead>
                  <tr>
                    {['SKU', 'Descripción', 'Departamento', 'Proveedor', 'Estado', 'Pronóstico Próx. Mes', 'Existencia Total', 'Cobertura Proyectada'].map(h => (
                      <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.productos.map((p, i) => (
                    <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                      <td style={styles.td}><strong>{p.sku}</strong></td>
                      <td style={styles.td}>{p.descripcion}</td>
                      <td style={styles.td}>{p.departamento}</td>
                      <td style={styles.td}>{p.proveedor}</td>
                      <td style={styles.td}>{p.estado}</td>
                      <td style={{ ...styles.td, fontWeight: theme.font.weight.bold }}>{p.pronostico_proximo_mes.toLocaleString()}</td>
                      <td style={styles.td}>{p.existencia_total.toLocaleString()}</td>
                      <td style={styles.td}>{p.cobertura_proyectada_meses != null ? `${p.cobertura_proyectada_meses} m` : '—'}</td>
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
  selectorCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  cargandoTexto: { color: theme.color.textMuted, fontSize: theme.font.size.sm, margin: '10px 0 0 0' },
  btnCalcular: { width: '100%', padding: '12px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '16px', fontFamily: theme.font.family },

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

  infoBanda: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' },
  infoBandaTexto: { fontSize: theme.font.size.sm, color: theme.color.textMuted, fontWeight: theme.font.weight.semibold },
  btnExportar: { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: theme.color.surface, border: '1.5px solid', borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },

  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '820px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
};

export default ForecastDemanda;