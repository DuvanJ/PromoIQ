import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

const CHAT_STORAGE_KEY = 'promoiq_chatia_mensajes';

const PASOS_CARGA = [
  'Consultando catálogo',
  'Cruzando con dinámicas activas',
  'Generando respuesta',
];

const mensajeBienvenida = {
  rol: 'ia',
  texto: '¡Hola! Soy el asistente de PromoIQ. Puedo ayudarte con información sobre dinámicas comerciales, artículos en campaña, análisis y mucho más. ¿En qué te puedo ayudar?'
};

function cargarMensajesGuardados() {
  try {
    const guardado = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (guardado) {
      const parseado = JSON.parse(guardado);
      if (Array.isArray(parseado) && parseado.length > 0) return parseado;
    }
  } catch (err) {
    console.error('Error leyendo chat guardado:', err);
  }
  return [mensajeBienvenida];
}

function ChatIA({ flotante = false, onCerrar, tiendaCodigo }) {
  const [mensajes, setMensajes] = useState(cargarMensajesGuardados);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [pasoActivo, setPasoActivo] = useState(0);
  const chatRef = useRef(null);
  const timersRef = useRef([]);

  const sugeridas = [
    '¿Qué artículos están en dinámica?',
    '¿Cuáles están en isla?',
    '¿Qué artículos tienen mayor ahorro?',
    '¿Cuántos artículos hay en campaña?',
  ];

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes, cargando, pasoActivo]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(mensajes));
    } catch (err) {
      console.error('Error guardando chat:', err);
    }
  }, [mensajes]);

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

  useEffect(() => {
    if (!flotante || !onCerrar) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flotante, onCerrar]);

  const enviar = async (textoPregunta) => {
    const texto = textoPregunta || pregunta;
    if (!texto.trim() || cargando) return;

    const nuevaMensajes = [...mensajes, { rol: 'usuario', texto }];
    setMensajes(nuevaMensajes);
    setPregunta('');
    setCargando(true);

    try {
      const res = await api.post('/consultas/preguntar', { pregunta: texto, tienda_codigo: tiendaCodigo });
      setMensajes([...nuevaMensajes, { rol: 'ia', texto: res.data.respuesta }]);
    } catch (err) {
      const texto429 = err.response?.status === 429
        ? `🚫 ${err.response.data?.detail || 'Se alcanzó el límite de consultas a la IA para este período.'}`
        : '❌ Ocurrió un error al consultar la IA. Intentá de nuevo.';
      setMensajes([...nuevaMensajes, {
        rol: 'ia',
        texto: texto429
      }]);
    } finally {
      setCargando(false);
    }
  };

  const limpiarChat = () => {
    setMensajes([{
      rol: 'ia',
      texto: '¡Chat limpiado! ¿En qué te puedo ayudar?'
    }]);
  };

  const contenedor = flotante ? styles.flotanteChat : styles.moduloChat;

  return (
    <div style={contenedor} role={flotante ? 'dialog' : undefined} aria-label={flotante ? 'Chat de PromoIQ IA' : undefined}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.iaAvatar} aria-hidden="true">🤖</div>
          <div style={{ minWidth: 0 }}>
            <p style={styles.headerTitulo}>PromoIQ IA</p>
            <p style={styles.headerSub}>● En línea</p>
          </div>
        </div>
        <div style={styles.headerAcciones}>
          <button
            className="pd-pressable"
            style={styles.btnLimpiar}
            onClick={limpiarChat}
            aria-label="Limpiar chat"
            title="Limpiar chat"
          >
            🗑️
          </button>
          {flotante && (
            <button
              className="pd-pressable"
              style={styles.btnCerrarFlotante}
              onClick={onCerrar}
              aria-label="Cerrar chat"
            >✕</button>
          )}
        </div>
      </div>

      {!flotante && (
        <div style={{ padding: '0 20px' }}>
          <InstruccionesModulo
            id="chat-ia-tienda"
            texto="Preguntale directamente sobre los artículos en dinámica de tu tienda — qué está en campaña, en qué ubicación, y cuánto ahorro tiene cada uno."
          />
        </div>
      )}

      <div ref={chatRef} style={flotante ? styles.flotanteMensajes : styles.moduloMensajes} aria-live="polite">
        {mensajes.map((m, i) => (
          <div key={i} style={m.rol === 'usuario' ? styles.mensajeUsuarioWrapper : styles.mensajeIAWrapper}>
            {m.rol === 'ia' && (
              <div style={styles.iaAvatarSmall} aria-hidden="true">🤖</div>
            )}
            <div style={m.rol === 'usuario' ? styles.mensajeUsuario : styles.mensajeIA}>
              {m.rol === 'ia' ? (
                <ReactMarkdown>{m.texto}</ReactMarkdown>
              ) : (
                <p style={{ margin: 0 }}>{m.texto}</p>
              )}
            </div>
          </div>
        ))}

        {cargando && (
          <div style={styles.mensajeIAWrapper}>
            <div style={styles.iaAvatarSmall} aria-hidden="true">🤖</div>
            <div style={styles.mensajeIA}>
              <div style={styles.pasosContainer}>
                {PASOS_CARGA.map((paso, i) => {
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
      </div>

      {mensajes.length === 1 && (
        <div style={styles.sugeridas}>
          {sugeridas.map((s, i) => (
            <button
              key={i}
              className="pd-pressable pd-hoverable pd-stagger-item"
              style={{ ...styles.sugerida, animationDelay: `calc(var(--stagger) * ${i})` }}
              onClick={() => enviar(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={styles.inputRow}>
        <label htmlFor="chatia-input" style={styles.srOnly}>Escribí tu pregunta para PromoIQ IA</label>
        <input
          id="chatia-input"
          className="pd-hoverable"
          style={styles.input}
          type="text"
          placeholder="Escribí tu pregunta..."
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          disabled={cargando}
        />
        <button
          className="pd-pressable"
          style={{
            ...styles.btnEnviar,
            opacity: cargando || !pregunta.trim() ? 0.6 : 1,
            cursor: cargando || !pregunta.trim() ? 'not-allowed' : 'pointer'
          }}
          onClick={() => enviar()}
          disabled={cargando || !pregunta.trim()}
          aria-label="Enviar pregunta"
        >
          ➤
        </button>
      </div>
    </div>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },

  moduloChat: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 140px)',
    background: theme.color.surface,
    borderRadius: theme.radius.xxl,
    boxShadow: theme.shadow.sm,
    overflow: 'hidden',
  },
  moduloMensajes: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  flotanteChat: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: theme.color.surface,
    borderRadius: theme.radius.xxl,
    overflow: 'hidden',
  },
  flotanteMensajes: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: theme.color.gradient,
    flexShrink: 0,
    gap: '8px',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
  iaAvatar: {
    width: '40px', height: '40px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xxl,
    flexShrink: 0,
  },
  headerTitulo: { color: theme.color.textOnPrimary, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, margin: 0, whiteSpace: 'nowrap' },
  headerSub: { color: theme.color.successAccent, fontSize: theme.font.size.sm, margin: '2px 0 0 0' },
  headerAcciones: { display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 },
  btnLimpiar: {
    background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: theme.radius.sm, padding: '6px 10px',
    cursor: 'pointer', fontSize: theme.font.size.xl,
  },
  btnCerrarFlotante: {
    background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: theme.radius.sm, padding: '6px 10px',
    cursor: 'pointer', fontSize: theme.font.size.xl, color: theme.color.textOnPrimary, fontWeight: theme.font.weight.bold,
  },

  mensajeUsuarioWrapper: {
    display: 'flex', justifyContent: 'flex-end',
  },
  mensajeIAWrapper: {
    display: 'flex', gap: '8px', alignItems: 'flex-start',
  },
  iaAvatarSmall: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: theme.color.accentSoft, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: theme.font.size.xl, flexShrink: 0,
  },
  mensajeUsuario: {
    background: theme.color.gradient,
    color: theme.color.textOnPrimary, borderRadius: '16px 16px 4px 16px',
    padding: '12px 16px', maxWidth: '85%', fontSize: theme.font.size.md, lineHeight: '1.5',
  },
  mensajeIA: {
    background: theme.color.background, color: theme.color.text,
    borderRadius: '4px 16px 16px 16px',
    padding: '12px 16px', maxWidth: '88%',
    fontSize: theme.font.size.md, lineHeight: '1.6',
  },

  pasosContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '8px',
  },
  pasoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pasoCheck: {
    width: '16px', height: '16px', borderRadius: '50%',
    background: theme.color.successBg, color: theme.color.successStrong,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, flexShrink: 0,
  },
  pasoTexto: {
    fontSize: theme.font.size.base,
  },

  typing: { display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' },

  sugeridas: {
    padding: '0 16px 12px',
    display: 'flex', flexWrap: 'wrap', gap: '8px',
  },
  sugerida: {
    padding: '6px 12px', background: theme.color.accentSoft,
    border: `1px solid ${theme.color.accentSoftBorder}`, borderRadius: theme.radius.pill,
    cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.primary,
  },

  inputRow: {
    display: 'flex', gap: '10px', padding: '16px',
    borderTop: `1px solid ${theme.color.border}`, flexShrink: 0,
  },
  input: {
    flex: 1, minWidth: 0, padding: '12px 16px', borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none',
    fontFamily: theme.font.family, background: theme.color.surfaceMuted,
  },
  btnEnviar: {
    width: '44px', height: '44px',
    background: theme.color.gradient,
    color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md,
    fontSize: theme.font.size.xxl, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};

export default ChatIA;
