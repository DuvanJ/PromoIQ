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

function SuperAdminDashboard({ usuario, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [menuActivo, setMenuActivo] = useState('dashboard');
  const [chatFlotanteAbierto, setChatFlotanteAbierto] = useState(false);

  useEffect(() => {
    cargarDashboard();
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

  const menu = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'usuarios',  icon: '👥', label: 'Usuarios' },
    { id: 'dinamicas', icon: '📦', label: 'Dinámicas' },
    { id: 'carga',     icon: '📤', label: 'Carga de Información' },
    { id: 'historial', icon: '🕐', label: 'Historial' },
    { id: 'reportes',  icon: '📈', label: 'Reportes' },
    { id: 'exportar',  icon: '📥', label: 'Exportar' },
    { id: 'chat',      icon: '🤖', label: 'Chat con IA' },
  ];
  return (
    <div style={styles.container}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>PromoIQ</div>
          <div style={styles.adminBadge}>SUPER ADMIN</div>
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
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.usuarioInfo}>
            <div style={styles.usuarioAvatar}>
              {usuario.nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={styles.usuarioNombre}>{usuario.nombre}</p>
              <p style={styles.usuarioRol}>Super Administrador</p>
            </div>
          </div>
          <button style={styles.logoutBtn} onClick={onLogout}>
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
          tema={{ primary: '#1E2761' }}
        />

        <div style={styles.subheader}>
          <h1 style={styles.headerTitulo}>
            {menu.find(m => m.id === menuActivo)?.icon}{' '}
            {menu.find(m => m.id === menuActivo)?.label}
          </h1>
          <button style={styles.refreshBtn} onClick={cargarDashboard}>
            🔄 Actualizar
          </button>
        </div>

        {/* CONTENIDO */}
        <div style={styles.contenido}>
          {menuActivo === 'dashboard' && (
            cargando ? (
              <div style={styles.cargando}>
                <p style={styles.cargandoTexto}>Cargando dashboard...</p>
              </div>
            ) : dashboard ? (
              <div>
                {/* MÉTRICAS */}
                <div style={styles.metricas}>
                  {[
                    { label: 'Dinámicas Activas', valor: dashboard.metricas.dinamicas_activas, icon: '📦', color: '#0077B6' },
                    { label: 'Artículos en Campaña', valor: dashboard.metricas.articulos_campana, icon: '🏷️', color: '#06D6A0' },
                    { label: 'Consultas Hoy', valor: dashboard.metricas.consultas_hoy, icon: '💬', color: '#F9C74F' },
                    { label: 'Usuarios Activos', valor: dashboard.metricas.usuarios_activos, icon: '👥', color: '#F96167' },
                  ].map((m, i) => (
                    <div key={i} style={styles.metricaCard}>
                      <div style={{ ...styles.metricaIcono, background: m.color + '20' }}>
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
                <div style={styles.filaSecundaria}>

                  {/* Artículos por ubicación */}
                  <div style={styles.card}>
                    <h3 style={styles.cardTitulo}>📍 Artículos por Ubicación</h3>
                    {dashboard.por_ubicacion.length === 0 ? (
                      <p style={styles.sinDatos}>Sin datos disponibles</p>
                    ) : (
                      dashboard.por_ubicacion.map((u, i) => (
                        <div key={i} style={styles.barraRow}>
                          <span style={styles.barraLabel}>{u.ubicacion}</span>
                          <div style={styles.barraContainer}>
                            <div style={{
                              ...styles.barra,
                              width: `${(u.total / dashboard.metricas.articulos_campana) * 100}%`,
                              background: ['#0077B6', '#06D6A0', '#F9C74F', '#F96167', '#9B5DE5'][i % 5]
                            }} />
                          </div>
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
                          background: ['#1E2761', '#0077B6', '#06D6A0', '#F9C74F', '#F96167'][i % 5]
                        }} />
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
                    <table style={styles.tabla}>
                      <thead>
                        <tr>
                          {['Usuario', 'Pregunta', 'Fecha', 'Tokens'].map(h => (
                            <th key={h} style={styles.th}>{h}</th>
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
                  )}
                </div>

              </div>
            ) : (
              <p style={styles.sinDatos}>Error cargando el dashboard</p>
            )
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

{menuActivo === 'exportar' && (
  <Exportar />
)}


{menuActivo !== 'dashboard' && menuActivo !== 'carga' && menuActivo !== 'historial' && menuActivo !== 'usuarios' && menuActivo !== 'dinamicas' && menuActivo !== 'chat' && menuActivo !== 'reportes' && menuActivo !== 'exportar' && (
  <div style={styles.proximamente}>
    <p style={styles.proximamenteIcono}>
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
      <div style={styles.flotanteContainer}>
        <ChatIA flotante={true} onCerrar={() => setChatFlotanteAbierto(false)} />
      </div>
    )}
    <button
      style={styles.flotanteBtn}
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
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'Calibri, sans-serif',
    background: '#F4F7FB',
  },
  sidebar: {
    width: '240px',
    background: '#1E2761',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logo: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '900',
    marginBottom: '8px',
  },
  adminBadge: {
    background: '#F9C74F',
    color: '#1E2761',
    fontSize: '10px',
    fontWeight: '800',
    padding: '3px 8px',
    borderRadius: '20px',
    display: 'inline-block',
    letterSpacing: '1px',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    color: '#CADCFC',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  navItemActivo: {
    background: 'rgba(255,255,255,0.12)',
    color: '#ffffff',
    fontWeight: '700',
  },
  navIcon: {
    fontSize: '18px',
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
    background: '#0077B6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px',
    flexShrink: 0,
  },
  usuarioNombre: {
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    margin: 0,
  },
  usuarioRol: {
    color: '#8892A4',
    fontSize: '11px',
    margin: 0,
  },
  logoutBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#8892A4',
    fontSize: '13px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 28px',
    background: '#ffffff',
    borderBottom: '1px solid #E2E8F0',
    flexShrink: 0,
  },
  headerTitulo: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#1E2761',
    margin: 0,
  },
  headerSub: {
    fontSize: '12px',
    color: '#8892A4',
    margin: '4px 0 0 0',
    textTransform: 'capitalize',
  },
  refreshBtn: {
    padding: '8px 16px',
    background: '#F4F7FB',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#1E2761',
    fontWeight: '600',
  },
  contenido: {
    flex: 1,
    overflow: 'auto',
    padding: '24px 28px',
  },
  metricas: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  metricaCard: {
    background: '#ffffff',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  metricaIcono: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricaValor: {
    fontSize: '32px',
    fontWeight: '900',
    color: '#1E2761',
    margin: 0,
    lineHeight: 1,
  },
  metricaLabel: {
    fontSize: '12px',
    color: '#8892A4',
    margin: '4px 0 0 0',
  },
  filaSecundaria: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '14px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    marginBottom: '16px',
  },
  cardTitulo: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1E2761',
    margin: '0 0 16px 0',
  },
  barraRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  barraLabel: {
    fontSize: '13px',
    color: '#555',
    width: '90px',
    flexShrink: 0,
  },
  barraContainer: {
    flex: 1,
    height: '8px',
    background: '#F4F7FB',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  barra: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },
  barraValor: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#1E2761',
    width: '24px',
    textAlign: 'right',
  },
  rolRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 0',
    borderBottom: '1px solid #F4F7FB',
  },
  rolDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  rolNombre: {
    flex: 1,
    fontSize: '13px',
    color: '#333',
  },
  rolTotal: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#1E2761',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '10px 12px',
    background: '#F4F7FB',
    color: '#1E2761',
    fontWeight: '700',
    textAlign: 'left',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '10px 12px',
    color: '#444',
    borderBottom: '1px solid #F4F7FB',
  },
  trPar: { background: '#ffffff' },
  trImpar: { background: '#FAFBFC' },
  cargando: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
  },
  cargandoTexto: {
    color: '#8892A4',
    fontSize: '16px',
  },
  sinDatos: {
    color: '#8892A4',
    fontSize: '14px',
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
    fontWeight: '800',
    color: '#1E2761',
    margin: '0 0 8px 0',
  },
  proximamenteSub: {
    fontSize: '15px',
    color: '#8892A4',
  },

flotanteBtn: {
  position: 'fixed', bottom: '24px', right: '24px',
  width: '56px', height: '56px',
  background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
  color: '#ffffff', border: 'none', borderRadius: '50%',
  fontSize: '24px', cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 999,
},
flotanteContainer: {
  position: 'fixed', bottom: '90px', right: '24px',
  width: '380px', height: '520px',
  borderRadius: '16px',
  boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
  zIndex: 999,
  overflow: 'hidden',
},

subheader: {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 28px', background: '#ffffff',
  borderBottom: '1px solid #E2E8F0', flexShrink: 0,
},


};

export default SuperAdminDashboard;