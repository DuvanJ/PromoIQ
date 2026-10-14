// ============================================================
// Componente: AsistentePersonalizado.js
// Descripción: Asistente IA personalizado con diseño premium
// Roles: Comercial y Planning
// Responsive: el panel de conversaciones se convierte en un
// drawer superpuesto (con overlay) en pantallas < 1024px.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';
import { theme } from '../../styles/theme';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { breakpoints } from '../../styles/breakpoints';
import InstruccionesModulo from '../InstruccionesModulo';

const PASOS_POR_ROL = {
  comercial: [
    (nombre) => `${nombre} está revisando tus ventas y dinámicas activas`,
    () => 'Cruzando artículos con el catálogo',
    (nombre) => `${nombre} está armando tu respuesta`,
  ],
  planning: [
    (nombre) => `${nombre} está revisando trazabilidad`,
    () => 'Verificando duplicados y vencimientos',
    (nombre) => `${nombre} está armando tu respuesta`,
  ],
};

function AsistentePersonalizado({ tema, usuario, paisSeleccionado, paisLabel }) {
  const esMobile = useMediaQuery(`(max-width: ${breakpoints.lg - 1}px)`);
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true);
  const [creandoConversacion, setCreandoConversacion] = useState(false);
  const [perfil, setPerfil] = useState(null);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [modalEmail, setModalEmail] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [guardandoEmail, setGuardandoEmail] = useState(false);
  const [bienvenida, setBienvenida] = useState(null);
  const [cargandoBienvenida, setCargandoBienvenida] = useState(true);
  const [nombreAsistente, setNombreAsistente] = useState('PromoIQ IA');
  const [nivelDetalle, setNivelDetalle] = useState('detallado');
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [pasoActivo, setPasoActivo] = useState(0);
  const chatRef = useRef(null);
  const timersRef = useRef([]);
  const montadoRef = useRef(true);

  const colorPrimario = tema?.primary || theme.color.primary;
  const gradiente = tema?.gradient || theme.color.gradient;
  const rol = usuario.rol;
  const nombre = usuario.nombre;

  // En pantallas chicas el panel arranca cerrado (es un drawer superpuesto)
  useEffect(() => {
    if (esMobile) setPanelAbierto(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sugeridosPorRol = {
    comercial: [
      '¿Qué artículos vendieron más este mes?',
      '¿Cuáles categorías tuvieron mejor rendimiento?',
      '¿Qué artículos estuvieron en isla en la última dinámica?',
      'Analizá el impacto de las campañas activas',
    ],
    planning: [
      '¿Hay artículos duplicados en dinámicas activas?',
      '¿Qué tiendas no tienen artículos registrados?',
      '¿Cuáles dinámicas vencen esta semana?',
      'Dame trazabilidad completa de los artículos activos',
    ],
  };

  const sugeridas = sugeridosPorRol[rol] || sugeridosPorRol['comercial'];
  const pasosCarga = (PASOS_POR_ROL[rol] || PASOS_POR_ROL['comercial']).map(fn => fn(nombreAsistente));

  const nivelesDetalle = [
    { value: 'rapido', label: '⚡ Rápido', desc: 'Respuestas cortas y directas' },
    { value: 'detallado', label: '📊 Detallado', desc: 'Análisis completo con contexto' },
    { value: 'experto', label: '🎯 Experto', desc: 'Máximo detalle y recomendaciones' },
  ];

  useEffect(() => {
    montadoRef.current = true;
    cargarTodo();
    return () => { montadoRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes, cargando, pasoActivo]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (cargando) {
      setPasoActivo(0);
      timersRef.current.push(setTimeout(() => setPasoActivo(1), 500));
      timersRef.current.push(setTimeout(() => setPasoActivo(2), 1100));
    }

    return () => timersRef.current.forEach(clearTimeout);
  }, [cargando]);

  // Cierra cualquier modal abierto, o el panel en modo drawer, con Escape
  useEffect(() => {
    if (!modalEmail && !modalConfig && !(esMobile && panelAbierto)) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalEmail) omitirEmail();
        if (modalConfig) setModalConfig(false);
        if (esMobile && panelAbierto) setPanelAbierto(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEmail, modalConfig, esMobile, panelAbierto]);

  const cargarTodo = async () => {
    setCargandoConversaciones(true);
    setCargandoBienvenida(true);

    const [resConv, resPerfil, resBienvenida] = await Promise.allSettled([
      api.get('/asistente/conversaciones'),
      api.get('/asistente/perfil/completo'),
      api.post('/asistente/bienvenida', {})
    ]);

    if (!montadoRef.current) return;

    if (resConv.status === 'fulfilled') {
      setConversaciones(resConv.value.data.conversaciones);
    } else {
      console.error('Error cargando conversaciones:', resConv.reason);
    }

    if (resPerfil.status === 'fulfilled') {
      setPerfil(resPerfil.value.data);
      if (resPerfil.value.data.solicitar_email && !resPerfil.value.data.email_notificaciones) {
        setTimeout(() => { if (montadoRef.current) setModalEmail(true); }, 2000);
      }
    } else {
      console.error('Error cargando perfil:', resPerfil.reason);
    }

    if (resBienvenida.status === 'fulfilled') {
      setBienvenida(resBienvenida.value.data);
      setNombreAsistente(resBienvenida.value.data.nombre_asistente || 'PromoIQ IA');
    } else {
      console.error('Error cargando bienvenida:', resBienvenida.reason);
    }

    setCargandoConversaciones(false);
    setCargandoBienvenida(false);
  };

  const nombrePersonalizado = perfil?.nombre_completo || nombre;

  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const guardarEmail = async () => {
    if (!emailInput.trim()) { setEmailError('Ingresá tu email corporativo'); return; }
    if (!emailInput.includes('@')) { setEmailError('El email no es válido'); return; }
    setGuardandoEmail(true);
    setEmailError('');
    try {
      const res = await api.post('/asistente/perfil/email', { email: emailInput });
      setPerfil(prev => ({
        ...prev,
        email_notificaciones: emailInput,
        email_confirmado: true,
        solicitar_email: false,
        nombre_completo: res.data.nombre_extraido
      }));
      setModalEmail(false);
    } catch (err) {
      setEmailError('Error guardando el email.');
    } finally {
      setGuardandoEmail(false);
    }
  };

  const omitirEmail = async () => {
    try {
      await api.post('/asistente/perfil/omitir-email', {});
      setPerfil(prev => ({ ...prev, solicitar_email: false }));
      setModalEmail(false);
    } catch (err) {
      setModalEmail(false);
    }
  };

  const guardarPersonalizacion = async () => {
    setGuardandoConfig(true);
    try {
      await api.post('/asistente/perfil/personalizacion', {
        nombre_asistente: nombreAsistente,
        nivel_detalle: nivelDetalle
      });
      setModalConfig(false);
    } catch (err) {
      console.error('Error guardando config:', err);
    } finally {
      setGuardandoConfig(false);
    }
  };

  const abrirConversacion = async (conv) => {
    setConversacionActiva(conv);
    setMensajes([]);
    if (esMobile) setPanelAbierto(false); // en mobile, elegir conversación cierra el drawer
    try {
      const res = await api.get(`/asistente/conversaciones/${conv.id}/mensajes`);
      setMensajes(res.data);
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    }
  };

  const nuevaConversacion = async () => {
    if (creandoConversacion) return;
    setCreandoConversacion(true);
    try {
      const res = await api.post('/asistente/conversaciones/nueva', {});
      const nueva = res.data;
      setConversaciones(prev => [{ ...nueva, total_mensajes: 0 }, ...prev]);
      setConversacionActiva(nueva);
      setMensajes([]);
      if (esMobile) setPanelAbierto(false);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCreandoConversacion(false);
    }
  };

  const eliminarConversacion = async (e, convId) => {
    e.stopPropagation();
    try {
      await api.delete(`/asistente/conversaciones/${convId}`);
      setConversaciones(prev => prev.filter(c => c.id !== convId));
      if (conversacionActiva?.id === convId) {
        setConversacionActiva(null);
        setMensajes([]);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const enviarMensaje = async (textoPregunta) => {
    const texto = textoPregunta || pregunta;
    if (!texto.trim() || cargando || creandoConversacion) return;

    let convActual = conversacionActiva;

    if (!convActual) {
      setCreandoConversacion(true);
      try {
        const res = await api.post('/asistente/conversaciones/nueva', {});
        convActual = res.data;
        setConversaciones(prev => [{ ...convActual, total_mensajes: 0 }, ...prev]);
        setConversacionActiva(convActual);
      } catch (err) {
        setCreandoConversacion(false);
        setMensajes(prev => [...prev, {
          rol: 'ia',
          contenido: '❌ No pude iniciar la conversación. Intentá de nuevo.',
          fecha: new Date().toISOString()
        }]);
        return;
      }
      setCreandoConversacion(false);
    }

    const mensajeUsuario = { rol: 'usuario', contenido: texto, fecha: new Date().toISOString() };
    setMensajes(prev => [...prev, mensajeUsuario]);
    setPregunta('');
    setCargando(true);

      try {
      const body = { pregunta: texto };
      if (usuario.rol === 'superadmin') {
        body.pais_seleccionado = paisSeleccionado;
      }
      const res = await api.post(
        `/asistente/conversaciones/${convActual.id}/mensaje`,
        body
      );
      setMensajes(prev => [...prev, {
        rol: 'ia',
        contenido: res.data.respuesta,
        tokens: res.data.tokens_usados,
        fecha: new Date().toISOString()
      }]);
      setConversaciones(prev => prev.map(c =>
        c.id === convActual.id && c.titulo === 'Nueva conversación'
          ? { ...c, titulo: texto.substring(0, 50) } : c
      ));
        } catch (err) {
      const contenido429 = err.response?.status === 429
        ? `🚫 ${err.response.data?.detail || 'Se alcanzó el límite de consultas a la IA para este período.'}`
        : '❌ Error al consultar el asistente. Intentá de nuevo.';
      setMensajes(prev => [...prev, {
        rol: 'ia',
        contenido: contenido429,
        fecha: new Date().toISOString()
      }]);
    } finally {
      setCargando(false);
    }
  };

  const formatFecha = (fecha) => {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={styles.container}>

      {/* ── MODAL EMAIL ───────────────────────────────── */}
      {modalEmail && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) omitirEmail(); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modalEmail}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-email-titulo"
          >
            <div style={{ ...styles.modalEmailHeader, background: gradiente }}>
              <span style={styles.modalEmailIcono} aria-hidden="true">✉️</span>
              <h3 id="modal-email-titulo" style={styles.modalEmailTitulo}>Personalizá tu experiencia</h3>
              <p style={styles.modalEmailSub}>
                Agregá tu email corporativo para que tu asistente te llame por tu nombre
                y puedas recibir notificaciones importantes
              </p>
            </div>
            <div style={styles.modalEmailBody}>
              <div style={styles.beneficiosLista}>
                {[
                  { icon: '👤', texto: 'Mejorá tu experiencia — tu asistente te conocerá mejor con cada consulta' },
                  { icon: '🔔', texto: 'Recibí alertas sobre las campañas comerciales activas y por vencer' },
                  { icon: '📊', texto: 'Resumen semanal personalizado con tus dinámicas más relevantes' },
                  { icon: '🔒', texto: 'Solo se usa para notificaciones de PromoIQ, nunca con terceros' },
                ].map((b, i) => (
                  <div key={i} style={styles.beneficioItem}>
                    <span style={styles.beneficioIcono} aria-hidden="true">{b.icon}</span>
                    <span style={styles.beneficioTexto}>{b.texto}</span>
                  </div>
                ))}
              </div>
              <div style={styles.emailInputWrapper}>
                <label htmlFor="email-corporativo" style={styles.emailLabel}>Email corporativo</label>
                <input
                  id="email-corporativo"
                  className="pd-hoverable"
                  style={{ ...styles.emailInput, borderColor: emailError ? theme.color.error : theme.color.border }}
                  type="email"
                  placeholder="nombre.apellido@empresa.cr"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setEmailError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEmail()}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'email-error' : undefined}
                  autoFocus
                />
                {emailError && <p id="email-error" style={styles.emailError} role="alert">⚠️ {emailError}</p>}
                <p style={styles.emailHint}>El formato es: nombre.apellido@empresa.cr / .gt / .sv</p>
              </div>
              <div style={styles.modalEmailBotones}>
                <button
                  className="pd-pressable"
                  style={{ ...styles.btnGuardarEmail, background: gradiente, opacity: guardandoEmail ? 0.7 : 1 }}
                  onClick={guardarEmail}
                  disabled={guardandoEmail}
                >
                  {guardandoEmail ? '⏳ Guardando...' : '✅ Agregar email'}
                </button>
                <button className="pd-pressable" style={styles.btnOmitirEmail} onClick={omitirEmail}>
                  Ahora no, lo hago después
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIGURACIÓN ───────────────────────── */}
      {modalConfig && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModalConfig(false); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modalConfig}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-config-titulo"
          >
            <div style={{ ...styles.modalConfigHeader, background: gradiente }}>
              <h3 id="modal-config-titulo" style={styles.modalConfigTitulo}>⚙️ Personalizar asistente</h3>
              <button
                className="pd-pressable"
                style={styles.modalClose}
                onClick={() => setModalConfig(false)}
                aria-label="Cerrar configuración"
              >✕</button>
            </div>
            <div style={styles.modalConfigBody}>

              <div style={styles.configSeccion}>
                <label htmlFor="nombre-asistente" style={styles.configLabel}>🏷️ Nombre de tu asistente</label>
                <p style={styles.configDesc}>¿Cómo querés llamar a tu asistente IA?</p>
                <input
                  id="nombre-asistente"
                  className="pd-hoverable"
                  style={styles.configInput}
                  type="text"
                  placeholder="Ej: Max, Sofia, PromoBot..."
                  value={nombreAsistente}
                  onChange={(e) => setNombreAsistente(e.target.value)}
                  maxLength={50}
                />
                <div style={styles.sugerenciasNombre}>
                  {['PromoIQ IA', 'Max', 'Sofia', 'Aria', 'Atlas'].map(n => (
                    <button
                      key={n}
                      className="pd-pressable"
                      style={{
                        ...styles.sugerenciaNombre,
                        background: nombreAsistente === n ? colorPrimario : theme.color.surfaceMuted,
                        color: nombreAsistente === n ? theme.color.textOnPrimary : theme.color.textSecondary,
                      }}
                      onClick={() => setNombreAsistente(n)}
                      aria-pressed={nombreAsistente === n}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.configSeccion}>
                <span style={styles.configLabel}>⚡ Nivel de respuesta</span>
                <p style={styles.configDesc}>¿Qué tan detalladas querés las respuestas?</p>
                <div style={styles.nivelesGrid} role="radiogroup" aria-label="Nivel de respuesta">
                  {nivelesDetalle.map(n => (
                    <div
                      key={n.value}
                      className="pd-pressable"
                      style={{
                        ...styles.nivelCard,
                        border: `2px solid ${nivelDetalle === n.value ? colorPrimario : theme.color.border}`,
                        background: nivelDetalle === n.value ? colorPrimario + '10' : theme.color.surface,
                      }}
                      onClick={() => setNivelDetalle(n.value)}
                      role="radio"
                      aria-checked={nivelDetalle === n.value}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNivelDetalle(n.value); } }}
                    >
                      <p style={{ ...styles.nivelLabel, color: nivelDetalle === n.value ? colorPrimario : theme.color.text }}>
                        {n.label}
                      </p>
                      <p style={styles.nivelDesc}>{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={styles.configSeccion}>
                <span style={styles.configLabel}>📧 Email para notificaciones</span>
                {perfil?.email_confirmado ? (
                  <div style={styles.emailConfirmado}>
                    <span>✅ {perfil.email_notificaciones}</span>
                    <button
                      className="pd-pressable"
                      style={styles.btnCambiarEmail}
                      onClick={() => { setModalConfig(false); setModalEmail(true); }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <button
                    className="pd-pressable"
                    style={{ ...styles.btnAgregarEmailConfig, color: colorPrimario, borderColor: colorPrimario }}
                    onClick={() => { setModalConfig(false); setModalEmail(true); }}
                  >
                    ✉️ Agregar email corporativo
                  </button>
                )}
              </div>

              <button
                className="pd-pressable"
                style={{ ...styles.btnGuardarConfig, background: gradiente, opacity: guardandoConfig ? 0.7 : 1 }}
                onClick={guardarPersonalizacion}
                disabled={guardandoConfig}
              >
                {guardandoConfig ? '⏳ Guardando...' : '✅ Guardar configuración'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay del panel en modo drawer (mobile/tablet) */}
      {esMobile && panelAbierto && (
        <div className="pd-sidebar-overlay" onClick={() => setPanelAbierto(false)} />
      )}

      {/* ── PANEL LATERAL ─────────────────────────────── */}
      <div className={`pd-sidebar${panelAbierto ? ' pd-sidebar-open' : ''}`} style={{
        ...styles.panel,
        width: panelAbierto ? '280px' : '0px',
        opacity: panelAbierto ? 1 : 0,
        overflow: 'hidden',
        transition: `width ${theme.motion.duration.base} ${theme.motion.easing.inOut}, opacity ${theme.motion.duration.fast} ${theme.motion.easing.out}`,
        flexShrink: 0,
      }}>
        <div style={{ ...styles.panelHeader, background: gradiente }}>
          <div>
            <p style={styles.panelTitulo}>{nombreAsistente}</p>
            <p style={styles.panelSub}>{conversaciones.length} conversación{conversaciones.length !== 1 ? 'es' : ''}</p>
          </div>
          <button
            className="pd-pressable"
            style={styles.btnNuevaConv}
            onClick={nuevaConversacion}
            disabled={creandoConversacion}
            aria-label="Nueva conversación"
            title="Nueva conversación"
          >✏️</button>
        </div>

        {perfil && (
          <div style={styles.perfilBox}>
            <div style={{ ...styles.perfilAvatar, background: colorPrimario }} aria-hidden="true">
              {nombrePersonalizado.charAt(0).toUpperCase()}
            </div>
            <div style={styles.perfilInfo}>
              <p style={styles.perfilNombre}>{nombrePersonalizado}</p>
              <p style={styles.perfilStats}>
                {perfil.email_confirmado
                  ? `✅ ${perfil.email_notificaciones}`
                  : '⚠️ Sin email corporativo'}
              </p>
            </div>
            {!perfil.email_confirmado && (
              <button
                className="pd-pressable"
                style={{ ...styles.btnAgregarEmail, color: colorPrimario }}
                onClick={() => setModalEmail(true)}
                aria-label="Agregar email corporativo"
              >✉️</button>
            )}
          </div>
        )}

        <div style={styles.listaConversaciones}>
          {cargandoConversaciones ? (
            <div style={styles.cargandoPanel}><p>Cargando...</p></div>
          ) : conversaciones.length === 0 ? (
            <div style={styles.sinConversaciones}>
              <span style={{ fontSize: '32px' }} aria-hidden="true">💬</span>
              <p>No hay conversaciones aún</p>
              <button
                className="pd-pressable"
                style={{ ...styles.btnIniciar, background: colorPrimario }}
                onClick={nuevaConversacion}
                disabled={creandoConversacion}
              >
                Iniciar conversación
              </button>
            </div>
          ) : (
            conversaciones.map((conv, i) => (
              <div
                key={conv.id}
                className="pd-pressable pd-hoverable pd-stagger-item"
                style={{
                  ...styles.convItem,
                  background: conversacionActiva?.id === conv.id ? colorPrimario + '15' : 'transparent',
                  borderLeft: conversacionActiva?.id === conv.id ? `3px solid ${colorPrimario}` : '3px solid transparent',
                  animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                }}
                onClick={() => abrirConversacion(conv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') abrirConversacion(conv); }}
              >
                <div style={styles.convIcono} aria-hidden="true">💬</div>
                <div style={styles.convInfo}>
                  <p style={styles.convTitulo}>
                    {conv.titulo?.length > 35 ? conv.titulo.substring(0, 35) + '...' : conv.titulo}
                  </p>
                  <p style={styles.convMeta}>{formatFecha(conv.ultimo_mensaje)} · {conv.total_mensajes} msgs</p>
                </div>
                <button
                  className="pd-pressable"
                  style={styles.btnEliminarConv}
                  onClick={(e) => eliminarConversacion(e, conv.id)}
                  aria-label={`Eliminar conversación: ${conv.titulo}`}
                >🗑️</button>
              </div>
            ))
          )}
        </div>

        {perfil?.articulos_favoritos?.length > 0 && (
          <div style={styles.favoritosBox}>
            <p style={styles.favoritosTitulo}>⭐ Consultados frecuentemente</p>
            <div style={styles.favoritosLista}>
              {perfil.articulos_favoritos.slice(0, 5).map((codigo, i) => (
                <button
                  key={i}
                  className="pd-pressable pd-hoverable"
                  style={{ ...styles.favoritoBadge, background: colorPrimario + '15', color: colorPrimario }}
                  onClick={() => enviarMensaje(`Dame información sobre el SKU ${codigo}`)}
                >
                  {codigo}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ÁREA DE CHAT ──────────────────────────────── */}
      <div style={styles.chatArea}>

        <div style={{ ...styles.chatHeader, background: gradiente }}>
          <button
            className="pd-pressable"
            style={styles.btnTogglePanel}
            onClick={() => setPanelAbierto(!panelAbierto)}
            aria-label={panelAbierto ? 'Ocultar panel de conversaciones' : 'Mostrar panel de conversaciones'}
            aria-expanded={panelAbierto}
          >
            {panelAbierto ? '◀' : '▶'}
          </button>

          <div style={styles.chatHeaderInfo}>
            <div style={styles.chatHeaderAvatar} aria-hidden="true">
              {nombreAsistente.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={styles.chatHeaderTitulo}>{nombreAsistente}</p>
              <p className="pd-hide-mobile" style={styles.chatHeaderSub}>
                ● Personalizado para {nombrePersonalizado} ·{' '}
                {nivelesDetalle.find(n => n.value === nivelDetalle)?.label || '📊 Detallado'}
                {usuario.rol === 'superadmin' && paisLabel && ` · 🌎 ${paisLabel}`}
              </p>
            </div>
          </div>

          <div style={styles.chatHeaderAcciones}>
            <button
              className="pd-pressable"
              style={styles.btnHeaderAccion}
              onClick={nuevaConversacion}
              disabled={creandoConversacion}
              aria-label="Nueva conversación"
              title="Nueva conversación"
            >✏️</button>
            <button
              className="pd-pressable"
              style={styles.btnHeaderAccion}
              onClick={() => setModalConfig(true)}
              aria-label="Configurar asistente"
              title="Configurar asistente"
            >⚙️</button>
            {conversacionActiva && (
              <button
                className="pd-pressable"
                style={{ ...styles.btnHeaderAccion, fontSize: '16px' }}
                onClick={() => {
                  setConversacionActiva(null);
                  setMensajes([]);
                }}
                aria-label="Cerrar conversación"
                title="Cerrar conversación"
              >✕</button>
            )}
          </div>
        </div>

        <div ref={chatRef} style={styles.mensajesArea} aria-live="polite">

          {!conversacionActiva ? (
            <div style={styles.bienvenida}>
              <InstruccionesModulo
                id="asistente-personalizado"
                texto="Chateá con tu asistente de IA personalizado — te conoce por tu país y tu rol. Podés cambiarle el nombre y ajustar qué tan detalladas son sus respuestas desde el ícono ⚙️ arriba a la derecha."
              />
              <div style={{ ...styles.bienvenidaAvatar, background: gradiente }} aria-hidden="true">
                {nombreAsistente.charAt(0).toUpperCase()}
              </div>

              {cargandoBienvenida ? (
                <div style={styles.bienvenidaCargando}>
                  <div style={styles.typing}>
                    <span className="pd-dot" />
                    <span className="pd-dot" style={{ animationDelay: '0.2s' }} />
                    <span className="pd-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <p style={{ color: theme.color.textMuted, fontSize: '13px' }}>Preparando tu bienvenida...</p>
                </div>
              ) : bienvenida ? (
                <div style={styles.bienvenidaMensajeBox}>
                  <p style={styles.bienvenidaNombre}>{obtenerSaludo()}, {nombrePersonalizado.split(' ')[0]}! 👋</p>
                  <p style={styles.bienvenidaMensaje}>{bienvenida.mensaje}</p>
                </div>
              ) : (
                <p style={styles.bienvenidaMensaje}>
                  {obtenerSaludo()}, {nombrePersonalizado}! Soy {nombreAsistente}, tu asistente personalizado.
                </p>
              )}

              {!perfil?.email_confirmado && (
                <button
                  className="pd-pressable"
                  style={{ ...styles.btnEmailBienvenida, borderColor: colorPrimario, color: colorPrimario }}
                  onClick={() => setModalEmail(true)}
                >
                  ✉️ Agregá tu email para personalización completa
                </button>
              )}

              <div className="pd-grid-2" style={styles.sugeridosGrid}>
                {sugeridas.map((s, i) => (
                  <button
                    key={i}
                    className="pd-pressable pd-hoverable pd-stagger-item"
                    style={{ ...styles.sugeridoCard, borderColor: colorPrimario + '40', animationDelay: `calc(var(--stagger) * ${i})` }}
                    onClick={() => enviarMensaje(s)}
                  >
                    <span style={{ ...styles.sugeridoIcono, color: colorPrimario }} aria-hidden="true">
                      {i === 0 ? '📊' : i === 1 ? '🏷️' : i === 2 ? '📍' : '📈'}
                    </span>
                    <span style={styles.sugeridoTexto}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : mensajes.length === 0 ? (
            <div style={styles.bienvenida}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">💬</span>
              <p style={styles.bienvenidaMensaje}>Nueva conversación. ¿En qué te puedo ayudar?</p>
              <div className="pd-grid-2" style={styles.sugeridosGrid}>
                {sugeridas.map((s, i) => (
                  <button
                    key={i}
                    className="pd-pressable pd-hoverable pd-stagger-item"
                    style={{ ...styles.sugeridoCard, borderColor: colorPrimario + '40', animationDelay: `calc(var(--stagger) * ${i})` }}
                    onClick={() => enviarMensaje(s)}
                  >
                    <span style={{ ...styles.sugeridoIcono, color: colorPrimario }} aria-hidden="true">
                      {i === 0 ? '📊' : i === 1 ? '🏷️' : i === 2 ? '📍' : '📈'}
                    </span>
                    <span style={styles.sugeridoTexto}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {mensajes.map((m, i) => (
                <div key={i} style={m.rol === 'usuario' ? styles.mensajeUsuarioWrapper : styles.mensajeIAWrapper}>
                  {m.rol === 'ia' && (
                    <div style={{ ...styles.iaAvatar, background: colorPrimario }} aria-hidden="true">
                      {nombreAsistente.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="pd-stagger-item" style={m.rol === 'usuario' ? { ...styles.mensajeUsuario, background: gradiente } : styles.mensajeIA}>
                    {m.rol === 'ia' ? (
                      <>
                        <ReactMarkdown>{m.contenido}</ReactMarkdown>
                        {m.tokens && (
                          <p style={styles.tokensInfo}>⚡ {m.tokens} tokens</p>
                        )}
                      </>
                    ) : (
                      <p style={{ margin: 0 }}>{m.contenido}</p>
                    )}
                  </div>
                  {m.rol === 'usuario' && (
                    <div style={{ ...styles.usuarioAvatar, background: colorPrimario }} aria-hidden="true">
                      {nombrePersonalizado.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}

              {cargando && (
                <div style={styles.mensajeIAWrapper}>
                  <div style={{ ...styles.iaAvatar, background: colorPrimario }} aria-hidden="true">
                    {nombreAsistente.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.mensajeIA}>
                    <div style={styles.pasosContainer}>
                      {pasosCarga.map((paso, i) => {
                        if (i > pasoActivo) return null;
                        const completado = i < pasoActivo;
                        return (
                          <div key={i} className="pd-stagger-item" style={styles.pasoItem}>
                            {completado ? (
                              <span style={styles.pasoCheck} aria-hidden="true">✓</span>
                            ) : (
                              <span className="pd-spinner" aria-hidden="true" />
                            )}
                            <span style={{
                              ...styles.pasoTexto,
                              color: completado ? theme.color.textMuted : theme.color.text,
                              fontWeight: completado ? theme.font.weight.regular : theme.font.weight.semibold,
                            }}>
                              {paso}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={styles.typing}>
                      <span className="pd-dot" />
                      <span className="pd-dot" style={{ animationDelay: '0.2s' }} />
                      <span className="pd-dot" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={styles.inputArea}>
          <div style={styles.inputWrapper}>
            <label htmlFor="pregunta-asistente" style={styles.srOnly}>Preguntale a {nombreAsistente}</label>
            <input
              id="pregunta-asistente"
              className="pd-hoverable"
              style={styles.input}
              type="text"
              placeholder={`Preguntale a ${nombreAsistente}...`}
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviarMensaje()}
              disabled={cargando}
            />
            <button
              className="pd-pressable"
              style={{
                ...styles.btnEnviar,
                background: gradiente,
                opacity: cargando || !pregunta.trim() ? 0.6 : 1,
                cursor: cargando || !pregunta.trim() ? 'not-allowed' : 'pointer'
              }}
              onClick={() => enviarMensaje()}
              disabled={cargando || !pregunta.trim()}
              aria-label="Enviar pregunta"
            >
              ➤
            </button>
          </div>
          <p className="pd-hide-mobile" style={styles.inputHint}>
            Enter para enviar · Historial guardado automáticamente ·{' '}
            {nivelesDetalle.find(n => n.value === nivelDetalle)?.label}
            {perfil?.email_confirmado && ` · ✅ ${perfil.email_notificaciones}`}
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: 'calc(100vh - 140px)', background: theme.color.background, borderRadius: theme.radius.xxl, overflow: 'hidden', boxShadow: theme.shadow.lg, position: 'relative' },

  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px', boxSizing: 'border-box' },
  modalEmail: { background: theme.color.surface, borderRadius: theme.radius.xxl, width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: theme.shadow.modal, maxHeight: '90vh', overflowY: 'auto' },
  modalEmailHeader: { padding: '32px', textAlign: 'center' },
  modalEmailIcono: { fontSize: '48px', display: 'block', marginBottom: '12px' },
  modalEmailTitulo: { fontSize: theme.font.size.display, fontWeight: theme.font.weight.bold, color: theme.color.textOnPrimary, margin: '0 0 8px 0' },
  modalEmailSub: { fontSize: theme.font.size.base, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.5' },
  modalEmailBody: { padding: '24px' },
  beneficiosLista: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  beneficioItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: theme.color.surfaceMuted, borderRadius: theme.radius.sm },
  beneficioIcono: { fontSize: '20px', flexShrink: 0 },
  beneficioTexto: { fontSize: theme.font.size.base, color: theme.color.text },
  emailInputWrapper: { marginBottom: '20px' },
  emailLabel: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  emailInput: { width: '100%', padding: '12px 14px', borderRadius: theme.radius.md, border: '1.5px solid', fontSize: theme.font.size.md, outline: 'none', boxSizing: 'border-box', fontFamily: theme.font.family, background: theme.color.surfaceMuted },
  emailError: { fontSize: theme.font.size.sm, color: theme.color.error, margin: '6px 0 0 0' },
  emailHint: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '6px 0 0 0' },
  modalEmailBotones: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnGuardarEmail: { width: '100%', padding: '14px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },
  btnOmitirEmail: { width: '100%', padding: '12px', background: 'transparent', border: 'none', color: theme.color.textMuted, fontSize: theme.font.size.base, cursor: 'pointer', fontFamily: theme.font.family },

  modalConfig: { background: theme.color.surface, borderRadius: theme.radius.xxl, width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: theme.shadow.modal, maxHeight: '90vh', overflowY: 'auto' },
  modalConfigHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' },
  modalConfigTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, color: theme.color.textOnPrimary, margin: 0 },
  modalClose: { background: 'rgba(255,255,255,0.2)', border: 'none', color: theme.color.textOnPrimary, width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: theme.font.size.xl, flexShrink: 0 },
  modalConfigBody: { padding: '24px' },
  configSeccion: { marginBottom: '24px' },
  configLabel: { display: 'block', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '4px' },
  configDesc: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 12px 0' },
  configInput: { width: '100%', padding: '12px 14px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none', boxSizing: 'border-box', fontFamily: theme.font.family, background: theme.color.surfaceMuted },
  sugerenciasNombre: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' },
  sugerenciaNombre: { padding: '6px 14px', borderRadius: theme.radius.pill, border: 'none', cursor: 'pointer', fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, fontFamily: theme.font.family },
  nivelesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' },
  nivelCard: { padding: '14px', borderRadius: theme.radius.md, cursor: 'pointer', textAlign: 'center' },
  nivelLabel: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, margin: '0 0 4px 0' },
  nivelDesc: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: 0 },
  emailConfirmado: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: theme.color.successBg, borderRadius: theme.radius.md, border: `1px solid ${theme.color.successBorder}`, fontSize: theme.font.size.base, color: theme.color.success, fontWeight: theme.font.weight.semibold, flexWrap: 'wrap', gap: '8px' },
  btnCambiarEmail: { background: 'none', border: 'none', color: theme.color.accent, cursor: 'pointer', fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold },
  btnAgregarEmailConfig: { width: '100%', padding: '12px', background: 'transparent', border: '1.5px solid', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, cursor: 'pointer', fontFamily: theme.font.family },
  btnGuardarConfig: { width: '100%', padding: '14px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },

  panel: { background: theme.color.surface, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${theme.color.border}` },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', flexShrink: 0 },
  panelTitulo: { color: theme.color.textOnPrimary, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, margin: 0, whiteSpace: 'nowrap' },
  panelSub: { color: 'rgba(255,255,255,0.7)', fontSize: theme.font.size.sm, margin: '2px 0 0 0', whiteSpace: 'nowrap' },
  btnNuevaConv: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: theme.radius.sm, padding: '6px 10px', cursor: 'pointer', fontSize: theme.font.size.xl, flexShrink: 0 },
  perfilBox: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${theme.color.background}`, flexShrink: 0 },
  perfilAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  perfilInfo: { flex: 1, overflow: 'hidden' },
  perfilNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  perfilStats: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnAgregarEmail: { background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.font.size.xl, flexShrink: 0 },
  listaConversaciones: { flex: 1, overflow: 'auto', padding: '8px' },
  cargandoPanel: { display: 'flex', justifyContent: 'center', padding: '20px', color: theme.color.textMuted, fontSize: theme.font.size.base },
  sinConversaciones: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', color: theme.color.textMuted, fontSize: theme.font.size.base, gap: '8px', textAlign: 'center' },
  btnIniciar: { color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, padding: '8px 16px', fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, cursor: 'pointer', marginTop: '8px' },
  convItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: theme.radius.md, cursor: 'pointer', marginBottom: '4px' },
  convIcono: { fontSize: theme.font.size.xl, flexShrink: 0 },
  convInfo: { flex: 1, overflow: 'hidden' },
  convTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.primary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convMeta: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  btnEliminarConv: { background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.font.size.md, opacity: 0.5, flexShrink: 0 },
  favoritosBox: { padding: '12px 16px', borderTop: `1px solid ${theme.color.background}`, flexShrink: 0 },
  favoritosTitulo: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  favoritosLista: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  favoritoBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 8px', borderRadius: theme.radius.pill, cursor: 'pointer', border: 'none' },

  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  chatHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', flexShrink: 0, boxShadow: theme.shadow.header },
  btnTogglePanel: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: theme.radius.sm, padding: '6px 10px', cursor: 'pointer', color: theme.color.textOnPrimary, fontSize: theme.font.size.md, flexShrink: 0 },
  chatHeaderInfo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 },
  chatHeaderAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  chatHeaderTitulo: { color: theme.color.textOnPrimary, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatHeaderSub: { color: 'rgba(255,255,255,0.75)', fontSize: theme.font.size.sm, margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatHeaderAcciones: { display: 'flex', gap: '6px', flexShrink: 0 },
  btnHeaderAccion: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: theme.radius.sm, padding: '6px 10px', cursor: 'pointer', fontSize: theme.font.size.xl, color: theme.color.textOnPrimary },
  mensajesArea: { flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: theme.color.surfaceMuted },

  bienvenida: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px', textAlign: 'center', gap: '16px' },
  bienvenidaAvatar: { width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: theme.font.weight.black, color: theme.color.textOnPrimary, boxShadow: theme.shadow.floating },
  bienvenidaCargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  bienvenidaMensajeBox: { background: theme.color.surface, borderRadius: theme.radius.xxl, padding: '20px 24px', maxWidth: '500px', boxShadow: theme.shadow.md },
  bienvenidaNombre: { fontSize: theme.font.size.display, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 8px 0' },
  bienvenidaMensaje: { fontSize: theme.font.size.lg, color: theme.color.textSecondary, lineHeight: '1.6', margin: 0 },
  btnEmailBienvenida: { padding: '10px 20px', background: 'transparent', border: '1.5px solid', borderRadius: theme.radius.pill, fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, cursor: 'pointer', fontFamily: theme.font.family },
  sugeridosGrid: { width: '100%', maxWidth: '560px', marginTop: '8px' },
  sugeridoCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: theme.color.surface, border: '1.5px solid', borderRadius: theme.radius.lg, cursor: 'pointer', textAlign: 'left', boxShadow: theme.shadow.sm },
  sugeridoIcono: { fontSize: theme.font.size.xxl, flexShrink: 0 },
  sugeridoTexto: { fontSize: theme.font.size.base, color: theme.color.text, fontWeight: theme.font.weight.medium, lineHeight: '1.4' },

  mensajeUsuarioWrapper: { display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'flex-end' },
  mensajeIAWrapper: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  mensajeUsuario: { color: theme.color.textOnPrimary, borderRadius: '18px 18px 4px 18px', padding: '12px 16px', maxWidth: '85%', fontSize: theme.font.size.md, lineHeight: '1.5' },
  mensajeIA: { background: theme.color.surface, color: theme.color.text, borderRadius: '4px 18px 18px 18px', padding: '16px 18px', maxWidth: '88%', fontSize: theme.font.size.md, lineHeight: '1.7', boxShadow: theme.shadow.md },
  iaAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  usuarioAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  tokensInfo: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '8px 0 0 0', textAlign: 'right' },
  typing: { display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' },
  pasosContainer: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' },
  pasoItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  pasoCheck: {
    width: '16px', height: '16px', borderRadius: '50%',
    background: theme.color.successBg, color: theme.color.successStrong,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, flexShrink: 0,
  },
  pasoTexto: { fontSize: theme.font.size.base },

  inputArea: { padding: '12px 16px', borderTop: `1px solid ${theme.color.border}`, background: theme.color.surface, flexShrink: 0 },
  inputWrapper: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '14px 18px', borderRadius: theme.radius.xl, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none', fontFamily: theme.font.family, background: theme.color.surfaceMuted },
  btnEnviar: { width: '48px', height: '48px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.xl, fontSize: theme.font.size.xxl, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputHint: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '8px 0 0 0', textAlign: 'center' },
};

export default AsistentePersonalizado;
