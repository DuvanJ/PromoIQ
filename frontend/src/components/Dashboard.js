import React, { useState } from 'react';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';
import { theme } from '../styles/theme';

function Dashboard({ usuario, onLogout }) {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [mensajeCarga, setMensajeCarga] = useState('');
  const [cargandoExcel, setCargandoExcel] = useState(false);

  const preguntar = async (e) => {
    e.preventDefault();
    if (!pregunta.trim() || cargando) return;
    setCargando(true);
    setRespuesta('');
    try {
      const res = await api.post('/consultas/preguntar', { pregunta });
      setRespuesta(res.data.respuesta);
    } catch (err) {
      setRespuesta('Error consultando la IA. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const cargarExcel = async () => {
    if (!archivo || cargandoExcel) return;
    setCargandoExcel(true);
    const formData = new FormData();
    formData.append('file', archivo);
    try {
      const res = await api.post('/dinamicas/cargar', formData);
      setMensajeCarga(`✅ ${res.data.registros_cargados} registros cargados exitosamente`);
    } catch (err) {
      setMensajeCarga('❌ Error cargando el archivo');
    } finally {
      setCargandoExcel(false);
    }
  };

  const coloreRol = {
    admin: theme.color.primary,
    comercial: theme.color.accent,
    planning: theme.color.successAccent,
    tienda: theme.color.warningBorder,
    tiendas: theme.color.warningBorder,
  };

  const preguntasSugeridas = [
    '¿Qué artículos están en dinámica?',
    '¿Cuáles artículos están en isla?',
    '¿Qué productos tiene la tienda CR-01?',
    '¿Cuál es el artículo más barato en campaña?',
  ];

  return (
    <div style={styles.container}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={styles.logoSidebar}>PromoIQ</h2>
        <p style={styles.subtituloSidebar}>Dinámicas Comerciales</p>

        <div style={{ ...styles.rolBadge, background: coloreRol[usuario.rol] || theme.color.primary }}>
          {usuario.rol.toUpperCase()}
        </div>

        <div style={styles.usuarioInfo}>
          <p style={styles.usuarioNombre}>{usuario.nombre}</p>
          <p style={styles.usuarioEmail}>{usuario.email}</p>
        </div>

        <div style={styles.divider} />

        <p style={styles.seccionLabel} id="sugerencias-label">Preguntas sugeridas</p>
        <div role="group" aria-labelledby="sugerencias-label">
          {preguntasSugeridas.map((p, i) => (
            <button
              key={i}
              className="pd-pressable pd-hoverable"
              style={styles.sugerencia}
              onClick={() => setPregunta(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {usuario.rol === 'admin' && (
          <>
            <div style={styles.divider} />
            <p style={styles.seccionLabel} id="cargar-excel-label">Cargar Excel</p>
            <label htmlFor="input-excel-dashboard" style={styles.srOnly}>Seleccionar archivo Excel</label>
            <input
              id="input-excel-dashboard"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setArchivo(e.target.files[0])}
              style={styles.inputFile}
              aria-describedby="cargar-excel-label"
            />
            <button
              className="pd-pressable"
              style={{ ...styles.botonCargar, opacity: cargandoExcel || !archivo ? 0.7 : 1, cursor: cargandoExcel || !archivo ? 'not-allowed' : 'pointer' }}
              onClick={cargarExcel}
              disabled={cargandoExcel || !archivo}
            >
              {cargandoExcel ? 'Cargando...' : 'Cargar archivo'}
            </button>
            {mensajeCarga && <p style={styles.mensajeCarga} role="status">{mensajeCarga}</p>}
          </>
        )}

        <div style={styles.divider} />
        <button className="pd-pressable" style={styles.botonLogout} onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.headerTitulo}>Centro de Inteligencia</h1>
          <p style={styles.headerSub}>Consultá cualquier información sobre dinámicas comerciales</p>
        </div>

        {/* CHAT */}
        <div style={styles.chatContainer} aria-live="polite">
          {!respuesta && !cargando && (
            <div style={styles.bienvenida}>
              <h2 style={styles.bienvenidaTitulo}>¡Hola, {usuario.nombre}! 👋</h2>
              <p style={styles.bienvenidaSub}>
                Soy el asistente de PromoIQ. Podés preguntarme sobre artículos en campaña,
                precios, ubicaciones en tienda y mucho más.
              </p>
            </div>
          )}

          {cargando && (
            <div style={styles.cargando}>
              <span className="pd-spinner" style={styles.spinnerGrande} aria-hidden="true" />
              <p style={styles.cargandoTexto}>Consultando IA...</p>
            </div>
          )}

          {respuesta && (
            <div style={styles.respuestaContainer}>
              <div style={styles.respuestaHeader}>
                <span style={styles.respuestaIcon} aria-hidden="true">🤖</span>
                <span style={styles.respuestaLabel}>PromoIQ IA</span>
              </div>
              <div style={styles.respuesta}>
                <ReactMarkdown>{respuesta}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* INPUT */}
        <form onSubmit={preguntar} style={styles.inputContainer}>
          <label htmlFor="pregunta-dashboard" style={styles.srOnly}>Escribí tu pregunta</label>
          <input
            id="pregunta-dashboard"
            className="pd-hoverable"
            style={styles.inputPregunta}
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Ej: ¿El artículo 10245 está en dinámica?"
            disabled={cargando}
          />
          <button
            className="pd-pressable"
            style={styles.botonEnviar}
            type="submit"
            disabled={cargando}
            aria-label="Enviar pregunta"
          >
            {cargando ? '...' : '➤'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: theme.font.family,
    background: theme.color.background,
  },
  sidebar: {
    width: '280px',
    background: theme.color.primary,
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  logoSidebar: {
    color: theme.color.textOnPrimary,
    fontSize: '28px',
    fontWeight: theme.font.weight.black,
    margin: '0 0 4px 0',
  },
  subtituloSidebar: {
    color: theme.color.dropBorder,
    fontSize: theme.font.size.sm,
    margin: '0 0 24px 0',
  },
  rolBadge: {
    color: theme.color.textOnPrimary,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
    padding: '4px 12px',
    borderRadius: theme.radius.pill,
    display: 'inline-block',
    marginBottom: '16px',
  },
  usuarioInfo: {
    marginBottom: '8px',
  },
  usuarioNombre: {
    color: theme.color.textOnPrimary,
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.semibold,
    margin: '0 0 2px 0',
  },
  usuarioEmail: {
    color: theme.color.textMuted,
    fontSize: theme.font.size.sm,
    margin: 0,
  },
  divider: {
    height: '1px',
    background: '#2D3875',
    margin: '20px 0',
  },
  seccionLabel: {
    color: theme.color.dropBorder,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 12px 0',
  },
  sugerencia: {
    background: '#2D3875',
    color: theme.color.dropBorder,
    border: 'none',
    borderRadius: theme.radius.sm,
    padding: '10px 12px',
    fontSize: theme.font.size.sm,
    cursor: 'pointer',
    marginBottom: '8px',
    width: '100%',
    textAlign: 'left',
  },
  inputFile: {
    color: theme.color.dropBorder,
    fontSize: theme.font.size.sm,
    marginBottom: '8px',
    width: '100%',
  },
  botonCargar: {
    background: theme.color.successAccent,
    color: theme.color.primary,
    border: 'none',
    borderRadius: theme.radius.sm,
    padding: '10px',
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.bold,
    cursor: 'pointer',
    width: '100%',
    marginBottom: '8px',
  },
  mensajeCarga: {
    color: theme.color.successAccent,
    fontSize: theme.font.size.sm,
    margin: '4px 0 0 0',
  },
  botonLogout: {
    background: 'transparent',
    color: theme.color.textMuted,
    border: '1px solid #2D3875',
    borderRadius: theme.radius.sm,
    padding: '10px',
    fontSize: theme.font.size.base,
    cursor: 'pointer',
    width: '100%',
    marginTop: 'auto',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '32px',
  },
  header: {
    marginBottom: '24px',
  },
  headerTitulo: {
    fontSize: '28px',
    fontWeight: theme.font.weight.black,
    color: theme.color.primary,
    margin: '0 0 4px 0',
  },
  headerSub: {
    fontSize: theme.font.size.md,
    color: theme.color.textMuted,
    margin: 0,
  },
  chatContainer: {
    flex: 1,
    background: theme.color.surface,
    borderRadius: theme.radius.xxl,
    padding: '32px',
    marginBottom: '16px',
    boxShadow: theme.shadow.md,
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  bienvenida: {
    textAlign: 'center',
    padding: '40px',
  },
  bienvenidaTitulo: {
    fontSize: '24px',
    color: theme.color.primary,
    marginBottom: '12px',
  },
  bienvenidaSub: {
    fontSize: theme.font.size.lg,
    color: theme.color.textMuted,
    maxWidth: '500px',
    margin: '0 auto',
    lineHeight: '1.6',
  },
  cargando: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px',
  },
  spinnerGrande: {
    width: '40px',
    height: '40px',
    border: `4px solid ${theme.color.dropBorder}`,
  },
  cargandoTexto: {
    color: theme.color.textMuted,
    marginTop: '16px',
    fontSize: theme.font.size.md,
  },
  respuestaContainer: {
    padding: '8px',
  },
  respuestaHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
  },
  respuestaIcon: {
    fontSize: '24px',
    marginRight: '8px',
  },
  respuestaLabel: {
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.bold,
    color: theme.color.primary,
  },
  respuesta: {
    fontSize: theme.font.size.lg,
    color: '#222222',
    lineHeight: '1.7',
  },
  inputContainer: {
    display: 'flex',
    gap: '12px',
  },
  inputPregunta: {
    flex: 1,
    padding: '16px 20px',
    borderRadius: theme.radius.lg,
    border: `1.5px solid ${theme.color.dropBorder}`,
    fontSize: theme.font.size.lg,
    outline: 'none',
    fontFamily: theme.font.family,
  },
  botonEnviar: {
    background: theme.color.gradient,
    color: theme.color.textOnPrimary,
    border: 'none',
    borderRadius: theme.radius.lg,
    padding: '16px 24px',
    fontSize: '20px',
    cursor: 'pointer',
  },
};

export default Dashboard;