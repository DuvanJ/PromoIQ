// ============================================================
// Componente: AdminDashboard.js
// Descripción: Dashboard adaptado por rol y país
// Colores: dinámicos, según catálogo /paises
// Moneda: dinámica según catálogo /paises — cada país muestra sus
// montos en su propia moneda (colón, quetzal, dólar), sin conversión.
// Responsive: sidebar tipo drawer en pantallas < 1024px
// Sidebar: colapsable a solo íconos en desktop (≥1024px)
// Íconos: lucide-react en vez de emoji
// Rol tiendas: la tienda NO es fija en la cuenta — se elige al
// entrar y se guarda en localStorage, cambiable sin recargar sesión.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, Tag, Upload, Bell, Download, Bot, Clock,
  Menu, RefreshCw, Search, MessageCircle, Users, XCircle, AlertTriangle,
  Info, CheckCircle2, Inbox, X, ChevronsLeft, ChevronsRight,
    Award, TrendingUp, TrendingDown, ShoppingCart, Building2, Calendar, PauseCircle, MapPin, Sparkles, GitCompare, Lightbulb, Layers, Rocket, Map, History, AlertOctagon, PackageX, RotateCcw, ArrowLeftRight, LineChart, PackageCheck,
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
import { formatoMoneda, formatoMonedaDecimales } from '../utils/moneda';
import ComparadorCampanas from './admin/ComparadorCampanas';
import OportunidadesSinExplotar from './admin/OportunidadesSinExplotar';
import RentabilidadUbicacion from './admin/RentabilidadUbicacion';
import DescuentosSinImpacto from './admin/DescuentosSinImpacto';
import CandidatosProximaCampana from './admin/CandidatosProximaCampana';
import DinamicasComercial from './admin/DinamicasComercial';
import VisorLayoutTienda from './admin/VisorLayoutTienda';
import HistorialSku from './admin/HistorialSku';
import RiesgoQuiebreCampana from './admin/RiesgoQuiebreCampana';
import SobreStockDepartamento from './admin/SobreStockDepartamento';
import Devoluciones from './admin/Devoluciones';
import CoberturaInventario from './admin/CoberturaInventario';
import ForecastDemanda from './admin/ForecastDemanda';
import ImpactoCampanaCobertura from './admin/ImpactoCampanaCobertura';
import InstruccionesModulo from './InstruccionesModulo';

