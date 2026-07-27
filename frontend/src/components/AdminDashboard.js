// ============================================================
// Componente: AdminDashboard.js
// Descripción: Dashboard adaptado por rol y país
// Colores: según bandera del país del usuario
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ChatIA from './admin/ChatIA';
import CargaInformacion from './admin/CargaInformacion';
import Exportar from './admin/Exportar';
import TopBar from './admin/TopBar';
import HistorialChat from './admin/HistorialChat';
import AsistentePersonalizado from './admin/AsistePersonalizado';

const TEMAS = {
  CR: {
    primary:   '#002B7F',
    secondary: '#CE1126',
    accent:    '#ffffff',
    gradient:  'linear-gradient(145deg, #002B7F 0%, #CE1126 100%)',
    badge:     '#CE1126',
  },
  GT: {
    primary:   '#4997D0',
    secondary: '#1A6DB5',
    accent:    '#ffffff',
    gradient:  'linear-gradient(145deg, #1A6DB5 0%, #4997D0 100%)',
    badge:     '#1A6DB5',
  },
  SV: {
    primary:   '#0F47AF',
    secondary: '#F0C010',
    accent:    '#ffffff',
    gradient:  'linear-gradient(145deg, #0F47AF 0%, #1565C0 100%)',
    badge:     '#F0C010',
  },
  default: {
    primary:   '#1E2761',
    secondary: '#0077B6',
    accent:    '#ffffff',
    gradient:  'linear-gradient(145deg, #1E2761 0%, #0077B6 100%)',
    badge:     '#0077B6',
  }
};

