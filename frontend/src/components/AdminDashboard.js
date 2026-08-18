// ============================================================
// Componente: AdminDashboard.js
// Descripción: Dashboard adaptado por rol y país
// Colores: dinámicos, según catálogo /paises
// Responsive: sidebar tipo drawer en pantallas < 1024px
// Sidebar: colapsable a solo íconos en desktop (≥1024px)
// Íconos: lucide-react en vez de emoji
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, Tag, Upload, Bell, Download, Bot, Clock,
  Menu, RefreshCw, Search, MessageCircle, Users, XCircle, AlertTriangle,
  Info, CheckCircle2, Inbox, X, ChevronsLeft, ChevronsRight, LogOut,
} from 'lucide-react';
import api from '../utils/api';
import ChatIA from './admin/ChatIA';
import CargaInformacion from './admin/CargaInformacion';
import Exportar from './admin/Exportar';
import TopBar from './admin/TopBar';
import HistorialChat from './admin/HistorialChat';
import AsistentePersonalizado from './admin/AsistePersonalizado';
import EmptyStateCountry from './admin/EmptyStateCountry';
import { theme } from '../styles/theme';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { breakpoints } from '../styles/breakpoints';

const TEMAS = {
  default: {
    primary:   theme.color.primary,
    secondary: theme.color.accent,
    accent:    theme.color.textOnPrimary,
    gradient:  theme.color.gradient,
    badge:     theme.color.accent,
  }
};

const menuPorRol = {
  admin: [
    { id: 'dashboard', Icono: LayoutDashboard, label: 'Dashboard' },
    { id: 'dinamicas', Icono: Package, label: 'Dinámicas' },
    { id: 'articulos', Icono: Tag, label: 'Artículos' },
    { id: 'carga',     Icono: Upload, label: 'Carga de Información' },
    { id: 'alertas',   Icono: Bell, label: 'Alertas' },
    { id: 'exportar',  Icono: Download, label: 'Exportar' },
    { id: 'chat',      Icono: Bot, label: 'Chat con IA' },
    { id: 'historial', Icono: Clock, label: 'Historial IA' },
  ],
  comercial: [
    { id: 'dashboard', Icono: LayoutDashboard, label: 'Mi Dashboard' },
    { id: 'articulos', Icono: Tag, label: 'Artículos en Campaña' },
    { id: 'alertas',   Icono: Bell, label: 'Alertas' },
    { id: 'historial', Icono: Clock, label: 'Historial IA' },
    { id: 'chat',      Icono: Bot, label: 'Mi Asistente IA' },
  ],
  planning: [
    { id: 'dashboard', Icono: LayoutDashboard, label: 'Mi Dashboard' },
    { id: 'articulos', Icono: Package, label: 'Trazabilidad' },
    { id: 'alertas',   Icono: Bell, label: 'Alertas' },
    { id: 'historial', Icono: Clock, label: 'Historial IA' },
    { id: 'chat',      Icono: Bot, label: 'Mi Asistente IA' },
  ],
  tiendas: [
    { id: 'articulos', Icono: Tag, label: 'Mis Artículos' },
    { id: 'chat',      Icono: Bot, label: 'Consultar IA' },
  ],
};

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

// Elige texto oscuro o claro según qué tan clara sea la superficie
// de fondo — reemplaza el caso especial que antes existía solo
// para SV, y funciona automáticamente para cualquier país nuevo.
function textoLegibleSobre(hex) {
  if (!hex) return theme.color.textOnPrimary;
  const h = hex.replace('#', '');
  if (h.length !== 6) return theme.color.textOnPrimary;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '#1E2761' : theme.color.textOnPrimary;
}

