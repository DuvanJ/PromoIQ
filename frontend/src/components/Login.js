import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import videoLogin from '../assets/login-animacion.mp4';
import { theme } from '../styles/theme';

function Login({ onLogin }) {
  const [vista, setVista] = useState('login'); // 'login' | 'recuperar' | 'restablecer'
  const [tipoAcceso, setTipoAcceso] = useState('colaborador');

  // Login — colaborador
  const [numeroColaborador, setNumeroColaborador] = useState('');
  const [pais, setPais] = useState(''); // sin valor por defecto — hay que elegirlo
  const [paises, setPaises] = useState([]);

  // Login — tienda
  const [usuario, setUsuario] = useState('');

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  // Recuperar contraseña
  const [recEmail, setRecEmail] = useState('');
  const [recNumero, setRecNumero] = useState('');
  const [recPais, setRecPais] = useState('');
  const [recEnviando, setRecEnviando] = useState(false);
  const [recEnviado, setRecEnviado] = useState(false);
  const [recError, setRecError] = useState('');

  // Restablecer (llega desde el enlace del correo)
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmar, setResetConfirmar] = useState('');
  const [resetEnviando, setResetEnviando] = useState(false);
  const [resetListo, setResetListo] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando países:', err));

    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setVista('restablecer');
    }
  }, []);

  const cambiarTipoAcceso = (tipo) => {
    setTipoAcceso(tipo);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cargando) return;

    if (tipoAcceso === 'colaborador' && !pais) {
      setError('Elegí tu país para continuar');
      return;
    }

    setCargando(true);
    setError('');
    try {
      const payload = tipoAcceso === 'tienda'
        ? { tipo_acceso: 'tienda', usuario, password }
        : { tipo_acceso: 'colaborador', numero_colaborador: numeroColaborador, pais, password };

      const res = await api.post('/auth/login', payload);
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Usuario o contraseña incorrectos');
      setCargando(false);
    }
  };

  const handleRecuperar = async (e) => {
    e.preventDefault();
    if (recEnviando) return;
    if (!recPais) {
      setRecError('Elegí tu país para continuar');
      return;
    }
    setRecEnviando(true);
    setRecError('');
    try {
        await api.post('/auth/olvide-password', {
        numero_colaborador: recNumero,
        pais: recPais,
        email: recEmail,
      });
      setRecEnviado(true);
    } catch (err) {
      setRecError(err.response?.data?.detail || 'No se pudo procesar la solicitud. Intentá de nuevo.');
    } finally {
      setRecEnviando(false);
    }
  };

  const handleRestablecer = async (e) => {
    e.preventDefault();
    if (resetEnviando) return;
    if (resetPassword.length < 6) {
      setResetError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (resetPassword !== resetConfirmar) {
      setResetError('Las contraseñas no coinciden');
      return;
    }
    setResetEnviando(true);
    setResetError('');
    try {
      await api.post('/auth/restablecer-password', {
        token: resetToken,
        password_nueva: resetPassword,
      });
      setResetListo(true);
    } catch (err) {
      setResetError(err.response?.data?.detail || 'No se pudo restablecer la contraseña');
    } finally {
      setResetEnviando(false);
    }
  };

  const volverAlLogin = () => {
    window.history.replaceState({}, '', window.location.pathname);
    setVista('login');
    setRecEnviado(false);
    setResetListo(false);
    setError('');
  };

  return (
    <div style={styles.container}>

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
        <div style={styles.grillaPlano} aria-hidden="true" />
        <div style={styles.overlay} />

        <div style={styles.panelContenido}>
          <div style={styles.logoGrande}>PromoIQ</div>
          <p style={styles.tagline}>El mapa de tus dinámicas<br/>comerciales, siempre a mano.</p>
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

      <div style={styles.panelDerecho}>
        <div className="pd-page-in" style={styles.card}>

          {/* ── VISTA: LOGIN ── */}
          {vista === 'login' && (
            <>
              <h2 style={styles.titulo}>Bienvenido</h2>
              <p style={styles.subtitulo}>Ingresá tus credenciales para continuar</p>

              <div style={styles.tipoAccesoRow} role="tablist" aria-label="Tipo de acceso">
                <div
                  style={{
                    ...styles.tipoAccesoIndicador,
                    transform: tipoAcceso === 'colaborador' ? 'translateX(0%)' : 'translateX(100%)',
                  }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="pd-pressable"
                  style={{ ...styles.tipoAccesoBtn, color: tipoAcceso === 'colaborador' ? theme.color.primary : theme.color.textMuted }}
                  onClick={() => cambiarTipoAcceso('colaborador')}
                  role="tab"
                  aria-selected={tipoAcceso === 'colaborador'}
                >
                  🧑‍💼 Colaborador
                </button>
                <button
                  type="button"
                  className="pd-pressable"
                  style={{ ...styles.tipoAccesoBtn, color: tipoAcceso === 'tienda' ? theme.color.primary : theme.color.textMuted }}
                  onClick={() => cambiarTipoAcceso('tienda')}
                  role="tab"
                  aria-selected={tipoAcceso === 'tienda'}
                >
                  🏪 Tienda
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {tipoAcceso === 'colaborador' ? (
                  <>
                    <div style={styles.campo}>
                      <label htmlFor="login-colaborador" style={styles.label}>Número de colaborador</label>
                      <div style={styles.inputWrapper}>
                        <span style={styles.inputIcon} aria-hidden="true">🪪</span>
                        <input
                          id="login-colaborador"
                          className="pd-hoverable"
                          style={styles.input}
                          type="text"
                          value={numeroColaborador}
                          onChange={(e) => setNumeroColaborador(e.target.value)}
                          placeholder="Ej: 1024"
                          autoComplete="username"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div style={styles.campo}>
                      <label htmlFor="login-pais" style={styles.label}>País</label>
                      <select
                        id="login-pais"
                        className="pd-hoverable"
                        style={{ ...styles.select, color: pais ? theme.color.text : theme.color.textMuted }}
                        value={pais}
                        onChange={(e) => setPais(e.target.value)}
                        required
                      >
                        <option value="" disabled>Elegí tu país</option>
                        <option value="GLOBAL">🌐 Superadmin / Global</option>
                        {paises.map(p => (
                          <option key={p.codigo} value={p.codigo}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
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
                )}

                <div style={styles.campo}>
                  <div style={styles.labelRow}>
                    <label htmlFor="login-password" style={styles.label}>Contraseña</label>
                    {tipoAcceso === 'colaborador' && (
                      <button
                        type="button"
                        className="pd-pressable"
                        style={styles.linkOlvide}
                        onClick={() => { setVista('recuperar'); setError(''); }}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
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
                  {tipoAcceso === 'tienda' && (
                    <p style={styles.notaTienda}>
                      ¿Olvidaste la contraseña de tienda? Pedísela a tu administrador.
                    </p>
                  )}
                </div>

                {error && (
                  <div style={styles.errorBox} role="alert">
                    <span aria-hidden="true">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  className="pd-pressable"
                  style={{ ...styles.boton, opacity: cargando ? 0.8 : 1, cursor: cargando ? 'not-allowed' : 'pointer' }}
                  type="submit"
                  disabled={cargando}
                >
                  {cargando ? 'Ingresando...' : 'Ingresar →'}
                </button>
              </form>
            </>
          )}

          {/* ── VISTA: RECUPERAR (pedir el enlace) ── */}
          {vista === 'recuperar' && !recEnviado && (
            <>
              <h2 style={styles.titulo}>Recuperar contraseña</h2>
              <p style={styles.subtitulo}>Ingresá tus datos y te mandamos un enlace por correo para elegir una contraseña nueva.</p>

              <form onSubmit={handleRecuperar}>
                <div style={styles.campo}>
                  <label htmlFor="rec-numero" style={styles.label}>Número de colaborador</label>
                  <input
                    id="rec-numero"
                    className="pd-hoverable"
                    style={styles.input}
                    type="text"
                    value={recNumero}
                    onChange={(e) => setRecNumero(e.target.value)}
                    placeholder="Ej: 1024"
                    required
                    autoFocus
                  />
                </div>

                <div style={styles.campo}>
                  <label htmlFor="rec-pais" style={styles.label}>País</label>
                  <select
                    id="rec-pais"
                    className="pd-hoverable"
                    style={{ ...styles.select, color: recPais ? theme.color.text : theme.color.textMuted }}
                    value={recPais}
                    onChange={(e) => setRecPais(e.target.value)}
                    required
                  >
                    <option value="" disabled>Elegí tu país</option>
                    <option value="GLOBAL">🌐 Superadmin / Global</option>
                    {paises.map(p => (
                      <option key={p.codigo} value={p.codigo}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.campo}>
                  <label htmlFor="rec-email" style={styles.label}>Email registrado</label>
                  <input
                    id="rec-email"
                    className="pd-hoverable"
                    style={styles.input}
                    type="email"
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="tu-correo@empresa.com"
                    required
                  />
                </div>

                {recError && (
                  <div style={styles.errorBox} role="alert">
                    <span aria-hidden="true">⚠️</span>
                    <span>{recError}</span>
                  </div>
                )}

                <button
                  className="pd-pressable"
                  style={{ ...styles.boton, opacity: recEnviando ? 0.8 : 1, cursor: recEnviando ? 'not-allowed' : 'pointer' }}
                  type="submit"
                  disabled={recEnviando}
                >
                  {recEnviando ? 'Enviando...' : 'Enviar enlace'}
                </button>

                <button type="button" className="pd-pressable" style={styles.linkVolver} onClick={volverAlLogin}>
                  ← Volver a iniciar sesión
                </button>
              </form>
            </>
          )}

          {/* ── VISTA: RECUPERAR (confirmación) ── */}
          {vista === 'recuperar' && recEnviado && (
            <div style={styles.confirmacion}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">📩</span>
              <h2 style={styles.titulo}>Revisá tu correo</h2>
              <p style={styles.subtitulo}>
                Si los datos coinciden con una cuenta, te llega un correo con un enlace para elegir tu nueva contraseña. El enlace vence en 30 minutos.
              </p>
              <button className="pd-pressable" style={styles.boton} onClick={volverAlLogin}>
                Volver a iniciar sesión
              </button>
            </div>
          )}

          {/* ── VISTA: RESTABLECER (desde el enlace del correo) ── */}
          {vista === 'restablecer' && !resetListo && (
            <>
              <h2 style={styles.titulo}>Elegí tu nueva contraseña</h2>
              <p style={styles.subtitulo}>Mínimo 6 caracteres.</p>

              <form onSubmit={handleRestablecer}>
                <div style={styles.campo}>
                  <label htmlFor="reset-password" style={styles.label}>Nueva contraseña</label>
                  <input
                    id="reset-password"
                    className="pd-hoverable"
                    style={styles.input}
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                  />
                </div>

                <div style={styles.campo}>
                  <label htmlFor="reset-confirmar" style={styles.label}>Confirmar contraseña</label>
                  <input
                    id="reset-confirmar"
                    className="pd-hoverable"
                    style={styles.input}
                    type="password"
                    value={resetConfirmar}
                    onChange={(e) => setResetConfirmar(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {resetError && (
                  <div style={styles.errorBox} role="alert">
                    <span aria-hidden="true">⚠️</span>
                    <span>{resetError}</span>
                  </div>
                )}

                <button
                  className="pd-pressable"
                  style={{ ...styles.boton, opacity: resetEnviando ? 0.8 : 1, cursor: resetEnviando ? 'not-allowed' : 'pointer' }}
                  type="submit"
                  disabled={resetEnviando}
                >
                  {resetEnviando ? 'Guardando...' : 'Guardar nueva contraseña'}
                </button>
              </form>
            </>
          )}

          {/* ── VISTA: RESTABLECER (listo) ── */}
          {vista === 'restablecer' && resetListo && (
            <div style={styles.confirmacion}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">✅</span>
              <h2 style={styles.titulo}>Contraseña actualizada</h2>
              <p style={styles.subtitulo}>Ya podés iniciar sesión con tu nueva contraseña.</p>
              <button className="pd-pressable" style={styles.boton} onClick={volverAlLogin}>
                Ir a iniciar sesión
              </button>
            </div>
          )}

          {vista === 'login' && (
            <div style={styles.footer}>
              <span>VIDRI/NOVEX · 2026</span>
            </div>
          )}
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
  // Grilla sutil tipo "plano" — coherente con que el sistema dibuja
  // layouts de tienda. Un solo detalle deliberado, no decoración suelta.
  grillaPlano: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    pointerEvents: 'none',
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
    marginBottom: '28px',
    lineHeight: '1.5',
  },

  // ── Selector de tipo de acceso, con indicador deslizante ──
  tipoAccesoRow: {
    position: 'relative',
    display: 'flex',
    gap: '0',
    background: theme.color.background,
    padding: '4px',
    borderRadius: theme.radius.lg,
    marginBottom: '24px',
  },
  tipoAccesoIndicador: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    width: 'calc(50% - 4px)',
    height: 'calc(100% - 8px)',
    background: theme.color.surface,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadow.sm,
    transition: `transform ${theme.motion.duration.base} ${theme.motion.easing.inOut}`,
  },
  tipoAccesoBtn: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    padding: '10px',
    borderRadius: theme.radius.md,
    border: 'none',
    background: 'transparent',
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.semibold,
    cursor: 'pointer',
    fontFamily: theme.font.family,
  },

  campo: {
    marginBottom: '20px',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '8px',
  },
  label: {
    display: 'block',
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold,
    color: theme.color.primary,
    marginBottom: '8px',
  },
  linkOlvide: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: theme.font.size.sm,
    color: theme.color.accent,
    cursor: 'pointer',
    fontFamily: theme.font.family,
  },
  notaTienda: {
    fontSize: theme.font.size.sm,
    color: theme.color.textMuted,
    margin: '8px 0 0 0',
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
  select: {
    width: '100%',
    padding: '14px',
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
  linkVolver: {
    display: 'block',
    width: '100%',
    textAlign: 'center',
    background: 'none',
    border: 'none',
    padding: '14px',
    marginTop: '8px',
    fontSize: theme.font.size.base,
    color: theme.color.textMuted,
    cursor: 'pointer',
    fontFamily: theme.font.family,
  },
  confirmacion: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '32px',
    fontSize: theme.font.size.xs,
    color: theme.color.textMuted,
  },
};

export default Login;