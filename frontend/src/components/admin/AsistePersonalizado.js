import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';

function AsistentePersonalizado({ tema, usuario }) {
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [cargandoConversaciones, setCargandoConversaciones] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [modalEmail, setModalEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [guardandoEmail, setGuardandoEmail] = useState(false);
  const chatRef = useRef(null);

  const colorPrimario = tema?.primary || '#1E2761';
  const gradiente = tema?.gradient || 'linear-gradient(135deg, #1E2761, #0077B6)';
  const rol = usuario.rol;
  const nombre = usuario.nombre;

  const sugeridosPorRol = {
    comercial: [
      '¿Qué artículos tienen mayor ahorro esta semana?',
      '¿Cuáles categorías no han tenido dinámica?',
      '¿Qué ubicación genera más impacto?',
      'Analizá el rendimiento de las campañas activas',
    ],
    planning: [
      '¿Hay artículos duplicados en dinámicas activas?',
      '¿Qué tiendas no tienen artículos registrados?',
      '¿Cuáles dinámicas vencen esta semana?',
      'Dame trazabilidad completa de los artículos activos',
    ],
  };

  const sugeridas = sugeridosPorRol[rol] || sugeridosPorRol['comercial'];

  useEffect(() => {
    cargarPerfilYConversaciones();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes, cargando]);

  const cargarPerfilYConversaciones = async () => {
    setCargandoConversaciones(true);
    try {
      const [resConv, resPerfil] = await Promise.all([
        api.get('/asistente/conversaciones'),
        api.get('/asistente/perfil/completo')
      ]);
      setConversaciones(resConv.data.conversaciones);
      setPerfil(resPerfil.data);

      // Mostrar modal de email si es la primera vez
      if (resPerfil.data.solicitar_email && !resPerfil.data.email_notificaciones) {
        setTimeout(() => setModalEmail(true), 1000);
      }
    } catch (err) {
      console.error('Error cargando perfil:', err);
    } finally {
      setCargandoConversaciones(false);
    }
  };

  // Nombre personalizado desde email o nombre de sistema
  const nombrePersonalizado = perfil?.nombre_completo || nombre;

  // Saludo variado según hora
  const obtenerSaludo = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const guardarEmail = async () => {
    if (!emailInput.trim()) {
      setEmailError('Ingresá tu email corporativo');
      return;
    }
    if (!emailInput.includes('@')) {
      setEmailError('El email no es válido');
      return;
    }

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
      setEmailError('Error guardando el email. Intentá de nuevo.');
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

  const abrirConversacion = async (conv) => {
    setConversacionActiva(conv);
    setMensajes([]);
    try {
      const res = await api.get(`/asistente/conversaciones/${conv.id}/mensajes`);
      setMensajes(res.data);
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    }
  };

  const nuevaConversacion = async () => {
    try {
      const res = await api.post('/asistente/conversaciones/nueva', {});
      const nueva = res.data;
      setConversaciones(prev => [{ ...nueva, total_mensajes: 0 }, ...prev]);
      setConversacionActiva(nueva);
      setMensajes([]);
    } catch (err) {
      console.error('Error creando conversación:', err);
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
      console.error('Error eliminando:', err);
    }
  };

  const enviarMensaje = async (textoPregunta) => {
    const texto = textoPregunta || pregunta;
    if (!texto.trim() || cargando) return;

    if (!conversacionActiva) {
      const res = await api.post('/asistente/conversaciones/nueva', {});
      const nueva = res.data;
      setConversaciones(prev => [{ ...nueva, total_mensajes: 0 }, ...prev]);
      setConversacionActiva(nueva);

      const mensajeUsuario = { rol: 'usuario', contenido: texto, fecha: new Date().toISOString() };
      setMensajes([mensajeUsuario]);
      setPregunta('');
      setCargando(true);

      try {
        const respuesta = await api.post(
          `/asistente/conversaciones/${nueva.id}/mensaje`,
          { pregunta: texto }
        );
        setMensajes(prev => [...prev, {
          rol: 'ia', contenido: respuesta.data.respuesta,
          tokens: respuesta.data.tokens_usados, fecha: new Date().toISOString()
        }]);
        setConversaciones(prev => prev.map(c =>
          c.id === nueva.id ? { ...c, titulo: texto.substring(0, 50) } : c
        ));
      } catch (err) {
        setMensajes(prev => [...prev, {
          rol: 'ia', contenido: '❌ Error al consultar el asistente.',
          fecha: new Date().toISOString()
        }]);
      } finally {
        setCargando(false);
      }
      return;
    }

    const mensajeUsuario = { rol: 'usuario', contenido: texto, fecha: new Date().toISOString() };
    setMensajes(prev => [...prev, mensajeUsuario]);
    setPregunta('');
    setCargando(true);

    try {
      const res = await api.post(
        `/asistente/conversaciones/${conversacionActiva.id}/mensaje`,
        { pregunta: texto }
      );
      setMensajes(prev => [...prev, {
        rol: 'ia', contenido: res.data.respuesta,
        tokens: res.data.tokens_usados, fecha: new Date().toISOString()
      }]);
      setConversaciones(prev => prev.map(c =>
        c.id === conversacionActiva.id && c.titulo === 'Nueva conversación'
          ? { ...c, titulo: texto.substring(0, 50) } : c
      ));
    } catch (err) {
      setMensajes(prev => [...prev, {
        rol: 'ia', contenido: '❌ Error al consultar el asistente.',
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
        <div style={styles.modalOverlay}>
          <div style={styles.modalEmail}>
            <div style={{ ...styles.modalEmailHeader, background: gradiente }}>
              <span style={styles.modalEmailIcono}>✉️</span>
              <h3 style={styles.modalEmailTitulo}>Personalizá tu experiencia</h3>
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
  { icon: '🔒', texto: 'Solo se usa para notificaciones de PromoIQ' },

                ].map((b, i) => (
                  <div key={i} style={styles.beneficioItem}>
                    <span style={styles.beneficioIcono}>{b.icon}</span>
                    <span style={styles.beneficioTexto}>{b.texto}</span>
                  </div>
                ))}
              </div>

              <div style={styles.emailInputWrapper}>
                <label style={styles.emailLabel}>Email corporativo</label>
                <input
                  style={{
                    ...styles.emailInput,
                    borderColor: emailError ? '#B91C1C' : '#E2E8F0'
                  }}
                  type="email"
                  placeholder="nombre.apellido@empresa. cr / .gt / .sv"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setEmailError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && guardarEmail()}
                  autoFocus
                />
                {emailError && (
                  <p style={styles.emailError}>⚠️ {emailError}</p>
                )}
                <p style={styles.emailHint}>
                  El formato es: nombre.apellido@empresa. cr / .gt / .sv
                </p>
              </div>

              <div style={styles.modalEmailBotones}>
                <button
                  style={{
                    ...styles.btnGuardarEmail,
                    background: gradiente,
                    opacity: guardandoEmail ? 0.7 : 1
                  }}
                  onClick={guardarEmail}
                  disabled={guardandoEmail}
                >
                  {guardandoEmail ? '⏳ Guardando...' : '✅ Agregar email'}
                </button>
                <button style={styles.btnOmitirEmail} onClick={omitirEmail}>
                  Ahora no, lo hago después
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PANEL LATERAL ─────────────────────────────── */}
      <div style={{
        ...styles.panel,
        width: panelAbierto ? '280px' : '0px',
        opacity: panelAbierto ? 1 : 0,
        overflow: 'hidden',
        transition: 'width 0.3s ease, opacity 0.3s ease',
      }}>
        <div style={{ ...styles.panelHeader, background: gradiente }}>
          <div>
            <p style={styles.panelTitulo}>Mis conversaciones</p>
            <p style={styles.panelSub}>{conversaciones.length} conversación{conversaciones.length !== 1 ? 'es' : ''}</p>
          </div>
          <button style={styles.btnNuevaConv} onClick={nuevaConversacion}>✏️</button>
        </div>

        {/* Perfil del usuario */}
        {perfil && (
          <div style={styles.perfilBox}>
            <div style={{ ...styles.perfilAvatar, background: colorPrimario }}>
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
                style={{ ...styles.btnAgregarEmail, color: colorPrimario }}
                onClick={() => setModalEmail(true)}
                title="Agregar email"
              >
                ✉️
              </button>
            )}
          </div>
        )}

        {/* Lista de conversaciones */}
        <div style={styles.listaConversaciones}>
          {cargandoConversaciones ? (
            <div style={styles.cargandoPanel}><p>Cargando...</p></div>
          ) : conversaciones.length === 0 ? (
            <div style={styles.sinConversaciones}>
              <span style={{ fontSize: '32px' }}>💬</span>
              <p>No hay conversaciones aún</p>
              <button
                style={{ ...styles.btnIniciar, background: colorPrimario }}
                onClick={nuevaConversacion}
              >
                Iniciar conversación
              </button>
            </div>
          ) : (
            conversaciones.map(conv => (
              <div
                key={conv.id}
                style={{
                  ...styles.convItem,
                  background: conversacionActiva?.id === conv.id ? colorPrimario + '15' : 'transparent',
                  borderLeft: conversacionActiva?.id === conv.id ? `3px solid ${colorPrimario}` : '3px solid transparent',
                }}
                onClick={() => abrirConversacion(conv)}
              >
                <div style={styles.convIcono}>💬</div>
                <div style={styles.convInfo}>
                  <p style={styles.convTitulo}>
                    {conv.titulo?.length > 35 ? conv.titulo.substring(0, 35) + '...' : conv.titulo}
                  </p>
                  <p style={styles.convMeta}>
                    {formatFecha(conv.ultimo_mensaje)} · {conv.total_mensajes} msgs
                  </p>
                </div>
                <button
                  style={styles.btnEliminarConv}
                  onClick={(e) => eliminarConversacion(e, conv.id)}
                >🗑️</button>
              </div>
            ))
          )}
        </div>

        {/* Artículos favoritos */}
        {perfil?.articulos_favoritos?.length > 0 && (
          <div style={styles.favoritosBox}>
            <p style={styles.favoritosTitulo}>⭐ Artículos consultados</p>
            <div style={styles.favoritosLista}>
              {perfil.articulos_favoritos.slice(0, 5).map((codigo, i) => (
                <span
                  key={i}
                  style={{ ...styles.favoritoBadge, background: colorPrimario + '15', color: colorPrimario }}
                  onClick={() => enviarMensaje(`¿Información sobre el artículo ${codigo}?`)}
                >
                  {codigo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── ÁREA DE CHAT ──────────────────────────────── */}
      <div style={styles.chatArea}>
        <div style={{ ...styles.chatHeader, background: gradiente }}>
          <button style={styles.btnTogglePanel} onClick={() => setPanelAbierto(!panelAbierto)}>
            {panelAbierto ? '◀' : '▶'}
          </button>
          <div style={styles.chatHeaderInfo}>
            <div style={styles.chatHeaderAvatar}>🤖</div>
            <div>
              <p style={styles.chatHeaderTitulo}>
                {conversacionActiva?.titulo || `Asistente ${rol === 'comercial' ? 'Comercial' : 'de Planning'}`}
              </p>
              <p style={styles.chatHeaderSub}>● Personalizado para {nombrePersonalizado}</p>
            </div>
          </div>
          {conversacionActiva && (
            <button style={styles.btnNuevoChatHeader} onClick={nuevaConversacion}>
              ✏️ Nueva
            </button>
          )}
        </div>

        {/* Mensajes */}
        <div ref={chatRef} style={styles.mensajesArea}>
          {!conversacionActiva ? (
            <div style={styles.bienvenida}>
              <div style={{ ...styles.bienvenidaAvatar, background: gradiente }}>🤖</div>
              <h2 style={{ ...styles.bienvenidaTitulo, color: colorPrimario }}>
                {obtenerSaludo()}, {nombrePersonalizado}! 👋
              </h2>
              <p style={styles.bienvenidaDesc}>
                {perfil?.email_confirmado
                  ? `Estoy listo para ayudarte, ${nombrePersonalizado.split(' ')[0]}.`
                  : `Hola ${nombre}, soy tu asistente personalizado de PromoIQ.`}
                {perfil?.total_conversaciones > 0
                  ? ` Llevamos ${perfil.total_conversaciones} consultas juntos.`
                  : ' Es nuestra primera conversación.'}
                <br />
                {rol === 'comercial'
                  ? 'Puedo ayudarte a analizar campañas, comparar precios y encontrar oportunidades.'
                  : 'Puedo ayudarte con trazabilidad, seguimiento de códigos y control de dinámicas.'}
              </p>

              {!perfil?.email_confirmado && (
                <button
                  style={{ ...styles.btnEmailBienvenida, borderColor: colorPrimario, color: colorPrimario }}
                  onClick={() => setModalEmail(true)}
                >
                  ✉️ Agregá tu email para personalización completa
                </button>
              )}

              <div style={styles.sugeridosGrid}>
                {sugeridas.map((s, i) => (
                  <button
                    key={i}
                    style={{ ...styles.sugeridoCard, borderColor: colorPrimario + '40' }}
                    onClick={async () => {
                      await nuevaConversacion();
                      setTimeout(() => enviarMensaje(s), 300);
                    }}
                  >
                    <span style={{ ...styles.sugeridoIcono, color: colorPrimario }}>
                      {i === 0 ? '📊' : i === 1 ? '🏷️' : i === 2 ? '📍' : '📈'}
                    </span>
                    <span style={styles.sugeridoTexto}>{s}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : mensajes.length === 0 ? (
            <div style={styles.bienvenida}>
              <span style={{ fontSize: '48px' }}>💬</span>
              <p style={styles.bienvenidaDesc}>Nueva conversación. ¿En qué te puedo ayudar?</p>
              <div style={styles.sugeridosGrid}>
                {sugeridas.map((s, i) => (
                  <button
                    key={i}
                    style={{ ...styles.sugeridoCard, borderColor: colorPrimario + '40' }}
                    onClick={() => enviarMensaje(s)}
                  >
                    <span style={{ ...styles.sugeridoIcono, color: colorPrimario }}>
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
                  {m.rol === 'ia' && <div style={styles.iaAvatar}>🤖</div>}
                  <div style={m.rol === 'usuario' ? { ...styles.mensajeUsuario, background: gradiente } : styles.mensajeIA}>
                    {m.rol === 'ia' ? (
                      <>
                        <ReactMarkdown>{m.contenido}</ReactMarkdown>
                        {m.tokens && <p style={styles.tokensInfo}>⚡ {m.tokens} tokens</p>}
                      </>
                    ) : (
                      <p style={{ margin: 0 }}>{m.contenido}</p>
                    )}
                  </div>
                  {m.rol === 'usuario' && (
                    <div style={{ ...styles.usuarioAvatar, background: colorPrimario }}>
                      {nombrePersonalizado.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
              {cargando && (
                <div style={styles.mensajeIAWrapper}>
                  <div style={styles.iaAvatar}>🤖</div>
                  <div style={styles.mensajeIA}>
                    <div style={styles.typing}>
                      <span style={styles.dot} />
                      <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
                      <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input */}
        <div style={styles.inputArea}>
          <div style={styles.inputWrapper}>
            <input
              style={styles.input}
              type="text"
              placeholder="Escribí tu mensaje..."
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
              disabled={cargando}
            />
            <button
              style={{
                ...styles.btnEnviar,
                background: gradiente,
                opacity: cargando || !pregunta.trim() ? 0.6 : 1,
                cursor: cargando || !pregunta.trim() ? 'not-allowed' : 'pointer'
              }}
              onClick={() => enviarMensaje()}
              disabled={cargando || !pregunta.trim()}
            >
              ➤
            </button>
          </div>
          <p style={styles.inputHint}>
            Enter para enviar · Historial guardado automáticamente
            {perfil?.email_confirmado && ` · ✅ ${perfil.email_notificaciones}`}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: { display: 'flex', height: 'calc(100vh - 140px)', background: '#F4F7FB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  modalEmail: { background: '#ffffff', borderRadius: '20px', width: '480px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalEmailHeader: { padding: '32px', textAlign: 'center' },
  modalEmailIcono: { fontSize: '48px', display: 'block', marginBottom: '12px' },
  modalEmailTitulo: { fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: '0 0 8px 0' },
  modalEmailSub: { fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.5' },
  modalEmailBody: { padding: '24px' },
  beneficiosLista: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' },
  beneficioItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#F8FAFC', borderRadius: '8px' },
  beneficioIcono: { fontSize: '20px', flexShrink: 0 },
  beneficioTexto: { fontSize: '13px', color: '#333' },
  emailInputWrapper: { marginBottom: '20px' },
  emailLabel: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#1E2761', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  emailInput: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Calibri, sans-serif', background: '#F8FAFC' },
  emailError: { fontSize: '12px', color: '#B91C1C', margin: '6px 0 0 0' },
  emailHint: { fontSize: '11px', color: '#8892A4', margin: '6px 0 0 0' },
  modalEmailBotones: { display: 'flex', flexDirection: 'column', gap: '10px' },
  btnGuardarEmail: { width: '100%', padding: '14px', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  btnOmitirEmail: { width: '100%', padding: '12px', background: 'transparent', border: 'none', color: '#8892A4', fontSize: '13px', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  panel: { background: '#ffffff', display: 'flex', flexDirection: 'column', borderRight: '1px solid #E2E8F0', flexShrink: 0 },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', flexShrink: 0 },
  panelTitulo: { color: '#ffffff', fontSize: '14px', fontWeight: '700', margin: 0 },
  panelSub: { color: 'rgba(255,255,255,0.7)', fontSize: '11px', margin: '2px 0 0 0' },
  btnNuevaConv: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '16px' },
  perfilBox: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid #F4F7FB', flexShrink: 0 },
  perfilAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '700', flexShrink: 0 },
  perfilInfo: { flex: 1, overflow: 'hidden' },
  perfilNombre: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  perfilStats: { fontSize: '10px', color: '#8892A4', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnAgregarEmail: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', flexShrink: 0 },
  listaConversaciones: { flex: 1, overflow: 'auto', padding: '8px' },
  cargandoPanel: { display: 'flex', justifyContent: 'center', padding: '20px', color: '#8892A4', fontSize: '13px' },
  sinConversaciones: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', color: '#8892A4', fontSize: '13px', gap: '8px', textAlign: 'center' },
  btnIniciar: { color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  convItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '4px', transition: 'background 0.2s' },
  convIcono: { fontSize: '16px', flexShrink: 0 },
  convInfo: { flex: 1, overflow: 'hidden' },
  convTitulo: { fontSize: '13px', fontWeight: '600', color: '#1E2761', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convMeta: { fontSize: '11px', color: '#8892A4', margin: '2px 0 0 0' },
  btnEliminarConv: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5, flexShrink: 0 },
  favoritosBox: { padding: '12px 16px', borderTop: '1px solid #F4F7FB', flexShrink: 0 },
  favoritosTitulo: { fontSize: '11px', fontWeight: '700', color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  favoritosLista: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  favoritoBadge: { fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', cursor: 'pointer' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', flexShrink: 0 },
  btnTogglePanel: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#ffffff', fontSize: '14px', flexShrink: 0 },
  chatHeaderInfo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  chatHeaderAvatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' },
  chatHeaderTitulo: { color: '#ffffff', fontSize: '14px', fontWeight: '700', margin: 0 },
  chatHeaderSub: { color: 'rgba(255,255,255,0.75)', fontSize: '11px', margin: '2px 0 0 0' },
  btnNuevoChatHeader: { background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#ffffff', fontSize: '12px', fontWeight: '600' },
  mensajesArea: { flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  bienvenida: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px', textAlign: 'center', gap: '16px' },
  bienvenidaAvatar: { width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' },
  bienvenidaTitulo: { fontSize: '24px', fontWeight: '800', margin: 0 },
  bienvenidaDesc: { fontSize: '14px', color: '#8892A4', maxWidth: '500px', lineHeight: '1.6', margin: 0 },
  btnEmailBienvenida: { padding: '10px 20px', background: 'transparent', border: '1.5px solid', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  sugeridosGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', maxWidth: '560px', marginTop: '8px' },
  sugeridoCard: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: '#ffffff', border: '1.5px solid', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  sugeridoIcono: { fontSize: '20px', flexShrink: 0 },
  sugeridoTexto: { fontSize: '13px', color: '#333', fontWeight: '500', lineHeight: '1.4' },
  mensajeUsuarioWrapper: { display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'flex-end' },
  mensajeIAWrapper: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  mensajeUsuario: { color: '#ffffff', borderRadius: '16px 16px 4px 16px', padding: '12px 16px', maxWidth: '70%', fontSize: '14px', lineHeight: '1.5' },
  mensajeIA: { background: '#ffffff', color: '#333', borderRadius: '4px 16px 16px 16px', padding: '14px 16px', maxWidth: '78%', fontSize: '14px', lineHeight: '1.7', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  iaAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 },
  usuarioAvatar: { width: '34px', height: '34px', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 },
  tokensInfo: { fontSize: '10px', color: '#8892A4', margin: '8px 0 0 0', textAlign: 'right' },
  typing: { display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', background: '#8892A4', display: 'inline-block', animation: 'bounce 1.2s infinite' },
  inputArea: { padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#ffffff', flexShrink: 0 },
  inputWrapper: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', fontFamily: 'Calibri, sans-serif', background: '#F8FAFC' },
  btnEnviar: { width: '46px', height: '46px', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputHint: { fontSize: '11px', color: '#8892A4', margin: '6px 0 0 0', textAlign: 'center' },
};

export default AsistentePersonalizado;