const MESES_LABEL = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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
    { id: 'resumen',   Icono: Sparkles, label: 'Resumen Campañas' },
    { id: 'dinamicas-comercial', Icono: Package, label: 'Dinámicas — Historial' },
    { id: 'dinamicas', Icono: Package, label: 'Dinámicas — Resumen' },
    { id: 'articulos', Icono: Tag, label: 'Artículos' },
    { id: 'carga',     Icono: Upload, label: 'Carga de Información' },
    { id: 'alertas',   Icono: Bell, label: 'Alertas' },
    { id: 'exportar',  Icono: Download, label: 'Exportar' },
    { id: 'chat',      Icono: Bot, label: 'Chat con IA' },
    { id: 'historial', Icono: Clock, label: 'Historial IA' },
  ],
  comercial: [
    // Visión general
    { id: 'dashboard', Icono: LayoutDashboard, label: 'Mi Dashboard' },
    { id: 'chat',      Icono: Bot, label: 'Mi Asistente IA' },
    // Gestión y análisis de campañas
    { id: 'resumen',   Icono: Sparkles, label: 'Resumen Campañas' },
    { id: 'dinamicas-comercial', Icono: Package, label: 'Dinámicas' },
    { id: 'comparador', Icono: GitCompare, label: 'Comparador Campañas' },
    { id: 'descuentos', Icono: TrendingDown, label: 'Descuentos Sin Impacto' },
    { id: 'rentabilidad', Icono: Layers, label: 'Rentabilidad Ubicación' },
    { id: 'layout-visor', Icono: Map, label: 'Layout de Tienda' },
    // Oportunidades a futuro
    { id: 'oportunidades', Icono: Lightbulb, label: 'Oportunidades' },
    { id: 'candidatos', Icono: Rocket, label: 'Candidatos Campaña' },
    // Datos operativos
    { id: 'articulos', Icono: Tag, label: 'Artículos en Campaña' },
    { id: 'alertas',   Icono: Bell, label: 'Alertas' },
  ],
  planning: [
    { id: 'dashboard', Icono: LayoutDashboard, label: 'Mi Dashboard' },
    { id: 'chat',      Icono: Bot, label: 'Mi Asistente IA' },
    { id: 'resumen',   Icono: Sparkles, label: 'Resumen Campañas' },
    { id: 'dinamicas-comercial', Icono: Package, label: 'Dinámicas' },
    { id: 'historial-sku', Icono: History, label: 'Historial de SKU' },
    { id: 'riesgo-quiebre', Icono: AlertOctagon, label: 'Riesgo de Quiebre' },
    { id: 'sobre-stock', Icono: PackageX, label: 'Sobre-stock' },
    { id: 'devoluciones', Icono: RotateCcw, label: 'Devoluciones' },
    { id: 'cobertura', Icono: ArrowLeftRight, label: 'Cobertura Inventario' },
    { id: 'forecast', Icono: LineChart, label: 'Forecast Demanda' },
    { id: 'impacto-campana', Icono: PackageCheck, label: 'Impacto de Campaña' },
    { id: 'alertas',   Icono: Bell, label: 'Alertas' },
  ],
  tiendas: [
    { id: 'dashboard', Icono: LayoutDashboard, label: 'Mi Dashboard' },
    { id: 'resumen',   Icono: Sparkles, label: 'Resumen Campañas' },
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
  const [ventasComercial, setVentasComercial] = useState(null);
  const [cargandoVentas, setCargandoVentas] = useState(false);

  // ── Filtro de mes para el dashboard de Comercial ─────
  const [mesesDisponiblesVentas, setMesesDisponiblesVentas] = useState([]);
  const [filtroMesVentas, setFiltroMesVentas] = useState(''); // '' = automático (mes anterior o último con datos)

  // ── Rol Planning: panorama general del dashboard ─────
  const [dashboardPlanning, setDashboardPlanning] = useState(null);
  const [cargandoPlanning, setCargandoPlanning] = useState(false);

  // ── Rol Tiendas: la tienda se elige en cada sesión, no es fija ──
  const [dashboardTienda, setDashboardTienda] = useState(null);
  const [cargandoDashboardTienda, setCargandoDashboardTienda] = useState(false);
  const [tiendasDisponibles, setTiendasDisponibles] = useState([]);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(
    () => localStorage.getItem('promoiq_tienda_seleccionada') || ''
  );
  const [mostrarSelectorTienda, setMostrarSelectorTienda] = useState(false);

  // ── Resumen de campañas (afiche) ─────────────────────
  const [campanasResumen, setCampanasResumen] = useState([]);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  const rol = usuario.rol;
  const pais = usuario.pais;

  const paisInfo = paises.find(p => p.codigo === pais);

  // Formateadores de moneda — usan el símbolo del país del usuario
  // (colón, quetzal, dólar). Cada país ya carga sus datos en su
  // propia moneda; esto solo decide cómo mostrarlo, sin convertir.
  const formatearMonto = (valor) => formatoMoneda(valor, paisInfo);
  const formatearMontoDecimales = (valor) => formatoMonedaDecimales(valor, paisInfo);

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
    cargarAlertas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catálogo dinámico de países — trae colores/nombre/bandera/moneda
  // reales, así el tema visual y el formato de montos se actualizan
  // solos si el superadmin edita un país desde Usuarios > Países.
  useEffect(() => {
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando países:', err));
  }, []);

  // Rol Tiendas: carga el catálogo de tiendas del país y decide si
  // hace falta preguntar cuál va a consultar en esta sesión.
  useEffect(() => {
    if (rol !== 'tiendas') return;
    api.get(`/tiendas?pais=${pais}`)
      .then(res => {
        setTiendasDisponibles(res.data);
        const guardada = localStorage.getItem('promoiq_tienda_seleccionada');
        const existe = res.data.some(t => t.codigo === guardada);
        if (!guardada || !existe) {
          setMostrarSelectorTienda(true);
        }
      })
      .catch(err => console.error('Error cargando tiendas:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, pais]);

  // Rol Comercial: carga qué meses tienen ventas cargadas, para el filtro
  useEffect(() => {
    if (rol !== 'comercial') return;
    api.get('/pais/ventas-comercial/meses-disponibles')
      .then(res => setMesesDisponiblesVentas(res.data))
      .catch(err => console.error('Error cargando meses disponibles:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol]);

  const elegirTienda = (codigo) => {
    localStorage.setItem('promoiq_tienda_seleccionada', codigo);
    setTiendaSeleccionada(codigo);
    setMostrarSelectorTienda(false);
  };

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
    if (menuActivo === 'dashboard' && tieneDatos !== false) {
      if (rol === 'tiendas') {
        cargarDashboardTienda();
      } else {
        cargarDashboard();
        if (rol === 'comercial') cargarVentasComercial();
        if (rol === 'planning') cargarDashboardPlanning();
      }
    }
    if (menuActivo === 'articulos') cargarArticulos();
    if (menuActivo === 'alertas') cargarAlertas();
    if (menuActivo === 'resumen') cargarCampanasResumen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuActivo, tieneDatos, tiendaSeleccionada]);

  // Recarga las ventas cuando cambia el mes elegido en el filtro
  useEffect(() => {
    if (rol === 'comercial' && menuActivo === 'dashboard') {
      cargarVentasComercial();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroMesVentas]);

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

  const cargarDashboardTienda = async () => {
    if (!tiendaSeleccionada) return;
    setCargandoDashboardTienda(true);
    try {
      const res = await api.get(`/pais/dashboard-tienda?tienda_codigo=${tiendaSeleccionada}`);
      setDashboardTienda(res.data);
    } catch (err) {
      console.error('Error dashboard tienda:', err);
    } finally {
      setCargandoDashboardTienda(false);
    }
  };

  const cargarVentasComercial = async () => {
    setCargandoVentas(true);
    try {
      let url = '/pais/ventas-comercial';
      if (filtroMesVentas) {
        const [mesSel, anioSel] = filtroMesVentas.split('-');
        url += `?mes=${mesSel}&anio=${anioSel}`;
      }
      const res = await api.get(url);
      setVentasComercial(res.data);
    } catch (err) {
      console.error('Error ventas comercial:', err);
    } finally {
      setCargandoVentas(false);
    }
  };

  const cargarDashboardPlanning = async () => {
    setCargandoPlanning(true);
    try {
      const res = await api.get('/pais/dashboard-planning');
      setDashboardPlanning(res.data);
    } catch (err) {
      console.error('Error dashboard planning:', err);
    } finally {
      setCargandoPlanning(false);
    }
  };



    const exportarArticulosTienda = async () => {
    if (!tiendaSeleccionada) return;
    try {
      const res = await api.get(`/exportar/tienda?tienda_codigo=${tiendaSeleccionada}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const nombreTienda = tiendasDisponibles.find(t => t.codigo === tiendaSeleccionada)?.nombre || tiendaSeleccionada;
      link.setAttribute('download', `PromoIQ_${nombreTienda.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando artículos de tienda:', err);
    }
  };

  const exportarVentasComercial = async (metrica, nombreArchivo) => {
    try {
      const res = await api.get(`/pais/ventas-comercial/exportar?metrica=${metrica}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nombreArchivo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando:', err);
    }
  };

  const cargarArticulos = async () => {
    if (rol === 'tiendas' && !tiendaSeleccionada) return;
    setCargandoArticulos(true);
    try {
      const params = rol === 'tiendas' ? `?tienda_codigo=${tiendaSeleccionada}` : '';
      const res = await api.get(`/pais/articulos${params}`);
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

  const cargarCampanasResumen = async () => {
    setCargandoResumen(true);
    try {
      const res = await api.get('/pais/campanas-resumen');
      setCampanasResumen(res.data);
    } catch (err) {
      console.error('Error cargando resumen de campañas:', err);
    } finally {
      setCargandoResumen(false);
    }
  };

  const seleccionarMenu = (id) => {
    setMenuActivo(id);
    setSidebarAbierto(false); // en mobile, elegir una sección cierra el drawer
  };



    const articulosAgrupadosPorUbicacion = () => {
    const ordenados = [...articulosFiltrados].sort((a, b) => (a.ubicacion || '').localeCompare(b.ubicacion || ''));
    const grupos = [];
    let actual = null;
    ordenados.forEach(a => {
      const clave = a.ubicacion || 'Sin ubicación';
      if (!actual || actual.ubicacion !== clave) {
        actual = { ubicacion: clave, items: [] };
        grupos.push(actual);
      }
      actual.items.push(a);
    });
    return grupos;
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

        <nav className="pd-nav-scroll" style={styles.nav} aria-label="Menú principal">
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
          {rol === 'tiendas' && tiendaSeleccionada && (
            <button
              className="pd-pressable"
              style={{ ...styles.selectorTiendaBtn, borderColor: tema.primary, color: tema.primary }}
              onClick={() => setMostrarSelectorTienda(true)}
            >
              <Building2 size={14} aria-hidden="true" />
              {tiendasDisponibles.find(t => t.codigo === tiendaSeleccionada)?.nombre || tiendaSeleccionada}
              <span style={{ fontSize: '11px', opacity: 0.7 }}>Cambiar</span>
            </button>
          )}
          {rol === 'comercial' && menuActivo === 'dashboard' && mesesDisponiblesVentas.length > 0 && (
            <label htmlFor="filtro-mes-ventas" style={styles.selectorMesWrapper}>
              <Calendar size={14} color={tema.primary} aria-hidden="true" />
              <select
                id="filtro-mes-ventas"
                className="pd-hoverable"
                style={{ ...styles.selectorMesInput, color: tema.primary }}
                value={filtroMesVentas}
                onChange={(e) => setFiltroMesVentas(e.target.value)}
              >
                <option value="">Automático (último mes con datos)</option>
                {mesesDisponiblesVentas.map((m, i) => (
                  <option key={i} value={`${m.mes}-${m.anio}`}>
                    {MESES_LABEL[m.mes]} {m.anio}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="pd-pressable" style={styles.refreshBtn} onClick={() => {
            if (menuActivo === 'dashboard') {
              if (rol === 'tiendas') {
                cargarDashboardTienda();
              } else {
                cargarDashboard();
                if (rol === 'comercial') cargarVentasComercial();
                if (rol === 'planning') cargarDashboardPlanning();
              }
            }
            if (menuActivo === 'articulos') cargarArticulos();
            if (menuActivo === 'alertas') cargarAlertas();
            if (menuActivo === 'resumen') cargarCampanasResumen();
          }}>
            <RefreshCw size={14} style={styles.refreshIcono} aria-hidden="true" />
            Actualizar
          </button>
        </div>

        {/* ── CONTENIDO ───────────────────────────────── */}
        <div key={menuActivo} className="pd-view-in" style={styles.contenido}>

          {/* DASHBOARD */}
          {menuActivo === 'dashboard' && (
            tieneDatos === false ? (
              <EmptyStateCountry
                pais={pais}
                tema={tema}
                onIrACargaInformacion={() => seleccionarMenu('carga')}
              />
            ) : rol === 'tiendas' ? (
              cargandoDashboardTienda ? (
                <div style={styles.cargando}>
                  <LayoutDashboard size={48} color={theme.color.textMuted} aria-hidden="true" />
                  <p>Cargando dashboard...</p>
                </div>
              ) : !dashboardTienda ? (
                <div style={styles.cargando}>
                  <XCircle size={48} color={theme.color.error} aria-hidden="true" />
                  <p>Error cargando el dashboard</p>
                  <button className="pd-pressable" style={{ ...styles.btnReintentar, background: tema.primary }} onClick={cargarDashboardTienda}>
                    Reintentar
                  </button>
                </div>
              ) : (
                <div>
                  {/* Tarjetas de resumen */}
                  <div className="pd-grid-4" style={{ marginBottom: '24px' }}>
                    {[
                      { label: 'Campañas Activas', valor: dashboardTienda.resumen.campanas_activas, Icono: Package, color: tema.primary },
                      { label: 'Artículos Activos', valor: dashboardTienda.resumen.articulos_activos, Icono: Tag, color: tema.secondary },
                      { label: 'Ubicaciones en Uso', valor: dashboardTienda.resumen.ubicaciones_en_uso, Icono: MapPin, color: theme.color.successStrong },
                      {
                        label: 'Próxima a Vencer',
                        valor: dashboardTienda.resumen.proxima_a_vencer_dias != null
                          ? `${dashboardTienda.resumen.proxima_a_vencer_dias}d`
                          : '—',
                        Icono: Calendar,
                        color: dashboardTienda.resumen.proxima_a_vencer_dias != null && dashboardTienda.resumen.proxima_a_vencer_dias < 7
                          ? theme.color.error : theme.color.warning
                      },
                    ].map((m, i) => (
                      <div key={i} className="pd-stagger-item pd-hoverable" style={{ ...styles.metricaCardPro, animationDelay: `calc(var(--stagger) * ${i})` }}>
                        <div style={{ ...styles.metricaAcento, background: `linear-gradient(90deg, ${tema.primary}, ${tema.secondary})` }} aria-hidden="true" />
                        <div style={styles.metricaCardBody}>
                          <div style={{ ...styles.metricaIconoPro, background: m.color + '14', boxShadow: `0 2px 8px ${m.color}22` }} aria-hidden="true">
                            <m.Icono size={22} color={m.color} />
                          </div>
                          <div>
                            <p style={styles.metricaValorPro}>{m.valor}</p>
                            <p style={styles.metricaLabelPro}>{m.label}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Campañas activas con fechas */}
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} aria-hidden="true" />Campañas Activas
                    </h3>
                    {dashboardTienda.campanas_activas.length === 0 ? (
                      <p style={styles.sinDatos}>No hay campañas activas para tu tienda en este momento</p>
                    ) : (
                      <div className="pd-grid-3">
                        {dashboardTienda.campanas_activas.map((c, i) => {
                          const dias = diasRestantes(c.fecha_fin);
                          return (
                            <div key={i} className="pd-stagger-item" style={{
                              ...styles.dinamicaCard,
                              borderLeft: `4px solid ${dias < 7 ? theme.color.error : tema.primary}`,
                              animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                            }}>
                              <p style={styles.dinamicaNombre}>{c.nombre}</p>
                              <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 8px 0' }}>
                                {new Date(c.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(c.fecha_fin).toLocaleDateString('es-CR')}
                              </p>
                              <div style={styles.dinamicaInfo}>
                                <span style={styles.dinamicaArts}><Tag size={12} style={styles.dinamicaArtsIcono} aria-hidden="true" />{c.total_articulos} artículos</span>
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

                  {/* Campañas finalizadas el mes anterior */}
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PauseCircle size={18} aria-hidden="true" />Campañas Finalizadas el Mes Anterior
                    </h3>
                    {dashboardTienda.campanas_inactivas_mes_anterior.length === 0 ? (
                      <p style={styles.sinDatos}>No hubo campañas que finalizaran el mes anterior en tu tienda</p>
                    ) : (
                      <div className="pd-grid-3">
                        {dashboardTienda.campanas_inactivas_mes_anterior.map((c, i) => (
                          <div key={i} className="pd-stagger-item" style={{
                            ...styles.dinamicaCard,
                            borderLeft: `4px solid ${theme.color.border}`,
                            opacity: 0.85,
                            animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})`,
                          }}>
                            <p style={styles.dinamicaNombre}>{c.nombre}</p>
                            <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 8px 0' }}>
                              {new Date(c.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(c.fecha_fin).toLocaleDateString('es-CR')}
                            </p>
                            <div style={styles.dinamicaInfo}>
                              <span style={styles.dinamicaArts}><Tag size={12} style={styles.dinamicaArtsIcono} aria-hidden="true" />{c.total_articulos} artículos</span>
                              <span style={{ ...styles.dinamicaDias, color: theme.color.textMuted }}>Finalizada</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ubicaciones de productos */}
                  <div style={styles.card}>
                    <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={18} aria-hidden="true" />Ubicaciones de Productos
                    </h3>
                    {dashboardTienda.ubicaciones.length === 0 ? (
                      <p style={styles.sinDatos}>No hay artículos activos para mostrar por ubicación</p>
                    ) : (
                      dashboardTienda.ubicaciones.map((u, i) => (
                        <div key={i} style={styles.barraRow}>
                          <span style={styles.barraLabel}>{u.ubicacion}</span>
                          <BarraProgreso pct={(u.total / dashboardTienda.resumen.articulos_activos) * 100} color={tema.primary} />
                          <span style={styles.barraValor}>{u.total}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            ) : cargando ? (
              <div style={styles.cargando}>
                <LayoutDashboard size={48} color={theme.color.textMuted} aria-hidden="true" />
                <p>Cargando dashboard...</p>
              </div>
            ) : dashboard ? (
              <div>
                {rol === 'admin' && (
                  <InstruccionesModulo
                    id="admin-dashboard"
                    texto="Panorama general de tu país: dinámicas activas, artículos en campaña y actividad de IA. Desde acá también podés saltar directo a Carga de Información, Artículos o Alertas usando el menú lateral."
                  />
                )}
                {/* Métricas — tarjetas premium con acento del país */}
                <div className="pd-grid-4" style={{ marginBottom: '24px' }}>
                  {[
                    { label: 'Dinámicas Activas', valor: dashboard.metricas.dinamicas_activas, Icono: Package, color: tema.primary },
                    { label: 'Artículos en Campaña', valor: dashboard.metricas.articulos_campana, Icono: Tag, color: tema.secondary },
                    { label: 'Consultas Hoy', valor: dashboard.metricas.consultas_hoy, Icono: MessageCircle, color: theme.color.successStrong },
                    { label: 'Usuarios Activos', valor: dashboard.metricas.usuarios_activos, Icono: Users, color: theme.color.warning },
                  ].map((m, i) => (
                    <div key={i} className="pd-stagger-item pd-hoverable" style={{ ...styles.metricaCardPro, animationDelay: `calc(var(--stagger) * ${i})` }}>
                      <div style={{ ...styles.metricaAcento, background: `linear-gradient(90deg, ${tema.primary}, ${tema.secondary})` }} aria-hidden="true" />
                      <div style={styles.metricaCardBody}>
                        <div style={{ ...styles.metricaIconoPro, background: m.color + '14', boxShadow: `0 2px 8px ${m.color}22` }} aria-hidden="true">
                          <m.Icono size={22} color={m.color} />
                        </div>
                        <div>
                          <p style={styles.metricaValorPro}>{m.valor}</p>
                          <p style={styles.metricaLabelPro}>{m.label}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dashboard diferenciado por rol */}
                {rol === 'comercial' && (
                  <>
                    <InstruccionesModulo
                      id="comercial-dashboard"
                      texto="Tu panorama de ventas en artículos de dinámica comercial, con el mes cargado más reciente. Usá el selector de mes arriba a la derecha si querés ver un período distinto al automático."
                    />
                    

                    {/* ── Métricas de venta en campaña ──────────── */}
                    {cargandoVentas && !ventasComercial ? (
                      <div style={{ ...styles.cargando, height: '160px' }}>
                        <TrendingUp size={36} color={theme.color.textMuted} aria-hidden="true" />
                        <p>Cargando métricas de venta...</p>
                      </div>
                    ) : ventasComercial && (
                      <>
                        {ventasComercial.periodo ? (
                          <>
                            <div style={styles.heroBanda}>
                              <div style={{ ...styles.heroCard, background: tema.gradient }}>
                                <div style={styles.heroCardTop}>
                                  <div style={styles.heroIconoWrap} aria-hidden="true">
                                    <ShoppingCart size={24} color="#fff" />
                                  </div>
                                  <span style={styles.heroPeriodo}>
                                    {MESES_LABEL[ventasComercial.periodo.mes]} {ventasComercial.periodo.anio}
                                  </span>
                                </div>
                                <p style={styles.heroValor}>{formatearMonto(ventasComercial.resumen.monto_vendido)}</p>
                                <p style={styles.heroLabel}>Facturado en artículos de dinámica comercial</p>
                              </div>

                              <div style={styles.heroApoyoCol}>
                                <div className="pd-hoverable" style={styles.apoyoCard}>
                                  <div style={{ ...styles.apoyoIcono, background: tema.secondary + '15' }} aria-hidden="true">
                                    <Award size={20} color={tema.secondary} />
                                  </div>
                                  <div>
                                    <p style={{ ...styles.apoyoValor, color: tema.secondary }}>{ventasComercial.resumen.cantidad_productos}</p>
                                    <p style={styles.apoyoLabel}>Productos distintos en campaña</p>
                                  </div>
                                </div>
                                <div className="pd-hoverable" style={styles.apoyoCard}>
                                  <div style={{ ...styles.apoyoIcono, background: theme.color.successStrong + '15' }} aria-hidden="true">
                                    <TrendingUp size={20} color={theme.color.successStrong} />
                                  </div>
                                  <div>
                                    <p style={{ ...styles.apoyoValor, color: theme.color.successStrong }}>{ventasComercial.resumen.margen_promedio}%</p>
                                    <p style={styles.apoyoLabel}>Margen promedio ponderado por venta</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Top 10 por venta */}
                            <div style={styles.card}>
                              <div style={styles.cardHeaderConAccion}>
                                <h3 style={{ ...styles.cardTitulo, color: tema.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Award size={18} aria-hidden="true" />
                                  Top 10 Productos por Venta
                                </h3>
                                <button
                                  className="pd-pressable"
                                  style={{ ...styles.btnRefresh, color: tema.primary }}
                                  onClick={() => exportarVentasComercial('top_ventas', 'top_10_por_venta.xlsx')}
                                >
                                  <Download size={14} style={styles.refreshIcono} aria-hidden="true" />
                                  Excel
                                </button>
                              </div>
                              {!ventasComercial.top_ventas?.length ? (
                                <p style={styles.sinDatos}>No hay ventas en campaña registradas para este período</p>
                              ) : (
                                <div className="pd-table-scroll">
                                  <table style={styles.tabla}>
                                    <caption style={styles.srOnly}>Top 10 productos por monto vendido en campaña</caption>
                                    <thead>
                                      <tr>
                                        {['#', 'SKU', 'Descripción', 'Unidades', 'P. Dinámica', 'Venta Total', 'Margen'].map(h => (
                                          <th key={h} style={{ ...styles.th, background: tema.primary + '0D', color: tema.primary }} scope="col">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ventasComercial.top_ventas.map((p, i) => (
                                        <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                                          <td style={styles.td}><span style={{ ...styles.rankBadge, background: tema.primary + '15', color: tema.primary }}>{i + 1}</span></td>
                                          <td style={styles.td}>{p.sku}</td>
                                          <td style={styles.td}>{p.descripcion}</td>
                                          <td style={styles.td}>{p.unidades}</td>
                                          <td style={styles.td}>{formatearMontoDecimales(p.precio_dinamica)}</td>
                                          <td style={{ ...styles.td, fontWeight: theme.font.weight.bold }}>
                                            {formatearMonto(p.venta_total)}
                                          </td>
                                          <td style={{ ...styles.td, color: theme.color.successStrong, fontWeight: theme.font.weight.bold }}>
                                            {p.margen_pct}%
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Top 10 por margen */}
                            <div style={styles.card}>
                              <div style={styles.cardHeaderConAccion}>
                                <h3 style={{ ...styles.cardTitulo, color: tema.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <TrendingUp size={18} aria-hidden="true" />
                                  Top 10 Productos por Margen
                                </h3>
                                <button
                                  className="pd-pressable"
                                  style={{ ...styles.btnRefresh, color: tema.primary }}
                                  onClick={() => exportarVentasComercial('top_margen', 'top_10_por_margen.xlsx')}
                                >
                                  <Download size={14} style={styles.refreshIcono} aria-hidden="true" />
                                  Excel
                                </button>
                              </div>
                              {!ventasComercial.top_margen?.length ? (
                                <p style={styles.sinDatos}>No hay datos suficientes para calcular margen</p>
                              ) : (
                                <div className="pd-table-scroll">
                                  <table style={styles.tabla}>
                                    <caption style={styles.srOnly}>Top 10 productos por margen en campaña</caption>
                                    <thead>
                                      <tr>
                                        {['#', 'SKU', 'Descripción', 'Costo', 'P. Dinámica', 'Margen', 'Venta Total'].map(h => (
                                          <th key={h} style={{ ...styles.th, background: tema.primary + '0D', color: tema.primary }} scope="col">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ventasComercial.top_margen.map((p, i) => (
                                        <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                                          <td style={styles.td}><span style={{ ...styles.rankBadge, background: tema.primary + '15', color: tema.primary }}>{i + 1}</span></td>
                                          <td style={styles.td}>{p.sku}</td>
                                          <td style={styles.td}>{p.descripcion}</td>
                                          <td style={styles.td}>{formatearMontoDecimales(p.costo_unitario)}</td>
                                          <td style={styles.td}>{formatearMontoDecimales(p.precio_dinamica)}</td>
                                          <td style={{ ...styles.td, color: theme.color.successStrong, fontWeight: theme.font.weight.bold }}>
                                            {p.margen_pct}%
                                          </td>
                                          <td style={{ ...styles.td, fontWeight: theme.font.weight.bold }}>
                                            {formatearMonto(p.venta_total)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Top / bottom departamentos */}
                            <div className="pd-grid-2">
                              <div style={styles.card}>
                                <div style={styles.cardHeaderConAccion}>
                                  <h3 style={{ ...styles.cardTitulo, color: tema.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Building2 size={18} aria-hidden="true" />
                                    Top Departamentos
                                  </h3>
                                  <button
                                    className="pd-pressable"
                                    style={{ ...styles.btnRefresh, color: tema.primary }}
                                    onClick={() => exportarVentasComercial('top_categorias', 'top_departamentos.xlsx')}
                                  >
                                    <Download size={14} style={styles.refreshIcono} aria-hidden="true" />
                                    Excel
                                  </button>
                                </div>
                                {!ventasComercial.top_departamentos?.length ? (
                                  <p style={styles.sinDatos}>Sin datos de departamento</p>
                                ) : (
                                  ventasComercial.top_departamentos.map((d, i) => {
                                    const max = ventasComercial.top_departamentos[0]?.venta_total || 1;
                                    return (
                                      <div key={i} style={styles.barraRow}>
                                        <span style={styles.barraLabel}>{d.departamento}</span>
                                        <BarraProgreso pct={(d.venta_total / max) * 100} color={theme.color.successStrong} />
                                        <span style={{ ...styles.barraValor, width: 'auto' }}>{formatearMonto(d.venta_total)}</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              <div style={styles.card}>
                                <div style={styles.cardHeaderConAccion}>
                                  <h3 style={{ ...styles.cardTitulo, color: tema.primary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Building2 size={18} aria-hidden="true" />
                                    Departamentos con Menor Venta
                                  </h3>
                                  <button
                                    className="pd-pressable"
                                    style={{ ...styles.btnRefresh, color: tema.primary }}
                                    onClick={() => exportarVentasComercial('categorias_bajas', 'departamentos_menor_venta.xlsx')}
                                  >
                                    <Download size={14} style={styles.refreshIcono} aria-hidden="true" />
                                    Excel
                                  </button>
                                </div>
                                {!ventasComercial.departamentos_bajos?.length ? (
                                  <p style={styles.sinDatos}>Sin datos de departamento</p>
                                ) : (
                                  ventasComercial.departamentos_bajos.map((d, i) => {
                                    const max = ventasComercial.top_departamentos[0]?.venta_total
                                      || ventasComercial.departamentos_bajos[ventasComercial.departamentos_bajos.length - 1]?.venta_total
                                      || 1;
                                    return (
                                      <div key={i} style={styles.barraRow}>
                                        <span style={styles.barraLabel}>{d.departamento}</span>
                                        <BarraProgreso pct={(d.venta_total / max) * 100} color={theme.color.warning} />
                                        <span style={{ ...styles.barraValor, width: 'auto' }}>{formatearMonto(d.venta_total)}</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={styles.card}>
                            <p style={styles.sinDatos}>Todavía no hay ventas cargadas para calcular estas métricas.</p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {rol === 'planning' && (
                  cargandoPlanning && !dashboardPlanning ? (
                    <div style={{ ...styles.cargando, height: '160px' }}>
                      <PackageX size={36} color={theme.color.textMuted} aria-hidden="true" />
                      <p>Cargando panorama de Planning...</p>
                    </div>
                  ) : dashboardPlanning && (
                    <>
                      <div style={styles.heroBanda}>
                        <div style={{ ...styles.heroCard, background: tema.gradient }}>
                          <div style={styles.heroCardTop}>
                            <div style={styles.heroIconoWrap} aria-hidden="true">
                              <PackageX size={24} color="#fff" />
                            </div>
                            <span style={styles.heroPeriodo}>{nombrePais}</span>
                          </div>
                          <p style={styles.heroValor}>{dashboardPlanning.cobertura.skus_criticos_o_bajos}</p>
                          <p style={styles.heroLabel}>SKUs en cobertura crítica o baja</p>
                        </div>

                        <div style={styles.heroApoyoCol}>
                          <div className="pd-hoverable" style={styles.apoyoCard}>
                            <div style={{ ...styles.apoyoIcono, background: tema.secondary + '15' }} aria-hidden="true">
                              <Package size={20} color={tema.secondary} />
                            </div>
                            <div>
                              <p style={{ ...styles.apoyoValor, color: tema.secondary }}>{dashboardPlanning.campanas.activas}</p>
                              <p style={styles.apoyoLabel}>
                                Campañas activas
                                {dashboardPlanning.campanas.proxima_a_vencer_dias != null && ` — próxima vence en ${dashboardPlanning.campanas.proxima_a_vencer_dias}d`}
                              </p>
                            </div>
                          </div>
                          <div className="pd-hoverable" style={styles.apoyoCard}>
                            <div style={{ ...styles.apoyoIcono, background: theme.color.error + '15' }} aria-hidden="true">
                              <AlertOctagon size={20} color={theme.color.error} />
                            </div>
                            <div>
                              <p style={{ ...styles.apoyoValor, color: theme.color.error }}>{dashboardPlanning.riesgo_quiebre.total}</p>
                              <p style={styles.apoyoLabel}>SKUs en riesgo de quiebre (campaña activa)</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pd-grid-3" style={{ marginBottom: '20px' }}>
                        {[
                          { label: 'Monto inmovilizado (sobre-stock)', valor: formatearMonto(dashboardPlanning.sobre_stock.monto_inmovilizado), Icono: PackageX, color: theme.color.warning },
                          { label: 'Devoluciones pendientes', valor: dashboardPlanning.devoluciones.total_pendientes, Icono: RotateCcw, color: tema.primary },
                          { label: 'Devoluciones con excedente', valor: dashboardPlanning.devoluciones.total_excedentes, Icono: AlertTriangle, color: theme.color.error },
                        ].map((m, i) => (
                          <div key={i} className="pd-stagger-item pd-hoverable" style={{ ...styles.metricaCardPro, animationDelay: `calc(var(--stagger) * ${i})` }}>
                            <div style={{ ...styles.metricaAcento, background: `linear-gradient(90deg, ${tema.primary}, ${tema.secondary})` }} aria-hidden="true" />
                            <div style={styles.metricaCardBody}>
                              <div style={{ ...styles.metricaIconoPro, background: m.color + '14', boxShadow: `0 2px 8px ${m.color}22` }} aria-hidden="true">
                                <m.Icono size={22} color={m.color} />
                              </div>
                              <div>
                                <p style={styles.metricaValorPro}>{m.valor}</p>
                                <p style={styles.metricaLabelPro}>{m.label}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pd-grid-2">
                        <div style={styles.card}>
                          <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Building2 size={18} aria-hidden="true" />Departamentos con más problemas de cobertura
                          </h3>
                          {dashboardPlanning.cobertura.top_departamentos_problema.length === 0 ? (
                            <p style={styles.sinDatos}>Sin datos de cobertura por departamento</p>
                          ) : (
                            dashboardPlanning.cobertura.top_departamentos_problema.map((d, i) => {
                              const max = dashboardPlanning.cobertura.top_departamentos_problema[0]?.total_criticos || 1;
                              return (
                                <div key={i} style={styles.barraRow}>
                                  <span style={styles.barraLabel}>{d.departamento}</span>
                                  <BarraProgreso pct={(d.total_criticos / max) * 100} color={theme.color.error} />
                                  <span style={styles.barraValor}>{d.total_criticos}</span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div style={styles.card}>
                          <h3 style={{ ...styles.cardTitulo, color: tema.primary, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <RotateCcw size={18} aria-hidden="true" />Devoluciones más urgentes
                          </h3>
                          {dashboardPlanning.devoluciones.top_urgentes.length === 0 ? (
                            <p style={styles.sinDatos}>No hay devoluciones con excedente pendientes</p>
                          ) : (
                            dashboardPlanning.devoluciones.top_urgentes.map((d, i) => (
                              <div key={i} className="pd-stagger-item" style={{ ...styles.dinamicaCard, borderLeft: `4px solid ${theme.color.error}`, marginBottom: '8px', animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})` }}>
                                <p style={styles.dinamicaNombre}>{d.sku} — {d.tienda_codigo}</p>
                                <p style={{ fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 6px 0' }}>{d.descripcion}</p>
                                <div style={styles.dinamicaInfo}>
                                  <span style={styles.dinamicaArts}>{d.dias_transcurridos} días sin resolver</span>
                                  <span style={{ ...styles.dinamicaDias, color: theme.color.error }}>Excedente</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )
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

          {/* RESUMEN CAMPAÑAS — vista tipo afiche, solo activas */}
          {menuActivo === 'resumen' && (
            <div>
              <InstruccionesModulo
                id="resumen-campanas"
                texto="Vista tipo afiche de las campañas activas — pensada para compartir o consultar rápido el contenido de cada promoción, sin entrar a la tabla detallada de artículos."
              />
              {cargandoResumen ? (
                <div style={styles.cargando}>
                  <Sparkles size={40} color={theme.color.textMuted} aria-hidden="true" />
                  <p>Cargando campañas...</p>
                </div>
              ) : campanasResumen.length === 0 ? (
                <div style={styles.cargando}>
                  <Inbox size={40} color={theme.color.textMuted} aria-hidden="true" />
                  <p>No hay campañas activas en este momento</p>
                </div>
              ) : (
                <div style={styles.afichesGrid}>
                  {campanasResumen.map((c, i) => {
                    const vencePronto = c.dias_restantes != null && c.dias_restantes < 7;
                    return (
                      <div key={c.id} className="pd-stagger-item pd-hoverable" style={{ ...styles.aficheCard, animationDelay: `calc(var(--stagger) * ${Math.min(i, 5)})` }}>
                        <div style={{ ...styles.afichHeader, background: tema.gradient }}>
                          <Sparkles size={22} color="#fff" aria-hidden="true" />
                          <h3 style={styles.afichNombre}>{c.nombre}</h3>
                          <div style={styles.afichFechas}>
                            <Calendar size={14} aria-hidden="true" />
                            {new Date(c.fecha_inicio).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })}
                            {' — '}
                            {new Date(c.fecha_fin).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                          {c.dias_restantes != null && (
                            <span style={{ ...styles.afichDiasBadge, background: vencePronto ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.22)', color: vencePronto ? theme.color.error : '#fff' }}>
                              {c.dias_restantes < 0 ? 'Vencida' : `${c.dias_restantes} días restantes`}
                            </span>
                          )}
                        </div>
                        <div style={styles.afichBody}>
                          {c.tarjetas?.length > 0 ? (
                            c.tarjetas.map((bloque, j) => (
                              <div key={j} style={{ ...styles.afichSubTarjeta, ...(j > 0 ? { marginTop: '12px' } : {}) }}>
                                {bloque.split('\n').filter(Boolean).map((linea, k) => (
                                  <p key={k} style={styles.afichLinea}>{linea}</p>
                                ))}
                              </div>
                            ))
                          ) : (
                            <p style={{ ...styles.afichLinea, color: theme.color.textMuted, fontStyle: 'italic' }}>
                              Sin resumen cargado para esta campaña.
                            </p>
                          )}
                        </div>
                        <div style={styles.afichFooter}>
                          <span style={styles.afichFooterItem}><Tag size={13} aria-hidden="true" />{c.total_articulos} artículos</span>
                          <span style={styles.afichFooterItem}><Building2 size={13} aria-hidden="true" />{c.total_tiendas} tienda{c.total_tiendas !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ARTÍCULOS */}
          {menuActivo === 'articulos' && (
            <div>
              <InstruccionesModulo
                id="admin-articulos"
                texto="Todos los artículos actualmente en campaña, con precio regular, precio de dinámica y ahorro calculado. Usá el buscador y el filtro de ubicación para encontrar un SKU específico rápido."
              />
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
                {rol === 'tiendas' && (
                  <button className="pd-pressable" style={{ ...styles.btnRefresh, color: tema.primary, borderColor: tema.primary }} onClick={exportarArticulosTienda}>
                    <Download size={14} style={styles.refreshIcono} aria-hidden="true" />
                    Descargar Excel
                  </button>
                )}
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
                        {rol === 'tiendas' ? (
                          articulosAgrupadosPorUbicacion().map((grupo, gi) => (
                            <React.Fragment key={grupo.ubicacion}>
                              <tr>
                                <td colSpan={9} style={{ ...styles.grupoUbicacionRow, background: tema.primary + '12', color: tema.primary }}>
                                  📍 {grupo.ubicacion} — {grupo.items.length} artículo{grupo.items.length !== 1 ? 's' : ''}
                                </td>
                              </tr>
                              {grupo.items.map((a, i) => (
                                <tr key={`${gi}-${i}`} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                                  <td style={styles.td}><strong style={{ color: tema.primary }}>{a.codigo}</strong></td>
                                  <td style={styles.td}>{a.descripcion}</td>
                                  <td style={styles.td}>{a.categoria}</td>
                                  <td style={styles.td}>{formatearMontoDecimales(a.precio_regular)}</td>
                                  <td style={{ ...styles.td, color: tema.primary, fontWeight: theme.font.weight.bold }}>
                                    {formatearMontoDecimales(a.precio_dinamica)}
                                  </td>
                                  <td style={{ ...styles.td, color: theme.color.successStrong, fontWeight: theme.font.weight.bold }}>
                                    {formatearMontoDecimales(a.ahorro)}
                                  </td>
                                  <td style={styles.td}>
                                    <span style={{ ...styles.ubicacionBadge, background: tema.primary + '15', color: tema.primary }}>
                                      {a.ubicacion}
                                    </span>
                                  </td>
                                  <td style={styles.td}>{a.tienda}</td>
                                  <td style={styles.td}>{a.tipo_campana}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))
                        ) : (
                          articulosFiltrados.map((a, i) => (
                            <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                              <td style={styles.td}><strong style={{ color: tema.primary }}>{a.codigo}</strong></td>
                              <td style={styles.td}>{a.descripcion}</td>
                              <td style={styles.td}>{a.categoria}</td>
                              <td style={styles.td}>{formatearMontoDecimales(a.precio_regular)}</td>
                              <td style={{ ...styles.td, color: tema.primary, fontWeight: theme.font.weight.bold }}>
                                {formatearMontoDecimales(a.precio_dinamica)}
                              </td>
                              <td style={{ ...styles.td, color: theme.color.successStrong, fontWeight: theme.font.weight.bold }}>
                                {formatearMontoDecimales(a.ahorro)}
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
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DINÁMICAS */}
          {menuActivo === 'dinamicas' && (
            <div>
              <InstruccionesModulo
                id="admin-dinamicas-resumen"
                texto="Vista rápida de todas las dinámicas de tu país con su vigencia. Para ver el detalle de artículos de una campaña específica, usá 'Dinámicas — Historial' en el menú."
              />
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
              )}</div>
            </div>
          )}

          {/* ALERTAS */}
          {menuActivo === 'alertas' && (
            <div>
              <InstruccionesModulo
                id="admin-alertas"
                texto="Avisos automáticos sobre cosas que necesitan tu atención: dinámicas por vencer, artículos sin precio o ubicación, y consumo alto de IA. Se recalculan cada vez que entrás a esta pantalla."
              />
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
          {menuActivo === 'comparador' && (
            <ComparadorCampanas tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'dinamicas-comercial' && (
            <DinamicasComercial tema={tema} />
          )}
          {menuActivo === 'oportunidades' && (
            <OportunidadesSinExplotar tema={tema} />
          )}
          {menuActivo === 'layout-visor' && (
            <VisorLayoutTienda tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'rentabilidad' && (
            <RentabilidadUbicacion tema={tema} />
          )}
          {menuActivo === 'descuentos' && (
            <DescuentosSinImpacto tema={tema} />
          )}
          {menuActivo === 'candidatos' && (
            <CandidatosProximaCampana tema={tema} />
          )}
          {menuActivo === 'historial-sku' && (
            <HistorialSku tema={tema} />
          )}
          {menuActivo === 'riesgo-quiebre' && (
            <RiesgoQuiebreCampana tema={tema} />
          )}
          {menuActivo === 'sobre-stock' && (
            <SobreStockDepartamento tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'devoluciones' && (
            <Devoluciones tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'cobertura' && (
            <CoberturaInventario tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'forecast' && (
            <ForecastDemanda tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'impacto-campana' && (
            <ImpactoCampanaCobertura tema={tema} usuario={usuario} />
          )}
          {menuActivo === 'chat' && (
            rol === 'tiendas' ? (
              <ChatIA tiendaCodigo={tiendaSeleccionada} rol={rol} />
            ) : (
              <AsistentePersonalizado tema={tema} usuario={usuario} />
            )
          )}
        </div>
      </div>

      {/* Modal de selección de tienda — obligatorio la primera vez,
          reabrible en cualquier momento desde el botón del subheader */}
      {mostrarSelectorTienda && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlaySelector}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && tiendaSeleccionada) setMostrarSelectorTienda(false);
          }}
        >
          <div className="pd-modal-card" style={styles.modalSelectorTienda} role="dialog" aria-modal="true" aria-labelledby="modal-tienda-titulo">
            <div style={{ ...styles.modalSelectorHeader, background: tema.gradient }}>
              <Building2 size={32} color="#fff" aria-hidden="true" />
              <h2 id="modal-tienda-titulo" style={styles.modalSelectorTitulo}>¿Qué tienda vas a consultar?</h2>
              <p style={styles.modalSelectorSub}>{nombrePais}</p>
            </div>
            <div style={styles.modalSelectorBody}>
              {tiendasDisponibles.length === 0 ? (
                <p style={styles.sinDatos}>Todavía no hay tiendas registradas para tu país. Contactá a tu administrador.</p>
              ) : (
                tiendasDisponibles.map(t => (
                  <button
                    key={t.codigo}
                    className="pd-pressable pd-hoverable"
                    style={{
                      ...styles.opcionTienda,
                      borderColor: tiendaSeleccionada === t.codigo ? tema.primary : theme.color.border,
                      background: tiendaSeleccionada === t.codigo ? tema.primary + '10' : theme.color.surface,
                    }}
                    onClick={() => elegirTienda(t.codigo)}
                  >
                    <span style={styles.opcionTiendaNombre}>{t.nombre}</span>
                    <span style={styles.opcionTiendaCodigo}>{t.codigo}</span>
                  </button>
                ))
              )}
              {tiendaSeleccionada && (
                <button className="pd-pressable" style={styles.btnCerrarSelector} onClick={() => setMostrarSelectorTienda(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      {menuActivo !== 'chat' && (
        <>
          {chatFlotanteAbierto && (
            <div className="pd-dropdown" style={{ ...styles.flotanteContainer, transformOrigin: 'bottom right' }}>
              <ChatIA flotante={true} onCerrar={() => setChatFlotanteAbierto(false)} tiendaCodigo={tiendaSeleccionada} />
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

  // ── Selector de mes de ventas (subheader, rol Comercial) ────
  selectorMesWrapper: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px',
    background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.pill, cursor: 'pointer',
  },
  selectorMesInput: {
    border: 'none', background: 'transparent', fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold, cursor: 'pointer', outline: 'none',
    fontFamily: theme.font.family,
  },

  // ── Selector de tienda (subheader) ───────────────────────
  selectorTiendaBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
    background: theme.color.surface, border: '1.5px solid', borderRadius: theme.radius.pill,
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  modalOverlaySelector: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px', boxSizing: 'border-box',
  },
  modalSelectorTienda: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, width: '100%',
    maxWidth: '440px', overflow: 'hidden', boxShadow: theme.shadow.modal, maxHeight: '85vh',
  },
  modalSelectorHeader: { padding: '28px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  modalSelectorTitulo: { color: '#fff', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.black, margin: 0 },
  modalSelectorSub: { color: 'rgba(255,255,255,0.85)', fontSize: theme.font.size.base, margin: 0 },
  modalSelectorBody: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '50vh' },
  opcionTienda: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px',
    borderRadius: theme.radius.lg, border: '1.5px solid', cursor: 'pointer', textAlign: 'left',
  },
  opcionTiendaNombre: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.text },
  opcionTiendaCodigo: { fontSize: theme.font.size.sm, color: theme.color.textMuted, fontFamily: 'monospace' },
  btnCerrarSelector: { padding: '10px', background: 'transparent', border: 'none', color: theme.color.textMuted, fontSize: theme.font.size.base, cursor: 'pointer', marginTop: '4px' },

  // ── Tarjetas de métrica premium (fila superior) ─────────────
  metricaCardPro: {
    background: theme.color.surface, borderRadius: theme.radius.xl, overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)',
    border: `1px solid ${theme.color.border}`,
  },
  metricaAcento: { height: '4px', width: '100%' },
  metricaCardBody: { display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px' },
  metricaIconoPro: { width: '48px', height: '48px', borderRadius: theme.radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  metricaValorPro: { fontSize: '30px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1, color: theme.color.text, letterSpacing: '-0.02em' },
  metricaLabelPro: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '5px 0 0 0', fontWeight: theme.font.weight.semibold },

  // ── Banda hero de Comercial / Planning ──────────────────────
  heroBanda: { display: 'grid', gridTemplateColumns: 'minmax(240px, 1.3fr) minmax(220px, 1fr)', gap: '16px', marginBottom: '20px' },
  heroCard: {
    borderRadius: theme.radius.xxl, padding: '28px', color: '#fff',
    boxShadow: theme.shadow.floating, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
  },
  heroCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' },
  heroIconoWrap: { width: '44px', height: '44px', borderRadius: theme.radius.lg, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  heroPeriodo: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, background: 'rgba(255,255,255,0.18)', padding: '4px 12px', borderRadius: theme.radius.pill, textTransform: 'uppercase', letterSpacing: '0.5px' },
  heroValor: { fontSize: '40px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' },
  heroLabel: { fontSize: theme.font.size.md, opacity: 0.85, margin: '8px 0 0 0', fontWeight: theme.font.weight.medium },
  heroApoyoCol: { display: 'flex', flexDirection: 'column', gap: '16px' },
  apoyoCard: {
    flex: 1, background: theme.color.surface, borderRadius: theme.radius.xl, padding: '18px 20px',
    display: 'flex', alignItems: 'center', gap: '14px', boxShadow: theme.shadow.sm, border: `1px solid ${theme.color.border}`,
  },
  apoyoIcono: { width: '40px', height: '40px', borderRadius: theme.radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  apoyoValor: { fontSize: '22px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  apoyoLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '4px 0 0 0', fontWeight: theme.font.weight.medium },

  cardHeaderConAccion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' },
  rankBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.black },

  // ── Módulo Resumen Campañas (afiches) ────────────────────
  afichesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: '20px' },
  aficheCard: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, overflow: 'hidden',
    boxShadow: theme.shadow.floating, display: 'flex', flexDirection: 'column',
  },
  afichHeader: { padding: '22px 22px 18px', color: '#fff', position: 'relative' },
  afichNombre: { fontSize: '22px', fontWeight: theme.font.weight.black, margin: '10px 0 8px 0', lineHeight: 1.15 },
  afichFechas: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, opacity: 0.95 },
  afichDiasBadge: { display: 'inline-block', marginTop: '12px', fontSize: theme.font.size.xs, fontWeight: theme.font.weight.black, padding: '4px 10px', borderRadius: theme.radius.pill, textTransform: 'uppercase', letterSpacing: '0.5px' },
  afichBody: { padding: '20px 22px', flex: 1 },
  afichSubTarjeta: { background: theme.color.surfaceMuted, borderRadius: theme.radius.lg, padding: '14px 16px' },
  afichLinea: { fontSize: theme.font.size.base, color: theme.color.text, lineHeight: '1.6', margin: '0 0 10px 0' },
  afichFooter: { display: 'flex', gap: '16px', padding: '14px 22px', borderTop: `1px solid ${theme.color.background}`, flexWrap: 'wrap' },
  afichFooterItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: theme.font.size.sm, color: theme.color.textMuted, fontWeight: theme.font.weight.semibold },

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
  btnRefresh: { display: 'flex', alignItems: 'center', padding: '10px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.sm, cursor: 'pointer', fontWeight: theme.font.weight.semibold },
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
    grupoUbicacionRow: { padding: '10px 12px', fontWeight: theme.font.weight.black, fontSize: theme.font.size.base },

};


export default AdminDashboard;
