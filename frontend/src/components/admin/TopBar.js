import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Bell, Tag, Package, User, AlertTriangle, CheckCircle2, ChevronUp, ChevronDown, Mail, LogOut, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import logo from '../../assets/Vidri Novex.png';
import { theme } from '../../styles/theme';

const BANDERAS = {
  CR: { emoji: '🇨🇷', nombre: 'Costa Rica',      gradient: `linear-gradient(135deg, ${theme.color.countryCrStart} 0%, ${theme.color.countryCrEnd} 100%)`, color: theme.color.countryCrStart },
  GT: { emoji: '🇬🇹', nombre: 'Guatemala',       gradient: `linear-gradient(135deg, ${theme.color.countryGtStart} 0%, ${theme.color.countryGtEnd} 100%)`, color: theme.color.countryGtStart },
  SV: { emoji: '🇸🇻', nombre: 'El Salvador',     gradient: `linear-gradient(135deg, ${theme.color.countrySvStart} 0%, ${theme.color.countrySvEnd} 100%)`, color: theme.color.countrySvStart },
  '': { emoji: '🌎', nombre: 'Todos los países', gradient: theme.color.gradient, color: theme.color.primary },
};

// Las banderas de país quedan como emoji intencionalmente — no hay
// un ícono SVG universal para "Costa Rica", el emoji de bandera
// es la representación más clara y reconocible acá.
const EMOJIS_PAIS = { CR: '🇨🇷', GT: '🇬🇹', SV: '🇸🇻', '': '🌎' };

