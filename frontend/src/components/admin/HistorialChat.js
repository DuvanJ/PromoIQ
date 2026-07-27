// ============================================================
// Componente: HistorialChat.js
// Descripción: Historial de consultas al chat con IA
// Filtrado por rol: superadmin=todo, admin=país, otros=propio
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';

const BANDERAS = {
  CR: '🇨🇷', GT: '🇬🇹', SV: '🇸🇻', '': '🌎'
};

function HistorialChat({ tema }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [filtroPais, setFiltroPais] = useState('');

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const rol = usuario.rol;
  const colorPrimario = tema?.primary || '#1E2761';

  useEffect(() => {
    cargarHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (cargando) return (
    <div style={styles.cargando}>
      <span style={{ fontSize: '48px' }}>💬</span>
      <p>Cargando historial...</p>
    </div>
  );

  if (!datos) return (
    <div style={styles.cargando}>
      <span style={{ fontSize: '48px' }}>❌</span>
      <p>Error cargando el historial</p>
    </div>
  );

  return (
    <div>
      <p style={styles.descripcion}>{tituloSegunRol}</p>

      {/* Estadísticas */}
      <div style={styles.statsGrid}>
        {[
          { label: 'Total consultas', valor: datos.stats.total_consultas, icon: '💬', color: colorPrimario },
          { label: 'Tokens consumidos', valor: datos.stats.total_tokens.toLocaleString(), icon: '⚡', color: '#06847A' },
          { label: 'Costo estimado', valor: `$${datos.stats.costo_estimado}`, icon: '💲', color: '#B45309' },
          { label: 'Mostrando', valor: consultasFiltradas.length, icon: '📋', color: '#B91C1C' },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statIcono, background: s.color + '15' }}>
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
          <span style={styles.buscadorIcon}>🔍</span>
          <input
            style={styles.buscador}
            type="text"
            placeholder="Buscar por usuario o pregunta..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        {/* Filtro por país — solo para superadmin */}
        {rol === 'superadmin' && (
          <select
            style={styles.selectFiltro}
            value={filtroPais}
            onChange={(e) => setFiltroPais(e.target.value)}
          >
            <option value="">🌎 Todos los países</option>
            <option value="CR">🇨🇷 Costa Rica</option>
            <option value="GT">🇬🇹 Guatemala</option>
            <option value="SV">🇸🇻 El Salvador</option>
          </select>
        )}

        <button style={{ ...styles.btnRefresh, color: colorPrimario }} onClick={cargarHistorial}>
          🔄 Actualizar
        </button>
      </div>

      {/* Lista de consultas */}
      {consultasFiltradas.length === 0 ? (
        <div style={styles.sinDatos}>
          <span style={{ fontSize: '48px' }}>📭</span>
          <p>No hay consultas que coincidan</p>
        </div>
      ) : (
        <div style={styles.lista}>
          {consultasFiltradas.map((c, i) => (
            <div
              key={c.id}
              style={{
                ...styles.consultaCard,
                borderLeft: `4px solid ${colorPrimario}`,
                cursor: 'pointer',
              }}
              onClick={() => setConsultaSeleccionada(c)}
            >
              {/* Header de la consulta */}
              <div style={styles.consultaHeader}>
                <div style={styles.usuarioWrapper}>
                  <div style={{ ...styles.usuarioAvatar, background: colorPrimario }}>
                    {c.usuario?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={styles.usuarioNombre}>{c.usuario}</p>
                    <p style={styles.usuarioRol}>{c.rol}</p>
                  </div>
                </div>

                <div style={styles.metaWrapper}>
                  {BANDERAS[c.pais] && (
                    <span style={styles.bandera}>{BANDERAS[c.pais]}</span>
                  )}
                  <span style={{ ...styles.tokenBadge, background: colorPrimario + '15', color: colorPrimario }}>
                    ⚡ {c.tokens} tokens
                  </span>
                  <span style={styles.fecha}>
                    {new Date(c.fecha).toLocaleString('es-CR')}
                  </span>
                </div>
              </div>

              {/* Pregunta */}
              <div style={styles.preguntaWrapper}>
                <span style={styles.preguntaIcono}>❓</span>
                <p style={styles.preguntaTexto}>
                  {c.pregunta?.length > 120
                    ? c.pregunta.substring(0, 120) + '...'
                    : c.pregunta}
                </p>
              </div>

              {/* Preview respuesta */}
              <div style={styles.respuestaPreview}>
                <span style={styles.respuestaIcono}>🤖</span>
                <p style={styles.respuestaTexto}>
                  {c.respuesta?.replace(/[#*`]/g, '').substring(0, 100)}...
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
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>

            {/* Header del modal */}
            <div style={{ ...styles.modalHeader, background: tema?.gradient || colorPrimario }}>
              <div style={styles.modalHeaderLeft}>
                <div style={styles.modalAvatar}>
                  {consultaSeleccionada.usuario?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={styles.modalUsuario}>{consultaSeleccionada.usuario}</p>
                  <p style={styles.modalMeta}>
                    {consultaSeleccionada.rol} · {BANDERAS[consultaSeleccionada.pais]} · {new Date(consultaSeleccionada.fecha).toLocaleString('es-CR')}
                  </p>
                </div>
              </div>
              <div style={styles.modalHeaderRight}>
                <span style={styles.modalTokens}>⚡ {consultaSeleccionada.tokens} tokens</span>
                <button style={styles.modalClose} onClick={() => setConsultaSeleccionada(null)}>✕</button>
              </div>
            </div>

            {/* Conversación */}
            <div style={styles.conversacion}>

              {/* Pregunta del usuario */}
              <div style={styles.mensajeUsuarioWrapper}>
                <div style={styles.mensajeUsuario}>
                  <p style={styles.mensajeLabel}>👤 {consultaSeleccionada.usuario}</p>
                  <p style={styles.mensajeTexto}>{consultaSeleccionada.pregunta}</p>
                </div>
              </div>

              {/* Respuesta de la IA */}
              <div style={styles.mensajeIAWrapper}>
                <div style={styles.iaIcono}>🤖</div>
                <div style={styles.mensajeIA}>
                  <p style={styles.mensajeLabel}>PromoIQ IA</p>
                  <div style={styles.respuestaMarkdown}>
                    <ReactMarkdown>{consultaSeleccionada.respuesta}</ReactMarkdown>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div style={styles.modalFooter}>
              <div style={styles.modalStats}>
                <span>📅 {new Date(consultaSeleccionada.fecha).toLocaleString('es-CR')}</span>
                <span>⚡ {consultaSeleccionada.tokens} tokens consumidos</span>
                <span>💲 ~${(consultaSeleccionada.tokens * 0.000003).toFixed(4)} USD</span>
              </div>
              <button
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
  descripcion: { fontSize: '14px', color: '#8892A4', marginBottom: '20px' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#8892A4', fontSize: '16px', gap: '16px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' },
  statCard: { background: '#ffffff', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  statIcono: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValor: { fontSize: '24px', fontWeight: '900', margin: 0, lineHeight: 1 },
  statLabel: { fontSize: '12px', color: '#8892A4', margin: '4px 0 0 0' },
  filtrosRow: { display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' },
  buscadorWrapper: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: '16px' },
  buscador: { width: '100%', padding: '12px 12px 12px 44px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', fontFamily: 'Calibri, sans-serif', background: '#ffffff', boxSizing: 'border-box' },
  selectFiltro: { padding: '12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', background: '#ffffff', color: '#333' },
  btnRefresh: { padding: '12px 16px', background: '#F4F7FB', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' },
  sinDatos: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#8892A4', fontSize: '14px', gap: '12px' },
  lista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  consultaCard: { background: '#ffffff', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', transition: 'box-shadow 0.2s' },
  consultaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  usuarioWrapper: { display: 'flex', alignItems: 'center', gap: '10px' },
  usuarioAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', flexShrink: 0 },
  usuarioNombre: { fontSize: '14px', fontWeight: '700', color: '#1E2761', margin: 0 },
  usuarioRol: { fontSize: '11px', color: '#8892A4', margin: '2px 0 0 0' },
  metaWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
  bandera: { fontSize: '20px' },
  tokenBadge: { fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' },
  fecha: { fontSize: '12px', color: '#8892A4' },
  preguntaWrapper: { display: 'flex', gap: '10px', alignItems: 'flex-start', background: '#F4F7FB', borderRadius: '10px', padding: '12px', marginBottom: '8px' },
  preguntaIcono: { fontSize: '16px', flexShrink: 0 },
  preguntaTexto: { fontSize: '13px', color: '#333', fontWeight: '600', margin: 0, lineHeight: '1.5' },
  respuestaPreview: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 12px' },
  respuestaIcono: { fontSize: '16px', flexShrink: 0 },
  respuestaTexto: { fontSize: '12px', color: '#8892A4', margin: 0, lineHeight: '1.5', fontStyle: 'italic' },
  verMasWrapper: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  verMas: { fontSize: '12px', fontWeight: '700', cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#ffffff', borderRadius: '16px', width: '680px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', flexShrink: 0 },
  modalHeaderLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  modalAvatar: { width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700' },
  modalUsuario: { fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: 0 },
  modalMeta: { fontSize: '12px', color: 'rgba(255,255,255,0.75)', margin: '2px 0 0 0' },
  modalHeaderRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  modalTokens: { background: 'rgba(255,255,255,0.2)', color: '#ffffff', fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' },
  modalClose: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  conversacion: { flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#F8FAFC' },
  mensajeUsuarioWrapper: { display: 'flex', justifyContent: 'flex-end' },
  mensajeUsuario: { background: 'linear-gradient(135deg, #1E2761, #0077B6)', color: '#ffffff', borderRadius: '16px 16px 4px 16px', padding: '14px 18px', maxWidth: '75%' },
  mensajeIAWrapper: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  iaIcono: { width: '36px', height: '36px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 },
  mensajeIA: { background: '#ffffff', borderRadius: '4px 16px 16px 16px', padding: '14px 18px', maxWidth: '80%', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flex: 1 },
  mensajeLabel: { fontSize: '11px', fontWeight: '700', color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  mensajeTexto: { fontSize: '14px', color: '#ffffff', margin: 0, lineHeight: '1.5' },
  respuestaMarkdown: { fontSize: '14px', color: '#333', lineHeight: '1.7' },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #E2E8F0', flexShrink: 0 },
  modalStats: { display: 'flex', gap: '16px', fontSize: '12px', color: '#8892A4' },
  btnCerrar: { padding: '10px 24px', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
};

export default HistorialChat;