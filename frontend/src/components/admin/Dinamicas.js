import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function Dinamicas() {
  const [dinamicas, setDinamicas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState(null);
  const [dinamicaSeleccionada, setDinamicaSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [filtroPais, setFiltroPais] = useState('');
  const mensajeTimerRef = useRef(null);

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);

  useEffect(() => {
    cargarDinamicas();
    cargarPaises();
    return () => clearTimeout(mensajeTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cierra el modal abierto con Escape
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modal]);

  const cargarDinamicas = async () => {
    setCargando(true);
    try {
      const res = await api.get('/admin/dinamicas');
      setDinamicas(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarPaises = async () => {
    try {
      const res = await api.get('/paises');
      setPaises(res.data);
    } catch (err) {
      console.error('Error cargando catálogo de países:', err);
    }
  };

  const abrirDetalle = async (d) => {
    setDinamicaSeleccionada(d);
    setDetalle(null);
    setCargandoDetalle(true);
    setModal('detalle');
    setFiltroPais('');
    try {
      const res = await api.get(`/admin/dinamicas/${d.id}/detalle`);
      setDetalle(res.data);
    } catch (err) {
      setError('Error cargando detalle');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const toggleDinamica = async (d) => {
    try {
      await api.put(`/admin/dinamicas/${d.id}/toggle`, {});
      cargarDinamicas();
      mostrarMensaje(`✅ Dinámica ${d.activa ? 'desactivada' : 'activada'} correctamente`);
    } catch (err) {
      mostrarMensaje('❌ Error actualizando dinámica');
    }
  };

  const eliminarDinamica = async () => {
    if (eliminando) return;
    setEliminando(true);
    try {
      await api.delete(`/admin/dinamicas/${dinamicaSeleccionada.id}`);
      setModal(null);
      cargarDinamicas();
      mostrarMensaje('✅ Dinámica eliminada correctamente');
    } catch (err) {
      setError('Error eliminando dinámica');
    } finally {
      setEliminando(false);
    }
  };

  const mostrarMensaje = (msg) => {
    setMensaje(msg);
    clearTimeout(mensajeTimerRef.current);
    mensajeTimerRef.current = setTimeout(() => setMensaje(''), 3000);
  };

  const dinamicasFiltradas = dinamicas.filter(d =>
    d.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  const articulosFiltrados = detalle?.articulos?.filter(a =>
    filtroPais ? a.pais === filtroPais : true
  ) || [];

  const diasRestantes = (fechaFin) => {
    const hoy = new Date();
    const fin = new Date(fechaFin);
    const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Colores de acento para las tarjetas de resumen — se asignan por
  // posición en el catálogo, no por código fijo, así funciona con
  // cualquier cantidad de países.
  const coloresResumen = [theme.color.successAccent, theme.color.warningBorder, theme.color.chart3, theme.color.chart4, theme.color.accent];

  return (
    <div>
      <p style={styles.descripcion}>
        Gestión de dinámicas comerciales. Podés ver el detalle, activar, desactivar y eliminar dinámicas.
      </p>

      {mensaje && <div style={styles.mensajeExito} role="status" aria-live="polite">{mensaje}</div>}

      {/* Barra de acciones */}
      <div style={styles.accionesRow}>
        <div style={styles.buscadorWrapper}>
          <span style={styles.buscadorIcon} aria-hidden="true">🔍</span>
          <label htmlFor="buscador-dinamicas" style={styles.srOnly}>Buscar dinámica</label>
          <input
            id="buscador-dinamicas"
            className="pd-hoverable"
            style={styles.buscador}
            type="text"
            placeholder="Buscar dinámica..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <button className="pd-pressable" style={styles.btnRefresh} onClick={cargarDinamicas}>
          🔄 Actualizar
        </button>
      </div>

      {/* Cards de dinámicas */}
      {cargando ? (
        <div style={styles.sinDatos}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span>
          <p>Cargando dinámicas...</p>
        </div>
      ) : dinamicasFiltradas.length === 0 ? (
        <div className="pd-stagger-item" style={styles.sinDatos}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📦</span>
          <p>No hay dinámicas registradas</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {dinamicasFiltradas.map((d, i) => {
            const dias = diasRestantes(d.fecha_fin);
            const vencida = dias < 0;
            const proxima = dias <= 7 && dias >= 0;

            return (
              <div
                key={d.id}
                className="pd-stagger-item"
                style={{
                  ...styles.card,
                  borderLeft: `4px solid ${d.activa ? theme.color.successAccent : theme.color.border}`,
                  animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                }}
              >
                {/* Header de la card */}
                <div style={styles.cardHeader}>
                  <div style={styles.cardTituloWrapper}>
                    <h3 style={styles.cardTitulo}>{d.nombre}</h3>
                    <span style={d.activa ? styles.activaBadge : styles.inactivaBadge}>
                      {d.activa ? '● Activa' : '● Inactiva'}
                    </span>
                  </div>
                  {d.descripcion && (
                    <p style={styles.cardDescripcion}>{d.descripcion}</p>
                  )}
                </div>

                {/* Info */}
                <div style={styles.cardInfo}>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Inicio</span>
                    <span style={styles.infoValor}>
                      {new Date(d.fecha_inicio).toLocaleDateString('es-CR')}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Fin</span>
                    <span style={styles.infoValor}>
                      {new Date(d.fecha_fin).toLocaleDateString('es-CR')}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Artículos</span>
                    <span style={{ ...styles.infoValor, fontWeight: theme.font.weight.black, color: theme.color.accent }}>
                      {d.total_articulos}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>
                      {vencida ? 'Vencida' : 'Días restantes'}
                    </span>
                    <span style={{
                      ...styles.infoValor,
                      color: vencida ? theme.color.error : proxima ? theme.color.warning : theme.color.success,
                      fontWeight: theme.font.weight.black,
                    }}>
                      {vencida ? 'Vencida' : `${dias} días`}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div style={styles.cardAcciones}>
                  <button className="pd-pressable" style={styles.btnVer} onClick={() => abrirDetalle(d)}>
                    👁️ Ver detalle
                  </button>
                  <button
                    className="pd-pressable"
                    style={d.activa ? styles.btnDesactivar : styles.btnActivar}
                    onClick={() => toggleDinamica(d)}
                  >
                    {d.activa ? '⏸️ Desactivar' : '▶️ Activar'}
                  </button>
                  <button
                    className="pd-pressable"
                    style={styles.btnEliminar}
                    onClick={() => { setDinamicaSeleccionada(d); setModal('eliminar'); }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle */}
      {modal === 'detalle' && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modalGrande}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-detalle-titulo"
          >
            <div style={styles.modalHeader}>
              <div style={{ minWidth: 0 }}>
                <h3 id="modal-detalle-titulo" style={styles.modalTitulo}>📦 {dinamicaSeleccionada?.nombre}</h3>
                <p style={styles.modalSub}>
                  {new Date(dinamicaSeleccionada?.fecha_inicio).toLocaleDateString('es-CR')} →{' '}
                  {new Date(dinamicaSeleccionada?.fecha_fin).toLocaleDateString('es-CR')}
                </p>
              </div>
              <button className="pd-pressable" style={styles.modalClose} onClick={() => setModal(null)} aria-label="Cerrar detalle">✕</button>
            </div>

            {cargandoDetalle ? (
              <div style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span>
                <p>Cargando artículos...</p>
              </div>
            ) : detalle && (
              <>
                {/* Resumen */}
                <div className="pd-grid-4" style={{ marginBottom: '16px' }}>
                  <div style={styles.resumenCard}>
                    <p style={{ ...styles.resumenValor, color: theme.color.accent }}>{detalle.articulos.length}</p>
                    <p style={styles.resumenLabel}>Total artículos</p>
                  </div>
                  {paises.map((p, i) => (
                    <div key={p.codigo} style={styles.resumenCard}>
                      <p style={{ ...styles.resumenValor, color: coloresResumen[i % coloresResumen.length] }}>
                        {detalle.articulos.filter(a => a.pais === p.codigo).length}
                      </p>
                      <p style={styles.resumenLabel}>{p.codigo}</p>
                    </div>
                  ))}
                </div>

                {/* Filtro por país */}
                <div style={styles.filtroPaisRow} role="group" aria-label="Filtrar artículos por país">
                  <button
                    className="pd-pressable"
                    style={{
                      ...styles.filtroPaisBtn,
                      ...(filtroPais === '' ? styles.filtroPaisBtnActivo : {})
                    }}
                    onClick={() => setFiltroPais('')}
                    aria-pressed={filtroPais === ''}
                  >
                    🌎 Todos
                  </button>
                  {paises.map(p => (
                    <button
                      key={p.codigo}
                      className="pd-pressable"
                      style={{
                        ...styles.filtroPaisBtn,
                        ...(filtroPais === p.codigo ? styles.filtroPaisBtnActivo : {})
                      }}
                      onClick={() => setFiltroPais(p.codigo)}
                      aria-pressed={filtroPais === p.codigo}
                    >
                      {p.bandera} {p.codigo}
                    </button>
                  ))}
                  <span style={styles.totalFiltrado}>
                    {articulosFiltrados.length} artículos
                  </span>
                </div>

                {/* Tabla de artículos */}
                <div className="pd-table-scroll" style={styles.tablaWrapper}>
                  <table style={styles.tabla}>
                    <caption style={styles.srOnly}>Artículos de la dinámica {dinamicaSeleccionada?.nombre}</caption>
                    <thead>
                      <tr>
                        {['Código', 'Descripción', 'Categoría', 'P. Regular', 'P. Dinámica', 'Ahorro', 'Ubicación', 'Tienda', 'País'].map(h => (
                          <th key={h} style={styles.th} scope="col">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {articulosFiltrados.map((a, i) => (
                        <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                          <td style={styles.td}><strong>{a.codigo}</strong></td>
                          <td style={styles.td}>{a.descripcion}</td>
                          <td style={styles.td}>{a.categoria || '-'}</td>
                          <td style={styles.td}>${a.precio_regular?.toFixed(2)}</td>
                          <td style={{ ...styles.td, color: theme.color.accent, fontWeight: theme.font.weight.bold }}>
                            ${a.precio_dinamica?.toFixed(2)}
                          </td>
                          <td style={{ ...styles.td, color: theme.color.success, fontWeight: theme.font.weight.bold }}>
                            ${a.ahorro?.toFixed(2)}
                          </td>
                          <td style={styles.td}>{a.ubicacion || '-'}</td>
                          <td style={styles.td}>{a.tienda || '-'}</td>
                          <td style={styles.td}>
                            <span style={styles.paisBadge}>{a.pais}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="pd-pressable" style={styles.btnCerrar} onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {modal === 'eliminar' && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div
            className="pd-modal-card"
            style={{ ...styles.modal, maxWidth: '420px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-eliminar-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-eliminar-titulo" style={styles.modalTitulo}>🗑️ Eliminar Dinámica</h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={() => setModal(null)} aria-label="Cerrar">✕</button>
            </div>
            <div style={styles.eliminarBox}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">⚠️</span>
              <p style={styles.eliminarTexto}>
                ¿Estás seguro que querés eliminar <strong>{dinamicaSeleccionada?.nombre}</strong>?
                Se eliminarán todos los artículos asociados. Esta acción no se puede deshacer.
              </p>
            </div>
            {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}
            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnEliminarConfirm, opacity: eliminando ? 0.7 : 1, cursor: eliminando ? 'not-allowed' : 'pointer' }}
                onClick={eliminarDinamica}
                disabled={eliminando}
              >
                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={() => setModal(null)} disabled={eliminando}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  mensajeExito: {
    background: theme.color.successBg, border: `1px solid ${theme.color.successBorder}`, borderRadius: theme.radius.sm,
    padding: '12px 16px', color: theme.color.success, fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, marginBottom: '16px',
  },
  accionesRow: { display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' },
  buscadorWrapper: { flex: '1 1 220px', position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: theme.font.size.xl },
  buscador: {
    width: '100%', padding: '12px 12px 12px 44px', borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none',
    fontFamily: theme.font.family, background: theme.color.surface, boxSizing: 'border-box',
  },
  btnRefresh: {
    padding: '12px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md, fontSize: theme.font.size.base, cursor: 'pointer', color: theme.color.primary,
    fontWeight: theme.font.weight.semibold, whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))',
    gap: '16px',
  },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xl,
    padding: '20px', boxShadow: theme.shadow.sm,
  },
  cardHeader: { marginBottom: '16px' },
  cardTituloWrapper: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' },
  cardTitulo: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: 0, flex: 1 },
  cardDescripcion: { fontSize: theme.font.size.base, color: theme.color.textMuted, margin: 0 },
  activaBadge: {
    background: theme.color.successBg, color: theme.color.success, fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap',
  },
  inactivaBadge: {
    background: theme.color.background, color: theme.color.textMuted, fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap',
  },
  cardInfo: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px', marginBottom: '16px',
    background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '12px',
  },
  infoItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  infoLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, fontWeight: theme.font.weight.bold, textTransform: 'uppercase' },
  infoValor: { fontSize: theme.font.size.base, color: theme.color.text, fontWeight: theme.font.weight.semibold },
  cardAcciones: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  btnVer: {
    flex: '1 1 100px', padding: '8px 12px', background: theme.color.accentSoft,
    border: `1px solid ${theme.color.accentSoftBorder}`, borderRadius: theme.radius.sm,
    cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.primary,
  },
  btnActivar: {
    flex: '1 1 100px', padding: '8px 12px', background: theme.color.successBg,
    border: `1px solid ${theme.color.successBorder}`, borderRadius: theme.radius.sm,
    cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.success,
  },
  btnDesactivar: {
    flex: '1 1 100px', padding: '8px 12px', background: theme.color.warningSoftBg,
    border: `1px solid ${theme.color.warningSoftBorder}`, borderRadius: theme.radius.sm,
    cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.warningStrong,
  },
  btnEliminar: {
    flex: '1 1 100px', padding: '8px 12px', background: theme.color.errorBg,
    border: `1px solid ${theme.color.errorSoftBorder}`, borderRadius: theme.radius.sm,
    cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.error,
  },
  sinDatos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px', color: theme.color.textMuted, fontSize: theme.font.size.md, gap: '12px',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    padding: '16px', boxSizing: 'border-box',
  },
  modalGrande: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, padding: 'clamp(16px, 4vw, 32px)',
    width: '100%', maxWidth: '1000px', maxHeight: '85vh',
    overflow: 'auto', boxShadow: theme.shadow.modal,
  },
  modal: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, padding: 'clamp(16px, 4vw, 32px)',
    width: '100%', maxWidth: '480px', boxShadow: theme.shadow.modal,
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '20px', gap: '12px',
  },
  modalTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: 0 },
  modalSub: { fontSize: theme.font.size.base, color: theme.color.textMuted, margin: '4px 0 0 0' },
  modalClose: { background: 'none', border: 'none', fontSize: theme.font.size.xl, cursor: 'pointer', color: theme.color.textMuted, flexShrink: 0 },
  resumenCard: {
    background: theme.color.background, borderRadius: theme.radius.md,
    padding: '14px', textAlign: 'center',
  },
  resumenValor: { fontSize: '28px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  resumenLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0' },
  filtroPaisRow: {
    display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap',
  },
  filtroPaisBtn: {
    padding: '6px 14px', background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.pill, cursor: 'pointer', fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.textSecondary,
  },
  filtroPaisBtnActivo: {
    background: theme.color.primary, color: theme.color.textOnPrimary, border: `1px solid ${theme.color.primary}`,
  },
  totalFiltrado: { fontSize: theme.font.size.base, color: theme.color.textMuted, marginLeft: 'auto' },
  tablaWrapper: { maxHeight: '400px', overflowY: 'auto' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '720px' },
  th: {
    padding: '10px 12px', background: theme.color.background, color: theme.color.primary,
    fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    position: 'sticky', top: 0, whiteSpace: 'nowrap',
  },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
  paisBadge: {
    background: theme.color.accentSoft, color: theme.color.primary, fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold, padding: '2px 8px', borderRadius: theme.radius.pill,
  },
  modalBotones: { display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' },
  btnCancelar: {
    flex: '1 1 120px', padding: '12px', background: theme.color.background, color: theme.color.textMuted,
    border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.md, cursor: 'pointer',
  },
  btnCerrar: {
    padding: '10px 24px', background: theme.color.primary, color: theme.color.textOnPrimary,
    border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold, cursor: 'pointer',
  },
  eliminarBox: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', padding: '20px 0', gap: '16px',
  },
  eliminarTexto: { fontSize: theme.font.size.lg, color: theme.color.textSecondary, lineHeight: '1.6' },
  btnEliminarConfirm: {
    flex: '1 1 120px', padding: '12px', background: theme.color.error, color: theme.color.textOnPrimary,
    border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer',
  },
  errorBox: {
    background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm,
    padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginTop: '16px',
  },
};

export default Dinamicas;