function AdminDashboard({ usuario, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [alertas, setAlertas] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [menuActivo, setMenuActivo] = useState('dashboard');
  const [chatFlotanteAbierto, setChatFlotanteAbierto] = useState(false);
  const [articulos, setArticulos] = useState([]);
  const [cargandoArticulos, setCargandoArticulos] = useState(false);
  const [filtroArticulo, setFiltroArticulo] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState('');

  const rol = usuario.rol;
  const pais = usuario.pais;
  const tema = TEMAS[pais] || TEMAS.default;

  const nombrePais = {
    CR: '🇨🇷 Costa Rica',
    GT: '🇬🇹 Guatemala',
    SV: '🇸🇻 El Salvador',
    '': '🌎 Todos'
  }[pais] || pais;

  const menuPorRol = {
    admin: [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'dinamicas', icon: '📦', label: 'Dinámicas' },
      { id: 'articulos', icon: '🏷️', label: 'Artículos' },
      { id: 'carga',     icon: '📤', label: 'Carga de Información' },
      { id: 'alertas',   icon: '🔔', label: 'Alertas' },
      { id: 'exportar',  icon: '📥', label: 'Exportar' },
      { id: 'chat',      icon: '🤖', label: 'Chat con IA' },
      { id: 'historial', icon: '🕐', label: 'Historial IA' },
    ],
    comercial: [
  { id: 'dashboard', icon: '📊', label: 'Mi Dashboard' },
  { id: 'articulos', icon: '🏷️', label: 'Artículos en Campaña' },
  { id: 'alertas',   icon: '🔔', label: 'Alertas' },
  { id: 'historial', icon: '🕐', label: 'Historial IA' },
  { id: 'chat',      icon: '🤖', label: 'Mi Asistente IA' },
],
    planning: [
  { id: 'dashboard', icon: '📊', label: 'Mi Dashboard' },
  { id: 'articulos', icon: '📋', label: 'Trazabilidad' },
  { id: 'alertas',   icon: '🔔', label: 'Alertas' },
  { id: 'historial', icon: '🕐', label: 'Historial IA' },
  { id: 'chat',      icon: '🤖', label: 'Mi Asistente IA' },
],
    tiendas: [
      { id: 'articulos', icon: '🏷️', label: 'Mis Artículos' },
      { id: 'chat',      icon: '🤖', label: 'Consultar IA' },
    ],
  };

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

  useEffect(() => {
    if (menuActivo === 'dashboard') cargarDashboard();
    if (menuActivo === 'articulos') cargarArticulos();
    if (menuActivo === 'alertas') cargarAlertas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuActivo]);

  const cargarDashboard = async () => {
    setCargando(true);
    try {
      // Limpiar dinámicas vencidas antes de cargar
      try {
        await api.post('/admin/dinamicas/limpiar-vencidas');
      } catch (err) {
        console.log('Error limpiando vencidas:', err);
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

  return (
    <div style={styles.container}>

      {/* ── SIDEBAR ───────────────────────────────────── */}
      <div style={{ ...styles.sidebar, background: tema.gradient }}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>PromoIQ</div>
          <div style={{
            ...styles.rolBadge,
            background: pais === 'SV' ? tema.badge : 'rgba(255,255,255,0.2)',
            color: pais === 'SV' ? '#0F47AF' : '#ffffff'
          }}>
            {labelRol}
          </div>
          <div style={styles.paisLabel}>{nombrePais}</div>
        </div>

        <nav style={styles.nav}>
          {menu.map(item => (
            <button
              key={item.id}
              style={{
                ...styles.navItem,
                ...(menuActivo === item.id ? styles.navItemActivo : {})
              }}
              onClick={() => setMenuActivo(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.id === 'alertas' && totalAlertas > 0 && (
                <span style={styles.alertaBadge}>{totalAlertas}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.usuarioInfo}>
            <div style={{
              ...styles.usuarioAvatar,
              background: tema.secondary
            }}>
              {usuario.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={styles.usuarioNombre}>{usuario.nombre}</p>
              <p style={styles.usuarioRolTexto}>{labelRol}</p>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* ── MAIN ──────────────────────────────────────── */}
      <div style={styles.main}>

        {/* TopBar profesional */}
        <TopBar
          usuario={usuario}
          onLogout={onLogout}
          totalAlertas={totalAlertas}
          onVerAlertas={() => setMenuActivo('alertas')}
          tema={tema}
        />

        {/* Subheader con título del módulo */}
        <div style={styles.subheader}>
          <h1 style={{ ...styles.headerTitulo, color: tema.primary }}>
            {menu.find(m => m.id === menuActivo)?.icon}{' '}
            {menu.find(m => m.id === menuActivo)?.label}
          </h1>
          <button style={styles.refreshBtn} onClick={() => {
            if (menuActivo === 'dashboard') cargarDashboard();
            if (menuActivo === 'articulos') cargarArticulos();
            if (menuActivo === 'alertas') cargarAlertas();
          }}>
            🔄 Actualizar
          </button>
        </div>

        {/* ── CONTENIDO ───────────────────────────────── */}
        <div style={styles.contenido}>

          {/* DASHBOARD */}
          {menuActivo === 'dashboard' && (
            cargando ? (
              <div style={styles.cargando}>
                <span style={{ fontSize: '48px' }}>📊</span>
                <p>Cargando dashboard...</p>
              </div>
            ) : dashboard ? (
              <div>
                {/* Métricas */}
                <div style={styles.metricas}>
                  {[
                    { label: 'Dinámicas Activas', valor: dashboard.metricas.dinamicas_activas, icon: '📦', color: tema.primary },
                    { label: 'Artículos en Campaña', valor: dashboard.metricas.articulos_campana, icon: '🏷️', color: tema.secondary },
                    { label: 'Consultas Hoy', valor: dashboard.metricas.consultas_hoy, icon: '💬', color: '#06847A' },
                    { label: 'Usuarios Activos', valor: dashboard.metricas.usuarios_activos, icon: '👥', color: '#B45309' },
                  ].map((m, i) => (
                    <div key={i} style={styles.metricaCard}>
                      <div style={{ ...styles.metricaIcono, background: m.color + '15' }}>
                        <span style={{ fontSize: '28px' }}>{m.icon}</span>
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
                    <div style={styles.filaSecundaria}>
                      <div>
                        <p style={styles.subTitulo}>Por Tipo de Campaña</p>
                        {dashboard.por_tipo_campana.map((t, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{t.tipo}</span>
                            <div style={styles.barraContainer}>
                              <div style={{
                                ...styles.barra,
                                width: `${(t.total / dashboard.metricas.articulos_campana) * 100}%`,
                                background: tema.primary
                              }} />
                            </div>
                            <span style={styles.barraValor}>{t.total}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p style={styles.subTitulo}>Por Ubicación en Tienda</p>
                        {dashboard.por_ubicacion.map((u, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{u.ubicacion}</span>
                            <div style={styles.barraContainer}>
                              <div style={{
                                ...styles.barra,
                                width: `${(u.total / dashboard.metricas.articulos_campana) * 100}%`,
                                background: tema.secondary
                              }} />
                            </div>
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
                      <div style={styles.dinamicasGrid}>
                        {dashboard.dinamicas?.map((d, i) => {
                          const dias = diasRestantes(d.fecha_fin);
                          return (
                            <div key={i} style={{
                              ...styles.dinamicaCard,
                              borderLeft: `4px solid ${dias < 7 ? '#B91C1C' : tema.primary}`
                            }}>
                              <p style={styles.dinamicaNombre}>{d.nombre}</p>
                              <div style={styles.dinamicaInfo}>
                                <span style={styles.dinamicaArts}>🏷️ {d.total_articulos} códigos</span>
                                <span style={{
                                  ...styles.dinamicaDias,
                                  color: dias < 0 ? '#B91C1C' : dias < 7 ? '#B45309' : '#06847A'
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
                  <>
                    <div style={styles.filaSecundaria}>
                      <div style={styles.card}>
                        <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>📍 Por Ubicación</h3>
                        {dashboard.por_ubicacion.map((u, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{u.ubicacion}</span>
                            <div style={styles.barraContainer}>
                              <div style={{
                                ...styles.barra,
                                width: `${(u.total / dashboard.metricas.articulos_campana) * 100}%`,
                                background: tema.primary
                              }} />
                            </div>
                            <span style={styles.barraValor}>{u.total}</span>
                          </div>
                        ))}
                      </div>
                      <div style={styles.card}>
                        <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>🎯 Por Tipo de Campaña</h3>
                        {dashboard.por_tipo_campana.map((t, i) => (
                          <div key={i} style={styles.barraRow}>
                            <span style={styles.barraLabel}>{t.tipo}</span>
                            <div style={styles.barraContainer}>
                              <div style={{
                                ...styles.barra,
                                width: `${(t.total / dashboard.metricas.articulos_campana) * 100}%`,
                                background: tema.secondary
                              }} />
                            </div>
                            <span style={styles.barraValor}>{t.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Dinámicas activas */}
                {rol !== 'planning' && dashboard.dinamicas?.length > 0 && (
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>📦 Dinámicas activas</h3>
                    <div style={styles.dinamicasGrid}>
                      {dashboard.dinamicas.map((d, i) => {
                        const dias = diasRestantes(d.fecha_fin);
                        return (
                          <div key={i} style={{
                            ...styles.dinamicaCard,
                            borderLeft: `4px solid ${dias < 7 ? '#B91C1C' : tema.primary}`
                          }}>
                            <p style={styles.dinamicaNombre}>{d.nombre}</p>
                            <div style={styles.dinamicaInfo}>
                              <span style={styles.dinamicaArts}>🏷️ {d.total_articulos} artículos</span>
                              <span style={{
                                ...styles.dinamicaDias,
                                color: dias < 0 ? '#B91C1C' : dias < 7 ? '#B45309' : '#06847A'
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
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>🕐 Últimas Consultas a la IA</h3>
                    <table style={styles.tabla}>
                      <thead>
                        <tr>
                          {['Usuario', 'Pregunta', 'Fecha', 'Tokens'].map(h => (
                            <th key={h} style={{ ...styles.th, background: tema.primary + '10' }}>{h}</th>
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
                )}
              </div>
            ) : (
              <div style={styles.cargando}>
                <span style={{ fontSize: '48px' }}>❌</span>
                <p>Error cargando el dashboard</p>
                <button style={{ ...styles.btnReintentar, background: tema.primary }} onClick={cargarDashboard}>
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
                  <span style={styles.buscadorIcon}>🔍</span>
                  <input
                    style={styles.buscador}
                    type="text"
                    placeholder="Buscar por código, descripción o tienda..."
                    value={filtroArticulo}
                    onChange={(e) => setFiltroArticulo(e.target.value)}
                  />
                </div>
                <select
                  style={styles.selectFiltro}
                  value={filtroUbicacion}
                  onChange={(e) => setFiltroUbicacion(e.target.value)}
                >
                  <option value="">Todas las ubicaciones</option>
                  {ubicaciones.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button style={{ ...styles.btnRefresh, color: tema.primary }} onClick={cargarArticulos}>
                  🔄 Actualizar
                </button>
                <span style={{ ...styles.totalBadge, background: tema.primary + '15', color: tema.primary }}>
                  {articulosFiltrados.length} artículos
                </span>
              </div>

              <div style={styles.card}>
                {cargandoArticulos ? (
                  <div style={styles.cargando}>
                    <span style={{ fontSize: '40px' }}>⏳</span>
                    <p>Cargando artículos...</p>
                  </div>
                ) : articulosFiltrados.length === 0 ? (
                  <div style={styles.cargando}>
                    <span style={{ fontSize: '40px' }}>📭</span>
                    <p>No hay artículos que coincidan</p>
                  </div>
                ) : (
                  <div style={styles.tablaWrapper}>
                    <table style={styles.tabla}>
                      <thead>
                        <tr>
                          {[
                            'Código', 'Descripción', 'Categoría',
                            'P. Regular', 'P. Dinámica', 'Ahorro',
                            'Ubicación', 'Tienda', 'Tipo Campaña',
                            ...(rol === 'planning' ? ['Dinámica', 'Vence'] : [])
                          ].map(h => (
                            <th key={h} style={{ ...styles.th, background: tema.primary + '10', color: tema.primary }}>{h}</th>
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
                            <td style={{ ...styles.td, color: tema.primary, fontWeight: '700' }}>
                              ${a.precio_dinamica?.toFixed(2)}
                            </td>
                            <td style={{ ...styles.td, color: '#06847A', fontWeight: '700' }}>
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
                                    background: diasRestantes(a.fecha_fin) < 7 ? '#FFF0F0' : '#F0FDF4',
                                    color: diasRestantes(a.fecha_fin) < 7 ? '#B91C1C' : '#06847A'
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
              <h3 style={{ ...styles.cardTitulo, color: tema.primary }}>📦 Dinámicas — {nombrePais}</h3>
              {!dashboard?.dinamicas?.length ? (
                <div style={styles.cargando}>
                  <span style={{ fontSize: '40px' }}>📭</span>
                  <p>No hay dinámicas registradas</p>
                </div>
              ) : (
                <table style={styles.tabla}>
                  <thead>
                    <tr>
                      {['Nombre', 'Inicio', 'Fin', 'Artículos', 'Estado', 'Vigencia'].map(h => (
                        <th key={h} style={{ ...styles.th, background: tema.primary + '10', color: tema.primary }}>{h}</th>
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
                              background: !d.activa ? '#F4F7FB' :
                                          vencida ? '#FFF0F0' :
                                          dias < 7 ? '#FEF3C7' : '#F0FDF4',
                              color: !d.activa ? '#8892A4' :
                                     vencida ? '#B91C1C' :
                                     dias < 7 ? '#B45309' : '#06847A'
                            }}>
                              {!d.activa ? '● Inactiva' :
                               vencida ? 'Vencida' :
                               `${dias} días restantes`}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {vencida ? (
                              <span style={{ fontSize: '12px', color: '#8892A4' }}>
                                Venció hace {Math.abs(dias)} días
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#06847A', fontWeight: '600' }}>
                                ● Vigente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ALERTAS */}
          {menuActivo === 'alertas' && (
            <div>
              {!alertas ? (
                <div style={styles.cargando}>
                  <span style={{ fontSize: '40px' }}>⏳</span>
                  <p>Cargando alertas...</p>
                </div>
              ) : alertas.total === 0 ? (
                <div style={styles.sinAlertasBox}>
                  <span style={{ fontSize: '64px' }}>✅</span>
                  <h2 style={{ color: '#06847A', margin: '16px 0 8px' }}>Todo en orden</h2>
                  <p style={{ color: '#8892A4' }}>No hay alertas activas en este momento</p>
                </div>
              ) : (
                <div>
                  {/* Resumen */}
                  <div style={styles.alertasResumen}>
                    {[
                      { label: 'Errores', valor: alertas.errores, color: '#B91C1C', bg: '#FFF0F0', icon: '❌' },
                      { label: 'Advertencias', valor: alertas.warnings, color: '#B45309', bg: '#FEF3C7', icon: '⚠️' },
                      { label: 'Información', valor: alertas.info, color: '#0077B6', bg: '#EEF2FF', icon: 'ℹ️' },
                    ].map((r, i) => (
                      <div key={i} style={{ ...styles.alertaResumenCard, background: r.bg, border: `1px solid ${r.color}30` }}>
                        <span style={{ fontSize: '28px' }}>{r.icon}</span>
                        <p style={{ ...styles.alertaResumenValor, color: r.color }}>{r.valor}</p>
                        <p style={styles.alertaResumenLabel}>{r.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Lista de alertas */}
                  <div style={styles.alertasLista}>
                    {alertas.alertas.map((a, i) => (
                      <div key={i} style={{
                        ...styles.alertaCard,
                        borderLeft: `4px solid ${
                          a.tipo === 'error' ? '#B91C1C' :
                          a.tipo === 'warning' ? '#B45309' : '#0077B6'
                        }`,
                        background: a.tipo === 'error' ? '#FFF8F8' :
                                    a.tipo === 'warning' ? '#FFFBF0' : '#F0F7FF'
                      }}>
                        <div style={styles.alertaIcono}>{a.icono}</div>
                        <div style={styles.alertaContenido}>
                          <p style={{
                            ...styles.alertaTitulo,
                            color: a.tipo === 'error' ? '#B91C1C' :
                                   a.tipo === 'warning' ? '#B45309' : '#0077B6'
                          }}>
                            {a.titulo}
                          </p>
                          <p style={styles.alertaMensaje}>{a.mensaje}</p>
                        </div>
                        <span style={{
                          ...styles.alertaTipo,
                          background: a.tipo === 'error' ? '#B91C1C' :
                                      a.tipo === 'warning' ? '#B45309' : '#0077B6'
                        }}>
                          {a.tipo === 'error' ? 'Error' : a.tipo === 'warning' ? 'Alerta' : 'Info'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'right', marginTop: '12px' }}>
                    <button style={{ ...styles.btnReintentar, background: tema.primary }} onClick={cargarAlertas}>
                      🔄 Actualizar alertas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


        {/* CARGA DE INFORMACIÓN — solo admin */}
                {menuActivo === 'carga' && (
                    <CargaInformacion />
                )}

{/* EXPORTAR */}
          {menuActivo === 'exportar' && (
            <Exportar />
          )}



          {menuActivo === 'historial' && (
  <HistorialChat tema={tema} />
)}

          {/* CHAT IA — personalizado para comercial y planning */}
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
            <div style={styles.flotanteContainer}>
              <ChatIA flotante={true} onCerrar={() => setChatFlotanteAbierto(false)} />
            </div>
          )}
          <button
            style={{ ...styles.flotanteBtn, background: tema.gradient }}
            onClick={() => setChatFlotanteAbierto(!chatFlotanteAbierto)}
          >
            {chatFlotanteAbierto ? '✕' : '🤖'}
          </button>
        </>
      )}

    </div>
  );
}

const styles = {
  container: { display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Calibri, sans-serif', background: '#F4F7FB' },
  sidebar: { width: '240px', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.15)' },
  logo: { color: '#ffffff', fontSize: '24px', fontWeight: '900', marginBottom: '8px' },
  rolBadge: { fontSize: '10px', fontWeight: '800', padding: '3px 8px', borderRadius: '20px', display: 'inline-block', letterSpacing: '1px', marginBottom: '6px' },
  paisLabel: { color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '4px' },
  nav: { flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' },
  navItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '14px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  navItemActivo: { background: 'rgba(255,255,255,0.15)', color: '#ffffff', fontWeight: '700' },
  navIcon: { fontSize: '18px', width: '24px' },
  alertaBadge: { background: '#B91C1C', color: '#ffffff', fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '20px', minWidth: '18px', textAlign: 'center' },
  sidebarFooter: { padding: '16px', borderTop: '1px solid rgba(255,255,255,0.15)' },
  usuarioInfo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  usuarioAvatar: { width: '36px', height: '36px', borderRadius: '50%', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px', flexShrink: 0 },
  usuarioNombre: { color: '#ffffff', fontSize: '13px', fontWeight: '600', margin: 0 },
  usuarioRolTexto: { color: 'rgba(255,255,255,0.6)', fontSize: '11px', margin: 0 },
  logoutBtn: { width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  subheader: {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 28px', background: '#ffffff',
  borderBottom: '1px solid #E2E8F0', flexShrink: 0,
},
  headerTitulo: { fontSize: '22px', fontWeight: '800', margin: 0 },
  headerSub: { fontSize: '12px', color: '#8892A4', margin: '4px 0 0 0', textTransform: 'capitalize' },
  headerAcciones: { display: 'flex', gap: '10px', alignItems: 'center' },
  btnAlertas: { padding: '8px 14px', background: '#FFF0F0', border: '1px solid', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '700' },
  refreshBtn: { padding: '8px 16px', background: '#F4F7FB', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' },
  contenido: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  metricas: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' },
  metricaCard: { background: '#ffffff', borderRadius: '14px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  metricaIcono: { width: '56px', height: '56px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  metricaValor: { fontSize: '32px', fontWeight: '900', margin: 0, lineHeight: 1 },
  metricaLabel: { fontSize: '12px', color: '#8892A4', margin: '4px 0 0 0' },
  card: { background: '#ffffff', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '16px' },
  cardTitulo: { fontSize: '15px', fontWeight: '700', margin: '0 0 16px 0' },
  subTitulo: { fontSize: '13px', fontWeight: '700', color: '#8892A4', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  filaSecundaria: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  barraRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  barraLabel: { fontSize: '13px', color: '#555', width: '100px', flexShrink: 0 },
  barraContainer: { flex: 1, height: '8px', background: '#F4F7FB', borderRadius: '4px', overflow: 'hidden' },
  barra: { height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' },
  barraValor: { fontSize: '13px', fontWeight: '700', width: '24px', textAlign: 'right' },
  dinamicasGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  dinamicaCard: { background: '#F8FAFC', borderRadius: '10px', padding: '14px' },
  dinamicaNombre: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: '0 0 8px 0' },
  dinamicaInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dinamicaArts: { fontSize: '12px', color: '#8892A4' },
  dinamicaDias: { fontSize: '12px', fontWeight: '700' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '10px 12px', fontWeight: '700', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0 },
  td: { padding: '10px 12px', color: '#444', borderBottom: '1px solid #F4F7FB' },
  trPar: { background: '#ffffff' },
  trImpar: { background: '#FAFBFC' },
  tablaWrapper: { overflow: 'auto', maxHeight: 'calc(100vh - 280px)' },
  accionesRow: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' },
  buscadorWrapper: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: '16px' },
  buscador: { width: '100%', padding: '12px 12px 12px 44px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none', fontFamily: 'Calibri, sans-serif', background: '#ffffff', boxSizing: 'border-box' },
  selectFiltro: { padding: '12px', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontSize: '13px', outline: 'none', background: '#ffffff', color: '#333' },
  btnRefresh: { padding: '12px 16px', background: '#F4F7FB', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' },
  totalBadge: { fontSize: '13px', fontWeight: '700', padding: '8px 14px', borderRadius: '8px' },
  ubicacionBadge: { fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px' },
  diasBadge: { fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#8892A4', fontSize: '16px', gap: '16px' },
  sinDatos: { color: '#8892A4', fontSize: '13px', textAlign: 'center', padding: '20px' },
  btnReintentar: { padding: '10px 20px', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  alertasResumen: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' },
  alertaResumenCard: { borderRadius: '12px', padding: '20px', textAlign: 'center' },
  alertaResumenValor: { fontSize: '32px', fontWeight: '900', margin: '8px 0 4px' },
  alertaResumenLabel: { fontSize: '13px', color: '#8892A4', margin: 0 },
  alertasLista: { display: 'flex', flexDirection: 'column', gap: '12px' },
  alertaCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderRadius: '12px' },
  alertaIcono: { fontSize: '28px', flexShrink: 0 },
  alertaContenido: { flex: 1 },
  alertaTitulo: { fontSize: '14px', fontWeight: '700', margin: '0 0 4px 0' },
  alertaMensaje: { fontSize: '13px', color: '#555', margin: 0 },
  alertaTipo: { color: '#ffffff', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', flexShrink: 0 },
  sinAlertasBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', textAlign: 'center' },
  flotanteBtn: { position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', color: '#ffffff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  flotanteContainer: { position: 'fixed', bottom: '90px', right: '24px', width: '380px', height: '520px', borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', zIndex: 999, overflow: 'hidden' },
};

export default AdminDashboard;