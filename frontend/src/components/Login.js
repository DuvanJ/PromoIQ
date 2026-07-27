import React, { useState } from 'react';
import api from '../utils/api';

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { usuario, password });
      onLogin(res.data);
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>

      {/* Panel izquierdo decorativo */}
      <div style={styles.panelIzquierdo}>
        <div style={styles.panelContenido}>
          <div style={styles.logoGrande}>PromoIQ</div>
          <p style={styles.tagline}>Centro de Inteligencia de<br/>Dinámicas Comerciales</p>
          <div style={styles.features}>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>⚡</span>
              <span>Consultas en tiempo real</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>🤖</span>
              <span>Inteligencia Artificial integrada</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>📦</span>
              <span>Gestión de dinámicas comerciales</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon}>📈</span>
              <span>Análisis y reportes automáticos</span>
            </div>
          </div>
        </div>
        <div style={styles.circulo1} />
        <div style={styles.circulo2} />
        <div style={styles.circulo3} />
      </div>

      {/* Panel derecho — formulario */}
      <div style={styles.panelDerecho}>
        <div style={styles.card}>

          <h2 style={styles.titulo}>Bienvenido</h2>
          <p style={styles.subtitulo}>Ingresá tus credenciales para continuar</p>

          <form onSubmit={handleSubmit}>

            <div style={styles.campo}>
              <label style={styles.label}>Usuario</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>👤</span>
                <input
                  style={styles.input}
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingresá tu usuario"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.campo}>
              <label style={styles.label}>Contraseña</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>🔑</span>
                <input
                  style={styles.inputPassword}
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  style={styles.togglePassword}
                  onClick={() => setVerPassword(!verPassword)}
                  title={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {verPassword ? '●' : '○'}
                </button>
              </div>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              style={{
                ...styles.boton,
                opacity: cargando ? 0.8 : 1,
                cursor: cargando ? 'not-allowed' : 'pointer'
              }}
              type="submit"
              disabled={cargando}
            >
              {cargando ? 'Ingresando...' : 'Ingresar →'}
            </button>

          </form>

          <div style={styles.footer}>
            <span>VIDRI/NOVEX · 2026</span>
          </div>

        </div>
      </div>

    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Calibri, sans-serif',
  },

  // Panel izquierdo 50%
  panelIzquierdo: {
    flex: 1,
    background: 'linear-gradient(145deg, #0D1B4B 0%, #1E2761 50%, #0077B6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  panelContenido: {
    position: 'relative',
    zIndex: 2,
    padding: '40px',
  },
  logoGrande: {
    fontSize: '56px',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: '-2px',
    marginBottom: '16px',
  },
  tagline: {
    fontSize: '18px',
    color: '#CADCFC',
    lineHeight: '1.6',
    marginBottom: '48px',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    color: '#ffffff',
    fontSize: '15px',
  },
  featureIcon: {
    fontSize: '20px',
    width: '36px',
    height: '36px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circulo1: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.04)',
    top: '-100px',
    right: '-100px',
  },
  circulo2: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.04)',
    bottom: '-80px',
    left: '-80px',
  },
  circulo3: {
    position: 'absolute',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'rgba(0,119,182,0.3)',
    bottom: '100px',
    right: '50px',
  },

  // Panel derecho 50%
  panelDerecho: {
    flex: 1,
    background: '#F4F7FB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '48px 40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
  },
  titulo: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#1E2761',
    margin: '0 0 8px 0',
  },
  subtitulo: {
    fontSize: '14px',
    color: '#8892A4',
    marginBottom: '32px',
  },
  campo: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '700',
    color: '#1E2761',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '16px',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    borderRadius: '10px',
    border: '1.5px solid #E2E8F0',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
    background: '#F8FAFC',
  },
  inputPassword: {
    width: '100%',
    padding: '14px 48px 14px 44px',
    borderRadius: '10px',
    border: '1.5px solid #E2E8F0',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif',
    background: '#F8FAFC',
  },
  togglePassword: {
    position: 'absolute',
    right: '14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    color: '#8892A4',
    padding: '0',
    lineHeight: 1,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#FFF0F0',
    border: '1px solid #FFD0D0',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#D32F2F',
    fontSize: '13px',
    marginBottom: '16px',
  },
  boton: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    fontFamily: 'Calibri, sans-serif',
    letterSpacing: '0.5px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '32px',
    fontSize: '11px',
    color: '#8892A4',
  },
};

export default Login;