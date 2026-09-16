// ============================================================
// Componente: CoberturaInventario.js
// Descripción: Cobertura de inventario en 3 vistas — por tienda
// (todo el catálogo, no solo campaña), comparar un SKU entre
// tiendas, y sugerencia de redistribución (exceso ↔ déficit).
// Cobertura y Redistribución requieren filtro de estado(s) —
// selección múltiple obligatoria antes de generar el reporte.
// Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

const COLOR_BANDA = {
  critico: '#DC2626',
  bajo: '#D97706',
  normal: '#16A34A',
  alto: '#2563EB',
  excesivo: '#6B7280',
  sin_datos: '#9CA3AF',
};

// Dropdown de selección múltiple por checkboxes — lista los nombres
// seleccionados directamente en el botón (no un contador).
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

  const etiqueta = seleccionados.length > 0 ? seleccionados.join(', ') : 'Seleccioná uno o más estados...';

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

function CoberturaInventario({ tema, usuario }) {
  const [vista, setVista] = useState('tienda'); // 'tienda' | 'sku' | 'redistribucion'
  const [tiendas, setTiendas] = useState([]);
  const [estadosDisponibles, setEstadosDisponibles] = useState([]);

  // ── Pestaña: por tienda ──────────────────────────────
  const [tiendaSel, setTiendaSel] = useState('');
  const [departamentos, setDepartamentos] = useState([]);
  const [cargandoDeptos, setCargandoDeptos] = useState(false);
  const [deptoSel, setDeptoSel] = useState('');
  const [estadosCobertura, setEstadosCobertura] = useState([]);
  const [datosTienda, setDatosTienda] = useState(null);
  const [cargandoTienda, setCargandoTienda] = useState(false);
  const [exportandoTienda, setExportandoTienda] = useState(false);

  // ── Pestaña: comparar SKU ────────────────────────────
  const [skuBuscado, setSkuBuscado] = useState('');
  const [datosSku, setDatosSku] = useState(null);
  const [cargandoSku, setCargandoSku] = useState(false);
  const [errorSku, setErrorSku] = useState('');

  // ── Pestaña: redistribución ───────────────────────────
  const [deptoRedistribucion, setDeptoRedistribucion] = useState('');
  const [todosDepartamentos, setTodosDepartamentos] = useState([]);
  const [estadosRedistribucion, setEstadosRedistribucion] = useState([]);
  const [datosRedistribucion, setDatosRedistribucion] = useState(null);
  const [cargandoRedistribucion, setCargandoRedistribucion] = useState(false);
  const [exportandoRedistribucion, setExportandoRedistribucion] = useState(false);

  useEffect(() => {
    cargarTiendas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarTiendas = async () => {
    try {
      const res = await api.get(`/tiendas?pais=${usuario.pais}`);
      setTiendas(res.data);
      if (res.data.length > 0) cargarEstadosDisponibles(res.data[0].codigo);
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    }
  };

  // El estado del catálogo es el mismo en todo el país — se consulta
  // una sola vez con cualquier tienda, y se reutiliza en ambas pestañas.
  const cargarEstadosDisponibles = async (codigoTiendaCualquiera) => {
    try {
      const res = await api.get(`/pais/estados-catalogo-tienda?tienda_codigo=${codigoTiendaCualquiera}`);
      setEstadosDisponibles(res.data);
    } catch (err) {
      console.error('Error cargando estados:', err);
    }
  };

  // ── Por tienda ────────────────────────────────────────
  const cambiarTiendaSel = async (codigo) => {
    setTiendaSel(codigo);
    setDeptoSel('');
    setDatosTienda(null);
    setDepartamentos([]);
    if (!codigo) return;
    setCargandoDeptos(true);
    try {
      const res = await api.get(`/pais/cobertura-tienda-departamentos-lista?tienda_codigo=${codigo}`);
      setDepartamentos(res.data);
    } catch (err) {
      console.error('Error cargando departamentos:', err);
    } finally {
      setCargandoDeptos(false);
    }
  };

  const calcularCoberturaTienda = async () => {
    if (!tiendaSel || !deptoSel || estadosCobertura.length === 0) return;
    setCargandoTienda(true);
    setDatosTienda(null);
    try {
      const res = await api.get(
        `/pais/cobertura-tienda?tienda_codigo=${tiendaSel}&departamento=${encodeURIComponent(deptoSel)}&estados=${encodeURIComponent(estadosCobertura.join(','))}`
      );
      setDatosTienda(res.data);
    } catch (err) {
      console.error('Error calculando cobertura:', err);
    } finally {
      setCargandoTienda(false);
    }
  };

  const exportarCoberturaTienda = async () => {
    if (!tiendaSel || !deptoSel || estadosCobertura.length === 0) return;
    setExportandoTienda(true);
    try {
      const res = await api.get(
        `/exportar/cobertura-tienda?tienda_codigo=${tiendaSel}&departamento=${encodeURIComponent(deptoSel)}&estados=${encodeURIComponent(estadosCobertura.join(','))}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cobertura_${nombreTienda(tiendaSel)}_${deptoSel}.xlsx`.replace(/\s+/g, '_'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando cobertura:', err);
    } finally {
      setExportandoTienda(false);
    }
  };

  // ── Comparar SKU ──────────────────────────────────────
  const buscarSku = async () => {
    if (!skuBuscado.trim()) return;
    setCargandoSku(true);
    setErrorSku('');
    setDatosSku(null);
    try {
      const res = await api.get(`/pais/cobertura-sku?sku=${skuBuscado.trim()}`);
      setDatosSku(res.data);
    } catch (err) {
      setErrorSku(err.response?.data?.detail || 'Error consultando el SKU');
    } finally {
      setCargandoSku(false);
    }
  };

  // ── Redistribución ────────────────────────────────────
  useEffect(() => {
    if (vista === 'redistribucion' && todosDepartamentos.length === 0) {
      cargarTodosDepartamentos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  const cargarTodosDepartamentos = async () => {
    if (tiendas.length === 0) return;
    try {
      const res = await api.get(`/pais/cobertura-tienda-departamentos-lista?tienda_codigo=${tiendas[0].codigo}`);
      setTodosDepartamentos(res.data.map(d => d.departamento));
    } catch (err) {
      console.error('Error cargando departamentos:', err);
    }
  };

  const buscarRedistribucion = async () => {
    if (!deptoRedistribucion || estadosRedistribucion.length === 0) return;
    setCargandoRedistribucion(true);
    setDatosRedistribucion(null);
    try {
      const res = await api.get(
        `/pais/redistribucion-departamento?departamento=${encodeURIComponent(deptoRedistribucion)}&estados=${encodeURIComponent(estadosRedistribucion.join(','))}`
      );
      setDatosRedistribucion(res.data);
    } catch (err) {
      console.error('Error buscando redistribución:', err);
    } finally {
      setCargandoRedistribucion(false);
    }
  };

  const exportarRedistribucion = async () => {
    if (!deptoRedistribucion || estadosRedistribucion.length === 0) return;
    setExportandoRedistribucion(true);
    try {
      const res = await api.get(
        `/exportar/redistribucion-departamento?departamento=${encodeURIComponent(deptoRedistribucion)}&estados=${encodeURIComponent(estadosRedistribucion.join(','))}`,
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Redistribucion_${deptoRedistribucion}.xlsx`.replace(/\s+/g, '_'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando redistribución:', err);
    } finally {
      setExportandoRedistribucion(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;
  const nombreTienda = (codigo) => tiendas.find(t => t.codigo === codigo)?.nombre || codigo;

  return (
    <div>
      <p style={styles.descripcion}>
        Cobertura de inventario — no solo lo que está en campaña, sino el catálogo completo.
        Tres vistas: por tienda, comparar un producto entre tiendas, y sugerencias de redistribución.
      </p>

      <div style={styles.tabs} role="tablist">
        {[
          { id: 'tienda', label: '🏪 Por Tienda' },
          { id: 'sku', label: '🔍 Comparar SKU' },
          { id: 'redistribucion', label: '🔄 Redistribución' },
        ].map(t => (
          <button
            key={t.id}
            className="pd-pressable"
            style={{ ...styles.tab, ...(vista === t.id ? { ...styles.tabActiva, color: colorAcento } : {}) }}
            onClick={() => setVista(t.id)}
            role="tab"
            aria-selected={vista === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════ POR TIENDA ══════ */}
      {vista === 'tienda' && (
        <div>
          <div style={styles.selectorCard}>
            <div className="pd-grid-2">
              <div>
                <label htmlFor="tienda-cobertura" style={styles.label}>Tienda</label>
                <select id="tienda-cobertura" className="pd-hoverable" style={styles.select} value={tiendaSel} onChange={(e) => cambiarTiendaSel(e.target.value)}>
                  <option value="">Seleccioná una tienda...</option>
                  {tiendas.map(t => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="depto-cobertura" style={styles.label}>Departamento</label>
                {!tiendaSel ? (
                  <p style={styles.cargandoTexto}>Elegí una tienda primero</p>
                ) : cargandoDeptos ? (
                  <p style={styles.cargandoTexto}>Cargando...</p>
                ) : (
                  <select id="depto-cobertura" className="pd-hoverable" style={styles.select} value={deptoSel} onChange={(e) => { setDeptoSel(e.target.value); setDatosTienda(null); }}>
                    <option value="">Seleccioná un departamento...</option>
                    {departamentos.map(d => <option key={d.departamento} value={d.departamento}>{d.departamento} ({d.total_skus})</option>)}
                  </select>
                )}
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <SelectorEstadosMultiple
                id="estados-cobertura"
                label="Estados del artículo"
                opciones={estadosDisponibles}
                seleccionados={estadosCobertura}
                onChange={setEstadosCobertura}
                colorAcento={colorAcento}
              />
            </div>

            <button
              className="pd-pressable"
              style={{ ...styles.btnCalcular, background: tema?.gradient || theme.color.gradient, opacity: cargandoTienda || !tiendaSel || !deptoSel || estadosCobertura.length === 0 ? 0.7 : 1 }}
              onClick={calcularCoberturaTienda}
              disabled={cargandoTienda || !tiendaSel || !deptoSel || estadosCobertura.length === 0}
            >
              {cargandoTienda ? '⏳ Calculando...' : '🔍 Ver cobertura'}
            </button>
          </div>

          {datosTienda && (
            <>
              <div style={styles.bandasResumen}>
                {Object.entries(datosTienda.resumen_bandas).map(([banda, cantidad]) => (
                  <div key={banda} style={{ ...styles.bandaCard, borderTop: `4px solid ${COLOR_BANDA[banda]}` }}>
                    <p style={{ ...styles.bandaValor, color: COLOR_BANDA[banda] }}>{cantidad}</p>
                    <p style={styles.bandaLabel}>{banda.charAt(0).toUpperCase() + banda.slice(1).replace('_', ' ')}</p>
                  </div>
                ))}
              </div>

              <div style={styles.accionesTabla}>
                <button
                  className="pd-pressable"
                  style={{ ...styles.btnExportar, color: colorAcento, borderColor: colorAcento, opacity: exportandoTienda ? 0.7 : 1 }}
                  onClick={exportarCoberturaTienda}
                  disabled={exportandoTienda}
                >
                  {exportandoTienda ? '⏳ Generando...' : '📥 Descargar Excel'}
                </button>
              </div>

              <div className="pd-table-scroll">
                <table style={styles.tabla}>
                  <caption style={styles.srOnly}>Cobertura de artículos por tienda y departamento</caption>
                  <thead>
                    <tr>
                      {['SKU', 'Descripción', 'Estado', 'Existencia', 'Consumo/mes', 'Cobertura', 'Banda'].map(h => (
                        <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {datosTienda.productos.map((p, i) => (
                      <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                        <td style={styles.td}><strong>{p.sku}</strong></td>
                        <td style={styles.td}>{p.descripcion}</td>
                        <td style={styles.td}>{p.estado}</td>
                        <td style={styles.td}>{p.existencia_actual.toLocaleString()}</td>
                        <td style={styles.td}>{p.consumo_mensual}</td>
                        <td style={styles.td}>{p.cobertura_meses != null ? `${p.cobertura_meses} m` : '—'}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.bandaBadge, background: COLOR_BANDA[p.banda] + '20', color: COLOR_BANDA[p.banda] }}>{p.banda_label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ COMPARAR SKU ══════ */}
      {vista === 'sku' && (
        <div>
          <div style={styles.selectorCard}>
            <label htmlFor="sku-comparar" style={styles.label}>SKU a comparar</label>
            <div style={styles.buscadorRow}>
              <input id="sku-comparar" className="pd-hoverable" style={styles.select} type="text" placeholder="Ej: 12345" value={skuBuscado} onChange={(e) => setSkuBuscado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscarSku()} />
              <button className="pd-pressable" style={{ ...styles.btnCalcularInline, background: tema?.gradient || theme.color.gradient, opacity: cargandoSku ? 0.7 : 1 }} onClick={buscarSku} disabled={cargandoSku}>
                {cargandoSku ? '⏳' : '🔍 Comparar'}
              </button>
            </div>
          </div>

          {errorSku && <div style={styles.errorBox} role="alert">⚠️ {errorSku}</div>}

          {datosSku && (
            <>
              <div style={{ ...styles.fichaCard, borderLeft: `4px solid ${colorAcento}` }}>
                <p style={styles.fichaSku}>SKU {datosSku.sku} — {datosSku.descripcion}</p>
                <p style={styles.fichaSub}>Existencia en bodega (nacional): {datosSku.existencia_bodega.toLocaleString()} uds</p>
              </div>

              <div className="pd-grid-4">
                {datosSku.tiendas.map((t, i) => (
                  <div key={i} className="pd-stagger-item" style={{ ...styles.cardTiendaSku, borderTop: `4px solid ${COLOR_BANDA[t.banda]}` }}>
                    <p style={styles.cardTiendaNombre}>{nombreTienda(t.tienda) || t.tienda}</p>
                    <p style={{ ...styles.cardTiendaCobertura, color: COLOR_BANDA[t.banda] }}>
                      {t.cobertura_meses != null ? `${t.cobertura_meses} m` : '—'}
                    </p>
                    <span style={{ ...styles.bandaBadge, background: COLOR_BANDA[t.banda] + '20', color: COLOR_BANDA[t.banda] }}>{t.banda_label}</span>
                    <div style={styles.cardTiendaDetalle}>
                      <p>Existencia: {t.existencia_actual.toLocaleString()}</p>
                      <p>Consumo/mes: {t.consumo_mensual}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ REDISTRIBUCIÓN ══════ */}
      {vista === 'redistribucion' && (
        <div>
          <div style={styles.selectorCard}>
            <label htmlFor="depto-redistribucion" style={styles.label}>Departamento</label>
            <select id="depto-redistribucion" className="pd-hoverable" style={styles.select} value={deptoRedistribucion} onChange={(e) => { setDeptoRedistribucion(e.target.value); setDatosRedistribucion(null); }}>
              <option value="">Seleccioná un departamento...</option>
              {todosDepartamentos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <div style={{ marginTop: '16px' }}>
              <SelectorEstadosMultiple
                id="estados-redistribucion"
                label="Estados del artículo"
                opciones={estadosDisponibles}
                seleccionados={estadosRedistribucion}
                onChange={setEstadosRedistribucion}
                colorAcento={colorAcento}
              />
            </div>

            <button
              className="pd-pressable"
              style={{ ...styles.btnCalcular, background: tema?.gradient || theme.color.gradient, opacity: cargandoRedistribucion || !deptoRedistribucion || estadosRedistribucion.length === 0 ? 0.7 : 1 }}
              onClick={buscarRedistribucion}
              disabled={cargandoRedistribucion || !deptoRedistribucion || estadosRedistribucion.length === 0}
            >
              {cargandoRedistribucion ? '⏳ Buscando...' : '🔄 Buscar'}
            </button>
          </div>

          {cargandoRedistribucion ? (
            <p style={styles.sinDatos}>Buscando oportunidades de redistribución...</p>
          ) : datosRedistribucion && datosRedistribucion.sugerencias.length === 0 ? (
            <div style={styles.cargando}>
              <span style={{ fontSize: '40px' }} aria-hidden="true">🤷</span>
              <p>No se encontraron oportunidades de redistribución en este departamento.</p>
            </div>
          ) : datosRedistribucion && (
            <>
              <div style={styles.accionesTabla}>
                <button
                  className="pd-pressable"
                  style={{ ...styles.btnExportar, color: colorAcento, borderColor: colorAcento, opacity: exportandoRedistribucion ? 0.7 : 1 }}
                  onClick={exportarRedistribucion}
                  disabled={exportandoRedistribucion}
                >
                  {exportandoRedistribucion ? '⏳ Generando...' : '📥 Descargar Excel'}
                </button>
              </div>

              <div style={styles.listaSugerencias}>
                {datosRedistribucion.sugerencias.map((s, i) => (
                  <div key={i} className="pd-stagger-item" style={styles.sugerenciaCard}>
                    <div style={styles.sugerenciaHeader}>
                      <span style={styles.sugerenciaSku}>SKU {s.sku}</span>
                      <span style={{ ...styles.sugerenciaUnidades, color: colorAcento }}>{s.unidades_sugeridas} uds sugeridas</span>
                    </div>
                    <div style={styles.sugerenciaFlujo}>
                      <div style={styles.sugerenciaTienda}>
                        <p style={styles.sugerenciaTiendaLabel}>Desde (exceso)</p>
                        <p style={styles.sugerenciaTiendaNombre}>{nombreTienda(s.tienda_origen)}</p>
                        <p style={styles.sugerenciaTiendaDato}>{s.disponible_origen.toLocaleString()} uds disponibles</p>
                      </div>
                      <span style={styles.sugerenciaFlecha} aria-hidden="true">→</span>
                      <div style={styles.sugerenciaTienda}>
                        <p style={styles.sugerenciaTiendaLabel}>Hacia (déficit)</p>
                        <p style={styles.sugerenciaTiendaNombre}>{nombreTienda(s.tienda_destino)}</p>
                        <p style={styles.sugerenciaTiendaDato}>{s.disponible_destino.toLocaleString()} uds disponibles</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px', lineHeight: '1.6' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '20px', background: theme.color.background, padding: '4px', borderRadius: theme.radius.lg, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' },
  tab: { padding: '10px 18px', borderRadius: theme.radius.md, border: 'none', background: 'transparent', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.textMuted, cursor: 'pointer', fontFamily: theme.font.family, whiteSpace: 'nowrap' },
  tabActiva: { background: theme.color.surface, boxShadow: theme.shadow.sm },

  selectorCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '18px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { flex: 1, width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  cargandoTexto: { color: theme.color.textMuted, fontSize: theme.font.size.sm, margin: '10px 0 0 0' },
  btnCalcular: { width: '100%', padding: '12px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '16px', fontFamily: theme.font.family },
  buscadorRow: { display: 'flex', gap: '10px' },
  btnCalcularInline: { padding: '10px 20px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '16px' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base },

  // ── Selector múltiple de estados ──────────────────────
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

  accionesTabla: { display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' },
  btnExportar: { display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: theme.color.surface, border: '1.5px solid', borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap' },

  bandasResumen: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '18px' },
  bandaCard: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '14px', textAlign: 'center', boxShadow: theme.shadow.sm },
  bandaValor: { fontSize: '26px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  bandaLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '4px 0 0 0', textTransform: 'capitalize' },
  bandaBadge: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap' },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '720px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },

  fichaCard: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '16px 20px', marginBottom: '18px', boxShadow: theme.shadow.sm },
  fichaSku: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  fichaSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0' },

  cardTiendaSku: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '16px', boxShadow: theme.shadow.sm, textAlign: 'center' },
  cardTiendaNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: '0 0 8px 0' },
  cardTiendaCobertura: { fontSize: '24px', fontWeight: theme.font.weight.black, margin: '0 0 6px 0' },
  cardTiendaDetalle: { fontSize: theme.font.size.xs, color: theme.color.textMuted, marginTop: '10px', lineHeight: '1.6' },

  listaSugerencias: { display: 'flex', flexDirection: 'column', gap: '12px' },
  sugerenciaCard: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '16px 20px', boxShadow: theme.shadow.sm },
  sugerenciaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  sugerenciaSku: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.text },
  sugerenciaUnidades: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.black },
  sugerenciaFlujo: { display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' },
  sugerenciaTienda: { flex: 1, textAlign: 'center', background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '10px' },
  sugerenciaTiendaLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '0 0 4px 0', textTransform: 'uppercase' },
  sugerenciaTiendaNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: '0 0 4px 0' },
  sugerenciaTiendaDato: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 },
  sugerenciaFlecha: { fontSize: '24px', color: theme.color.textMuted, flexShrink: 0 },
};

export default CoberturaInventario;