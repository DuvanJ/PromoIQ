import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

function Reportes() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarReportes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const colorRol = {
    'Super Administrador': '#1E2761',
    'Administrador': '#0077B6',
    'Comercial': '#06847A',
    'Planning': '#B45309',
    'Tiendas': '#B91C1C',
  };

  const coloresUbicacion = ['#0077B6', '#06D6A0', '#F96167', '#9B5DE5', '#F9C74F'];
  const coloresCategoria = ['#1E2761', '#0077B6', '#06847A', '#B45309', '#B91C1C'];

  const maxConsultas = datos?.consultas_por_dia?.length > 0
    ? Math.max(...datos.consultas_por_dia.map(d => d.total))
    : 1;

  const maxUbicacion = datos?.por_ubicacion?.length > 0
    ? Math.max(...datos.por_ubicacion.map(d => d.total))
    : 1;

  const maxAhorro = datos?.ahorro_por_categoria?.length > 0
    ? Math.max(...datos.ahorro_por_categoria.map(d => d.ahorro_total))
    : 1;

  if (cargando) return (
    <div style={styles.cargando}>
      <span style={{ fontSize: '48px' }}>📊</span>
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
      <p style={styles.descripcion}>
        Análisis completo del sistema PromoIQ — uso, impacto comercial y adopción por usuarios.
      </p>

      {/* Totales */}
      <div style={styles.totalesGrid}>
        {[
          { label: 'Total consultas IA', valor: datos.totales.total_consultas, icon: '💬', color: '#0077B6' },
          { label: 'Tokens consumidos', valor: datos.totales.total_tokens.toLocaleString(), icon: '⚡', color: '#06847A' },
          { label: 'Costo estimado', valor: `$${datos.totales.costo_estimado}`, icon: '💲', color: '#B45309' },
          { label: 'Artículos en campaña', valor: datos.totales.total_articulos, icon: '🏷️', color: '#B91C1C' },
          { label: 'Ahorro total generado', valor: `$${datos.totales.ahorro_total.toLocaleString()}`, icon: '💰', color: '#1E2761' },
        ].map((t, i) => (
          <div key={i} style={styles.totalCard}>
            <span style={styles.totalIcon}>{t.icon}</span>
            <p style={{ ...styles.totalValor, color: t.color }}>{t.valor}</p>
            <p style={styles.totalLabel}>{t.label}</p>
          </div>
        ))}
      </div>

      {/* Fila 1: Consultas por día + Top usuarios */}
      <div style={styles.filaGrid}>

        {/* Consultas por día */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitulo}>📈 Consultas por día</h3>
            <span style={styles.cardSub}>Últimos 14 días</span>
          </div>
          {datos.consultas_por_dia.length === 0 ? (
            <div style={styles.sinDatos}>
              <span style={{ fontSize: '32px' }}>📭</span>
              <p>Sin consultas en los últimos 14 días</p>
            </div>
          ) : (
            <div style={styles.barChart}>
              {datos.consultas_por_dia.map((d, i) => (
                <div key={i} style={styles.barColumn}>
                  <span style={styles.barValue}>{d.total}</span>
                  <div style={styles.barWrapper}>
                    <div style={{
                      ...styles.barFill,
                      height: `${(d.total / maxConsultas) * 100}%`,
                      background: `linear-gradient(180deg, #0077B6, #1E2761)`
                    }} />
                  </div>
                  <span style={styles.barLabel}>
                    {new Date(d.dia).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top usuarios */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitulo}>🏆 Top usuarios activos</h3>
            <span style={styles.cardSub}>Por consultas realizadas</span>
          </div>
          {datos.top_usuarios.length === 0 ? (
            <div style={styles.sinDatos}>
              <span style={{ fontSize: '32px' }}>👥</span>
              <p>Sin actividad registrada</p>
            </div>
          ) : (
            <div style={styles.topUsuarios}>
              {datos.top_usuarios.map((u, i) => (
                <div key={i} style={styles.topUsuarioRow}>
                  <div style={styles.topRanking}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div style={{
                    ...styles.topAvatar,
                    background: colorRol[u.rol] || '#1E2761'
                  }}>
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

      {/* Fila 2: Ubicaciones + Ahorro por categoría */}
      <div style={styles.filaGrid}>

        {/* Artículos por ubicación */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitulo}>📍 Artículos por ubicación</h3>
            <span style={styles.cardSub}>Distribución en tienda</span>
          </div>
          {datos.por_ubicacion.length === 0 ? (
            <div style={styles.sinDatos}>
              <span style={{ fontSize: '32px' }}>📭</span>
              <p>Sin datos de ubicación</p>
            </div>
          ) : (
            <div>
              {datos.por_ubicacion.map((u, i) => (
                <div key={i} style={styles.horizontalRow}>
                  <span style={styles.horizontalLabel}>{u.ubicacion}</span>
                  <div style={styles.horizontalBarWrapper}>
                    <div style={{
                      ...styles.horizontalBar,
                      width: `${(u.total / maxUbicacion) * 100}%`,
                      background: coloresUbicacion[i % coloresUbicacion.length]
                    }} />
                  </div>
                  <div style={styles.horizontalRight}>
                    <span style={{
                      ...styles.horizontalBadge,
                      background: coloresUbicacion[i % coloresUbicacion.length] + '20',
                      color: coloresUbicacion[i % coloresUbicacion.length]
                    }}>
                      {u.total} arts.
                    </span>
                    <span style={styles.horizontalPct}>
                      {Math.round((u.total / datos.totales.total_articulos) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ahorro por categoría */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitulo}>💰 Ahorro por categoría</h3>
            <span style={styles.cardSub}>Precio regular vs precio en dinámica</span>
          </div>
          {datos.ahorro_por_categoria.length === 0 ? (
            <div style={styles.sinDatos}>
              <span style={{ fontSize: '32px' }}>📭</span>
              <p>Sin datos de ahorro</p>
            </div>
          ) : (
            <div>
              {datos.ahorro_por_categoria.map((c, i) => (
                <div key={i} style={styles.categoriaRow}>
                  <div style={styles.categoriaInfo}>
                    <div style={{
                      ...styles.categoriaDot,
                      background: coloresCategoria[i % coloresCategoria.length]
                    }} />
                    <div>
                      <p style={styles.categoriaNombre}>{c.categoria}</p>
                      <p style={styles.categoriaArts}>{c.articulos} artículos</p>
                    </div>
                  </div>
                  <div style={styles.categoriaStats}>
                    <div style={styles.horizontalBarWrapper}>
                      <div style={{
                        ...styles.horizontalBar,
                        width: `${(c.ahorro_total / maxAhorro) * 100}%`,
                        background: coloresCategoria[i % coloresCategoria.length]
                      }} />
                    </div>
                    <div style={styles.categoriaValores}>
                      <span style={styles.categoriaAhorroProm}>
                        Prom: ${c.ahorro_promedio}
                      </span>
                      <span style={{
                        ...styles.categoriaAhorroTotal,
                        color: coloresCategoria[i % coloresCategoria.length]
                      }}>
                        Total: ${c.ahorro_total}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Botón exportar */}
      <div style={styles.exportRow}>
        <button style={styles.btnExportar} onClick={cargarReportes}>
          🔄 Actualizar reportes
        </button>
      </div>
    </div>
  );
}

const styles = {
  descripcion: { fontSize: '14px', color: '#8892A4', marginBottom: '20px' },
  cargando: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '400px', color: '#8892A4',
    fontSize: '16px', gap: '16px',
  },
  totalesGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '12px', marginBottom: '20px',
  },
  totalCard: {
    background: '#ffffff', borderRadius: '12px', padding: '16px',
    textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  totalIcon: { fontSize: '24px' },
  totalValor: {
    fontSize: '22px', fontWeight: '900', margin: '6px 0 4px 0', lineHeight: 1,
  },
  totalLabel: { fontSize: '11px', color: '#8892A4', margin: 0 },
  filaGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '16px', marginBottom: '16px',
  },
  card: {
    background: '#ffffff', borderRadius: '14px',
    padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '20px',
  },
  cardTitulo: { fontSize: '15px', fontWeight: '700', color: '#1E2761', margin: 0 },
  cardSub: { fontSize: '12px', color: '#8892A4' },
  sinDatos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px', color: '#8892A4', fontSize: '13px', gap: '8px',
  },

  // Gráfico de barras verticales
  barChart: {
    display: 'flex', alignItems: 'flex-end', gap: '8px',
    height: '160px', padding: '0 4px',
  },
  barColumn: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '4px', height: '100%',
  },
  barValue: { fontSize: '11px', fontWeight: '700', color: '#1E2761' },
  barWrapper: {
    flex: 1, width: '100%', display: 'flex',
    alignItems: 'flex-end', background: '#F4F7FB', borderRadius: '4px', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' },
  barLabel: { fontSize: '10px', color: '#8892A4', textAlign: 'center' },

  // Top usuarios
  topUsuarios: { display: 'flex', flexDirection: 'column', gap: '12px' },
  topUsuarioRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px', background: '#F8FAFC', borderRadius: '10px',
  },
  topRanking: { fontSize: '20px', width: '28px', textAlign: 'center', flexShrink: 0 },
  topAvatar: {
    width: '36px', height: '36px', borderRadius: '50%', color: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', fontWeight: '700', flexShrink: 0,
  },
  topInfo: { flex: 1 },
  topNombre: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: 0 },
  topRol: { fontSize: '11px', color: '#8892A4', margin: '2px 0 0 0' },
  topStats: { textAlign: 'right' },
  topConsultas: { fontSize: '18px', fontWeight: '900', color: '#0077B6', margin: 0, lineHeight: 1 },
  topTokens: { fontSize: '11px', color: '#8892A4', margin: '2px 0 0 0' },

  // Barras horizontales
  horizontalRow: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
  },
  horizontalLabel: { fontSize: '13px', color: '#555', width: '80px', flexShrink: 0 },
  horizontalBarWrapper: {
    flex: 1, height: '10px', background: '#F4F7FB',
    borderRadius: '5px', overflow: 'hidden',
  },
  horizontalBar: { height: '100%', borderRadius: '5px', transition: 'width 0.5s ease' },
  horizontalRight: { display: 'flex', alignItems: 'center', gap: '6px' },
  horizontalBadge: {
    fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px',
  },
  horizontalPct: { fontSize: '12px', color: '#8892A4', width: '32px', textAlign: 'right' },

  // Categorías
  categoriaRow: { marginBottom: '16px' },
  categoriaInfo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  categoriaDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  categoriaNombre: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: 0 },
  categoriaArts: { fontSize: '11px', color: '#8892A4', margin: '2px 0 0 0' },
  categoriaStats: { paddingLeft: '20px' },
  categoriaValores: {
    display: 'flex', justifyContent: 'space-between',
    marginTop: '4px',
  },
  categoriaAhorroProm: { fontSize: '11px', color: '#8892A4' },
  categoriaAhorroTotal: { fontSize: '12px', fontWeight: '700' },

  // Export
  exportRow: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  btnExportar: {
    padding: '10px 20px', background: '#F4F7FB',
    border: '1px solid #E2E8F0', borderRadius: '10px',
    fontSize: '13px', cursor: 'pointer', color: '#1E2761', fontWeight: '600',
  },
};

export default Reportes;