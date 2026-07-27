import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import ReactMarkdown from 'react-markdown';

function ChatIA({ flotante = false, onCerrar }) {
  const [mensajes, setMensajes] = useState([
    {
      rol: 'ia',
      texto: '¡Hola! Soy el asistente de PromoIQ. Puedo ayudarte con información sobre dinámicas comerciales, artículos en campaña, análisis y mucho más. ¿En qué te puedo ayudar?'
    }
  ]);
  const [pregunta, setPregunta] = useState('');
  const [cargando, setCargando] = useState(false);
  const chatRef = useRef(null);

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
  }, [mensajes, cargando]);

  const enviar = async (textoPregunta) => {
    const texto = textoPregunta || pregunta;
    if (!texto.trim() || cargando) return;

    const nuevaMensajes = [...mensajes, { rol: 'usuario', texto }];
    setMensajes(nuevaMensajes);
    setPregunta('');
    setCargando(true);

    try {
      // Token agregado automáticamente por el interceptor de api.js
      const res = await api.post('/consultas/preguntar', { pregunta: texto });
      setMensajes([...nuevaMensajes, { rol: 'ia', texto: res.data.respuesta }]);
    } catch (err) {
      setMensajes([...nuevaMensajes, {
        rol: 'ia',
        texto: '❌ Ocurrió un error al consultar la IA. Intentá de nuevo.'
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
    <div style={contenedor}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.iaAvatar}>🤖</div>
          <div>
            <p style={styles.headerTitulo}>PromoIQ IA</p>
            <p style={styles.headerSub}>● En línea</p>
          </div>
        </div>
        <div style={styles.headerAcciones}>
          <button style={styles.btnLimpiar} onClick={limpiarChat} title="Limpiar chat">
            🗑️
          </button>
          {flotante && (
            <button style={styles.btnCerrarFlotante} onClick={onCerrar}>✕</button>
          )}
        </div>
      </div>

      <div ref={chatRef} style={flotante ? styles.flotanteMensajes : styles.moduloMensajes}>
        {mensajes.map((m, i) => (
          <div key={i} style={m.rol === 'usuario' ? styles.mensajeUsuarioWrapper : styles.mensajeIAWrapper}>
            {m.rol === 'ia' && (
              <div style={styles.iaAvatarSmall}>🤖</div>
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
            <div style={styles.iaAvatarSmall}>🤖</div>
            <div style={styles.mensajeIA}>
              <div style={styles.typing}>
                <span style={styles.dot} />
                <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
                <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {mensajes.length === 1 && (
        <div style={styles.sugeridas}>
          {sugeridas.map((s, i) => (
            <button key={i} style={styles.sugerida} onClick={() => enviar(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="Escribí tu pregunta..."
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          disabled={cargando}
        />
        <button
          style={{
            ...styles.btnEnviar,
            opacity: cargando || !pregunta.trim() ? 0.6 : 1,
            cursor: cargando || !pregunta.trim() ? 'not-allowed' : 'pointer'
          }}
          onClick={() => enviar()}
          disabled={cargando || !pregunta.trim()}
        >
          ➤
        </button>
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
  // Modo módulo (pantalla completa)
  moduloChat: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 140px)',
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
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

  // Modo flotante
  flotanteChat: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#ffffff',
    borderRadius: '16px',
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

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  iaAvatar: {
    width: '40px', height: '40px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
  },
  headerTitulo: { color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: 0 },
  headerSub: { color: '#06D6A0', fontSize: '12px', margin: '2px 0 0 0' },
  headerAcciones: { display: 'flex', gap: '8px', alignItems: 'center' },
  btnLimpiar: {
    background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: '8px', padding: '6px 10px',
    cursor: 'pointer', fontSize: '16px',
  },
  btnCerrarFlotante: {
    background: 'rgba(255,255,255,0.1)', border: 'none',
    borderRadius: '8px', padding: '6px 10px',
    cursor: 'pointer', fontSize: '16px', color: '#ffffff', fontWeight: '700',
  },

  // Mensajes
  mensajeUsuarioWrapper: {
    display: 'flex', justifyContent: 'flex-end',
  },
  mensajeIAWrapper: {
    display: 'flex', gap: '8px', alignItems: 'flex-start',
  },
  iaAvatarSmall: {
    width: '32px', height: '32px', borderRadius: '50%',
    background: '#EEF2FF', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '16px', flexShrink: 0,
  },
  mensajeUsuario: {
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff', borderRadius: '16px 16px 4px 16px',
    padding: '12px 16px', maxWidth: '75%', fontSize: '14px', lineHeight: '1.5',
  },
  mensajeIA: {
    background: '#F4F7FB', color: '#333',
    borderRadius: '4px 16px 16px 16px',
    padding: '12px 16px', maxWidth: '80%',
    fontSize: '14px', lineHeight: '1.6',
  },

  // Typing
  typing: { display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' },
  dot: {
    width: '8px', height: '8px', borderRadius: '50%',
    background: '#8892A4', display: 'inline-block',
    animation: 'bounce 1.2s infinite',
  },

  // Sugeridas
  sugeridas: {
    padding: '0 16px 12px',
    display: 'flex', flexWrap: 'wrap', gap: '8px',
  },
  sugerida: {
    padding: '6px 12px', background: '#EEF2FF',
    border: '1px solid #C7D2FE', borderRadius: '20px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#1E2761',
  },

  // Input
  inputRow: {
    display: 'flex', gap: '10px', padding: '16px',
    borderTop: '1px solid #E2E8F0', flexShrink: 0,
  },
  input: {
    flex: 1, padding: '12px 16px', borderRadius: '10px',
    border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none',
    fontFamily: 'Calibri, sans-serif', background: '#F8FAFC',
  },
  btnEnviar: {
    width: '44px', height: '44px',
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff', border: 'none', borderRadius: '10px',
    fontSize: '18px', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};

export default ChatIA;