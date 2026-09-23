// ============================================================
// Componente: HistorialChat.js
// Descripción: Historial de consultas al chat con IA
// Filtrado por rol: superadmin=todo, admin=país, otros=propio
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

// Limpia sintaxis markdown para mostrar texto plano en la vista previa
function limpiarMarkdown(texto) {
  if (!texto) return '';
  return texto
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
}

function HistorialChat({ tema }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [filtroPais, setFiltroPais] = useState('');
  const [paises, setPaises] = useState([]);

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const rol = usuario.rol;
  const colorPrimario = tema?.primary || theme.color.primary;

  useEffect(() => {
    cargarHistorial();
    cargarPaises();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!consultaSeleccionada) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setConsultaSeleccionada(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [consultaSeleccionada]);

  const cargarHistorial = async () => {
    setCargando(true);
    try {
      const res = await api.get('/pais/historial-chat');
      setDatos(res.data);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarPaises = async () => {
    try {
      const res = await api.get('/paises');
      setPaises(res.data || []);
    } catch (err) {
      console.error('Error cargando países:', err);
    }
  };

  const getBandera = (codigo) => {
    if (!codigo) return '🌎';
    return paises.find(p => p.codigo === codigo)?.bandera || '';
  };

  const consultasFiltradas = datos?.consultas?.filter(c => {
    const matchTexto =
      c.pregunta?.toLowerCase().includes(filtro.toLowerCase()) ||
      c.usuario?.toLowerCase().includes(filtro.toLowerCase());
    const matchPais = filtroPais ? c.pais === filtroPais : true;
    return matchTexto && matchPais;
  }) || [];

  const tituloSegunRol = {
    superadmin: 'Historial completo — Todos los países',
    admin:      `Historial de consultas — ${usuario.pais || ''}`,
    comercial:  'Mis consultas al asistente IA',
    planning:   'Mis consultas al asistente IA',
    tiendas:    'Mis consultas al asistente IA',
  }[rol] || 'Historial de consultas';

  const instruccionSegunRol = {
    superadmin: 'Todas las consultas que cualquier usuario le hizo a la IA, en los tres países. Filtrá por país con el selector, o buscá por usuario/pregunta.',
    admin:      'Todas las consultas que los usuarios de tu país le hicieron a la IA. Hacé clic en cualquier tarjeta para ver la conversación completa.',
  }[rol] || 'Tus consultas anteriores al asistente IA — hacé clic en cualquiera para volver a ver la conversación completa.';

  if (cargando) return (
    <div style={styles.cargando}>
      <span style={{ fontSize: '48px' }} aria-hidden="true">💬</span>
      <p>Cargando historial...</p>
    </div>
  );

  if (!datos) return (
    <div style={styles.cargando}>
      <span style={{ fontSize: '48px' }} aria-hidden="true">❌</span>
      <p>Error cargando el historial</p>
    </div>
  );

  return (
    <div>
      <InstruccionesModulo id="historial-chat" texto={instruccionSegunRol} />

      <p style={styles.descripcion}>{tituloSegunRol}</p>

      {/* Estadísticas */}
      <div className="pd-grid-4" style={{ marginBottom: '20px' }}>
        {[
          { label: 'Total consultas', valor: datos.stats.total_consultas, icon: '💬', color: colorPrimario },
          { label: 'Tokens consumidos', valor: datos.stats.total_tokens.toLocaleString(), icon: '⚡', color: theme.color.successStrong },
          { label: 'Costo estimado (USD)', valor: `$${datos.stats.costo_estimado}`, icon: '💲', color: theme.color.warning },
          { label: 'Mostrando', valor: consultasFiltradas.length, icon: '📋', color: theme.color.error },
        ].map((s, i) => (
          <div key={i} className="pd-stagger-item" style={{ ...styles.statCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
            <div style={{ ...styles.statIcono, background: s.color + '15' }} aria-hidden="true">
              <span style={{ fontSize: '24px' }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ ...styles.statValor, color: s.color }}>{s.valor}</p>
              <p style={styles.statLabel}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={styles.filtrosRow}>
        <div style={styles.buscadorWrapper}>
          <span style={styles.buscadorIcon} aria-hidden="true">🔍</span>
          <label htmlFor="buscador-historial-chat" style={styles.srOnly}>Buscar por usuario o pregunta</label>
          <input
            id="buscador-historial-chat"
            className="pd-hoverable"
            style={styles.buscador}
            type="text"
            placeholder="Buscar por usuario o pregunta..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        {rol === 'superadmin' && (
          <>
            <label htmlFor="filtro-pais-historial" style={styles.srOnly}>Filtrar por país</label>
            <select
              id="filtro-pais-historial"
              className="pd-hoverable"
              style={styles.selectFiltro}
              value={filtroPais}
              onChange={(e) => setFiltroPais(e.target.value)}
            >
              <option value="">🌎 Todos los países</option>
              {paises.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.label || `${p.bandera} ${p.nombre}`}
                </option>
              ))}
            </select>
          </>
        )}

        <button className="pd-pressable" style={{ ...styles.btnRefresh, color: colorPrimario }} onClick={cargarHistorial}>
          🔄 Actualizar
        </button>
      </div>

      {/* Lista de consultas */}
      {consultasFiltradas.length === 0 ? (
        <div style={styles.sinDatos}>
          <span style={{ fontSize: '48px' }} aria-hidden="true">📭</span>
          <p>No hay consultas que coincidan</p>
        </div>
      ) : (
        <div style={styles.lista}>
          {consultasFiltradas.map((c, i) => (
            <div
              key={c.id}
              className="pd-pressable pd-hoverable pd-stagger-item"
              style={{
                ...styles.consultaCard,
                borderLeft: `4px solid ${colorPrimario}`,
                cursor: 'pointer',
                animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
              }}
              onClick={() => setConsultaSeleccionada(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setConsultaSeleccionada(c); } }}
              aria-label={`Ver conversación completa de ${c.usuario}`}
            >
              <div style={styles.consultaHeader}>
                <div style={styles.usuarioWrapper}>
                  <div style={{ ...styles.usuarioAvatar, background: colorPrimario }} aria-hidden="true">
                    {c.usuario?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={styles.usuarioNombre}>{c.usuario}</p>
                    <p style={styles.usuarioRol}>{c.rol}</p>
                  </div>
                </div>

                <div style={styles.metaWrapper}>
                  {getBandera(c.pais) && (
                    <span style={styles.bandera} aria-hidden="true">{getBandera(c.pais)}</span>
                  )}
                  <span style={{ ...styles.tokenBadge, background: colorPrimario + '15', color: colorPrimario }}>
                    ⚡ {c.tokens} tokens
                  </span>
                  <span style={styles.fecha}>
                    {new Date(c.fecha).toLocaleString('es-CR')}
                  </span>
                </div>
              </div>

              <div style={styles.preguntaWrapper}>
                <span style={styles.preguntaIcono} aria-hidden="true">❓</span>
                <p style={styles.preguntaTexto}>
                  {c.pregunta?.length > 120
                    ? c.pregunta.substring(0, 120) + '...'
                    : c.pregunta}
                </p>
              </div>

              <div style={styles.respuestaPreview}>
                <span style={styles.respuestaIcono} aria-hidden="true">🤖</span>
                <p style={styles.respuestaTexto}>
                  {limpiarMarkdown(c.respuesta).substring(0, 100)}...
                </p>
              </div>

              <div style={styles.verMasWrapper}>
                <span style={{ ...styles.verMas, color: colorPrimario }}>
                  Ver conversación completa →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de conversación completa */}
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
            aria-labelledby="modal-historialchat-titulo"
          >

            <div style={{ ...styles.modalHeader, background: tema?.gradient || colorPrimario }}>
              <div style={styles.modalHeaderLeft}>
                <div style={styles.modalAvatar} aria-hidden="true">
                  {consultaSeleccionada.usuario?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p id="modal-historialchat-titulo" style={styles.modalUsuario}>{consultaSeleccionada.usuario}</p>
                  <p style={styles.modalMeta}>
                    {consultaSeleccionada.rol} · {getBandera(consultaSeleccionada.pais)} · {new Date(consultaSeleccionada.fecha).toLocaleString('es-CR')}
                  </p>
                </div>
              </div>
              <div style={styles.modalHeaderRight}>
                <span className="pd-hide-mobile" style={styles.modalTokens}>⚡ {consultaSeleccionada.tokens} tokens</span>
                <button
                  className="pd-pressable"
                  style={styles.modalClose}
                  onClick={() => setConsultaSeleccionada(null)}
                  aria-label="Cerrar conversación"
                >✕</button>
              </div>
            </div>

            <div style={styles.conversacion} aria-live="polite">

              <div style={styles.mensajeUsuarioWrapper}>
                <div style={styles.mensajeUsuario}>
                  <p style={styles.mensajeLabel}>👤 {consultaSeleccionada.usuario}</p>
                  <p style={styles.mensajeTexto}>{consultaSeleccionada.pregunta}</p>
                </div>
              </div>

              <div style={styles.mensajeIAWrapper}>
                <div style={styles.iaIcono} aria-hidden="true">🤖</div>
                <div style={styles.mensajeIA}>
                  <p style={styles.mensajeLabel}>PromoIQ IA</p>
                  <div style={styles.respuestaMarkdown}>
                    <ReactMarkdown>{consultaSeleccionada.respuesta}</ReactMarkdown>
                  </div>
                </div>
              </div>

            </div>

            <div style={styles.modalFooter}>
              <div style={styles.modalStats}>
                <span>📅 {new Date(consultaSeleccionada.fecha).toLocaleString('es-CR')}</span>
                <span>⚡ {consultaSeleccionada.tokens} tokens consumidos</span>
                <span>💲 ~${(consultaSeleccionada.tokens * 0.000003).toFixed(4)} USD</span>
              </div>
              <button
                className="pd-pressable"
                style={{ ...styles.btnCerrar, background: colorPrimario }}
                onClick={() => setConsultaSeleccionada(null)}
              >
                Cerrar
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
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: theme.color.textMuted, fontSize: theme.font.size.xl, gap: '16px' },
  statCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: theme.shadow.sm },
  statIcono: { width: '48px', height: '48px', borderRadius: theme.radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValor: { fontSize: '24px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  statLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0' },
  filtrosRow: { display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' },
  buscadorWrapper: { flex: '1 1 220px', position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: theme.font.size.xl },
  buscador: { width: '100%', padding: '12px 12px 12px 44px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none', fontFamily: theme.font.family, background: theme.color.surface, boxSizing: 'border-box' },
  selectFiltro: { padding: '12px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, outline: 'none', background: theme.color.surface, color: theme.color.text },
  btnRefresh: { padding: '12px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.base, cursor: 'pointer', fontWeight: theme.font.weight.semibold, whiteSpace: 'nowrap' },
  sinDatos: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: theme.color.textMuted, fontSize: theme.font.size.md, gap: '12px' },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  consultaCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm },
  consultaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' },
  usuarioWrapper: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  usuarioAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  usuarioNombre: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0 },
  usuarioRol: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  metaWrapper: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  bandera: { fontSize: '20px' },
  tokenBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 8px', borderRadius: theme.radius.pill },
  fecha: { fontSize: theme.font.size.sm, color: theme.color.textMuted },
  preguntaWrapper: { display: 'flex', gap: '10px', alignItems: 'flex-start', background: theme.color.background, borderRadius: theme.radius.md, padding: '12px', marginBottom: '8px' },
  preguntaIcono: { fontSize: theme.font.size.xl, flexShrink: 0 },
  preguntaTexto: { fontSize: theme.font.size.base, color: theme.color.text, fontWeight: theme.font.weight.semibold, margin: 0, lineHeight: '1.5' },
  respuestaPreview: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 12px' },
  respuestaIcono: { fontSize: theme.font.size.xl, flexShrink: 0 },
  respuestaTexto: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, lineHeight: '1.5', fontStyle: 'italic' },
  verMasWrapper: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  verMas: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', boxSizing: 'border-box' },
  modal: { background: theme.color.surface, borderRadius: theme.radius.xxl, width: '100%', maxWidth: '680px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: theme.shadow.modal },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', flexShrink: 0, gap: '8px' },
  modalHeaderLeft: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
  modalAvatar: { width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  modalUsuario: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.black, color: theme.color.textOnPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  modalMeta: { fontSize: theme.font.size.sm, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  modalHeaderRight: { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 },
  modalTokens: { background: 'rgba(255,255,255,0.2)', color: theme.color.textOnPrimary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '4px 10px', borderRadius: theme.radius.pill },
  modalClose: { background: 'rgba(255,255,255,0.2)', border: 'none', color: theme.color.textOnPrimary, width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: theme.font.size.xl, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  conversacion: { flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: theme.color.surfaceMuted },
  mensajeUsuarioWrapper: { display: 'flex', justifyContent: 'flex-end' },
  mensajeUsuario: { background: theme.color.gradient, color: theme.color.textOnPrimary, borderRadius: '16px 16px 4px 16px', padding: '14px 18px', maxWidth: '85%' },
  mensajeIAWrapper: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  iaIcono: { width: '36px', height: '36px', borderRadius: '50%', background: theme.color.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xxl, flexShrink: 0 },
  mensajeIA: { background: theme.color.surface, borderRadius: '4px 16px 16px 16px', padding: '14px 18px', maxWidth: '88%', boxShadow: theme.shadow.md, flex: 1 },
  mensajeLabel: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  mensajeTexto: { fontSize: theme.font.size.md, color: theme.color.textOnPrimary, margin: 0, lineHeight: '1.5' },
  respuestaMarkdown: { fontSize: theme.font.size.md, color: theme.color.text, lineHeight: '1.7' },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: `1px solid ${theme.color.border}`, flexShrink: 0, flexWrap: 'wrap', gap: '12px' },
  modalStats: { display: 'flex', gap: '16px', fontSize: theme.font.size.sm, color: theme.color.textMuted, flexWrap: 'wrap' },
  btnCerrar: { padding: '10px 24px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer' },
};

export default HistorialChat;