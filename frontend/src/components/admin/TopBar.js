import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import logo from '../../assets/Vidri Novex.png';

const BANDERAS = {
  CR: { emoji: '🇨🇷', nombre: 'Costa Rica',      gradient: 'linear-gradient(135deg, #002B7F 0%, #CE1126 100%)', color: '#002B7F' },
  GT: { emoji: '🇬🇹', nombre: 'Guatemala',       gradient: 'linear-gradient(135deg, #1A6DB5 0%, #4997D0 100%)', color: '#1A6DB5' },
  SV: { emoji: '🇸🇻', nombre: 'El Salvador',     gradient: 'linear-gradient(135deg, #0F47AF 0%, #1565C0 100%)', color: '#0F47AF' },
  '': { emoji: '🌎', nombre: 'Todos los países', gradient: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)', color: '#1E2761' },
};

const EMOJIS_PAIS = { CR: '🇨🇷', GT: '🇬🇹', SV: '🇸🇻', '': '🌎' };

const banderaCirculo = (pais) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '20px', height: '20px', borderRadius: '50%',
    background: 'rgba(0,0,0,0.06)', fontSize: '12px', flexShrink: 0,
  }}>
    {EMOJIS_PAIS[pais] || '🌎'}
  </span>
);

function TopBar({ usuario, onLogout, totalAlertas = 0, onVerAlertas, tema }) {
  const [hora, setHora] = useState(new Date());
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const perfilRef = useRef(null);
  const notifRef = useRef(null);
  const buscadorRef = useRef(null);
  const busquedaTimer = useRef(null);

  const pais = usuario.pais || '';
  const bandera = BANDERAS[pais] || BANDERAS[''];
  const gradiente = tema?.gradient || bandera.gradient;

  useEffect(() => {
    const timer = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (perfilRef.current && !perfilRef.current.contains(e.target)) setPerfilAbierto(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotificacionesAbiertas(false);
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) setMostrarResultados(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (busquedaTimer.current) clearTimeout(busquedaTimer.current);
    if (busqueda.length < 2) {
      setResultados(null);
      setMostrarResultados(false);
      return;
    }
    busquedaTimer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await api.get(`/pais/buscar?q=${encodeURIComponent(busqueda)}`);
        setResultados(res.data);
        setMostrarResultados(true);
      } catch (err) {
        console.error('Error buscando:', err);
      } finally {
        setBuscando(false);
      }
    }, 400);
    return () => clearTimeout(busquedaTimer.current);
  }, [busqueda]);

  const formatHora = (date) => date.toLocaleTimeString('es-CR', {
    hour: '2-digit', minute: '2-digit'
  });

  const formatFecha = (date) => date.toLocaleDateString('es-CR', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  const labelRol = {
    superadmin: 'Super Admin',
    admin:      'Administrador',
    comercial:  'Comercial',
    planning:   'Planning',
    tiendas:    'Tiendas',
  }[usuario.rol] || usuario.rol;

  return (
    <div style={{ ...styles.topbar, background: gradiente }}>
      <div style={styles.brilloSuperior} />

      {/* ── LOGO ──────────────────────────────────────── */}
      <div style={styles.logoWrapper}>
        <img src={logo} alt="VIDRI/NOVEX" style={styles.logoImg} />
        <div style={styles.logoDivisor} />
        <div>
          <p style={styles.logoSistema}>PromoIQ</p>
          <p style={styles.logoSub}>VIDRI / NOVEX</p>
        </div>
      </div>

      <div style={styles.divisor} />

      {/* ── BUSCADOR ──────────────────────────────────── */}
      <div ref={buscadorRef} style={styles.buscadorWrapper}>
        <span style={styles.buscadorIcon}>{buscando ? '⏳' : '🔍'}</span>
        <input
          style={styles.buscador}
          type="text"
          placeholder="Buscar artículo, dinámica o usuario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={() => resultados && setMostrarResultados(true)}
        />
        {busqueda && (
          <button style={styles.buscadorClear} onClick={() => {
            setBusqueda('');
            setResultados(null);
            setMostrarResultados(false);
          }}>✕</button>
        )}

        {/* Dropdown resultados */}
        {mostrarResultados && resultados && (
          <div style={styles.resultadosDropdown}>
            {resultados.total === 0 ? (
              <div style={styles.sinResultados}>
                <span style={{ fontSize: '24px' }}>🔍</span>
                <p>Sin resultados para "{busqueda}"</p>
              </div>
            ) : (
              <>
                <div style={styles.resultadosHeader}>
                  <span style={styles.resultadosTotal}>
                    {resultados.total} resultado{resultados.total !== 1 ? 's' : ''} para "{busqueda}"
                  </span>
                </div>

                {/* Artículos */}
                {resultados.resultados.articulos.length > 0 && (
                  <div>
                    <p style={styles.seccionLabel}>🏷️ Artículos</p>
                    {resultados.resultados.articulos.map((a, i) => (
                      <div key={i} style={styles.resultadoItem}>
                        <div style={styles.resultadoIcono}>🏷️</div>
                        <div style={styles.resultadoInfo}>
                          <div style={styles.resultadoTitulo}>
                            <strong>{a.codigo}</strong> — {a.descripcion}
                          </div>
                          <div style={styles.resultadoMeta}>
                            ${a.precio} · {a.ubicacion} · {a.tienda} · {banderaCirculo(a.pais)}
                          </div>
                        </div>
                        <span style={styles.resultadoBadge}>{a.tipo_campana}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dinámicas */}
                {resultados.resultados.dinamicas.length > 0 && (
                  <div>
                    <p style={styles.seccionLabel}>📦 Dinámicas</p>
                    {resultados.resultados.dinamicas.map((d, i) => (
                      <div key={i} style={styles.resultadoItem}>
                        <div style={styles.resultadoIcono}>📦</div>
                        <div style={styles.resultadoInfo}>
                          <div style={styles.resultadoTitulo}>{d.nombre}</div>
                          <div style={styles.resultadoMeta}>
                            {new Date(d.fecha_fin).toLocaleDateString('es-CR')}
                          </div>
                        </div>
                        <span style={{
                          ...styles.resultadoBadge,
                          background: d.dias_restantes < 7 ? '#FFF0F0' : '#F0FDF4',
                          color: d.dias_restantes < 7 ? '#B91C1C' : '#06847A'
                        }}>
                          {d.dias_restantes < 0 ? 'Vencida' : `${d.dias_restantes} días`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Usuarios */}
                {resultados.resultados.usuarios?.length > 0 && (
                  <div>
                    <p style={styles.seccionLabel}>👥 Usuarios</p>
                    {resultados.resultados.usuarios.map((u, i) => (
                      <div key={i} style={styles.resultadoItem}>
                        <div style={styles.resultadoIcono}>👤</div>
                        <div style={styles.resultadoInfo}>
                          <div style={styles.resultadoTitulo}>{u.nombre}</div>
                          <div style={styles.resultadoMeta}>
                            {u.rol} · {banderaCirculo(u.pais)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── RELOJ ─────────────────────────────────────── */}
      <div style={styles.divisor} />
      <div style={styles.relojBox}>
        <p style={styles.hora}>{formatHora(hora)}</p>
        <p style={styles.fecha}>{formatFecha(hora)}</p>
      </div>

      {/* ── NOTIFICACIONES ────────────────────────────── */}
      <div style={styles.divisor} />
      <div ref={notifRef} style={styles.notifWrapper}>
        <button style={styles.notifBtn} onClick={() => {
          setNotificacionesAbiertas(!notificacionesAbiertas);
          setPerfilAbierto(false);
        }}>
          <span style={styles.notifIcono}>🔔</span>
          {totalAlertas > 0 && (
            <span style={styles.notifCount}>{totalAlertas}</span>
          )}
        </button>

        {notificacionesAbiertas && (
          <div style={styles.dropdown}>
            <div style={{ ...styles.dropdownHeader, background: gradiente }}>
              <p style={styles.dropdownTitulo}>🔔 Notificaciones</p>
              <span style={styles.dropdownSub}>
                {totalAlertas} alerta{totalAlertas !== 1 ? 's' : ''} activa{totalAlertas !== 1 ? 's' : ''}
              </span>
            </div>
            {totalAlertas === 0 ? (
              <div style={styles.dropdownVacio}>
                <span style={{ fontSize: '32px' }}>✅</span>
                <p>Todo en orden</p>
              </div>
            ) : (
              <div style={styles.dropdownItem} onClick={() => {
                onVerAlertas();
                setNotificacionesAbiertas(false);
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <p style={styles.dropdownItemTitulo}>Ver todas las alertas</p>
                  <p style={styles.dropdownItemSub}>{totalAlertas} alertas pendientes</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PAÍS ──────────────────────────────────────── */}
      <div style={styles.divisor} />
      <div style={styles.paisWrapper}>
        <div style={styles.banderaCirculo}>
          <span style={{ fontSize: '20px' }}>{bandera.emoji}</span>
        </div>
        <div>
          <p style={styles.paisNombre}>{bandera.nombre}</p>
          <p style={styles.paisLabel}>País activo</p>
        </div>
      </div>

      {/* ── PERFIL ────────────────────────────────────── */}
      <div style={styles.divisor} />
      <div ref={perfilRef} style={styles.perfilWrapper}>
        <button style={styles.perfilBtn} onClick={() => {
          setPerfilAbierto(!perfilAbierto);
          setNotificacionesAbiertas(false);
        }}>
          <div style={styles.perfilAvatar}>
            {usuario.nombre.charAt(0).toUpperCase()}
          </div>
          <div style={styles.perfilInfo}>
            <p style={styles.perfilNombre}>{usuario.nombre}</p>
            <p style={styles.perfilRol}>{labelRol}</p>
          </div>
          <span style={styles.perfilArrow}>{perfilAbierto ? '▲' : '▼'}</span>
        </button>

        {perfilAbierto && (
          <div style={styles.perfilDropdown}>
            <div style={{ ...styles.perfilDropdownHeader, background: gradiente }}>
              <div style={styles.perfilAvatarGrande}>
                {usuario.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={styles.perfilDropdownNombre}>{usuario.nombre}</p>
                <p style={styles.perfilDropdownRol}>{labelRol}</p>
                <div style={styles.perfilDropdownPais}>
                  <span style={{ fontSize: '14px' }}>{bandera.emoji}</span>
                  <span>{bandera.nombre}</span>
                </div>
              </div>
            </div>

            <div style={styles.perfilDropdownBody}>
              {[
                { icon: '📧', label: 'Email', valor: usuario.email },
                { icon: '👤', label: 'Rol', valor: labelRol },
                { icon: bandera.emoji, label: 'País', valor: bandera.nombre },
              ].map((item, i) => (
                <div key={i} style={styles.perfilInfoRow}>
                  <span style={styles.perfilInfoIcon}>{item.icon}</span>
                  <div>
                    <p style={styles.perfilInfoLabel}>{item.label}</p>
                    <p style={styles.perfilInfoValor}>{item.valor}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.perfilDivider} />
            <button style={styles.btnLogout} onClick={onLogout}>
              🚪 Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  topbar: {
    display: 'flex', alignItems: 'center', gap: '16px',
    padding: '0 24px', height: '64px', flexShrink: 0,
    position: 'relative', zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  brilloSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.4)' },

  // Logo
  logoWrapper: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  logoImg: { height: '36px', objectFit: 'contain' },
  logoDivisor: { width: '1px', height: '28px', background: 'rgba(255,255,255,0.3)' },
  logoSistema: { color: '#ffffff', fontSize: '14px', fontWeight: '900', margin: 0, lineHeight: 1 },
  logoSub: { color: 'rgba(255,255,255,0.65)', fontSize: '10px', margin: '2px 0 0 0' },

  // Divisor
  divisor: { width: '1px', height: '32px', background: 'rgba(255,255,255,0.25)', flexShrink: 0 },

  // Buscador
  buscadorWrapper: { position: 'relative', display: 'flex', alignItems: 'center', flex: 2, maxWidth: '600px' },
  buscadorIcon: { position: 'absolute', left: '12px', fontSize: '13px', zIndex: 1 },
  buscador: {
    width: '100%', padding: '9px 32px 9px 36px',
    borderRadius: '20px', border: 'none',
    fontSize: '13px', outline: 'none',
    fontFamily: 'Calibri, sans-serif',
    background: 'rgba(255,255,255,0.92)',
    color: '#1E2761', boxSizing: 'border-box', fontWeight: '500',
  },
  buscadorClear: { position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#8892A4', fontSize: '12px', zIndex: 1 },
  resultadosDropdown: { position: 'absolute', top: '46px', left: 0, width: '420px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0', overflow: 'hidden', zIndex: 1000, maxHeight: '480px', overflowY: 'auto' },
  resultadosHeader: { padding: '10px 16px', borderBottom: '1px solid #F4F7FB', background: '#F8FAFC' },
  resultadosTotal: { fontSize: '12px', color: '#8892A4', fontWeight: '600' },
  sinResultados: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px', color: '#8892A4', fontSize: '13px', gap: '8px' },
  seccionLabel: { fontSize: '11px', fontWeight: '800', color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 16px 4px' },
  resultadoItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #F8FAFC' },
  resultadoIcono: { width: '30px', height: '30px', borderRadius: '8px', background: '#F4F7FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 },
  resultadoInfo: { flex: 1, overflow: 'hidden' },
  resultadoTitulo: { fontSize: '13px', color: '#1E2761', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' },
  resultadoMeta: { fontSize: '11px', color: '#8892A4', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' },
  resultadoBadge: { fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#EEF2FF', color: '#1E2761', flexShrink: 0 },

  // Reloj
  relojBox: { textAlign: 'center', flexShrink: 0 },
  hora: { color: '#ffffff', fontSize: '18px', fontWeight: '900', fontFamily: 'monospace', margin: 0, lineHeight: 1 },
  fecha: { color: 'rgba(255,255,255,0.75)', fontSize: '10px', margin: '2px 0 0 0', textTransform: 'capitalize' },

  // Notificaciones
  notifWrapper: { position: 'relative', flexShrink: 0 },
  notifBtn: { width: '38px', height: '38px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' },
  notifIcono: { fontSize: '16px' },
  notifCount: { position: 'absolute', top: '-5px', right: '-5px', background: '#F96167', color: '#ffffff', fontSize: '10px', fontWeight: '800', width: '17px', height: '17px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' },
  dropdown: { position: 'absolute', top: '50px', right: 0, width: '300px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0', overflow: 'hidden', zIndex: 1000 },
  dropdownHeader: { padding: '14px 18px' },
  dropdownTitulo: { fontSize: '14px', fontWeight: '700', color: '#ffffff', margin: 0 },
  dropdownSub: { fontSize: '12px', color: 'rgba(255,255,255,0.75)' },
  dropdownVacio: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', color: '#8892A4', fontSize: '13px', gap: '8px' },
  dropdownItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer', background: '#F8FAFC' },
  dropdownItemTitulo: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: 0 },
  dropdownItemSub: { fontSize: '12px', color: '#8892A4', margin: '2px 0 0 0' },

  // País
  paisWrapper: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  banderaCirculo: { width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 },
  paisNombre: { color: '#ffffff', fontSize: '12px', fontWeight: '700', margin: 0, lineHeight: 1 },
  paisLabel: { color: 'rgba(255,255,255,0.65)', fontSize: '10px', margin: '2px 0 0 0' },

  // Perfil
  perfilWrapper: { position: 'relative', flexShrink: 0 },
  perfilBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px 5px 5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Calibri, sans-serif' },
  perfilAvatar: { width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.25)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 },
  perfilInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  perfilNombre: { fontSize: '12px', fontWeight: '700', color: '#ffffff', margin: 0, lineHeight: 1 },
  perfilRol: { fontSize: '10px', color: 'rgba(255,255,255,0.7)', margin: '2px 0 0 0' },
  perfilArrow: { fontSize: '10px', color: 'rgba(255,255,255,0.7)' },
  perfilDropdown: { position: 'absolute', top: '50px', right: 0, width: '280px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0', overflow: 'hidden', zIndex: 1000 },
  perfilDropdownHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '18px' },
  perfilAvatarGrande: { width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(255,255,255,0.25)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', flexShrink: 0 },
  perfilDropdownNombre: { fontSize: '14px', fontWeight: '800', color: '#ffffff', margin: 0 },
  perfilDropdownRol: { fontSize: '12px', color: 'rgba(255,255,255,0.8)', margin: '2px 0' },
  perfilDropdownPais: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' },
  perfilDropdownBody: { padding: '12px 18px' },
  perfilInfoRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F8FAFC' },
  perfilInfoIcon: { fontSize: '14px', width: '22px', textAlign: 'center' },
  perfilInfoLabel: { fontSize: '11px', color: '#8892A4', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
  perfilInfoValor: { fontSize: '13px', color: '#1E2761', margin: '2px 0 0 0', fontWeight: '600' },
  perfilDivider: { height: '1px', background: '#F4F7FB' },
  btnLogout: { width: '100%', padding: '12px 18px', background: '#FFF0F0', border: 'none', color: '#B91C1C', fontSize: '14px', fontWeight: '700', cursor: 'pointer', textAlign: 'left', fontFamily: 'Calibri, sans-serif' },
};

export default TopBar;