import React, { useState } from 'react';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';

function Dashboard({ usuario, onLogout }) {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [mensajeCarga, setMensajeCarga] = useState('');

  const preguntar = async (e) => {
    e.preventDefault();
    if (!pregunta.trim()) return;
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
    if (!archivo) return;
    const formData = new FormData();
    formData.append('file', archivo);
    try {
      const res = await api.post('/dinamicas/cargar', formData);
      setMensajeCarga(`✅ ${res.data.registros_cargados} registros cargados exitosamente`);
    } catch (err) {
      setMensajeCarga('❌ Error cargando el archivo');
    }
  };

  const coloreRol = {
    admin: '#1E2761',
    comercial: '#0077B6',
    planning: '#06D6A0',
    tienda: '#F9C74F',
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

        <div style={{ ...styles.rolBadge, background: coloreRol[usuario.rol] || '#1E2761' }}>
          {usuario.rol.toUpperCase()}
        </div>

        <div style={styles.usuarioInfo}>
          <p style={styles.usuarioNombre}>{usuario.nombre}</p>
          <p style={styles.usuarioEmail}>{usuario.email}</p>
        </div>

        <div style={styles.divider} />

        <p style={styles.seccionLabel}>Preguntas sugeridas</p>
        {preguntasSugeridas.map((p, i) => (
          <button
            key={i}
            style={styles.sugerencia}
            onClick={() => setPregunta(p)}
          >
            {p}
          </button>
        ))}

        {usuario.rol === 'admin' && (
          <>
            <div style={styles.divider} />
            <p style={styles.seccionLabel}>Cargar Excel</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setArchivo(e.target.files[0])}
              style={styles.inputFile}
            />
            <button style={styles.botonCargar} onClick={cargarExcel}>
              Cargar archivo
            </button>
            {mensajeCarga && <p style={styles.mensajeCarga}>{mensajeCarga}</p>}
          </>
        )}

        <div style={styles.divider} />
        <button style={styles.botonLogout} onClick={onLogout}>
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
        <div style={styles.chatContainer}>
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
              <div style={styles.spinner} />
              <p style={styles.cargandoTexto}>Consultando IA...</p>
            </div>
          )}

          {respuesta && (
            <div style={styles.respuestaContainer}>
              <div style={styles.respuestaHeader}>
                <span style={styles.respuestaIcon}>🤖</span>
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
          <input
            style={styles.inputPregunta}
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Ej: ¿El artículo 10245 está en dinámica?"
            disabled={cargando}
          />
          <button style={styles.botonEnviar} type="submit" disabled={cargando}>
            {cargando ? '...' : '➤'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Calibri, sans-serif',
    background: '#F4F7FB',
  },
  sidebar: {
    width: '280px',
    background: '#1E2761',
    padding: '32px 20px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  logoSidebar: {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: '800',
    margin: '0 0 4px 0',
  },
  subtituloSidebar: {
    color: '#CADCFC',
    fontSize: '12px',
    margin: '0 0 24px 0',
  },
  rolBadge: {
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: '700',
    padding: '4px 12px',
    borderRadius: '20px',
    display: 'inline-block',
    marginBottom: '16px',
  },
  usuarioInfo: {
    marginBottom: '8px',
  },
  usuarioNombre: {
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    margin: '0 0 2px 0',
  },
  usuarioEmail: {
    color: '#8892A4',
    fontSize: '12px',
    margin: 0,
  },
  divider: {
    height: '1px',
    background: '#2D3875',
    margin: '20px 0',
  },
  seccionLabel: {
    color: '#CADCFC',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 12px 0',
  },
  sugerencia: {
    background: '#2D3875',
    color: '#CADCFC',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    marginBottom: '8px',
    width: '100%',
    textAlign: 'left',
  },
  inputFile: {
    color: '#CADCFC',
    fontSize: '12px',
    marginBottom: '8px',
    width: '100%',
  },
  botonCargar: {
    background: '#06D6A0',
    color: '#1E2761',
    border: 'none',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    width: '100%',
    marginBottom: '8px',
  },
  mensajeCarga: {
    color: '#06D6A0',
    fontSize: '12px',
    margin: '4px 0 0 0',
  },
  botonLogout: {
    background: 'transparent',
    color: '#8892A4',
    border: '1px solid #2D3875',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '13px',
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
    fontWeight: '800',
    color: '#1E2761',
    margin: '0 0 4px 0',
  },
  headerSub: {
    fontSize: '14px',
    color: '#8892A4',
    margin: 0,
  },
  chatContainer: {
    flex: 1,
    background: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '16px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
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
    color: '#1E2761',
    marginBottom: '12px',
  },
  bienvenidaSub: {
    fontSize: '15px',
    color: '#8892A4',
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
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #CADCFC',
    borderTop: '4px solid #1E2761',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  cargandoTexto: {
    color: '#8892A4',
    marginTop: '16px',
    fontSize: '14px',
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
    fontSize: '14px',
    fontWeight: '700',
    color: '#1E2761',
  },
  respuesta: {
    fontSize: '15px',
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
    borderRadius: '12px',
    border: '1.5px solid #CADCFC',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'Calibri, sans-serif',
  },
  botonEnviar: {
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 24px',
    fontSize: '20px',
    cursor: 'pointer',
  },
};

export default Dashboard;