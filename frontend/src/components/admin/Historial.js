import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

const ACCION_LABEL = {
  eliminar: 'Eliminar',
  eliminar_masivo: 'Eliminar (masivo)',
  desactivar: 'Desactivar',
  crear: 'Crear',
  editar: 'Editar',
};

const ACCION_ICONO = {
  eliminar: '🗑️',
  eliminar_masivo: '⚠️',
  desactivar: '🚫',
  crear: '➕',
  editar: '✏️',
};

function Historial() {
  const [tabActiva, setTabActiva] = useState('consultas'); // 'consultas' | 'auditoria'

  // ── Consultas IA ───────────────────────────────────────
  const [consultas, setConsultas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState('');

  // ── Auditoría ────────────────────────────────────────────
  const [auditoria, setAuditoria] = useState([]);
  const [cargandoAuditoria, setCargandoAuditoria] = useState(true);
  const [paginaAuditoria, setPaginaAuditoria] = useState(1);
  const [totalPaginasAuditoria, setTotalPaginasAuditoria] = useState(1);
  const [filtroPaisAuditoria, setFiltroPaisAuditoria] = useState('');
  const [filtroAccionAuditoria, setFiltroAccionAuditoria] = useState('');

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);

  useEffect(() => {
    cargarHistorial();
    cargarPaises();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tabActiva === 'auditoria') {
      cargarAuditoria(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva]);

  // Cierra el modal de detalle con Escape
  useEffect(() => {
    if (!consultaSeleccionada) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setConsultaSeleccionada(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [consultaSeleccionada]);

  const cargarHistorial = async () => {
    try {
      const res = await api.get('/admin/historial');
      setConsultas(res.data);
    } catch (err) {
      console.error('Error cargando historial:', err);
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

  const cargarAuditoria = async (pagina = 1) => {
    setCargandoAuditoria(true);
    try {
      const params = new URLSearchParams({ pagina, por_pagina: 30 });
      if (filtroPaisAuditoria) params.append('pais', filtroPaisAuditoria);
      if (filtroAccionAuditoria) params.append('accion', filtroAccionAuditoria);
      const res = await api.get(`/admin/auditoria?${params}`);
      setAuditoria(res.data.registros);
      setPaginaAuditoria(res.data.pagina);
      setTotalPaginasAuditoria(res.data.total_paginas || 1);
    } catch (err) {
      console.error('Error cargando auditoría:', err);
    } finally {
      setCargandoAuditoria(false);
    }
  };

  const consultasFiltradas = consultas.filter(c =>
    c.pregunta?.toLowerCase().includes(filtro.toLowerCase()) ||
    c.usuario?.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalTokens = consultas.reduce((acc, c) => acc + (c.tokens || 0), 0);
  const costoEstimado = ((totalTokens * 0.000003)).toFixed(4);

  // Busca el label completo (bandera + nombre) de un código de país
  const labelPais = (codigo) => {
    if (!codigo) return '—';
    const encontrado = paises.find(p => p.codigo === codigo);
    return encontrado ? encontrado.label : codigo;
  };

  return (
    <div>
      {tabActiva === 'consultas' && (
        <InstruccionesModulo
          id="historial-consultas"
          texto="Todas las preguntas que los usuarios le hicieron a la IA, con el costo real en tokens. El costo estimado siempre se muestra en dólares (USD), porque así factura Anthropic — sin importar el país del usuario que consultó."
        />
      )}
      {tabActiva === 'auditoria' && (
        <InstruccionesModulo
          id="historial-auditoria"
          texto="Registro de acciones destructivas o administrativas — quién eliminó, desactivó, creó o editó qué, y cuándo. Usalo para investigar cambios inesperados en el sistema."
        />
      )}

      <p style={styles.descripcion}>
        {tabActiva === 'consultas'
          ? 'Registro completo de todas las consultas realizadas a la IA por los usuarios del sistema.'
          : 'Registro de acciones administrativas destructivas: eliminaciones y cambios masivos.'}
      </p>

      {/* Tabs */}
      <div style={styles.tabs} role="tablist">
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'consultas' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('consultas')}
          role="tab"
          aria-selected={tabActiva === 'consultas'}
        >
          💬 Consultas IA
        </button>
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'auditoria' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('auditoria')}
          role="tab"
          aria-selected={tabActiva === 'auditoria'}
        >
          🛡️ Auditoría
        </button>
      </div>

      {/* ── TAB CONSULTAS IA ──────────────────────────── */}
      {tabActiva === 'consultas' && (
        <div role="tabpanel">
          {/* Métricas rápidas */}
          <div className="pd-grid-3" style={{ marginBottom: '20px' }}>
            {[
              { label: 'Total consultas', valor: consultas.length, icon: '💬', color: theme.color.accent },
              { label: 'Tokens usados', valor: totalTokens.toLocaleString(), icon: '⚡', color: theme.color.successAccent },
              { label: 'Costo estimado (USD)', valor: `$${costoEstimado}`, icon: '💲', color: theme.color.warningBorder },
            ].map((m, i) => (
              <div key={i} className="pd-stagger-item" style={{ ...styles.metricaCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                <span style={styles.metricaIcon} aria-hidden="true">{m.icon}</span>
                <div>
                  <p style={{ ...styles.metricaValor, color: m.color }}>{m.valor}</p>
                  <p style={styles.metricaLabel}>{m.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Buscador */}
          <div style={styles.buscadorRow}>
            <div style={styles.buscadorWrapper}>
              <span style={styles.buscadorIcon} aria-hidden="true">🔍</span>
              <label htmlFor="buscador-historial" style={styles.srOnly}>Buscar por usuario o pregunta</label>
              <input
                id="buscador-historial"
                className="pd-hoverable"
                style={styles.buscador}
                type="text"
                placeholder="Buscar por usuario o pregunta..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
            <button className="pd-pressable" style={styles.btnRefresh} onClick={cargarHistorial}>
              🔄 Actualizar
            </button>
          </div>

          {/* Tabla */}
          <div style={styles.card}>
            {cargando ? (
              <div style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span>
                <p>Cargando historial...</p>
              </div>
            ) : consultasFiltradas.length === 0 ? (
              <div className="pd-stagger-item" style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }} aria-hidden="true">📭</span>
                <p>No hay consultas registradas</p>
              </div>
            ) : (
              <div className="pd-table-scroll">
                <table style={styles.tabla}>
                  <caption style={styles.srOnly}>Historial de consultas a la IA</caption>
                  <thead>
                    <tr>
                      {['#', 'Usuario', 'Pregunta', 'Tokens', 'Fecha', 'Ver'].map(h => (
                        <th key={h} style={styles.th} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {consultasFiltradas.map((c, i) => (
                      <tr
                        key={i}
                        style={i % 2 === 0 ? styles.trPar : styles.trImpar}
                      >
                        <td style={styles.td}>{c.id}</td>
                        <td style={styles.td}>
                          <div style={styles.usuarioCell}>
                            <div style={styles.avatar} aria-hidden="true">
                              {(c.usuario || 'U').charAt(0).toUpperCase()}
                            </div>
                            {c.usuario || 'Desconocido'}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {c.pregunta?.length > 60
                            ? c.pregunta.substring(0, 60) + '...'
                            : c.pregunta}
                        </td>
                        <td style={styles.td}>
                          <span style={styles.tokenBadge}>{c.tokens || 0}</span>
                        </td>
                        <td style={styles.td}>
                          {new Date(c.fecha).toLocaleString('es-CR')}
                        </td>
                        <td style={styles.td}>
                          <button
                            className="pd-pressable"
                            style={styles.btnVer}
                            onClick={() => setConsultaSeleccionada(c)}
                            aria-label={`Ver detalle de la consulta de ${c.usuario || 'usuario desconocido'}`}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB AUDITORÍA ─────────────────────────────── */}
      {tabActiva === 'auditoria' && (
        <div role="tabpanel">
          <div style={styles.buscadorRow}>
            <select
              className="pd-hoverable"
              style={styles.filtroSelect}
              value={filtroPaisAuditoria}
              onChange={(e) => { setFiltroPaisAuditoria(e.target.value); }}
              aria-label="Filtrar por país"
            >
              <option value="">Todos los países</option>
              {paises.map(p => (
                <option key={p.codigo} value={p.codigo}>{p.label}</option>
              ))}
            </select>
            <select
              className="pd-hoverable"
              style={styles.filtroSelect}
              value={filtroAccionAuditoria}
              onChange={(e) => { setFiltroAccionAuditoria(e.target.value); }}
              aria-label="Filtrar por tipo de acción"
            >
              <option value="">Todas las acciones</option>
              <option value="eliminar">Eliminar</option>
              <option value="eliminar_masivo">Eliminar (masivo)</option>
              <option value="desactivar">Desactivar</option>
              <option value="crear">Crear</option>
              <option value="editar">Editar</option>
            </select>
            <button className="pd-pressable" style={styles.btnRefresh} onClick={() => cargarAuditoria(1)}>
              🔍 Filtrar
            </button>
          </div>

          <div style={styles.card}>
            {cargandoAuditoria ? (
              <div style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span>
                <p>Cargando auditoría...</p>
              </div>
            ) : auditoria.length === 0 ? (
              <div className="pd-stagger-item" style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }} aria-hidden="true">📭</span>
                <p>No hay acciones registradas</p>
              </div>
            ) : (
              <>
                <div className="pd-table-scroll">
                  <table style={styles.tabla}>
                    <caption style={styles.srOnly}>Registro de auditoría de acciones administrativas</caption>
                    <thead>
                      <tr>
                        {['Usuario', 'Acción', 'Entidad', 'País', 'Detalle', 'Fecha'].map(h => (
                          <th key={h} style={styles.th} scope="col">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditoria.map((a, i) => (
                        <tr key={a.id} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                          <td style={styles.td}>
                            <div style={styles.usuarioCell}>
                              <div style={styles.avatar} aria-hidden="true">
                                {(a.usuario || 'U').charAt(0).toUpperCase()}
                              </div>
                              {a.usuario || 'Desconocido'}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                              ...styles.accionBadge,
                              background: a.accion === 'eliminar_masivo' ? theme.color.errorBg : theme.color.accentSoft,
                              color: a.accion === 'eliminar_masivo' ? theme.color.error : theme.color.primary,
                            }}>
                              {ACCION_ICONO[a.accion] || '•'} {ACCION_LABEL[a.accion] || a.accion}
                            </span>
                          </td>
                          <td style={styles.td}>{a.entidad}{a.entidad_id ? ` #${a.entidad_id}` : ''}</td>
                          <td style={styles.td}>{labelPais(a.pais)}</td>
                          <td style={styles.td}>{a.detalle || '—'}</td>
                          <td style={styles.td}>{new Date(a.fecha).toLocaleString('es-CR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={styles.paginacion}>
                  <button className="pd-pressable" style={styles.btnPagina} disabled={paginaAuditoria <= 1} onClick={() => cargarAuditoria(paginaAuditoria - 1)}>← Anterior</button>
                  <span style={{ color: theme.color.textMuted, fontSize: theme.font.size.sm }}>Página {paginaAuditoria} de {totalPaginasAuditoria}</span>
                  <button className="pd-pressable" style={styles.btnPagina} disabled={paginaAuditoria >= totalPaginasAuditoria} onClick={() => cargarAuditoria(paginaAuditoria + 1)}>Siguiente →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal detalle — solo aplica a consultas IA */}
      {consultaSeleccionada && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConsultaSeleccionada(null); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-historial-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-historial-titulo" style={styles.modalTitulo}>Detalle de consulta</h3>
              <button
                className="pd-pressable"
                style={styles.modalClose}
                onClick={() => setConsultaSeleccionada(null)}
                aria-label="Cerrar detalle"
              >
                ✕
              </button>
            </div>

            <div style={styles.modalInfo}>
              <span><strong>Usuario:</strong> {consultaSeleccionada.usuario}</span>
              <span><strong>Tokens:</strong> {consultaSeleccionada.tokens}</span>
              <span><strong>Fecha:</strong> {new Date(consultaSeleccionada.fecha).toLocaleString('es-CR')}</span>
            </div>

            <div style={styles.preguntaBox}>
              <p style={styles.boxLabel}>Pregunta</p>
              <p style={styles.preguntaTexto}>{consultaSeleccionada.pregunta}</p>
            </div>

            <div style={styles.respuestaBox}>
              <p style={styles.boxLabel}>Respuesta de la IA</p>
              <p style={styles.respuestaTexto}>{consultaSeleccionada.respuesta}</p>
            </div>

            <button
              className="pd-pressable"
              style={styles.btnCerrar}
              onClick={() => setConsultaSeleccionada(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '20px', background: theme.color.background, padding: '4px', borderRadius: theme.radius.lg, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' },
  tab: { padding: '10px 20px', borderRadius: theme.radius.md, border: 'none', background: 'transparent', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.textMuted, cursor: 'pointer', fontFamily: theme.font.family, whiteSpace: 'nowrap' },
  tabActiva: { background: theme.color.surface, color: theme.color.primary, boxShadow: theme.shadow.sm },
  metricaCard: {
    background: theme.color.surface, borderRadius: theme.radius.lg, padding: '20px',
    display: 'flex', alignItems: 'center', gap: '16px', boxShadow: theme.shadow.sm,
  },
  metricaIcon: { fontSize: '32px' },
  metricaValor: { fontSize: '28px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  metricaLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0' },
  buscadorRow: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  buscadorWrapper: { flex: '1 1 220px', position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: theme.font.size.xl },
  buscador: {
    width: '100%', padding: '12px 12px 12px 44px', borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none',
    fontFamily: theme.font.family, background: theme.color.surface, boxSizing: 'border-box',
  },
  filtroSelect: {
    padding: '12px 14px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`,
    fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surface,
    outline: 'none', flex: '1 1 180px',
  },
  btnRefresh: {
    padding: '12px 20px', background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md, fontSize: theme.font.size.base, cursor: 'pointer', color: theme.color.primary,
    fontWeight: theme.font.weight.semibold, whiteSpace: 'nowrap',
  },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xl,
    padding: '0', boxShadow: theme.shadow.sm, overflow: 'hidden',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '620px' },
  th: {
    padding: '12px 16px', background: theme.color.background, color: theme.color.primary,
    fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm,
    textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 16px', color: '#444444', borderBottom: `1px solid ${theme.color.background}`, verticalAlign: 'middle' },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
  usuarioCell: { display: 'flex', alignItems: 'center', gap: '8px' },
  avatar: {
    width: '28px', height: '28px', borderRadius: '50%', background: theme.color.primary,
    color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, flexShrink: 0,
  },
  tokenBadge: {
    background: theme.color.accentSoft, color: theme.color.primary, fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold, padding: '3px 8px', borderRadius: theme.radius.pill,
  },
  accionBadge: {
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px',
    borderRadius: theme.radius.pill, whiteSpace: 'nowrap', display: 'inline-block',
  },
  btnVer: {
    padding: '5px 12px', background: theme.color.accentSoft, border: 'none',
    borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold, color: theme.color.primary,
  },
  paginacion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', flexWrap: 'wrap', gap: '8px' },
  btnPagina: {
    padding: '8px 14px', background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm, color: theme.color.primary, fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold, cursor: 'pointer',
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
  modal: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, padding: 'clamp(16px, 4vw, 32px)',
    width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', boxShadow: theme.shadow.modal,
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' },
  modalTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: theme.font.size.xl, cursor: 'pointer', color: theme.color.textMuted, flexShrink: 0 },
  modalInfo: {
    display: 'flex', gap: '20px', background: theme.color.background, borderRadius: theme.radius.sm,
    padding: '12px 16px', marginBottom: '16px', fontSize: theme.font.size.base, color: theme.color.textSecondary, flexWrap: 'wrap',
  },
  preguntaBox: { background: theme.color.accentSoft, borderRadius: theme.radius.md, padding: '16px', marginBottom: '12px' },
  respuestaBox: { background: theme.color.successBg, borderRadius: theme.radius.md, padding: '16px', marginBottom: '20px' },
  boxLabel: {
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, textTransform: 'uppercase',
    letterSpacing: '0.5px', color: theme.color.textMuted, margin: '0 0 8px 0',
  },
  preguntaTexto: { fontSize: theme.font.size.md, color: theme.color.primary, fontWeight: theme.font.weight.semibold, margin: 0 },
  respuestaTexto: { fontSize: theme.font.size.base, color: theme.color.text, lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' },
  btnCerrar: {
    width: '100%', padding: '12px', background: theme.color.primary, color: theme.color.textOnPrimary,
    border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer',
  },
};

export default Historial;
