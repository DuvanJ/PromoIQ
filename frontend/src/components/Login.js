import React, { useState } from 'react';
import api from '../utils/api';
import videoLogin from '../assets/login-animacion.mp4';
import { theme } from '../styles/theme';

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { usuario, password });
      // La transición visual (pantalla "Iniciando sesión...") la
      // maneja App.js — acá solo se entrega el resultado.
      onLogin(res.data);
    } catch (err) {
      setError('Usuario o contraseña incorrectos');
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>

      {/* Panel izquierdo decorativo — oculto en pantallas < 1024px
          para dejarle todo el ancho al formulario, que es lo único
          que hace falta para iniciar sesión en un celular. */}
      <div className="pd-hide-mobile" style={styles.panelIzquierdo}>
        <video
          className="pd-decorative-video"
          style={styles.video}
          src={videoLogin}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
        <div style={styles.overlay} />

        <div style={styles.panelContenido}>
          <div style={styles.logoGrande}>PromoIQ</div>
          <p style={styles.tagline}>Centro de Inteligencia de<br/>Dinámicas Comerciales</p>
          <div style={styles.features}>
            <div style={styles.feature}>
              <span style={styles.featureIcon} aria-hidden="true">⚡</span>
              <span>Consultas en tiempo real</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon} aria-hidden="true">🤖</span>
              <span>Inteligencia Artificial integrada</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon} aria-hidden="true">📦</span>
              <span>Gestión de dinámicas comerciales</span>
            </div>
            <div style={styles.feature}>
              <span style={styles.featureIcon} aria-hidden="true">📈</span>
              <span>Análisis y reportes automáticos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario. Ocupa todo el ancho cuando el
          panel izquierdo está oculto (mobile/tablet). */}
      <div style={styles.panelDerecho}>
        <div className="pd-page-in" style={styles.card}>

          <h2 style={styles.titulo}>Bienvenido</h2>
          <p style={styles.subtitulo}>Ingresá tus credenciales para continuar</p>

          <form onSubmit={handleSubmit}>

            <div style={styles.campo}>
              <label htmlFor="login-usuario" style={styles.label}>Usuario</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon} aria-hidden="true">👤</span>
                <input
                  id="login-usuario"
                  className="pd-hoverable"
                  style={styles.input}
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingresá tu usuario"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.campo}>
              <label htmlFor="login-password" style={styles.label}>Contraseña</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon} aria-hidden="true">🔑</span>
                <input
                  id="login-password"
                  className="pd-hoverable"
                  style={styles.inputPassword}
                  type={verPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="pd-pressable"
                  style={styles.togglePassword}
                  onClick={() => setVerPassword(!verPassword)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  aria-pressed={verPassword}
                >
                  {verPassword ? '●' : '○'}
                </button>
              </div>
            </div>

            {error && (
              <div style={styles.errorBox} role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button
              className="pd-pressable"
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
    fontFamily: theme.font.family,
    overflow: 'hidden',
  },

  // Panel izquierdo — 60% en desktop, oculto en mobile/tablet
  panelIzquierdo: {
    flex: '0 0 60%',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.color.loginBackdrop,
    boxSizing: 'border-box',
  },
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: 0,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(145deg, rgba(13,27,75,0.85) 0%, rgba(30,39,97,0.75) 50%, rgba(0,119,182,0.7) 100%)',
    zIndex: 1,
  },
  panelContenido: {
    position: 'relative',
    zIndex: 2,
    padding: '40px',
  },
  logoGrande: {
    fontSize: '56px',
    fontWeight: theme.font.weight.black,
    color: theme.color.textOnPrimary,
    letterSpacing: '-2px',
    marginBottom: '16px',
  },
  tagline: {
    fontSize: theme.font.size.xxl,
    color: theme.color.dropBorder,
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
    color: theme.color.textOnPrimary,
    fontSize: theme.font.size.lg,
  },
  featureIcon: {
    fontSize: theme.font.size.xxl,
    width: '36px',
    height: '36px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: theme.radius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Panel derecho — se expande a 100% cuando el izquierdo está oculto
  panelDerecho: {
    flex: '1 1 320px',
    background: theme.color.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(20px, 6vw, 40px)',
    boxSizing: 'border-box',
  },
  card: {
    background: theme.color.surface,
    borderRadius: theme.radius.xxl,
    padding: 'clamp(28px, 6vw, 48px) clamp(20px, 5vw, 40px)',
    width: '100%',
    maxWidth: '420px',
    boxShadow: theme.shadow.floating,
  },
  titulo: {
    fontSize: '28px',
    fontWeight: theme.font.weight.black,
    color: theme.color.primary,
    margin: '0 0 8px 0',
  },
  subtitulo: {
    fontSize: theme.font.size.md,
    color: theme.color.textMuted,
    marginBottom: '32px',
  },
  campo: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.bold,
    color: theme.color.primary,
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
    fontSize: theme.font.size.xl,
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.color.border}`,
    fontSize: theme.font.size.lg,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: theme.font.family,
    background: theme.color.surfaceMuted,
  },
  inputPassword: {
    width: '100%',
    padding: '14px 48px 14px 44px',
    borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.color.border}`,
    fontSize: theme.font.size.lg,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: theme.font.family,
    background: theme.color.surfaceMuted,
  },
  togglePassword: {
    position: 'absolute',
    right: '14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    color: theme.color.textMuted,
    padding: '0',
    lineHeight: 1,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: theme.color.errorBg,
    border: `1px solid ${theme.color.errorBorder}`,
    borderRadius: theme.radius.sm,
    padding: '12px 16px',
    color: theme.color.error,
    fontSize: theme.font.size.base,
    marginBottom: '16px',
  },
  boton: {
    width: '100%',
    padding: '16px',
    background: theme.color.gradient,
    color: theme.color.textOnPrimary,
    border: 'none',
    borderRadius: theme.radius.md,
    fontSize: theme.font.size.xl,
    fontWeight: theme.font.weight.bold,
    cursor: 'pointer',
    marginTop: '8px',
    fontFamily: theme.font.family,
    letterSpacing: '0.5px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '32px',
    fontSize: theme.font.size.xs,
    color: theme.color.textMuted,
  },
};

export default Login;