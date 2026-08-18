import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import CargaInformacion from './admin/CargaInformacion';
import Historial from './admin/Historial';
import Usuarios from './admin/Usuarios';
import Dinamicas from './admin/Dinamicas';
import ChatIA from './admin/ChatIA';
import Reportes from './admin/Reportes';
import TopBar from './admin/TopBar';
import Exportar from './admin/Exportar';
import Notificaciones from './admin/Notificaciones';
import { theme } from '../styles/theme';

// Barra de progreso horizontal reutilizable — anima transform
// en vez de width (ver auditoría de animaciones: width fuerza
// reflow, transform corre en GPU).
function BarraProgreso({ pct, color }) {
  return (
    <div className="pd-bar-track" style={{ flex: 1, height: '8px', background: theme.color.background, borderRadius: '4px' }}>
      <div
        className="pd-bar-fill"
        style={{ height: '100%', borderRadius: '4px', background: color, transform: `scaleX(${Math.min(pct, 100) / 100})` }}
      />
    </div>
  );
}

function SuperAdminDashboard({ usuario, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [comparativa, setComparativa] = useState(null);
  const [cargandoComparativa, setCargandoComparativa] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [menuActivo, setMenuActivo] = useState('dashboard');
  const [chatFlotanteAbierto, setChatFlotanteAbierto] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);

  useEffect(() => {
    cargarDashboard();
    cargarComparativa();
    cargarPaises();
    // Limpiar dinámicas vencidas automáticamente
    const limpiarVencidas = async () => {
      try {
        await api.post('/admin/dinamicas/limpiar-vencidas');
      } catch (err) {
        console.log('Error limpiando vencidas:', err);
      }
    };
    limpiarVencidas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // Verificar dinámicas por vencer al cargar el dashboard
  useEffect(() => {
    const verificarVencimientos = async () => {
      try {
        await api.post('/notificaciones/dinamicas-vencer?dias_limite=7');
      } catch (err) {
        console.log('Sin dinámicas por vencer o error:', err);
      }
    };
    verificarVencimientos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape cierra el chat flotante
  useEffect(() => {
    if (!chatFlotanteAbierto) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setChatFlotanteAbierto(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chatFlotanteAbierto]);

  // Escape cierra el sidebar en modo drawer (mobile/tablet)
  useEffect(() => {
    if (!sidebarAbierto) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setSidebarAbierto(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarAbierto]);

  const cargarDashboard = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarComparativa = async () => {
    setCargandoComparativa(true);
    try {
      const res = await api.get('/admin/comparativa-paises');
      setComparativa(res.data);
    } catch (err) {
      console.error('Error cargando comparativa:', err);
    } finally {
      setCargandoComparativa(false);
    }
  };

  const cargarPaises = async () => {
    try {
      const res = await api.get('/paises');
      setPaises(res.data);
    } catch (err) {
      console.error('Error cargando catálogo de países:', err);
    }
  };

  const actualizarTodo = () => {
    cargarDashboard();
    cargarComparativa();
    cargarPaises();
  };

  // Orden pensado por flujo de trabajo: primero visión general,
  // luego los datos operativos que se gestionan día a día
  // (dinámicas → carga → usuarios), después análisis (reportes →
  // historial), utilidades (exportar), y el asistente al final.
  const menu = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'dinamicas', icon: '📦', label: 'Dinámicas' },
    { id: 'carga',     icon: '📤', label: 'Carga de Información' },
    { id: 'usuarios',  icon: '👥', label: 'Usuarios' },
    { id: 'reportes',  icon: '📈', label: 'Reportes' },
    { id: 'notificaciones', icon: '🔔', label: 'Notificaciones' },
    { id: 'historial', icon: '🕐', label: 'Historial' },
    { id: 'exportar',  icon: '📥', label: 'Exportar' },
    { id: 'chat',      icon: '🤖', label: 'Chat con IA' },
  ];

  const coloresUbicacion = [theme.color.accent, theme.color.successAccent, theme.color.warningBorder, theme.color.chart3, theme.color.chart4];
  const coloresRol = [theme.color.primary, theme.color.accent, theme.color.successAccent, theme.color.warningBorder, theme.color.chart3];
  const coloresMetrica = [theme.color.accent, theme.color.successAccent, theme.color.warningBorder, theme.color.chart3];

  const seleccionarMenu = (id) => {
    setMenuActivo(id);
    setSidebarAbierto(false); // en mobile, elegir una sección cierra el drawer
  };

  return (
    <div style={styles.container}>

      {/* Overlay del sidebar en modo drawer (mobile/tablet) */}
      {sidebarAbierto && (
        <div className="pd-sidebar-overlay" onClick={() => setSidebarAbierto(false)} />
      )}

      {/* SIDEBAR */}
      <div className={`pd-sidebar${sidebarAbierto ? ' pd-sidebar-open' : ''}`} style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>PromoIQ</div>
          <div style={styles.adminBadge}>SUPER ADMIN</div>
        </div>

        <nav style={styles.nav} aria-label="Menú principal">
          {menu.map(item => (
            <button
              key={item.id}
              className="pd-pressable"
              style={{
                ...styles.navItem,
                ...(menuActivo === item.id ? styles.navItemActivo : {})
              }}
              onClick={() => seleccionarMenu(item.id)}
              aria-current={menuActivo === item.id ? 'page' : undefined}
            >
              <span style={styles.navIcon} aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.usuarioInfo}>
            <div style={styles.usuarioAvatar} aria-hidden="true">
              {usuario.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={styles.usuarioNombre}>{usuario.nombre}</p>
              <p style={styles.usuarioRol}>Super Administrador</p>
            </div>
          </div>
          <button className="pd-pressable" style={styles.logoutBtn} onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>

        <TopBar
          usuario={usuario}
          onLogout={onLogout}
          totalAlertas={0}
          onVerAlertas={() => {}}
          tema={{ primary: theme.color.primary, gradient: theme.color.gradient }}
        />

        <div style={styles.subheader}>
          <div style={styles.subheaderIzquierda}>
            <button
              className="pd-pressable pd-show-mobile-only"
              style={styles.btnHamburguesa}
              onClick={() => setSidebarAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={sidebarAbierto}
            >
              ☰
            </button>
            <h1 className="pd-heading-fluid" style={styles.headerTitulo}>
              {menu.find(m => m.id === menuActivo)?.icon}{' '}
              {menu.find(m => m.id === menuActivo)?.label}
            </h1>
          </div>
          <button className="pd-pressable" style={styles.refreshBtn} onClick={actualizarTodo}>
            🔄 Actualizar
          </button>
        </div>

        {/* CONTENIDO */}
        <div style={styles.contenido}>
          {menuActivo === 'dashboard' && (
            <div>
              {/* COMPARATIVA ENTRE PAÍSES — exclusivo de superadmin */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={styles.cardTitulo}>🌎 Comparativa entre países</h3>
                {cargandoComparativa ? (
                  <p style={styles.sinDatos}>Cargando comparativa...</p>
                ) : comparativa ? (
                  <div className="pd-grid-3">
                    {paises.map((p) => {
                      const datos = comparativa.paises[p.codigo];
                      if (!datos) return null;
                      return (
                        <div key={p.codigo} style={{ ...styles.paisCard, borderTop: `4px solid ${p.color_primario}` }}>
                          <div style={styles.paisCardHeader}>
                            <span style={styles.paisCardNombre}>{p.label}</span>
                            {datos.dinamicas_por_vencer > 0 && (
                              <span style={styles.paisCardAlerta}>
                                ⏰ {datos.dinamicas_por_vencer} por vencer
                              </span>
                            )}
                          </div>

                          <div style={styles.paisCardMetrica}>
                            <span style={styles.paisCardMetricaLabel}>Dinámicas activas</span>
                            <span style={{ ...styles.paisCardMetricaValor, color: p.color_primario }}>
                              {datos.dinamicas_activas}
                            </span>
                          </div>
                          <div style={styles.paisCardMetrica}>
                            <span style={styles.paisCardMetricaLabel}>Artículos en catálogo</span>
                            <span style={{ ...styles.paisCardMetricaValor, color: p.color_primario }}>
                              {datos.total_catalogo.toLocaleString()}
                            </span>
                          </div>
                          <div style={styles.paisCardMetrica}>
                            <span style={styles.paisCardMetricaLabel}>Artículos en campaña</span>
                            <span style={{ ...styles.paisCardMetricaValor, color: p.color_primario }}>
                              {datos.articulos_campana}
                            </span>
                          </div>
                          <div style={styles.paisCardMetrica}>
                            <span style={styles.paisCardMetricaLabel}>
                              Ventas{' '}
                              {comparativa.periodo_ventas?.mes && datos.total_ventas_mes > 0
                                ? `(${MESES[comparativa.periodo_ventas.mes - 1]?.slice(0, 3)})`
                                : ''}
                            </span>
                            <span style={{ ...styles.paisCardMetricaValor, color: p.color_primario }}>
                              {datos.total_ventas_mes > 0 ? datos.total_ventas_mes.toLocaleString() : '—'}
                            </span>
                          </div>
                          <div style={styles.paisCardMetrica}>
                            <span style={styles.paisCardMetricaLabel}>Usuarios activos</span>
                            <span style={{ ...styles.paisCardMetricaValor, color: p.color_primario }}>
                              {datos.usuarios_activos}
                            </span>
                          </div>

                          <div style={styles.paisCardFooter}>
                            <span style={styles.paisCardFooterTexto}>
                              💬 {datos.consultas_hoy} consultas hoy · ${datos.costo_estimado_hoy.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={styles.sinDatos}>No se pudo cargar la comparativa</p>
                )}
              </div>

              {cargando ? (
                <div style={styles.cargando}>
                  <p style={styles.cargandoTexto}>Cargando dashboard...</p>
                </div>
              ) : dashboard ? (
                <div>
                  {/* MÉTRICAS */}
                  <div className="pd-grid-4" style={{ marginBottom: '20px' }}>
                    {[
                      { label: 'Dinámicas Activas', valor: dashboard.metricas.dinamicas_activas, icon: '📦', color: coloresMetrica[0] },
                      { label: 'Artículos en Campaña', valor: dashboard.metricas.articulos_campana, icon: '🏷️', color: coloresMetrica[1] },
                      { label: 'Consultas Hoy', valor: dashboard.metricas.consultas_hoy, icon: '💬', color: coloresMetrica[2] },
                      { label: 'Usuarios Activos', valor: dashboard.metricas.usuarios_activos, icon: '👥', color: coloresMetrica[3] },
                    ].map((m, i) => (
                      <div key={i} className="pd-stagger-item" style={{ ...styles.metricaCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                        <div style={{ ...styles.metricaIcono, background: m.color + '20' }} aria-hidden="true">
                          <span style={{ fontSize: '28px' }}>{m.icon}</span>
                        </div>
                        <div>
                          <p style={styles.metricaValor}>{m.valor}</p>
                          <p style={styles.metricaLabel}>{m.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SEGUNDA FILA */}
                  <div className="pd-grid-2" style={{ marginBottom: '20px' }}>

                    {/* Artículos por ubicación */}
                    <div style={styles.card}>
                      <h3 style={styles.cardTitulo}>📍 Artículos por Ubicación</h3>
                      {dashboard.por_ubicacion.length === 0 ? (
                        <p style={styles.sinDatos}>Sin datos disponibles</p>
                      ) : (
                        dashboard.por_ubicacion.map((u, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{u.ubicacion}</span>
                            <BarraProgreso pct={(u.total / dashboard.metricas.articulos_campana) * 100} color={coloresUbicacion[i % coloresUbicacion.length]} />
                            <span style={styles.barraValor}>{u.total}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Usuarios por rol */}
                    <div style={styles.card}>
                      <h3 style={styles.cardTitulo}>👥 Usuarios por Rol</h3>
                      {dashboard.usuarios_por_rol.map((r, i) => (
                        <div key={i} style={styles.rolRow}>
                          <div style={{
                            ...styles.rolDot,
                            background: coloresRol[i % coloresRol.length]
                          }} aria-hidden="true" />
                          <span style={styles.rolNombre}>{r.rol}</span>
                          <span style={styles.rolTotal}>{r.total}</span>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* ÚLTIMAS CONSULTAS */}
                  <div style={styles.card}>
                    <h3 style={styles.cardTitulo}>🕐 Últimas Consultas a la IA</h3>
                    {dashboard.ultimas_consultas.length === 0 ? (
                      <p style={styles.sinDatos}>No hay consultas registradas aún</p>
                    ) : (
                      <div className="pd-table-scroll">
                        <table style={styles.tabla}>
                          <caption style={styles.srOnly}>Últimas consultas realizadas a la IA</caption>
                          <thead>
                            <tr>
                              {['Usuario', 'Pregunta', 'Fecha', 'Tokens'].map(h => (
                                <th key={h} style={styles.th} scope="col">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dashboard.ultimas_consultas.map((c, i) => (
                              <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                                <td style={styles.td}>{c.usuario}</td>
                                <td style={styles.td}>
                                  {c.pregunta?.length > 50
                                    ? c.pregunta.substring(0, 50) + '...'
                                    : c.pregunta}
                                </td>
                                <td style={styles.td}>
                                  {new Date(c.fecha).toLocaleString('es-CR')}
                                </td>
                                <td style={styles.td}>{c.tokens}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <p style={styles.sinDatos}>Error cargando el dashboard</p>
              )}
            </div>
          )}

          {menuActivo === 'carga' && (
            <CargaInformacion />
          )}

          {menuActivo === 'historial' && (
            <Historial />
          )}

          {menuActivo === 'usuarios' && (
            <Usuarios />
          )}

          {menuActivo === 'dinamicas' && (
            <Dinamicas />
          )}

          {menuActivo === 'chat' && (
            <ChatIA />
          )}

          {menuActivo === 'reportes' && (
            <Reportes />
          )}

          {menuActivo === 'notificaciones' && (
            <Notificaciones />
          )}

          {menuActivo === 'exportar' && (
            <Exportar />
          )}


          {menuActivo !== 'dashboard' && menuActivo !== 'carga' && menuActivo !== 'historial' && menuActivo !== 'usuarios' && menuActivo !== 'dinamicas' && menuActivo !== 'chat' && menuActivo !== 'reportes' && menuActivo !== 'notificaciones' && menuActivo !== 'exportar' && (
            <div style={styles.proximamente}>
              <p style={styles.proximamenteIcono} aria-hidden="true">
                {menu.find(m => m.id === menuActivo)?.icon}
              </p>
              <h2 style={styles.proximamenteTitulo}>
                {menu.find(m => m.id === menuActivo)?.label}
              </h2>
              <p style={styles.proximamenteSub}>Este módulo está en desarrollo</p>
            </div>
          )}

        </div>
      </div>
      {/* Botón flotante IA */}
      {menuActivo !== 'chat' && (
        <>
          {chatFlotanteAbierto && (
            <div className="pd-dropdown" style={{ ...styles.flotanteContainer, transformOrigin: 'bottom right' }}>
              <ChatIA flotante={true} onCerrar={() => setChatFlotanteAbierto(false)} />
            </div>
          )}
          <button
            className="pd-pressable"
            style={styles.flotanteBtn}
            onClick={() => setChatFlotanteAbierto(!chatFlotanteAbierto)}
            aria-label={chatFlotanteAbierto ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
            aria-expanded={chatFlotanteAbierto}
          >
            {chatFlotanteAbierto ? '✕' : '🤖'}
          </button>
        </>
      )}

    </div>
  );
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: theme.font.family,
    background: theme.color.background,
  },
  sidebar: {
    width: '240px',
    background: theme.color.primary,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logo: {
    color: theme.color.textOnPrimary,
    fontSize: '24px',
    fontWeight: theme.font.weight.black,
    marginBottom: '8px',
  },
  adminBadge: {
    background: theme.color.warningBorder,
    color: theme.color.primary,
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.black,
    padding: '3px 8px',
    borderRadius: theme.radius.pill,
    display: 'inline-block',
    letterSpacing: '1px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: theme.radius.md,
    border: 'none',
    background: 'transparent',
    color: theme.color.dropBorder,
    fontSize: theme.font.size.md,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  navItemActivo: {
    background: 'rgba(255,255,255,0.12)',
    color: theme.color.textOnPrimary,
    fontWeight: theme.font.weight.bold,
  },
  navIcon: {
    fontSize: theme.font.size.xxl,
    width: '24px',
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  usuarioInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  usuarioAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: theme.color.accent,
    color: theme.color.textOnPrimary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: theme.font.weight.bold,
    fontSize: theme.font.size.xl,
    flexShrink: 0,
  },
  usuarioNombre: {
    color: theme.color.textOnPrimary,
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.semibold,
    margin: 0,
  },
  usuarioRol: {
    color: theme.color.textMuted,
    fontSize: theme.font.size.sm,
    margin: 0,
  },
  logoutBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: theme.radius.sm,
    color: theme.color.textMuted,
    fontSize: theme.font.size.base,
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 28px',
    background: theme.color.surface,
    borderBottom: `1px solid ${theme.color.border}`,
    flexShrink: 0,
  },
  headerSub: {
    fontSize: theme.font.size.sm,
    color: theme.color.textMuted,
    margin: '4px 0 0 0',
    textTransform: 'capitalize',
  },
  refreshBtn: {
    padding: '8px 16px',
    background: theme.color.background,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    fontSize: theme.font.size.base,
    cursor: 'pointer',
    color: theme.color.primary,
    fontWeight: theme.font.weight.semibold,
    flexShrink: 0,
  },
  contenido: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  },
  metricaCard: {
    background: theme.color.surface,
    borderRadius: theme.radius.xl,
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: theme.shadow.sm,
  },
  metricaIcono: {
    width: '56px',
    height: '56px',
    borderRadius: theme.radius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricaValor: {
    fontSize: '32px',
    fontWeight: theme.font.weight.black,
    color: theme.color.primary,
    margin: 0,
    lineHeight: 1,
  },
  metricaLabel: {
    fontSize: theme.font.size.sm,
    color: theme.color.textMuted,
    margin: '4px 0 0 0',
  },
  card: {
    background: theme.color.surface,
    borderRadius: theme.radius.xl,
    padding: '20px',
    boxShadow: theme.shadow.sm,
    marginBottom: '16px',
  },
  cardTitulo: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.color.primary,
    margin: '0 0 16px 0',
  },
  barraRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  barraLabel: {
    fontSize: theme.font.size.base,
    color: theme.color.textSecondary,
    width: '90px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  barraValor: {
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.bold,
    color: theme.color.primary,
    width: '24px',
    textAlign: 'right',
    flexShrink: 0,
  },
  rolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 0',
    borderBottom: `1px solid ${theme.color.background}`,
  },
  rolDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  rolNombre: {
    flex: 1,
    fontSize: theme.font.size.base,
    color: theme.color.text,
  },
  rolTotal: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.color.primary,
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.font.size.base,
    minWidth: '560px',
  },
  th: {
    padding: '10px 12px',
    background: theme.color.background,
    color: theme.color.primary,
    fontWeight: theme.font.weight.bold,
    textAlign: 'left',
    fontSize: theme.font.size.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 12px',
    color: '#444444',
    borderBottom: `1px solid ${theme.color.background}`,
  },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
  cargando: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
  },
  cargandoTexto: {
    color: theme.color.textMuted,
    fontSize: theme.font.size.xl,
  },
  sinDatos: {
    color: theme.color.textMuted,
    fontSize: theme.font.size.md,
    textAlign: 'center',
    padding: '20px',
  },
  proximamente: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
  },
  proximamenteIcono: {
    fontSize: '64px',
    margin: '0 0 16px 0',
  },
  proximamenteTitulo: {
    fontSize: '24px',
    fontWeight: theme.font.weight.black,
    color: theme.color.primary,
    margin: '0 0 8px 0',
  },
  proximamenteSub: {
    fontSize: theme.font.size.lg,
    color: theme.color.textMuted,
  },

  flotanteBtn: {
    position: 'fixed', bottom: '24px', right: '24px',
    width: '56px', height: '56px',
    background: theme.color.gradient,
    color: theme.color.textOnPrimary, border: 'none', borderRadius: '50%',
    fontSize: '24px', cursor: 'pointer',
    boxShadow: theme.shadow.floating,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  flotanteContainer: {
    position: 'fixed', bottom: '90px', right: '24px',
    width: 'min(380px, calc(100vw - 32px))',
    height: 'min(520px, calc(100vh - 160px))',
    borderRadius: theme.radius.xxl,
    boxShadow: theme.shadow.floating,
    zIndex: 999,
    overflow: 'hidden',
  },

  subheader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', background: theme.color.surface,
    borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0, gap: '12px', flexWrap: 'wrap',
  },
  subheaderIzquierda: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  btnHamburguesa: { background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '4px 8px', lineHeight: 1, flexShrink: 0, color: theme.color.primary },
  headerTitulo: {
    fontWeight: theme.font.weight.black,
    color: theme.color.primary,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // Tarjetas de comparativa entre países
  paisCard: {
    background: theme.color.surface,
    borderRadius: theme.radius.xl,
    padding: '18px 20px',
    boxShadow: theme.shadow.sm,
  },
  paisCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: `1px solid ${theme.color.background}`,
  },
  paisCardNombre: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.color.text,
  },
  paisCardAlerta: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.bold,
    color: theme.color.warning,
    background: theme.color.warningBg,
    padding: '3px 8px',
    borderRadius: theme.radius.pill,
    whiteSpace: 'nowrap',
  },
  paisCardMetrica: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
  },
  paisCardMetricaLabel: {
    fontSize: theme.font.size.sm,
    color: theme.color.textMuted,
  },
  paisCardMetricaValor: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
  },
  paisCardFooter: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: `1px solid ${theme.color.background}`,
  },
  paisCardFooterTexto: {
    fontSize: theme.font.size.sm,
    color: theme.color.textMuted,
  },

};

export default SuperAdminDashboard;