const banderaCirculo = (pais) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '20px', height: '20px', borderRadius: '50%',
    background: 'rgba(0,0,0,0.06)', fontSize: '12px', flexShrink: 0,
  }} aria-hidden="true">
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
        <div className="pd-hide-mobile" style={styles.logoDivisor} />
        <div className="pd-hide-mobile">
          <p style={styles.logoSistema}>PromoIQ</p>
          <p style={styles.logoSub}>VIDRI / NOVEX</p>
        </div>
      </div>

      <div className="pd-hide-mobile" style={styles.divisor} />

      {/* ── BUSCADOR ──────────────────────────────────── */}
      <div ref={buscadorRef} style={styles.buscadorWrapper}>
        <span style={styles.buscadorIcon} aria-hidden="true">
          {buscando ? <Loader2 size={16} className="pd-icon-spin" /> : <Search size={16} />}
        </span>
        <label htmlFor="buscador-topbar" style={styles.srOnly}>Buscar artículo, dinámica o usuario</label>
        <input
          id="buscador-topbar"
          className="pd-hoverable"
          style={styles.buscador}
          type="text"
          placeholder="Buscar artículo, dinámica o usuario..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onFocus={() => resultados && setMostrarResultados(true)}
          role="combobox"
          aria-expanded={mostrarResultados}
          aria-controls="resultados-busqueda-topbar"
          autoComplete="off"
        />
        {busqueda && (
          <button
            className="pd-pressable"
            style={styles.buscadorClear}
            onClick={() => {
              setBusqueda('');
              setResultados(null);
              setMostrarResultados(false);
            }}
            aria-label="Limpiar búsqueda"
          ><X size={14} /></button>
        )}

        {/* Dropdown resultados */}
        {mostrarResultados && resultados && (
          <div id="resultados-busqueda-topbar" className="pd-dropdown" style={{ ...styles.resultadosDropdown, transformOrigin: 'top left' }} role="listbox">
            {resultados.total === 0 ? (
              <div style={styles.sinResultados}>
                <Search size={24} color={theme.color.textMuted} aria-hidden="true" />
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
                    <p style={styles.seccionLabel}><Tag size={12} style={styles.seccionIcon} aria-hidden="true" />Artículos</p>
                    {resultados.resultados.articulos.map((a, i) => (
                      <div key={i} style={styles.resultadoItem}>
                        <div style={styles.resultadoIcono} aria-hidden="true"><Tag size={16} color={theme.color.primary} /></div>
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
                    <p style={styles.seccionLabel}><Package size={12} style={styles.seccionIcon} aria-hidden="true" />Dinámicas</p>
                    {resultados.resultados.dinamicas.map((d, i) => (
                      <div key={i} style={styles.resultadoItem}>
                        <div style={styles.resultadoIcono} aria-hidden="true"><Package size={16} color={theme.color.primary} /></div>
                        <div style={styles.resultadoInfo}>
                          <div style={styles.resultadoTitulo}>{d.nombre}</div>
                          <div style={styles.resultadoMeta}>
                            {new Date(d.fecha_fin).toLocaleDateString('es-CR')}
                          </div>
                        </div>
                        <span style={{
                          ...styles.resultadoBadge,
                          background: d.dias_restantes < 7 ? theme.color.errorBg : theme.color.successBg,
                          color: d.dias_restantes < 7 ? theme.color.error : theme.color.successStrong,
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
                    <p style={styles.seccionLabel}><User size={12} style={styles.seccionIcon} aria-hidden="true" />Usuarios</p>
                    {resultados.resultados.usuarios.map((u, i) => (
                      <div key={i} style={styles.resultadoItem}>
                        <div style={styles.resultadoIcono} aria-hidden="true"><User size={16} color={theme.color.primary} /></div>
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

      {/* ── RELOJ (oculto en pantallas chicas) ─────────── */}
      <div className="pd-hide-mobile" style={styles.divisor} />
      <div className="pd-hide-mobile" style={styles.relojBox}>
        <p style={styles.hora}>{formatHora(hora)}</p>
        <p style={styles.fecha}>{formatFecha(hora)}</p>
      </div>

      {/* ── NOTIFICACIONES ────────────────────────────── */}
      <div style={styles.divisor} />
      <div ref={notifRef} style={styles.notifWrapper}>
        <button
          className="pd-pressable"
          style={styles.notifBtn}
          onClick={() => {
            setNotificacionesAbiertas(!notificacionesAbiertas);
            setPerfilAbierto(false);
          }}
          aria-haspopup="true"
          aria-expanded={notificacionesAbiertas}
          aria-label={`Notificaciones${totalAlertas > 0 ? `, ${totalAlertas} alertas activas` : ''}`}
        >
          <Bell size={18} aria-hidden="true" />
          {totalAlertas > 0 && (
            <span style={styles.notifCount} aria-hidden="true">{totalAlertas}</span>
          )}
        </button>

        {notificacionesAbiertas && (
          <div className="pd-dropdown" style={styles.dropdown} role="menu">
            <div style={{ ...styles.dropdownHeader, background: gradiente }}>
              <p style={styles.dropdownTitulo}><Bell size={16} style={styles.dropdownTituloIcono} aria-hidden="true" />Notificaciones</p>
              <span style={styles.dropdownSub}>
                {totalAlertas} alerta{totalAlertas !== 1 ? 's' : ''} activa{totalAlertas !== 1 ? 's' : ''}
              </span>
            </div>
            {totalAlertas === 0 ? (
              <div style={styles.dropdownVacio}>
                <CheckCircle2 size={32} color={theme.color.successStrong} aria-hidden="true" />
                <p>Todo en orden</p>
              </div>
            ) : (
              <div
                className="pd-pressable pd-hoverable"
                style={styles.dropdownItem}
                onClick={() => {
                  onVerAlertas();
                  setNotificacionesAbiertas(false);
                }}
                role="menuitem"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') { onVerAlertas(); setNotificacionesAbiertas(false); } }}
              >
                <AlertTriangle size={20} color={theme.color.warning} aria-hidden="true" />
                <div>
                  <p style={styles.dropdownItemTitulo}>Ver todas las alertas</p>
                  <p style={styles.dropdownItemSub}>{totalAlertas} alertas pendientes</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── PAÍS (texto oculto en pantallas chicas) ────── */}
      <div className="pd-hide-mobile" style={styles.divisor} />
      <div className="pd-hide-mobile" style={styles.paisWrapper}>
        <div style={styles.banderaCirculo}>
          <span style={{ fontSize: '20px' }} aria-hidden="true">{bandera.emoji}</span>
        </div>
        <div>
          <p style={styles.paisNombre}>{bandera.nombre}</p>
          <p style={styles.paisLabel}>País activo</p>
        </div>
      </div>

      {/* ── PERFIL ────────────────────────────────────── */}
      <div style={styles.divisor} />
      <div ref={perfilRef} style={styles.perfilWrapper}>
        <button
          className="pd-pressable"
          style={styles.perfilBtn}
          onClick={() => {
            setPerfilAbierto(!perfilAbierto);
            setNotificacionesAbiertas(false);
          }}
          aria-haspopup="true"
          aria-expanded={perfilAbierto}
          aria-label="Menú de perfil"
        >
          <div style={styles.perfilAvatar} aria-hidden="true">
            {usuario.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="pd-hide-mobile" style={styles.perfilInfo}>
            <p style={styles.perfilNombre}>{usuario.nombre}</p>
            <p style={styles.perfilRol}>{labelRol}</p>
          </div>
          <span className="pd-hide-mobile" style={styles.perfilArrow} aria-hidden="true">
            {perfilAbierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {perfilAbierto && (
          <div className="pd-dropdown" style={styles.perfilDropdown} role="menu">
            <div style={{ ...styles.perfilDropdownHeader, background: gradiente }}>
              <div style={styles.perfilAvatarGrande} aria-hidden="true">
                {usuario.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={styles.perfilDropdownNombre}>{usuario.nombre}</p>
                <p style={styles.perfilDropdownRol}>{labelRol}</p>
                <div style={styles.perfilDropdownPais}>
                  <span style={{ fontSize: '14px' }} aria-hidden="true">{bandera.emoji}</span>
                  <span>{bandera.nombre}</span>
                </div>
              </div>
            </div>

            <div style={styles.perfilDropdownBody}>
              {[
                { Icono: Mail, label: 'Email', valor: usuario.email },
                { Icono: User, label: 'Rol', valor: labelRol },
              ].map((item, i) => (
                <div key={i} style={styles.perfilInfoRow}>
                  <item.Icono size={16} color={theme.color.textMuted} style={styles.perfilInfoIcon} aria-hidden="true" />
                  <div>
                    <p style={styles.perfilInfoLabel}>{item.label}</p>
                    <p style={styles.perfilInfoValor}>{item.valor}</p>
                  </div>
                </div>
              ))}
              <div style={styles.perfilInfoRow}>
                <span style={{ ...styles.perfilInfoIcon, fontSize: '16px', display: 'inline-flex', width: '22px', justifyContent: 'center' }} aria-hidden="true">{bandera.emoji}</span>
                <div>
                  <p style={styles.perfilInfoLabel}>País</p>
                  <p style={styles.perfilInfoValor}>{bandera.nombre}</p>
                </div>
              </div>
            </div>

            <div style={styles.perfilDivider} />
            <button className="pd-pressable" style={styles.btnLogout} onClick={onLogout} role="menuitem">
              <LogOut size={16} style={styles.btnLogoutIcono} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  topbar: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '0 16px', height: '64px', flexShrink: 0,
    position: 'relative', zIndex: 100,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  brilloSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.4)' },

  logoWrapper: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  logoImg: { height: '36px', objectFit: 'contain' },
  logoDivisor: { width: '1px', height: '28px', background: 'rgba(255,255,255,0.3)' },
  logoSistema: { color: theme.color.textOnPrimary, fontSize: theme.font.size.md, fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1, whiteSpace: 'nowrap' },
  logoSub: { color: 'rgba(255,255,255,0.65)', fontSize: theme.font.size.xs, margin: '2px 0 0 0', whiteSpace: 'nowrap' },

  divisor: { width: '1px', height: '32px', background: 'rgba(255,255,255,0.25)', flexShrink: 0 },

  buscadorWrapper: { position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 100px', minWidth: 0, maxWidth: '600px' },
  buscadorIcon: { position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: theme.color.textMuted, zIndex: 1 },
  buscador: {
    width: '100%', padding: '9px 32px 9px 36px',
    borderRadius: theme.radius.pill, border: 'none',
    fontSize: theme.font.size.base, outline: 'none',
    fontFamily: theme.font.family,
    background: 'rgba(255,255,255,0.92)',
    color: theme.color.primary, boxSizing: 'border-box', fontWeight: theme.font.weight.medium,
  },
  buscadorClear: { position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: theme.color.textMuted, display: 'flex', zIndex: 1 },
  resultadosDropdown: { position: 'absolute', top: '46px', left: 0, width: 'min(420px, calc(100vw - 32px))', background: theme.color.surface, borderRadius: theme.radius.xxl, boxShadow: theme.shadow.floating, border: `1px solid ${theme.color.border}`, overflow: 'hidden', zIndex: 1000, maxHeight: '480px', overflowY: 'auto' },
  resultadosHeader: { padding: '10px 16px', borderBottom: `1px solid ${theme.color.background}`, background: theme.color.surfaceMuted },
  resultadosTotal: { fontSize: theme.font.size.sm, color: theme.color.textMuted, fontWeight: theme.font.weight.semibold },
  sinResultados: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px', color: theme.color.textMuted, fontSize: theme.font.size.base },
  seccionLabel: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.black, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '10px 16px 4px' },
  seccionIcon: { flexShrink: 0 },
  resultadoItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: `1px solid ${theme.color.surfaceMuted}` },
  resultadoIcono: { width: '30px', height: '30px', borderRadius: theme.radius.sm, background: theme.color.background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultadoInfo: { flex: 1, overflow: 'hidden' },
  resultadoTitulo: { fontSize: theme.font.size.base, color: theme.color.primary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: theme.font.weight.semibold },
  resultadoMeta: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '4px' },
  resultadoBadge: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold, padding: '2px 8px', borderRadius: theme.radius.pill, background: theme.color.accentSoft, color: theme.color.primary, flexShrink: 0 },

  relojBox: { textAlign: 'center', flexShrink: 0 },
  hora: { color: theme.color.textOnPrimary, fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, fontFamily: 'monospace', margin: 0, lineHeight: 1 },
  fecha: { color: 'rgba(255,255,255,0.75)', fontSize: theme.font.size.xs, margin: '2px 0 0 0', textTransform: 'capitalize' },

  notifWrapper: { position: 'relative', flexShrink: 0 },
  notifBtn: { width: '38px', height: '38px', borderRadius: theme.radius.md, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: theme.color.textOnPrimary },
  notifCount: { position: 'absolute', top: '-5px', right: '-5px', background: theme.color.chart3, color: theme.color.textOnPrimary, fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, width: '17px', height: '17px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' },
  dropdown: { position: 'absolute', top: '50px', right: 0, width: 'min(300px, calc(100vw - 32px))', background: theme.color.surface, borderRadius: theme.radius.xxl, boxShadow: theme.shadow.floating, border: `1px solid ${theme.color.border}`, overflow: 'hidden', zIndex: 1000 },
  dropdownHeader: { padding: '14px 18px' },
  dropdownTitulo: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.color.textOnPrimary, margin: 0 },
  dropdownTituloIcono: { flexShrink: 0 },
  dropdownSub: { fontSize: theme.font.size.sm, color: 'rgba(255,255,255,0.75)' },
  dropdownVacio: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '24px', color: theme.color.textMuted, fontSize: theme.font.size.base },
  dropdownItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer', background: theme.color.surfaceMuted },
  dropdownItemTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0 },
  dropdownItemSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },

  paisWrapper: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  banderaCirculo: { width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 },
  paisNombre: { color: theme.color.textOnPrimary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, margin: 0, lineHeight: 1, whiteSpace: 'nowrap' },
  paisLabel: { color: 'rgba(255,255,255,0.65)', fontSize: theme.font.size.xs, margin: '2px 0 0 0' },

  perfilWrapper: { position: 'relative', flexShrink: 0 },
  perfilBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px 5px 5px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: theme.radius.md, cursor: 'pointer', fontFamily: theme.font.family },
  perfilAvatar: { width: '32px', height: '32px', borderRadius: theme.radius.sm, background: 'rgba(255,255,255,0.25)', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  perfilInfo: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  perfilNombre: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textOnPrimary, margin: 0, lineHeight: 1, whiteSpace: 'nowrap' },
  perfilRol: { fontSize: theme.font.size.xs, color: 'rgba(255,255,255,0.7)', margin: '2px 0 0 0' },
  perfilArrow: { display: 'flex', color: 'rgba(255,255,255,0.7)' },
  perfilDropdown: { position: 'absolute', top: '50px', right: 0, width: 'min(280px, calc(100vw - 32px))', background: theme.color.surface, borderRadius: theme.radius.xxl, boxShadow: theme.shadow.floating, border: `1px solid ${theme.color.border}`, overflow: 'hidden', zIndex: 1000 },
  perfilDropdownHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '18px' },
  perfilAvatarGrande: { width: '44px', height: '44px', borderRadius: theme.radius.md, background: 'rgba(255,255,255,0.25)', color: theme.color.textOnPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  perfilDropdownNombre: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.black, color: theme.color.textOnPrimary, margin: 0 },
  perfilDropdownRol: { fontSize: theme.font.size.sm, color: 'rgba(255,255,255,0.8)', margin: '2px 0' },
  perfilDropdownPais: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: theme.font.size.sm, color: 'rgba(255,255,255,0.8)' },
  perfilDropdownBody: { padding: '12px 18px' },
  perfilInfoRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${theme.color.surfaceMuted}` },
  perfilInfoIcon: { flexShrink: 0 },
  perfilInfoLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, fontWeight: theme.font.weight.semibold, textTransform: 'uppercase', letterSpacing: '0.5px' },
  perfilInfoValor: { fontSize: theme.font.size.base, color: theme.color.primary, margin: '2px 0 0 0', fontWeight: theme.font.weight.semibold },
  perfilDivider: { height: '1px', background: theme.color.background },
  btnLogout: { display: 'flex', alignItems: 'center', width: '100%', padding: '12px 18px', background: theme.color.errorBg, border: 'none', color: theme.color.error, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', textAlign: 'left', fontFamily: theme.font.family },
  btnLogoutIcono: { marginRight: '8px', flexShrink: 0 },
};

export default TopBar;