function AdminDashboard({ usuario, onLogout }) {
  const esMobile = useMediaQuery(`(max-width: ${breakpoints.lg - 1}px)`);
  const [dashboard, setDashboard] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [menuActivo, setMenuActivo] = useState('dashboard');
  const [chatFlotanteAbierto, setChatFlotanteAbierto] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [sidebarColapsado, setSidebarColapsado] = useState(false);
  const [articulos, setArticulos] = useState([]);
  const [cargandoArticulos, setCargandoArticulos] = useState(false);
  const [filtroArticulo, setFiltroArticulo] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState('');
  const [tieneDatos, setTieneDatos] = useState(null); // null = verificando, true/false = resultado
  const [paises, setPaises] = useState([]);

  const rol = usuario.rol;
  const pais = usuario.pais;

  const paisInfo = paises.find(p => p.codigo === pais);

  const tema = paisInfo ? {
    primary: paisInfo.color_primario,
    secondary: paisInfo.color_secundario,
    accent: theme.color.textOnPrimary,
    gradient: `linear-gradient(145deg, ${paisInfo.color_primario} 0%, ${paisInfo.color_secundario} 100%)`,
    badge: paisInfo.color_secundario,
    badgeTexto: textoLegibleSobre(paisInfo.color_secundario),
  } : TEMAS.default;

  const nombrePais = paisInfo ? paisInfo.label : (pais ? pais : '🌎 Todos');

  const menu = menuPorRol[rol] || menuPorRol['admin'];

  const labelRol = {
    admin:     'ADMINISTRADOR',
    comercial: 'COMERCIAL',
    planning:  'PLANNING',
    tiendas:   'TIENDAS',
  }[rol] || rol.toUpperCase();

  useEffect(() => {
    if (rol === 'tiendas') setMenuActivo('articulos');
    cargarAlertas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catálogo dinámico de países — trae colores/nombre/bandera reales,
  // así el tema visual del dashboard se actualiza solo si el
  // superadmin edita un país desde Usuarios > Países.
  useEffect(() => {
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando países:', err));
  }, []);

  // El sidebar colapsado a íconos es un patrón de desktop — en
  // mobile/tablet siempre vuelve al drawer completo con texto.
  useEffect(() => {
    if (esMobile) setSidebarColapsado(false);
  }, [esMobile]);

  useEffect(() => {
    if (!pais || rol === 'superadmin') { setTieneDatos(true); return; }
    api.get(`/pais/${pais}/tiene-datos`)
  .then(res => setTieneDatos(res.data.tiene_datos))
  .catch(() => setTieneDatos(true));
  }, [pais, rol]);

  useEffect(() => {
    if (menuActivo === 'dashboard' && tieneDatos !== false) cargarDashboard();
    if (menuActivo === 'articulos') cargarArticulos();
    if (menuActivo === 'alertas') cargarAlertas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuActivo, tieneDatos]);

  useEffect(() => {
    if (!chatFlotanteAbierto) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setChatFlotanteAbierto(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chatFlotanteAbierto]);

  useEffect(() => {
    if (!sidebarAbierto) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') setSidebarAbierto(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarAbierto]);

  const cargarDashboard = async () => {
    setCargando(true);
    try {
      if (rol === 'admin' || rol === 'superadmin') {
        try {
          await api.post('/admin/dinamicas/limpiar-vencidas');
        } catch (err) {
          console.log('Error limpiando vencidas:', err);
        }
      }
      const res = await api.get('/pais/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error('Error dashboard:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarArticulos = async () => {
    setCargandoArticulos(true);
    try {
      const res = await api.get('/pais/articulos');
      setArticulos(res.data);
    } catch (err) {
      console.error('Error artículos:', err);
    } finally {
      setCargandoArticulos(false);
    }
  };

  const cargarAlertas = async () => {
    try {
      const res = await api.get('/pais/alertas');
      setAlertas(res.data);
    } catch (err) {
      console.error('Error alertas:', err);
    }
  };

  const seleccionarMenu = (id) => {
    setMenuActivo(id);
    setSidebarAbierto(false); // en mobile, elegir una sección cierra el drawer
  };

  const articulosFiltrados = articulos.filter(a => {
    const matchTexto =
      a.codigo?.toLowerCase().includes(filtroArticulo.toLowerCase()) ||
      a.descripcion?.toLowerCase().includes(filtroArticulo.toLowerCase()) ||
      a.tienda?.toLowerCase().includes(filtroArticulo.toLowerCase());
    const matchUbicacion = filtroUbicacion ? a.ubicacion === filtroUbicacion : true;
    return matchTexto && matchUbicacion;
  });

  const ubicaciones = [...new Set(articulos.map(a => a.ubicacion).filter(Boolean))];

  const diasRestantes = (fechaFin) =>
    Math.ceil((new Date(fechaFin) - new Date()) / (1000 * 60 * 60 * 24));

  const totalAlertas = alertas?.total || 0;
  const menuActivoInfo = menu.find(m => m.id === menuActivo);
  const colapsado = sidebarColapsado && !esMobile;

  return (
    <div style={styles.container}>

      {/* Overlay del sidebar en modo drawer (mobile/tablet) */}
      {sidebarAbierto && (
        <div className="pd-sidebar-overlay" onClick={() => setSidebarAbierto(false)} />
      )}

      {/* ── SIDEBAR ───────────────────────────────────── */}
      <div
        className={`pd-sidebar${sidebarAbierto ? ' pd-sidebar-open' : ''}`}
        style={{
          ...styles.sidebar,
          background: tema.gradient,
          width: colapsado ? '76px' : '240px',
          transition: `width ${theme.motion.duration.base} ${theme.motion.easing.inOut}`,
        }}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarHeaderTop}>
            <div style={styles.logo}>{colapsado ? 'PQ' : 'PromoIQ'}</div>
            {/* Colapsar/expandir — solo tiene sentido en desktop */}
            <button
              className="pd-pressable pd-hide-mobile"
              style={styles.btnColapsar}
              onClick={() => setSidebarColapsado(!sidebarColapsado)}
              aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              aria-pressed={colapsado}
            >
              {colapsado ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </button>
          </div>
          {!colapsado && (
            <>
              <div style={{
                ...styles.rolBadge,
                background: 'rgba(255,255,255,0.2)',
                color: theme.color.textOnPrimary,
              }}>
                {labelRol}
              </div>
              <div style={styles.paisLabel}>{nombrePais}</div>
            </>
          )}
        </div>

        <nav style={styles.nav} aria-label="Menú principal">
          {menu.map(item => (
            <button
              key={item.id}
              className="pd-pressable"
              style={{
                ...styles.navItem,
                justifyContent: colapsado ? 'center' : 'flex-start',
                padding: colapsado ? '12px' : '12px 16px',
                ...(menuActivo === item.id ? styles.navItemActivo : {})
              }}
              onClick={() => seleccionarMenu(item.id)}
              aria-current={menuActivo === item.id ? 'page' : undefined}
              title={colapsado ? item.label : undefined}
            >
              <item.Icono size={18} style={styles.navIcon} aria-hidden="true" />
              {!colapsado && <span style={{ flex: 1 }}>{item.label}</span>}
              {item.id === 'alertas' && totalAlertas > 0 && (
                <span style={colapsado ? styles.alertaDot : styles.alertaBadge} aria-hidden={colapsado}>
                  {colapsado ? '' : totalAlertas}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={{ ...styles.usuarioInfo, justifyContent: colapsado ? 'center' : 'flex-start' }}>
            <div style={{
              ...styles.usuarioAvatar,
              background: tema.secondary
            }} aria-hidden="true" title={colapsado ? usuario.nombre : undefined}>
              {usuario.nombre.charAt(0).toUpperCase()}
            </div>
            {!colapsado && (
              <div>
                <p style={styles.usuarioNombre}>{usuario.nombre}</p>
                <p style={styles.usuarioRolTexto}>{labelRol}</p>
              </div>
            )}
          </div>
          <button
            className="pd-pressable"
            style={{ ...styles.logoutBtn, justifyContent: colapsado ? 'center' : 'flex-start' }}
            onClick={onLogout}
            aria-label="Cerrar sesión"
            title={colapsado ? 'Cerrar sesión' : undefined}
          >
            <LogOut size={16} style={colapsado ? undefined : styles.logoutIcono} aria-hidden="true" />
            {!colapsado && 'Cerrar sesión'}
          </button>
        </div>
      </div>

      {/* ── MAIN ──────────────────────────────────────── */}
      <div style={styles.main}>

        <TopBar
          usuario={usuario}
          onLogout={onLogout}
          totalAlertas={totalAlertas}
          onVerAlertas={() => seleccionarMenu('alertas')}
          tema={tema}
        />

        {/* Subheader con título del módulo */}
        <div style={styles.subheader}>
          <div style={styles.subheaderIzquierda}>
            <button
              className="pd-pressable pd-show-mobile-only"
              style={{ ...styles.btnHamburguesa, color: tema.primary }}
              onClick={() => setSidebarAbierto(true)}
              aria-label="Abrir menú"
              aria-expanded={sidebarAbierto}
            >
              <Menu size={22} />
            </button>
            {menuActivoInfo && <menuActivoInfo.Icono size={20} color={tema.primary} aria-hidden="true" />}
            <h1 className="pd-heading-fluid" style={{ ...styles.headerTitulo, color: tema.primary }}>
              {menuActivoInfo?.label}
            </h1>
          </div>
          <button className="pd-pressable" style={styles.refreshBtn} onClick={() => {
            if (menuActivo === 'dashboard') cargarDashboard();
            if (menuActivo === 'articulos') cargarArticulos();
            if (menuActivo === 'alertas') cargarAlertas();
          }}>
            <RefreshCw size={14} style={styles.refreshIcono} aria-hidden="true" />
            Actualizar
          </button>
        </div>

        {/* ── CONTENIDO ───────────────────────────────── */}
        {/* key={menuActivo} fuerza un remount al cambiar de sección,
            para que la animación de entrada (pd-view-in) se
            reproduzca cada vez — rápida (200ms) porque esto pasa
            muchas veces por sesión, a diferencia de la transición
            de login/logout que sí se toma su tiempo. */}
        <div key={menuActivo} className="pd-view-in" style={styles.contenido}>

          {/* DASHBOARD */}
          {menuActivo === 'dashboard' && (
            tieneDatos === false ? (
              <EmptyStateCountry
                pais={pais}
                tema={tema}
                onIrACargaInformacion={() => seleccionarMenu('carga')}
              />
            ) : cargando ? (
              <div style={styles.cargando}>
                <LayoutDashboard size={48} color={theme.color.textMuted} aria-hidden="true" />
                <p>Cargando dashboard...</p>
              </div>
            ) : dashboard ? (
              <div>
                {/* Métricas */}
                <div className="pd-grid-4" style={{ marginBottom: '20px' }}>
                  {[
                    { label: 'Dinámicas Activas', valor: dashboard.metricas.dinamicas_activas, Icono: Package, color: tema.primary },
                    { label: 'Artículos en Campaña', valor: dashboard.metricas.articulos_campana, Icono: Tag, color: tema.secondary },
                    { label: 'Consultas Hoy', valor: dashboard.metricas.consultas_hoy, Icono: MessageCircle, color: theme.color.successStrong },
                    { label: 'Usuarios Activos', valor: dashboard.metricas.usuarios_activos, Icono: Users, color: theme.color.warning },
                  ].map((m, i) => (
                    <div key={i} className="pd-stagger-item" style={{ ...styles.metricaCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                      <div style={{ ...styles.metricaIcono, background: m.color + '15' }} aria-hidden="true">
                        <m.Icono size={26} color={m.color} />
                      </div>
                      <div>
                        <p style={{ ...styles.metricaValor, color: m.color }}>{m.valor}</p>
                        <p style={styles.metricaLabel}>{m.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dashboard diferenciado por rol */}
                {rol === 'comercial' && (
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>
                      📈 Análisis Comercial — {nombrePais}
                    </h3>
                    <div className="pd-grid-2">
                      <div>
                        <p style={styles.subTitulo}>Por Tipo de Campaña</p>
                        {dashboard.por_tipo_campana.map((t, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{t.tipo}</span>
                            <BarraProgreso pct={(t.total / dashboard.metricas.articulos_campana) * 100} color={tema.primary} />
                            <span style={styles.barraValor}>{t.total}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p style={styles.subTitulo}>Por Ubicación en Tienda</p>
                        {dashboard.por_ubicacion.map((u, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{u.ubicacion}</span>
                            <BarraProgreso pct={(u.total / dashboard.metricas.articulos_campana) * 100} color={tema.secondary} />
                            <span style={styles.barraValor}>{u.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {rol === 'planning' && (
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>
                      📋 Trazabilidad — {nombrePais}
                    </h3>
                    {dashboard.dinamicas?.length === 0 ? (
                      <p style={styles.sinDatos}>No hay dinámicas activas</p>
                    ) : (
                      <div className="pd-grid-3">
                        {dashboard.dinamicas?.map((d, i) => {
                          const dias = diasRestantes(d.fecha_fin);
                          return (
                            <div key={i} className="pd-stagger-item" style={{
                              ...styles.dinamicaCard,
                              borderLeft: `4px solid ${dias < 7 ? theme.color.error : tema.primary}`,
                              animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                            }}>
                              <p style={styles.dinamicaNombre}>{d.nombre}</p>
                              <div style={styles.dinamicaInfo}>
                                <span style={styles.dinamicaArts}><Tag size={12} style={styles.dinamicaArtsIcono} aria-hidden="true" />{d.total_articulos} códigos</span>
                                <span style={{
                                  ...styles.dinamicaDias,
                                  color: dias < 0 ? theme.color.error : dias < 7 ? theme.color.warning : theme.color.successStrong
                                }}>
                                  {dias < 0 ? 'Vencida' : `${dias} días`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {rol === 'admin' && (
                  <div className="pd-grid-2">
                    <div style={styles.card}>
                      <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>📍 Por Ubicación</h3>
                      {dashboard.por_ubicacion.map((u, i) => (
                        <div key={i} style={styles.barraRow}>
                          <span style={styles.barraLabel}>{u.ubicacion}</span>
                          <BarraProgreso pct={(u.total / dashboard.metricas.articulos_campana) * 100} color={tema.primary} />
                          <span style={styles.barraValor}>{u.total}</span>
                        </div>
                      ))}
                    </div>
                    <div style={styles.card}>
                      <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>🎯 Por Tipo de Campaña</h3>
                      {dashboard.por_tipo_campana.map((t, i) => (
                        <div key={i} style={styles.barraRow}>
                          <span style={styles.barraLabel}>{t.tipo}</span>
                          <BarraProgreso pct={(t.total / dashboard.metricas.articulos_campana) * 100} color={tema.secondary} />
                          <span style={styles.barraValor}>{t.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dinámicas activas */}
                {rol !== 'planning' && dashboard.dinamicas?.length > 0 && (
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Package size={18} aria-hidden="true" />Dinámicas activas
                    </h3>
                    <div className="pd-grid-3">
                      {dashboard.dinamicas.map((d, i) => {
                        const dias = diasRestantes(d.fecha_fin);
                        return (
                          <div key={i} className="pd-stagger-item" style={{
                            ...styles.dinamicaCard,
                            borderLeft: `4px solid ${dias < 7 ? theme.color.error : tema.primary}`,
                            animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                          }}>
                            <p style={styles.dinamicaNombre}>{d.nombre}</p>
                            <div style={styles.dinamicaInfo}>
                              <span style={styles.dinamicaArts}><Tag size={12} style={styles.dinamicaArtsIcono} aria-hidden="true" />{d.total_articulos} artículos</span>
                              <span style={{
                                ...styles.dinamicaDias,
                                color: dias < 0 ? theme.color.error : dias < 7 ? theme.color.warning : theme.color.successStrong
                              }}>
                                {dias < 0 ? 'Vencida' : `${dias} días`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Últimas consultas */}
                {dashboard.ultimas_consultas?.length > 0 && (
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={18} aria-hidden="true" />Últimas Consultas a la IA
                    </h3>
                    <div className="pd-table-scroll">
                      <table style={styles.tabla}>
                        <caption style={styles.srOnly}>Últimas consultas realizadas a la IA</caption>
                        <thead>
                          <tr>
                            {['Usuario', 'Pregunta', 'Fecha', 'Tokens'].map(h => (
                              <th key={h} style={{ ...styles.th, background: tema.primary + '10' }} scope="col">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dashboard.ultimas_consultas.map((c, i) => (
                            <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                              <td style={styles.td}>{c.usuario}</td>
                              <td style={styles.td}>
                                {c.pregunta?.length > 50 ? c.pregunta.substring(0, 50) + '...' : c.pregunta}
                              </td>
                              <td style={styles.td}>{new Date(c.fecha).toLocaleString('es-CR')}</td>
                              <td style={styles.td}>{c.tokens}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.cargando}>
                <XCircle size={48} color={theme.color.error} aria-hidden="true" />
                <p>Error cargando el dashboard</p>
                <button className="pd-pressable" style={{ ...styles.btnReintentar, background: tema.primary }} onClick={cargarDashboard}>
                  Reintentar
                </button>
              </div>
            )
          )}

          {/* ARTÍCULOS */}
          {menuActivo === 'articulos' && (
            <div>
              <div style={styles.accionesRow}>
                <div style={styles.buscadorWrapper}>
                  <Search size={16} style={styles.buscadorIcon} aria-hidden="true" />
                  <label htmlFor="buscador-articulos-dashboard" style={styles.srOnly}>Buscar por código, descripción o tienda</label>
                  <input
                    id="buscador-articulos-dashboard"
                    className="pd-hoverable"
                    style={styles.buscador}
                    type="text"
                    placeholder="Buscar por código, descripción o tienda..."
                    value={filtroArticulo}
                    onChange={(e) => setFiltroArticulo(e.target.value)}
                  />
                </div>
                <label htmlFor="filtro-ubicacion-dashboard" style={styles.srOnly}>Filtrar por ubicación</label>
                <select
                  id="filtro-ubicacion-dashboard"
                  className="pd-hoverable"
                  style={styles.selectFiltro}
                  value={filtroUbicacion}
                  onChange={(e) => setFiltroUbicacion(e.target.value)}
                >
                  <option value="">Todas las ubicaciones</option>
                  {ubicaciones.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button className="pd-pressable" style={{ ...styles.btnRefresh, color: tema.primary }} onClick={cargarArticulos}>
                  <RefreshCw size={14} style={styles.refreshIcono} aria-hidden="true" />
                  Actualizar
                </button>
                <span style={{ ...styles.totalBadge, background: tema.primary + '15', color: tema.primary }}>
                  {articulosFiltrados.length} artículos
                </span>
              </div>

              <div style={styles.card}>
                {cargandoArticulos ? (
                  <div style={styles.cargando}>
                    <Tag size={40} color={theme.color.textMuted} aria-hidden="true" />
                    <p>Cargando artículos...</p>
                  </div>
                ) : articulosFiltrados.length === 0 ? (
                  <div style={styles.cargando}>
                    <Inbox size={40} color={theme.color.textMuted} aria-hidden="true" />
                    <p>No hay artículos que coincidan</p>
                  </div>
                ) : (
                  <div className="pd-table-scroll" style={styles.tablaWrapper}>
                    <table style={styles.tabla}>
                      <caption style={styles.srOnly}>Artículos {rol === 'planning' ? 'con trazabilidad' : 'en campaña'}</caption>
                      <thead>
                        <tr>
                          {[
                            'Código', 'Descripción', 'Categoría',
                            'P. Regular', 'P. Dinámica', 'Ahorro',
                            'Ubicación', 'Tienda', 'Tipo Campaña',
                            ...(rol === 'planning' ? ['Dinámica', 'Vence'] : [])
                          ].map(h => (
                            <th key={h} style={{ ...styles.th, background: tema.primary + '10', color: tema.primary }} scope="col">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {articulosFiltrados.map((a, i) => (
                          <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                            <td style={styles.td}><strong style={{ color: tema.primary }}>{a.codigo}</strong></td>
                            <td style={styles.td}>{a.descripcion}</td>
                            <td style={styles.td}>{a.categoria}</td>
                            <td style={styles.td}>${a.precio_regular?.toFixed(2)}</td>
                            <td style={{ ...styles.td, color: tema.primary, fontWeight: theme.font.weight.bold }}>
                              ${a.precio_dinamica?.toFixed(2)}
                            </td>
                            <td style={{ ...styles.td, color: theme.color.successStrong, fontWeight: theme.font.weight.bold }}>
                              ${a.ahorro?.toFixed(2)}
                            </td>
                            <td style={styles.td}>
                              <span style={{ ...styles.ubicacionBadge, background: tema.primary + '15', color: tema.primary }}>
                                {a.ubicacion}
                              </span>
                            </td>
                            <td style={styles.td}>{a.tienda}</td>
                            <td style={styles.td}>{a.tipo_campana}</td>
                            {rol === 'planning' && (
                              <>
                                <td style={styles.td}>{a.dinamica}</td>
                                <td style={styles.td}>
                                  <span style={{
                                    ...styles.diasBadge,
                                    background: diasRestantes(a.fecha_fin) < 7 ? theme.color.errorBg : theme.color.successBg,
                                    color: diasRestantes(a.fecha_fin) < 7 ? theme.color.error : theme.color.successStrong
                                  }}>
                                    {diasRestantes(a.fecha_fin) < 0 ? 'Vencida' : `${diasRestantes(a.fecha_fin)} días`}
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DINÁMICAS */}
          {menuActivo === 'dinamicas' && (
            <div style={styles.card}>
              <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} aria-hidden="true" />Dinámicas — {nombrePais}
              </h3>
              {!dashboard?.dinamicas?.length ? (
                <div style={styles.cargando}>
                  <Inbox size={40} color={theme.color.textMuted} aria-hidden="true" />
                  <p>No hay dinámicas registradas</p>
                </div>
              ) : (
                <div className="pd-table-scroll">
                  <table style={styles.tabla}>
                    <caption style={styles.srOnly}>Dinámicas de {nombrePais}</caption>
                    <thead>
                      <tr>
                        {['Nombre', 'Inicio', 'Fin', 'Artículos', 'Estado', 'Vigencia'].map(h => (
                          <th key={h} style={{ ...styles.th, background: tema.primary + '10', color: tema.primary }} scope="col">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.dinamicas.map((d, i) => {
                        const dias = diasRestantes(d.fecha_fin);
                        const vencida = dias < 0;
                        return (
                          <tr key={i} style={{
                            ...(i % 2 === 0 ? styles.trPar : styles.trImpar),
                            opacity: !d.activa ? 0.6 : 1
                          }}>
                            <td style={styles.td}>
                              <strong>{d.nombre}</strong>
                            </td>
                            <td style={styles.td}>{new Date(d.fecha_inicio).toLocaleDateString('es-CR')}</td>
                            <td style={styles.td}>{new Date(d.fecha_fin).toLocaleDateString('es-CR')}</td>
                            <td style={styles.td}>{d.total_articulos}</td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.diasBadge,
                                background: !d.activa ? theme.color.background :
                                            vencida ? theme.color.errorBg :
                                            dias < 7 ? theme.color.warningSoftBg : theme.color.successBg,
                                color: !d.activa ? theme.color.textMuted :
                                       vencida ? theme.color.error :
                                       dias < 7 ? theme.color.warning : theme.color.successStrong
                              }}>
                                {!d.activa ? '● Inactiva' :
                                 vencida ? 'Vencida' :
                                 `${dias} días restantes`}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {vencida ? (
                                <span style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted }}>
                                  Venció hace {Math.abs(dias)} días
                                </span>
                              ) : (
                                <span style={{ fontSize: theme.font.size.sm, color: theme.color.successStrong, fontWeight: theme.font.weight.semibold }}>
                                  ● Vigente
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ALERTAS */}
          {menuActivo === 'alertas' && (
            <div>
              {!alertas ? (
                <div style={styles.cargando}>
                  <Bell size={40} color={theme.color.textMuted} aria-hidden="true" />
                  <p>Cargando alertas...</p>
                </div>
              ) : alertas.total === 0 ? (
                <div style={styles.sinAlertasBox}>
                  <CheckCircle2 size={64} color={theme.color.successStrong} aria-hidden="true" />
                  <h2 style={{ color: theme.color.successStrong, margin: '16px 0 8px' }}>Todo en orden</h2>
                  <p style={{ color: theme.color.textMuted }}>No hay alertas activas en este momento</p>
                </div>
              ) : (
                <div>
                  <div className="pd-grid-3" style={{ marginBottom: '20px' }}>
                    {[
                      { label: 'Errores', valor: alertas.errores, color: theme.color.error, bg: theme.color.errorBg, Icono: XCircle },
                      { label: 'Advertencias', valor: alertas.warnings, color: theme.color.warning, bg: theme.color.warningSoftBg, Icono: AlertTriangle },
                      { label: 'Información', valor: alertas.info, color: theme.color.accent, bg: theme.color.accentSoft, Icono: Info },
                    ].map((r, i) => (
                      <div key={i} className="pd-stagger-item" style={{ ...styles.alertaResumenCard, background: r.bg, border: `1px solid ${r.color}30`, animationDelay: `calc(var(--stagger) * ${i})` }}>
                        <r.Icono size={28} color={r.color} aria-hidden="true" />
                        <p style={{ ...styles.alertaResumenValor, color: r.color }}>{r.valor}</p>
                        <p style={styles.alertaResumenLabel}>{r.label}</p>
                      </div>
                    ))}
                  </div>

                  <div style={styles.alertasLista}>
                    {alertas.alertas.map((a, i) => (
                      <div key={i} className="pd-stagger-item" style={{
                        ...styles.alertaCard,
                        borderLeft: `4px solid ${
                          a.tipo === 'error' ? theme.color.error :
                          a.tipo === 'warning' ? theme.color.warning : theme.color.accent
                        }`,
                        background: a.tipo === 'error' ? '#FFF8F8' :
                                    a.tipo === 'warning' ? '#FFFBF0' : '#F0F7FF',
                        animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                      }}>
                        <div style={styles.alertaIcono} aria-hidden="true">
                          {a.tipo === 'error' ? <XCircle size={26} color={theme.color.error} /> :
                           a.tipo === 'warning' ? <AlertTriangle size={26} color={theme.color.warning} /> :
                           <Info size={26} color={theme.color.accent} />}
                        </div>
                        <div style={styles.alertaContenido}>
                          <p style={{
                            ...styles.alertaTitulo,
                            color: a.tipo === 'error' ? theme.color.error :
                                   a.tipo === 'warning' ? theme.color.warning : theme.color.accent
                          }}>
                            {a.titulo}
                          </p>
                          <p style={styles.alertaMensaje}>{a.mensaje}</p>
                        </div>
                        <span style={{
                          ...styles.alertaTipo,
                          background: a.tipo === 'error' ? theme.color.error :
                                      a.tipo === 'warning' ? theme.color.warning : theme.color.accent
                        }}>
                          {a.tipo === 'error' ? 'Error' : a.tipo === 'warning' ? 'Alerta' : 'Info'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'right', marginTop: '12px' }}>
                    <button className="pd-pressable" style={{ ...styles.btnReintentar, background: tema.primary }} onClick={cargarAlertas}>
                      <RefreshCw size={14} style={styles.refreshIcono} aria-hidden="true" />
                      Actualizar alertas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {menuActivo === 'carga' && (<CargaInformacion />)}
          {menuActivo === 'exportar' && (<Exportar />)}
          {menuActivo === 'historial' && (<HistorialChat tema={tema} />)}
          {menuActivo === 'chat' && (
            rol === 'comercial' || rol === 'planning' ? (
              <AsistentePersonalizado tema={tema} usuario={usuario} />
            ) : (
              <ChatIA />
            )
          )}

        </div>
      </div>

      {/* Botón flotante */}
      {menuActivo !== 'chat' && (
        <>
          {chatFlotanteAbierto && (
            <div className="pd-dropdown" style={{ ...styles.flotanteContainer, transformOrigin: 'bottom right' }}>
              <ChatIA flotante={true} onCerrar={() => setChatFlotanteAbierto(false)} />
            </div>
          )}
          <button
            className="pd-pressable"
            style={{ ...styles.flotanteBtn, background: tema.gradient }}
            onClick={() => setChatFlotanteAbierto(!chatFlotanteAbierto)}
            aria-label={chatFlotanteAbierto ? 'Cerrar asistente IA' : 'Abrir asistente IA'}
            aria-expanded={chatFlotanteAbierto}
          >
            {chatFlotanteAbierto ? <X size={24} /> : <Bot size={24} />}
          </button>
        </>
      )}

    </div>
  );
}



const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  container: { display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: theme.font.family, background: theme.color.background },
  sidebar: { display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  sidebarHeader: { padding: '24px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)' },
  sidebarHeaderTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  logo: { color: theme.color.textOnPrimary, fontSize: '20px', fontWeight: theme.font.weight.black, whiteSpace: 'nowrap' },
  btnColapsar: { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: theme.radius.sm, padding: '5px', cursor: 'pointer', color: theme.color.textOnPrimary, display: 'flex', flexShrink: 0 },
  rolBadge: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, padding: '3px 8px', borderRadius: theme.radius.pill, display: 'inline-block', letterSpacing: '1px', marginBottom: '6px', whiteSpace: 'nowrap' },
  paisLabel: { color: 'rgba(255,255,255,0.8)', fontSize: theme.font.size.base, marginTop: '4px', whiteSpace: 'nowrap' },
  nav: { flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', overflowX: 'hidden' },
  navItem: { display: 'flex', alignItems: 'center', gap: '12px', borderRadius: theme.radius.md, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: theme.font.size.md, cursor: 'pointer', textAlign: 'left', width: '100%', whiteSpace: 'nowrap', position: 'relative' },
  navItemActivo: { background: 'rgba(255,255,255,0.15)', color: theme.color.textOnPrimary, fontWeight: theme.font.weight.bold },
  navIcon: { flexShrink: 0 },
  alertaBadge: { background: theme.color.error, color: theme.color.textOnPrimary, fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, padding: '2px 6px', borderRadius: theme.radius.pill, minWidth: '18px', textAlign: 'center' },
  alertaDot: { position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', borderRadius: '50%', background: theme.color.error },
  sidebarFooter: { padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.15)' },
  usuarioInfo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  usuarioAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: theme.font.weight.bold, fontSize: theme.font.size.xl, flexShrink: 0 },
  usuarioNombre: { color: theme.color.textOnPrimary, fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, margin: 0, whiteSpace: 'nowrap' },
  usuarioRolTexto: { color: 'rgba(255,255,255,0.6)', fontSize: theme.font.size.sm, margin: 0, whiteSpace: 'nowrap' },
  logoutBtn: { display: 'flex', alignItems: 'center', width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: theme.radius.sm, color: 'rgba(255,255,255,0.6)', fontSize: theme.font.size.base, cursor: 'pointer', whiteSpace: 'nowrap' },
  logoutIcono: { marginRight: '8px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  subheader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', background: theme.color.surface,
    borderBottom: `1px solid ${theme.color.border}`, flexShrink: 0, gap: '12px', flexWrap: 'wrap',
  },
  subheaderIzquierda: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  btnHamburguesa: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', lineHeight: 1, flexShrink: 0, display: 'flex' },
  headerTitulo: { fontWeight: theme.font.weight.black, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  headerSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0', textTransform: 'capitalize' },
  headerAcciones: { display: 'flex', gap: '10px', alignItems: 'center' },
  btnAlertas: { padding: '8px 14px', background: theme.color.errorBg, border: '1px solid', borderRadius: theme.radius.sm, fontSize: theme.font.size.base, cursor: 'pointer', fontWeight: theme.font.weight.bold },
  refreshBtn: { display: 'flex', alignItems: 'center', padding: '8px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, fontSize: theme.font.size.base, cursor: 'pointer', fontWeight: theme.font.weight.semibold, flexShrink: 0 },
  refreshIcono: { marginRight: '6px' },
  contenido: { flex: 1, overflow: 'auto', padding: '20px' },
  metricaCard: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: theme.shadow.sm },
  metricaIcono: { width: '56px', height: '56px', borderRadius: theme.radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  metricaValor: { fontSize: '32px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  metricaLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0' },
  card: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '16px' },
  cardTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, margin: '0 0 16px 0' },
  subTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  barraRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  barraLabel: { fontSize: theme.font.size.base, color: theme.color.textSecondary, width: '100px', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  barraValor: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, width: '24px', textAlign: 'right', flexShrink: 0 },
  dinamicaCard: { background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '14px' },
  dinamicaNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 8px 0' },
  dinamicaInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' },
  dinamicaArts: { display: 'flex', alignItems: 'center', fontSize: theme.font.size.sm, color: theme.color.textMuted },
  dinamicaArtsIcono: { marginRight: '4px' },
  dinamicaDias: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '640px' },
  th: { padding: '10px 12px', fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm, textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0, whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#444444', borderBottom: `1px solid ${theme.color.background}` },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
  tablaWrapper: { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' },
  accionesRow: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  buscadorWrapper: { flex: '1 1 220px', position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', color: theme.color.textMuted },
  buscador: { width: '100%', padding: '12px 12px 12px 44px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none', fontFamily: theme.font.family, background: theme.color.surface, boxSizing: 'border-box' },
  selectFiltro: { padding: '12px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, outline: 'none', background: theme.color.surface, color: theme.color.text },
  btnRefresh: { display: 'flex', alignItems: 'center', padding: '12px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.base, cursor: 'pointer', fontWeight: theme.font.weight.semibold },
  totalBadge: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, padding: '8px 14px', borderRadius: theme.radius.sm },
  ubicacionBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, padding: '2px 8px', borderRadius: theme.radius.pill },
  diasBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 8px', borderRadius: theme.radius.pill },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: theme.color.textMuted, fontSize: theme.font.size.xl, gap: '16px' },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base, textAlign: 'center', padding: '20px' },
  btnReintentar: { display: 'flex', alignItems: 'center', padding: '10px 20px', color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
  alertaResumenCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: theme.radius.lg, padding: '20px', textAlign: 'center' },
  alertaResumenValor: { fontSize: '32px', fontWeight: theme.font.weight.black, margin: '8px 0 4px' },
  alertaResumenLabel: { fontSize: theme.font.size.md, color: theme.color.textMuted, margin: 0 },
  alertasLista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  alertaCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderRadius: theme.radius.lg, flexWrap: 'wrap' },
  alertaIcono: { flexShrink: 0, display: 'flex' },
  alertaContenido: { flex: '1 1 200px' },
  alertaTitulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, margin: '0 0 4px 0' },
  alertaMensaje: { fontSize: theme.font.size.base, color: theme.color.textSecondary, margin: 0 },
  alertaTipo: { color: theme.color.textOnPrimary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, flexShrink: 0 },
  sinAlertasBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', textAlign: 'center' },
  flotanteBtn: { position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', color: theme.color.textOnPrimary, border: 'none', borderRadius: '50%', cursor: 'pointer', boxShadow: theme.shadow.floating, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  flotanteContainer: { position: 'fixed', bottom: '90px', right: '24px', width: 'min(380px, calc(100vw - 32px))', height: 'min(520px, calc(100vh - 160px))', borderRadius: theme.radius.xxl, boxShadow: theme.shadow.floating, zIndex: 999, overflow: 'hidden' },
};

export default AdminDashboard;