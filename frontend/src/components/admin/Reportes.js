import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

// Barra vertical — anima transform: scaleY() en vez de height
function BarraVertical({ pct, destacada }) {
  return (
    <div className="pd-bar-track" style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', background: theme.color.background, borderRadius: theme.radius.sm }}>
      <div
        className="pd-bar-fill"
        style={{
          width: '100%', borderRadius: '4px 4px 0 0',
          background: destacada ? `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.primary})` : theme.color.dropBorder,
          transformOrigin: 'bottom center', transform: `scaleY(${Math.min(pct, 100) / 100})`,
        }}
      />
    </div>
  );
}

// Barra horizontal — anima transform: scaleX() en vez de width
function BarraHorizontal({ pct, color }) {
  return (
    <div className="pd-bar-track" style={{ flex: 1, height: '10px', background: theme.color.background, borderRadius: '5px' }}>
      <div
        className="pd-bar-fill"
        style={{ height: '100%', borderRadius: '5px', background: color, transform: `scaleX(${Math.min(pct, 100) / 100})` }}
      />
    </div>
  );
}

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7dias', label: '7 días' },
  { id: '30dias', label: '30 días' },
  { id: 'todo', label: 'Todo' },
];

function Reportes() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [costosIA, setCostosIA] = useState(null);
  const [cargandoCostos, setCargandoCostos] = useState(true);
  const [periodoCostos, setPeriodoCostos] = useState('30dias');
  const [paisExpandido, setPaisExpandido] = useState(null);

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);

  // ── Límites de consumo de tokens por país ─────────────
  const [limites, setLimites] = useState([]);
  const [cargandoLimites, setCargandoLimites] = useState(true);
  const [guardandoPais, setGuardandoPais] = useState(null);
  const [mensajeGuardado, setMensajeGuardado] = useState(null);

  // ── Límites de consumo de tokens por país + rol ───────
  const [limitesRol, setLimitesRol] = useState([]);
  const [cargandoLimitesRol, setCargandoLimitesRol] = useState(true);
  const [paisRolExpandido, setPaisRolExpandido] = useState(null);
  const [guardandoRol, setGuardandoRol] = useState(null);
  const [mensajeGuardadoRol, setMensajeGuardadoRol] = useState(null);

  useEffect(() => {
    cargarReportes();
    cargarPaises();
    cargarLimites();
    cargarLimitesRol();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarCostosIA();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoCostos]);

  const cargarReportes = async () => {
    setCargando(true);
    try {
      const res = await api.get('/admin/reportes');
      setDatos(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
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

  const cargarCostosIA = async () => {
    setCargandoCostos(true);
    try {
      const res = await api.get(`/admin/costos-ia?periodo=${periodoCostos}`);
      setCostosIA(res.data);
    } catch (err) {
      console.error('Error cargando costos IA:', err);
    } finally {
      setCargandoCostos(false);
    }
  };

  const cargarLimites = async () => {
    setCargandoLimites(true);
    try {
      const res = await api.get('/pais/limites-tokens');
      setLimites(res.data);
    } catch (err) {
      console.error('Error cargando límites de tokens:', err);
    } finally {
      setCargandoLimites(false);
    }
  };

  const actualizarCampoLimite = (pais, campo, valor) => {
    setLimites(prev => prev.map(l => l.pais === pais ? { ...l, [campo]: valor } : l));
  };

  const guardarLimite = async (pais) => {
    const limite = limites.find(l => l.pais === pais);
    if (!limite) return;
    setGuardandoPais(pais);
    setMensajeGuardado(null);
    try {
      await api.put(`/pais/limites-tokens/${pais}`, {
        limite_diario_alerta: Number(limite.limite_diario_alerta),
        limite_mensual_corte: Number(limite.limite_mensual_corte),
        activo: limite.activo,
      });
      setMensajeGuardado({ pais, ok: true });
    } catch (err) {
      setMensajeGuardado({ pais, ok: false });
    } finally {
      setGuardandoPais(null);
      setTimeout(() => setMensajeGuardado(null), 3000);
    }
  };

  const cargarLimitesRol = async () => {
    setCargandoLimitesRol(true);
    try {
      const res = await api.get('/pais/limites-tokens-rol');
      setLimitesRol(res.data);
    } catch (err) {
      console.error('Error cargando límites por rol:', err);
    } finally {
      setCargandoLimitesRol(false);
    }
  };

  const actualizarCampoLimiteRol = (pais, rol, campo, valor) => {
    setLimitesRol(prev => prev.map(l =>
      l.pais === pais && l.rol === rol ? { ...l, [campo]: valor } : l
    ));
  };

  const guardarLimiteRol = async (pais, rol) => {
    const limite = limitesRol.find(l => l.pais === pais && l.rol === rol);
    if (!limite) return;
    const clave = `${pais}-${rol}`;
    setGuardandoRol(clave);
    setMensajeGuardadoRol(null);
    try {
      await api.put(`/pais/limites-tokens-rol/${pais}/${rol}`, {
        limite_diario_alerta: Number(limite.limite_diario_alerta),
        limite_mensual_corte: Number(limite.limite_mensual_corte),
        activo: limite.activo,
      });
      setMensajeGuardadoRol({ clave, ok: true });
    } catch (err) {
      setMensajeGuardadoRol({ clave, ok: false });
    } finally {
      setGuardandoRol(null);
      setTimeout(() => setMensajeGuardadoRol(null), 3000);
    }
  };

  const actualizarTodo = () => {
    cargarReportes();
    cargarCostosIA();
    cargarPaises();
    cargarLimites();
    cargarLimitesRol();
  };

  const colorRol = {
    'Super Administrador': theme.color.primary,
    'Administrador': theme.color.accent,
    'Comercial': theme.color.successStrong,
    'Planning': theme.color.warning,
    'Tiendas': theme.color.error,
  };

  const coloresUbicacion = [theme.color.accent, theme.color.successAccent, theme.color.chart3, theme.color.chart4, theme.color.warningBorder];

  const maxConsultas = datos?.consultas_por_dia?.length > 0
    ? Math.max(...datos.consultas_por_dia.map(d => d.total))
    : 1;

  const maxUbicacion = datos?.por_ubicacion?.length > 0
    ? Math.max(...datos.por_ubicacion.map(d => d.total))
    : 1;

  if (cargando) return (
    <div style={styles.cargando}>
      <span style={{ fontSize: '48px' }} aria-hidden="true">📊</span>
      <p>Generando reportes...</p>
    </div>
  );

  if (!datos) return (
    <div style={styles.cargando}>
      <p>Error cargando reportes</p>
    </div>
  );

  return (
    <div>
      <InstruccionesModulo
        id="reportes"
        texto="Dos vistas en una: consumo de IA (costos siempre en dólares, con límites de gasto configurables por país y por rol) y operación comercial (consultas, usuarios activos, artículos por ubicación). Ajustá los límites de tokens acá si necesitás frenar el gasto de un país o rol específico."
      />

      <p style={styles.descripcion}>
        Análisis completo del sistema PromoIQ — uso de inteligencia artificial y operación comercial.
      </p>

      {/* ══════════════════════════════════════════════
          SECCIÓN 1: INTELIGENCIA ARTIFICIAL
          Todos los números de consultas/tokens/costo viven acá,
          con una sola fuente de verdad (filtrable por período).
          ══════════════════════════════════════════════ */}
      <div style={styles.seccionHeader}>
        <h2 style={styles.seccionTitulo}>🤖 Inteligencia Artificial</h2>
        <div style={styles.periodoTabs} role="tablist" aria-label="Período de análisis de IA">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              className="pd-pressable"
              style={{ ...styles.periodoTab, ...(periodoCostos === p.id ? styles.periodoTabActivo : {}) }}
              onClick={() => setPeriodoCostos(p.id)}
              role="tab"
              aria-selected={periodoCostos === p.id}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargandoCostos ? (
        <div className="pd-stagger-item" style={{ ...styles.sinDatos, marginBottom: '16px' }}>
          <span style={{ fontSize: '32px' }} aria-hidden="true">⏳</span>
          <p>Cargando consumo de IA...</p>
        </div>
      ) : costosIA ? (
        <>
          {/* Totales del período seleccionado — única fuente de estos 3 números */}
          <div style={styles.totalesGrid}>
            {[
              { label: 'Consultas', valor: costosIA.totales_generales.total_consultas, icon: '💬', color: theme.color.accent },
              { label: 'Tokens consumidos', valor: costosIA.totales_generales.total_tokens.toLocaleString(), icon: '⚡', color: theme.color.successStrong },
              { label: 'Costo estimado (USD)', valor: `$${costosIA.totales_generales.costo_estimado}`, icon: '💲', color: theme.color.warning },
            ].map((t, i) => (
              <div key={i} className="pd-stagger-item" style={{ ...styles.totalCard, animationDelay: `calc(var(--stagger) * ${i})` }}>
                <span style={styles.totalIcon} aria-hidden="true">{t.icon}</span>
                <p style={{ ...styles.totalValor, color: t.color }}>{t.valor}</p>
                <p style={styles.totalLabel}>{t.label}</p>
              </div>
            ))}
          </div>

          {/* Costo por país */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitulo}>🌎 Costo por país (USD)</h3>
              <span style={styles.cardSub}>Período: {PERIODOS.find(p => p.id === periodoCostos)?.label}</span>
            </div>
            <div className="pd-grid-3">
              {paises.map(p => {
                const datosPais = costosIA.paises[p.codigo];
                if (!datosPais) return null;
                const expandido = paisExpandido === p.codigo;
                return (
                  <div key={p.codigo} style={{ ...styles.paisCostoCard, borderTop: `4px solid ${p.color_primario}` }}>
                    <p style={styles.paisCostoNombre}>{p.label}</p>
                    <p style={{ ...styles.paisCostoMonto, color: p.color_primario }}>
                      ${datosPais.costo_estimado}
                    </p>
                    <p style={styles.paisCostoDetalle}>
                      {datosPais.total_consultas} consultas · {datosPais.total_tokens.toLocaleString()} tokens
                    </p>

                    {datosPais.por_rol.length > 0 && (
                      <button
                        className="pd-pressable"
                        style={styles.btnExpandir}
                        onClick={() => setPaisExpandido(expandido ? null : p.codigo)}
                        aria-expanded={expandido}
                      >
                        {expandido ? '▲ Ocultar detalle por rol' : '▼ Ver detalle por rol'}
                      </button>
                    )}

                    {expandido && (
                      <div style={styles.rolDetalleLista}>
                        {datosPais.por_rol.map((r, i) => (
                          <div key={i} style={styles.rolDetalleRow}>
                            <span style={styles.rolDetalleNombre}>{r.rol}</span>
                            <span style={styles.rolDetalleValor}>${r.costo_estimado}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Límites de consumo de tokens por país + por rol */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitulo}>⚙️ Límites de consumo de tokens</h3>
              <span style={styles.cardSub}>Alerta diaria + corte automático mensual — por país y por rol</span>
            </div>
            {cargandoLimites ? (
              <div className="pd-stagger-item" style={styles.sinDatos}>
                <span style={{ fontSize: '32px' }} aria-hidden="true">⏳</span>
                <p>Cargando configuración...</p>
              </div>
            ) : limites.length === 0 ? (
              <div className="pd-stagger-item" style={styles.sinDatos}>
                <span style={{ fontSize: '32px' }} aria-hidden="true">📭</span>
                <p>No hay límites configurados todavía</p>
              </div>
            ) : (
              <div className="pd-grid-3">
                {limites.map(l => {
                  const paisInfo = paises.find(p => p.codigo === l.pais);
                  return (
                    <div key={l.pais} style={{ ...styles.limiteCard, borderTop: `4px solid ${paisInfo?.color_primario || theme.color.primary}` }}>
                      <div style={styles.limiteHeader}>
                        <p style={styles.limiteNombre}>{paisInfo?.label || l.pais}</p>
                        <label style={styles.limiteToggleWrapper}>
                          <input
                            type="checkbox"
                            checked={l.activo}
                            onChange={(e) => actualizarCampoLimite(l.pais, 'activo', e.target.checked)}
                            aria-label={`Corte automático activo para ${paisInfo?.label || l.pais}`}
                          />
                          <span style={styles.limiteToggleLabel}>{l.activo ? 'Activo' : 'Desactivado'}</span>
                        </label>
                      </div>

                      <div style={styles.limiteCampo}>
                        <label htmlFor={`alerta-${l.pais}`} style={styles.limiteLabel}>Alerta diaria (tokens)</label>
                        <input
                          id={`alerta-${l.pais}`}
                          className="pd-hoverable"
                          style={styles.limiteInput}
                          type="number"
                          min="0"
                          step="10000"
                          value={l.limite_diario_alerta}
                          onChange={(e) => actualizarCampoLimite(l.pais, 'limite_diario_alerta', e.target.value)}
                        />
                      </div>

                      <div style={styles.limiteCampo}>
                        <label htmlFor={`corte-${l.pais}`} style={styles.limiteLabel}>Corte mensual (tokens)</label>
                        <input
                          id={`corte-${l.pais}`}
                          className="pd-hoverable"
                          style={styles.limiteInput}
                          type="number"
                          min="0"
                          step="100000"
                          value={l.limite_mensual_corte}
                          onChange={(e) => actualizarCampoLimite(l.pais, 'limite_mensual_corte', e.target.value)}
                        />
                      </div>

                      <button
                        className="pd-pressable"
                        style={{ ...styles.btnGuardarLimite, opacity: guardandoPais === l.pais ? 0.7 : 1 }}
                        onClick={() => guardarLimite(l.pais)}
                        disabled={guardandoPais === l.pais}
                      >
                        {guardandoPais === l.pais ? '⏳ Guardando...' : '💾 Guardar'}
                      </button>

                      {mensajeGuardado?.pais === l.pais && (
                        <p style={{ ...styles.limiteMensaje, color: mensajeGuardado.ok ? theme.color.successStrong : theme.color.error }}>
                          {mensajeGuardado.ok ? '✅ Guardado correctamente' : '❌ Error al guardar'}
                        </p>
                      )}

                      <button
                        className="pd-pressable"
                        style={styles.btnExpandir}
                        onClick={() => setPaisRolExpandido(paisRolExpandido === l.pais ? null : l.pais)}
                        aria-expanded={paisRolExpandido === l.pais}
                      >
                        {paisRolExpandido === l.pais ? '▲ Ocultar límites por rol' : '▼ Configurar límites por rol'}
                      </button>

                      {paisRolExpandido === l.pais && (
                        <div style={styles.limiteRolLista}>
                          {cargandoLimitesRol ? (
                            <p style={styles.limiteRolCargando}>Cargando...</p>
                          ) : (
                            limitesRol.filter(lr => lr.pais === l.pais).map(lr => {
                              const clave = `${lr.pais}-${lr.rol}`;
                              return (
                                <div key={lr.rol} style={styles.limiteRolItem}>
                                  <div style={styles.limiteRolHeader}>
                                    <span style={styles.limiteRolNombre}>{lr.rol.charAt(0).toUpperCase() + lr.rol.slice(1)}</span>
                                    <label style={styles.limiteToggleWrapper}>
                                      <input
                                        type="checkbox"
                                        checked={lr.activo}
                                        onChange={(e) => actualizarCampoLimiteRol(lr.pais, lr.rol, 'activo', e.target.checked)}
                                        aria-label={`Corte automático activo para ${lr.rol} en ${lr.pais}`}
                                      />
                                      <span style={styles.limiteToggleLabel}>{lr.activo ? 'Activo' : 'Off'}</span>
                                    </label>
                                  </div>
                                  <div style={styles.limiteRolCampos}>
                                    <div style={{ flex: 1 }}>
                                      <label htmlFor={`alerta-rol-${clave}`} style={styles.limiteLabel}>Alerta diaria</label>
                                      <input
                                        id={`alerta-rol-${clave}`}
                                        className="pd-hoverable"
                                        style={styles.limiteInput}
                                        type="number"
                                        min="0"
                                        step="10000"
                                        value={lr.limite_diario_alerta}
                                        onChange={(e) => actualizarCampoLimiteRol(lr.pais, lr.rol, 'limite_diario_alerta', e.target.value)}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label htmlFor={`corte-rol-${clave}`} style={styles.limiteLabel}>Corte mensual</label>
                                      <input
                                        id={`corte-rol-${clave}`}
                                        className="pd-hoverable"
                                        style={styles.limiteInput}
                                        type="number"
                                        min="0"
                                        step="100000"
                                        value={lr.limite_mensual_corte}
                                        onChange={(e) => actualizarCampoLimiteRol(lr.pais, lr.rol, 'limite_mensual_corte', e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <button
                                    className="pd-pressable"
                                    style={{ ...styles.btnGuardarLimiteRol, opacity: guardandoRol === clave ? 0.7 : 1 }}
                                    onClick={() => guardarLimiteRol(lr.pais, lr.rol)}
                                    disabled={guardandoRol === clave}
                                  >
                                    {guardandoRol === clave ? '⏳' : '💾 Guardar'}
                                  </button>
                                  {mensajeGuardadoRol?.clave === clave && (
                                    <p style={{ ...styles.limiteMensaje, color: mensajeGuardadoRol.ok ? theme.color.successStrong : theme.color.error }}>
                                      {mensajeGuardadoRol.ok ? '✅ Guardado' : '❌ Error'}
                                    </p>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="pd-stagger-item" style={{ ...styles.sinDatos, marginBottom: '16px' }}>
          <span style={{ fontSize: '32px' }} aria-hidden="true">📭</span>
          <p>No se pudo cargar el consumo de IA</p>
        </div>
      )}

      {/* Consultas por día + Top usuarios — siempre últimos 14 días, independiente del filtro de período de arriba */}
      <div className="pd-grid-2">
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitulo}>📈 Consultas por día</h3>
            <span style={styles.cardSub}>Últimos 14 días</span>
          </div>
          {datos.consultas_por_dia.length === 0 ? (
            <div className="pd-stagger-item" style={styles.sinDatos}>
              <span style={{ fontSize: '32px' }} aria-hidden="true">📭</span>
              <p>Sin consultas en los últimos 14 días</p>
            </div>
          ) : (
            <div className="pd-table-scroll" style={styles.barChart} role="img" aria-label="Gráfico de consultas diarias de los últimos 14 días — el día de hoy resaltado">
              {datos.consultas_por_dia.map((d, i) => {
                const fechaLabel = new Date(d.dia).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' });
                const esHoy = new Date(d.dia).toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={styles.barColumn} title={`${fechaLabel}${esHoy ? ' (hoy)' : ''}: ${d.total} consultas`}>
                    <span style={{ ...styles.barValue, color: esHoy ? theme.color.primary : theme.color.textMuted, fontWeight: esHoy ? theme.font.weight.black : theme.font.weight.semibold }}>{d.total}</span>
                    <BarraVertical pct={(d.total / maxConsultas) * 100} destacada={esHoy} />
                    <span style={{ ...styles.barLabel, color: esHoy ? theme.color.primary : theme.color.textMuted, fontWeight: esHoy ? theme.font.weight.bold : theme.font.weight.regular }}>{fechaLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitulo}>🏆 Top usuarios activos</h3>
            <span style={styles.cardSub}>Por consultas realizadas</span>
          </div>
          {datos.top_usuarios.length === 0 ? (
            <div className="pd-stagger-item" style={styles.sinDatos}>
              <span style={{ fontSize: '32px' }} aria-hidden="true">👥</span>
              <p>Sin actividad registrada</p>
            </div>
          ) : (
            <div style={styles.topUsuarios}>
              {datos.top_usuarios.map((u, i) => (
                <div key={i} className="pd-stagger-item" style={{ ...styles.topUsuarioRow, animationDelay: `calc(var(--stagger) * ${i})` }}>
                  <div style={styles.topRanking} aria-hidden="true">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{
                    ...styles.topAvatar,
                    background: colorRol[u.rol] || theme.color.primary,
                  }} aria-hidden="true">
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.topInfo}>
                    <p style={styles.topNombre}>{u.nombre}</p>
                    <p style={styles.topRol}>{u.rol}</p>
                  </div>
                  <div style={styles.topStats}>
                    <p style={styles.topConsultas}>{u.consultas}</p>
                    <p style={styles.topTokens}>{u.tokens} tokens</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          SECCIÓN 2: OPERACIÓN COMERCIAL
          ══════════════════════════════════════════════ */}
      <div style={styles.seccionHeader}>
        <h2 style={styles.seccionTitulo}>📦 Operación Comercial</h2>
      </div>

      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitulo}>📍 Artículos por ubicación</h3>
          <span style={styles.cardSub}>{datos.totales.total_articulos} artículos en campaña activa</span>
        </div>
        {datos.por_ubicacion.length === 0 ? (
          <div className="pd-stagger-item" style={styles.sinDatos}>
            <span style={{ fontSize: '32px' }} aria-hidden="true">📭</span>
            <p>Sin datos de ubicación</p>
          </div>
        ) : (
          <div role="img" aria-label="Gráfico de artículos por ubicación en tienda">
            {datos.por_ubicacion.map((u, i) => {
              const pct = Math.round((u.total / datos.totales.total_articulos) * 100);
              return (
                <div key={i} style={styles.horizontalRow} title={`${u.ubicacion}: ${u.total} artículos (${pct}%)`}>
                  <span style={styles.horizontalLabel}>{u.ubicacion}</span>
                  <BarraHorizontal pct={(u.total / maxUbicacion) * 100} color={coloresUbicacion[i % coloresUbicacion.length]} />
                  <div style={styles.horizontalRight}>
                    <span style={{
                      ...styles.horizontalBadge,
                      background: coloresUbicacion[i % coloresUbicacion.length] + '20',
                      color: coloresUbicacion[i % coloresUbicacion.length],
                    }}>
                      {u.total} arts.
                    </span>
                    <span style={styles.horizontalPct}>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Botón exportar */}
      <div style={styles.exportRow}>
        <button className="pd-pressable" style={styles.btnExportar} onClick={actualizarTodo}>
          🔄 Actualizar reportes
        </button>
      </div>
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  cargando: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '400px', color: theme.color.textMuted,
    fontSize: theme.font.size.xl, gap: '16px',
  },

  seccionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: '10px', margin: '28px 0 14px 0',
  },
  seccionTitulo: {
    fontSize: theme.font.size.xl, fontWeight: theme.font.weight.black,
    color: theme.color.primary, margin: 0,
  },

  totalesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px', marginBottom: '16px',
  },
  totalCard: {
    background: theme.color.surface, borderRadius: theme.radius.lg, padding: '16px',
    textAlign: 'center', boxShadow: theme.shadow.sm,
  },
  totalIcon: { fontSize: '24px' },
  totalValor: {
    fontSize: '22px', fontWeight: theme.font.weight.black, margin: '6px 0 4px 0', lineHeight: 1,
  },
  totalLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0 },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xl,
    padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '16px',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px',
  },
  cardTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0 },
  cardSub: { fontSize: theme.font.size.sm, color: theme.color.textMuted },
  sinDatos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px', color: theme.color.textMuted, fontSize: theme.font.size.base, gap: '8px',
  },

  // Gráfico de barras verticales
  barChart: {
    display: 'flex', alignItems: 'flex-end', gap: '8px',
    height: '160px', padding: '0 4px', minWidth: '480px',
  },
  barColumn: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '4px', height: '100%', minWidth: '24px',
  },
  barValue: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary },
  barLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, textAlign: 'center' },

  // Top usuarios
  topUsuarios: { display: 'flex', flexDirection: 'column', gap: '12px' },
  topUsuarioRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px', background: theme.color.surfaceMuted, borderRadius: theme.radius.md, flexWrap: 'wrap',
  },
  topRanking: { fontSize: '20px', width: '28px', textAlign: 'center', flexShrink: 0 },
  topAvatar: {
    width: '36px', height: '36px', borderRadius: '50%', color: theme.color.textOnPrimary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, flexShrink: 0,
  },
  topInfo: { flex: '1 1 100px', minWidth: 0 },
  topNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  topRol: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },
  topStats: { textAlign: 'right' },
  topConsultas: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.accent, margin: 0, lineHeight: 1 },
  topTokens: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 0 0' },

  // Barras horizontales
  horizontalRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap',
  },
  horizontalLabel: { fontSize: theme.font.size.base, color: theme.color.textSecondary, width: '80px', flexShrink: 0 },
  horizontalRight: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  horizontalBadge: {
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 8px', borderRadius: theme.radius.pill,
  },
  horizontalPct: { fontSize: theme.font.size.base, color: theme.color.textMuted, width: '32px', textAlign: 'right' },

  // Costos de IA
  periodoTabs: { display: 'flex', gap: '4px', background: theme.color.background, padding: '4px', borderRadius: theme.radius.lg },
  periodoTab: { padding: '6px 14px', borderRadius: theme.radius.md, border: 'none', background: 'transparent', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.textMuted, cursor: 'pointer', fontFamily: theme.font.family },
  periodoTabActivo: { background: theme.color.surface, color: theme.color.primary, boxShadow: theme.shadow.sm },
  paisCostoCard: { background: theme.color.surfaceMuted, borderRadius: theme.radius.lg, padding: '16px' },
  paisCostoNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text, margin: '0 0 6px 0' },
  paisCostoMonto: { fontSize: '28px', fontWeight: theme.font.weight.black, margin: '0 0 4px 0', lineHeight: 1 },
  paisCostoDetalle: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 12px 0' },
  btnExpandir: { background: 'none', border: 'none', color: theme.color.accent, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, cursor: 'pointer', padding: 0, marginTop: '8px' },
  rolDetalleLista: { marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${theme.color.border}`, display: 'flex', flexDirection: 'column', gap: '6px' },
  rolDetalleRow: { display: 'flex', justifyContent: 'space-between', fontSize: theme.font.size.sm },
  rolDetalleNombre: { color: theme.color.textSecondary },
  rolDetalleValor: { color: theme.color.primary, fontWeight: theme.font.weight.semibold },

  // Límites de consumo de tokens — por país
  limiteCard: { background: theme.color.surfaceMuted, borderRadius: theme.radius.lg, padding: '16px' },
  limiteHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '6px' },
  limiteNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  limiteToggleWrapper: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' },
  limiteToggleLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, fontWeight: theme.font.weight.semibold },
  limiteCampo: { marginBottom: '10px' },
  limiteLabel: { display: 'block', fontSize: theme.font.size.xs, color: theme.color.textMuted, marginBottom: '4px', fontWeight: theme.font.weight.semibold, textTransform: 'uppercase', letterSpacing: '0.3px' },
  limiteInput: { width: '100%', padding: '8px 10px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, outline: 'none', boxSizing: 'border-box', fontFamily: theme.font.family, background: theme.color.surface },
  btnGuardarLimite: { width: '100%', padding: '9px', background: theme.color.primary, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, cursor: 'pointer', marginTop: '4px' },
  limiteMensaje: { fontSize: theme.font.size.xs, textAlign: 'center', margin: '8px 0 0 0', fontWeight: theme.font.weight.semibold },

  // Límites de consumo de tokens — por rol (dentro de cada país)
  limiteRolLista: { marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${theme.color.border}`, display: 'flex', flexDirection: 'column', gap: '12px' },
  limiteRolCargando: { fontSize: theme.font.size.sm, color: theme.color.textMuted, textAlign: 'center' },
  limiteRolItem: { background: theme.color.surface, borderRadius: theme.radius.sm, padding: '10px' },
  limiteRolHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  limiteRolNombre: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.text },
  limiteRolCampos: { display: 'flex', gap: '8px', marginBottom: '8px' },
  btnGuardarLimiteRol: { width: '100%', padding: '7px', background: theme.color.accent, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.sm, fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, cursor: 'pointer' },

  // Export
  exportRow: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  btnExportar: {
    padding: '10px 20px', background: theme.color.background,
    border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md,
    fontSize: theme.font.size.base, cursor: 'pointer', color: theme.color.primary, fontWeight: theme.font.weight.semibold,
  },
};

export default Reportes;