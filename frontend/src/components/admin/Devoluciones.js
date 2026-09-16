// ============================================================
// Componente: Devoluciones.js
// Descripción: Seguimiento de devoluciones tienda → CEDI. Carga
// masiva por Excel (una tienda por archivo), lista de pendientes
// con alertas recalculadas contra el catálogo actual, cierre con
// comentario obligatorio, e historial de cerradas.
// Exclusivo del rol Planning.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

const CONFIG_ESTADO = {
  excedente:      { color: '#DC2626', bg: '#FEF2F2', icono: '🚨', label: 'Excedente' },
  incompleta:     { color: '#D97706', bg: '#FFFBEB', icono: '⚠️', label: 'Incompleta' },
  sin_movimiento: { color: '#D97706', bg: '#FFFBEB', icono: '⚠️', label: 'Sin movimiento' },
  coincide:       { color: '#16A34A', bg: '#F0FDF4', icono: '✅', label: 'Coincide' },
  pendiente:      { color: '#6B7280', bg: '#F9FAFB', icono: '⏳', label: 'Pendiente' },
  sin_datos:      { color: '#6B7280', bg: '#F9FAFB', icono: '❓', label: 'Sin datos' },
};

function Devoluciones({ tema, usuario }) {
  const [vista, setVista] = useState('pendientes'); // 'pendientes' | 'cargar' | 'historial'

  const [pendientes, setPendientes] = useState([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(true);

  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const [tiendas, setTiendas] = useState([]);
  const [tiendaCarga, setTiendaCarga] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [cargandoCarga, setCargandoCarga] = useState(false);
  const [resultadoCarga, setResultadoCarga] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');

  const [devolucionCerrando, setDevolucionCerrando] = useState(null);
  const [comentarioCierre, setComentarioCierre] = useState('');
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  useEffect(() => {
    cargarPendientes();
    cargarTiendas();
  }, []);

  useEffect(() => {
    if (vista === 'historial') cargarHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  const cargarPendientes = async () => {
    setCargandoPendientes(true);
    try {
      const res = await api.get('/pais/devoluciones');
      setPendientes(res.data);
    } catch (err) {
      console.error('Error cargando devoluciones:', err);
    } finally {
      setCargandoPendientes(false);
    }
  };

  const cargarHistorial = async () => {
    setCargandoHistorial(true);
    try {
      const res = await api.get('/pais/devoluciones/historial');
      setHistorial(res.data);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const cargarTiendas = async () => {
    try {
      const res = await api.get(`/tiendas?pais=${usuario.pais}`);
      setTiendas(res.data);
      if (res.data.length > 0) setTiendaCarga(res.data[0].codigo);
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    }
  };

  const handleCargar = async () => {
    if (!archivo) { setErrorCarga('Seleccioná un archivo Excel'); return; }
    if (!tiendaCarga) { setErrorCarga('Seleccioná una tienda'); return; }
    setCargandoCarga(true);
    setErrorCarga('');
    setResultadoCarga(null);
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('tienda_codigo', tiendaCarga);
    try {
      const res = await api.post('/pais/devoluciones/cargar', formData);
      setResultadoCarga(res.data);
      setArchivo(null);
      document.getElementById('inputDevoluciones').value = '';
      cargarPendientes();
    } catch (err) {
      setErrorCarga(err.response?.data?.detail || 'Error cargando el archivo. Verificá el formato.');
    } finally {
      setCargandoCarga(false);
    }
  };

  const confirmarCierre = async () => {
    if (!comentarioCierre.trim()) return;
    setGuardandoCierre(true);
    try {
      await api.put(`/pais/devoluciones/${devolucionCerrando.id}/cerrar`, { comentario: comentarioCierre.trim() });
      setDevolucionCerrando(null);
      setComentarioCierre('');
      cargarPendientes();
    } catch (err) {
      console.error('Error cerrando devolución:', err);
    } finally {
      setGuardandoCierre(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;

  return (
    <div>
      <p style={styles.descripcion}>
        Seguimiento de devoluciones de tienda al CEDI — cargá el Excel con lo que se indicó devolver,
        y el sistema revisa contra el catálogo si realmente se movió esa cantidad.
      </p>

      <div style={styles.tabs} role="tablist">
        {[
          { id: 'pendientes', label: `🔔 Pendientes (${pendientes.length})` },
          { id: 'cargar', label: '📤 Cargar Devolución' },
          { id: 'historial', label: '📋 Historial' },
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

      {/* ── PENDIENTES ─────────────────────────────────── */}
      {vista === 'pendientes' && (
        cargandoPendientes ? (
          <div style={styles.cargando}>
            <span style={{ fontSize: '40px' }} aria-hidden="true">🔄</span>
            <p>Revisando devoluciones...</p>
          </div>
        ) : pendientes.length === 0 ? (
          <div style={styles.cargando}>
            <span style={{ fontSize: '40px' }} aria-hidden="true">🎉</span>
            <p>No hay devoluciones pendientes de revisión.</p>
          </div>
        ) : (
          <div style={styles.listaPendientes}>
            {pendientes.map((d) => {
              const cfg = CONFIG_ESTADO[d.estado] || CONFIG_ESTADO.sin_datos;
              return (
                <div key={d.id} className="pd-stagger-item" style={{ ...styles.cardDevolucion, borderLeft: `4px solid ${cfg.color}`, background: cfg.bg }}>
                  <div style={styles.cardHeader}>
                    <div>
                      <p style={styles.cardTitulo}>{cfg.icono} SKU {d.sku} — {d.descripcion}</p>
                      <p style={styles.cardSub}>
                        {tiendas.find(t => t.codigo === d.tienda_codigo)?.nombre || d.tienda_codigo} · Registrada hace {d.dias_transcurridos} día{d.dias_transcurridos !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ ...styles.estadoBadge, background: cfg.color, color: '#fff' }}>{cfg.label}</span>
                  </div>

                  <p style={{ ...styles.mensaje, color: cfg.color }}>{d.mensaje}</p>

                  <div style={styles.detalleGrid}>
                    <div style={styles.detalleItem}>
                      <p style={styles.detalleLabel}>Cantidad indicada</p>
                      <p style={styles.detalleValor}>{d.cantidad_indicada}</p>
                    </div>
                    <div style={styles.detalleItem}>
                      <p style={styles.detalleLabel}>Disponible al registrar</p>
                      <p style={styles.detalleValor}>{d.disponible_inicial ?? '—'}</p>
                    </div>
                    <div style={styles.detalleItem}>
                      <p style={styles.detalleLabel}>Disponible ahora</p>
                      <p style={styles.detalleValor}>{d.disponible_actual ?? '—'}</p>
                    </div>
                    <div style={styles.detalleItem}>
                      <p style={styles.detalleLabel}>Diferencia detectada</p>
                      <p style={{ ...styles.detalleValor, color: cfg.color, fontWeight: theme.font.weight.black }}>
                        {d.diferencia_tienda ?? '—'}
                      </p>
                    </div>
                  </div>

                  {d.nota_bodega && (
                    <p style={styles.notaBodega}>🏭 {d.nota_bodega}</p>
                  )}

                  <button
                    className="pd-pressable"
                    style={{ ...styles.btnCerrar, borderColor: colorAcento, color: colorAcento }}
                    onClick={() => { setDevolucionCerrando(d); setComentarioCierre(''); }}
                  >
                    ✔️ Marcar como revisada
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── CARGAR ─────────────────────────────────────── */}
      {vista === 'cargar' && (
        <div className="pd-grid-2">
          <div style={styles.card}>
            <h3 style={styles.cardTituloCarga}>📤 Cargar Excel de Devolución</h3>

            <div style={styles.campo}>
              <label htmlFor="tienda-devolucion" style={styles.label}>Tienda</label>
              <select
                id="tienda-devolucion"
                className="pd-hoverable"
                style={styles.select}
                value={tiendaCarga}
                onChange={(e) => setTiendaCarga(e.target.value)}
              >
                {tiendas.map(t => (
                  <option key={t.codigo} value={t.codigo}>{t.nombre}</option>
                ))}
              </select>
              <p style={styles.hint}>💡 El Excel es de una sola tienda — un archivo por sucursal.</p>
            </div>

            <div style={styles.campo}>
              <label htmlFor="inputDevoluciones" style={styles.label}>Archivo Excel</label>
              <div style={styles.dropZone}>
                <input
                  id="inputDevoluciones"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => { setArchivo(e.target.files[0]); setErrorCarga(''); setResultadoCarga(null); }}
                  style={styles.inputFile}
                  aria-label="Archivo Excel de devolución"
                />
                <div style={styles.dropTexto}>
                  {archivo ? (
                    <>
                      <span style={{ fontSize: '32px' }} aria-hidden="true">📄</span>
                      <p style={styles.dropNombre}>{archivo.name}</p>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '32px' }} aria-hidden="true">🔄</span>
                      <p style={styles.dropNombre}>Hacé clic para seleccionar</p>
                      <p style={styles.dropSize}>.xlsx o .xls</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {errorCarga && <div style={styles.errorBox} role="alert">⚠️ {errorCarga}</div>}

            {resultadoCarga && (
              <div style={styles.exitoBox}>
                <span style={{ fontSize: '24px' }} aria-hidden="true">✅</span>
                <div>
                  <p style={styles.exitoTitulo}>¡Devoluciones registradas!</p>
                  <p style={styles.exitoSub}>
                    {resultadoCarga.registros_cargados} registros cargados
                    {resultadoCarga.errores > 0 && ` · ${resultadoCarga.errores} filas con error omitidas`}
                  </p>
                </div>
              </div>
            )}

            <button
              className="pd-pressable"
              style={{ ...styles.btnCargar, background: tema?.gradient || theme.color.gradient, opacity: cargandoCarga || !archivo ? 0.7 : 1 }}
              onClick={handleCargar}
              disabled={cargandoCarga || !archivo}
            >
              {cargandoCarga ? '⏳ Cargando...' : '🔄 Cargar devolución'}
            </button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTituloCarga}>ℹ️ Formato esperado</h3>
            <div style={styles.columnas}>
              {['SKU', 'Descripcion', 'Existencia Actual', 'Cantidad a Devolver'].map(col => (
                <span key={col} style={styles.columnaTag}>{col}</span>
              ))}
            </div>
            <div style={styles.instrucciones}>
              {[
                { icon: '📦', texto: '"Existencia Actual" es el mismo dato que "Disponible" — el conteo real de la tienda al momento de registrar la devolución.' },
                { icon: '🔍', texto: 'El sistema revisa automáticamente si esa cantidad se movió, comparando contra el catálogo que se actualiza a diario.' },
                { icon: '⏱️', texto: 'Se da una ventana de 4 días antes de marcar una devolución como "sin movimiento".' },
                { icon: '🚨', texto: 'Cualquier cantidad devuelta de más (aunque sea 1 unidad) se marca como excedente — no hay margen de tolerancia.' },
              ].map((item, i) => (
                <div key={i} style={styles.instruccionItem}>
                  <span style={styles.instruccionIcon} aria-hidden="true">{item.icon}</span>
                  <p style={styles.instruccionTexto}>{item.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ──────────────────────────────────── */}
      {vista === 'historial' && (
        cargandoHistorial ? (
          <p style={styles.sinDatos}>Cargando historial...</p>
        ) : historial.length === 0 ? (
          <p style={styles.sinDatos}>Todavía no hay devoluciones cerradas.</p>
        ) : (
          <div className="pd-table-scroll">
            <table style={styles.tabla}>
              <caption style={styles.srOnly}>Historial de devoluciones cerradas</caption>
              <thead>
                <tr>
                  {['Tienda', 'SKU', 'Descripción', 'Cant. Indicada', 'Registrada', 'Cerrada', 'Comentario'].map(h => (
                    <th key={h} style={{ ...styles.th, background: colorAcento + '10', color: colorAcento }} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((h, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                    <td style={styles.td}>{tiendas.find(t => t.codigo === h.tienda_codigo)?.nombre || h.tienda_codigo}</td>
                    <td style={styles.td}><strong>{h.sku}</strong></td>
                    <td style={styles.td}>{h.descripcion}</td>
                    <td style={styles.td}>{h.cantidad_indicada}</td>
                    <td style={styles.td}>{new Date(h.fecha_registro).toLocaleDateString('es-CR')}</td>
                    <td style={styles.td}>{new Date(h.cerrada_en).toLocaleDateString('es-CR')}</td>
                    <td style={styles.td}>{h.comentario_cierre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── MODAL DE CIERRE ────────────────────────────── */}
      {devolucionCerrando && (
        <div className="pd-modal-overlay" style={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setDevolucionCerrando(null); }}>
          <div className="pd-modal-card" style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-cierre-titulo">
            <h3 id="modal-cierre-titulo" style={styles.modalTitulo}>✔️ Cerrar devolución — SKU {devolucionCerrando.sku}</h3>
            <p style={styles.modalTexto}>{devolucionCerrando.mensaje}</p>
            <div style={styles.campo}>
              <label htmlFor="comentario-cierre" style={styles.label}>¿Qué se concluyó? (obligatorio)</label>
              <textarea
                id="comentario-cierre"
                className="pd-hoverable"
                style={styles.textarea}
                placeholder="Ej: Confirmado con la tienda, se devolvieron 3 unidades por error de conteo inicial."
                value={comentarioCierre}
                onChange={(e) => setComentarioCierre(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnConfirmarCierre, background: tema?.gradient || theme.color.gradient, opacity: guardandoCierre || !comentarioCierre.trim() ? 0.7 : 1 }}
                onClick={confirmarCierre}
                disabled={guardandoCierre || !comentarioCierre.trim()}
              >
                {guardandoCierre ? 'Guardando...' : 'Confirmar cierre'}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={() => setDevolucionCerrando(null)}>Cancelar</button>
            </div>
          </div>
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
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base },

  listaPendientes: { display: 'flex', flexDirection: 'column', gap: '14px' },
  cardDevolucion: { borderRadius: theme.radius.lg, padding: '18px 20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' },
  cardTitulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  cardSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  estadoBadge: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, padding: '4px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap', textTransform: 'uppercase' },
  mensaje: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, margin: '0 0 14px 0' },

  detalleGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' },
  detalleItem: { background: theme.color.surface, borderRadius: theme.radius.sm, padding: '8px 10px', textAlign: 'center' },
  detalleLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '0 0 2px 0' },
  detalleValor: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },

  notaBodega: { fontSize: theme.font.size.xs, color: theme.color.textMuted, fontStyle: 'italic', margin: '0 0 12px 0', lineHeight: '1.5' },
  btnCerrar: { padding: '8px 16px', background: 'transparent', border: '1.5px solid', borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer' },

  card: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm },
  cardTituloCarga: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 20px 0' },
  campo: { marginBottom: '16px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  hint: { fontSize: theme.font.size.sm, color: theme.color.textMuted, marginTop: '6px', marginBottom: 0 },
  dropZone: { border: `2px dashed ${theme.color.dropBorder}`, borderRadius: theme.radius.md, padding: '24px', cursor: 'pointer', position: 'relative', background: theme.color.surfaceMuted },
  inputFile: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' },
  dropTexto: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', pointerEvents: 'none' },
  dropNombre: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.primary, margin: '4px 0 0 0' },
  dropSize: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '12px' },
  exitoBox: { display: 'flex', alignItems: 'center', gap: '12px', background: theme.color.successBg, border: `1px solid ${theme.color.successBorder}`, borderRadius: theme.radius.md, padding: '14px 16px', marginBottom: '12px' },
  exitoTitulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.success, margin: 0 },
  exitoSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  btnCargar: { width: '100%', padding: '14px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },

  columnas: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' },
  columnaTag: { background: theme.color.primary, color: theme.color.textOnPrimary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, padding: '4px 10px', borderRadius: theme.radius.pill, fontFamily: 'monospace' },
  instrucciones: { display: 'flex', flexDirection: 'column', gap: '14px' },
  instruccionItem: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  instruccionIcon: { fontSize: '20px', flexShrink: 0 },
  instruccionTexto: { fontSize: theme.font.size.sm, color: theme.color.textSecondary, margin: 0, lineHeight: '1.5' },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '800px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', boxSizing: 'border-box' },
  modal: { background: theme.color.surface, borderRadius: theme.radius.xxl, padding: 'clamp(16px, 4vw, 32px)', width: '100%', maxWidth: '480px', boxShadow: theme.shadow.modal },
  modalTitulo: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: '0 0 12px 0' },
  modalTexto: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 16px 0', lineHeight: '1.5' },
  textarea: { width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box', fontFamily: theme.font.family, resize: 'vertical' },
  btnConfirmarCierre: { flex: 1, padding: '12px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },
  btnCancelar: { padding: '12px 20px', background: theme.color.background, color: theme.color.primary, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.md, cursor: 'pointer', fontWeight: theme.font.weight.semibold },
};

export default Devoluciones;