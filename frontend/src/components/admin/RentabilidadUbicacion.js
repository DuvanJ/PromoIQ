// ============================================================
// Componente: RentabilidadUbicacion.js
// Descripción: Compara rentabilidad entre Isla, Cabecera y
// Botadero — únicas exhibiciones físicas reales comparables.
// A nivel país (ventas_mes no tiene desglose por tienda).
// Con selector de período para ver cualquier mes cargado.
// Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';
import { formatoMoneda } from '../../utils/moneda';

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const ICONOS_UBICACION = {
  isla: '🏝️',
  cabecera: '🎯',
  botadero: '📦',
};

function iconoParaUbicacion(nombre) {
  const clave = Object.keys(ICONOS_UBICACION).find(k => nombre.toLowerCase().includes(k));
  return clave ? ICONOS_UBICACION[clave] : '📍';
}

function BarraProgreso({ pct, color }) {
  return (
    <div className="pd-bar-track" style={{ flex: 1, height: '10px', background: theme.color.background, borderRadius: '5px' }}>
      <div
        className="pd-bar-fill"
        style={{ height: '100%', borderRadius: '5px', background: color, transform: `scaleX(${Math.min(pct, 100) / 100})` }}
      />
    </div>
  );
}

function RentabilidadUbicacion({ tema }) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [periodos, setPeriodos] = useState([]);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);

  // ── Catálogo de países — necesario para saber la moneda del
  // país del usuario ────
  const [paises, setPaises] = useState([]);
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  useEffect(() => {
    cargarPeriodos();
    cargar();
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando catálogo de países:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paisInfo = paises.find(p => p.codigo === usuario?.pais);
  const formatearMonto = (valor) => formatoMoneda(valor, paisInfo);

  const cargarPeriodos = async () => {
    try {
      const res = await api.get('/dinamicas/ventas/stats');
      setPeriodos(res.data.meses_disponibles || []);
    } catch (err) {
      console.error('Error cargando períodos disponibles:', err);
    }
  };

  const cargar = async (mes, anio) => {
    setCargando(true);
    try {
      const params = (mes && anio) ? `?mes=${mes}&anio=${anio}` : '';
      const res = await api.get(`/pais/rentabilidad-ubicacion${params}`);
      setDatos(res.data);
      if (res.data.periodo) setPeriodoSeleccionado(`${res.data.periodo.mes}-${res.data.periodo.anio}`);
    } catch (err) {
      console.error('Error cargando rentabilidad por ubicación:', err);
    } finally {
      setCargando(false);
    }
  };

  const cambiarPeriodo = (valor) => {
    setPeriodoSeleccionado(valor);
    const [mes, anio] = valor.split('-').map(Number);
    cargar(mes, anio);
  };

  const colorAcento = tema?.primary || theme.color.primary;
  const colorSecundario = tema?.secondary || theme.color.accent;
  const colores = [colorAcento, colorSecundario, theme.color.successStrong, theme.color.warning];

  const maxMonto = datos?.ubicaciones?.[0]?.monto_vendido || 1;
  const ganadoraMargen = datos?.ubicaciones?.length
    ? [...datos.ubicaciones].sort((a, b) => b.margen_promedio - a.margen_promedio)[0]
    : null;

  return (
    <div>
      <InstruccionesModulo
        id="rentabilidad-ubicacion"
        texto="Comparación de rentabilidad entre las tres exhibiciones físicas del país — Isla, Cabecera y Botadero. Cambiá el período arriba para ver cualquier mes con ventas cargadas."
      />

      <p style={styles.descripcion}>
        Compara qué exhibición física rinde mejor — Isla, Cabecera o Botadero. Es un dato a nivel país, basado en ventas registradas en el sistema. Selecciona un período para ver la rentabilidad de ese mes
      </p>

      {periodos.length > 0 && (
        <div style={styles.selectorPeriodoWrapper}>
          <label htmlFor="selector-periodo-rentabilidad" style={styles.selectorPeriodoLabel}>📅 Período</label>
          <select
            id="selector-periodo-rentabilidad"
            className="pd-hoverable"
            style={styles.selectorPeriodo}
            value={periodoSeleccionado || ''}
            onChange={(e) => cambiarPeriodo(e.target.value)}
          >
            {periodos.map(p => (
              <option key={`${p.mes}-${p.anio}`} value={`${p.mes}-${p.anio}`}>
                {MESES[p.mes]} {p.anio}
              </option>
            ))}
          </select>
        </div>
      )}

      {cargando ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📍</span>
          <p>Calculando rentabilidad...</p>
        </div>
      ) : !datos || datos.ubicaciones.length === 0 ? (
        <div style={styles.cargando}>
          <span style={{ fontSize: '40px' }} aria-hidden="true">📭</span>
          <p>No hay ventas registradas en Isla, Cabecera o Botadero en este período.</p>
        </div>
      ) : (
        <>
          {ganadoraMargen && (
            <div style={{ ...styles.destacado, background: `linear-gradient(135deg, ${colorAcento} 0%, ${colorSecundario} 100%)` }}>
              <span style={{ fontSize: '32px' }} aria-hidden="true">{iconoParaUbicacion(ganadoraMargen.tipo_ubicacion)}</span>
              <div>
                <p style={styles.destacadoTitulo}>{ganadoraMargen.tipo_ubicacion} tiene el mejor margen</p>
                <p style={styles.destacadoSub}>
                  {ganadoraMargen.margen_promedio}% de margen promedio en {MESES[datos.periodo.mes]} {datos.periodo.anio} — la exhibición más rentable de ese mes
                </p>
              </div>
            </div>
          )}

          <div className="pd-grid-3">
            {datos.ubicaciones.map((u, i) => (
              <div key={i} className="pd-stagger-item pd-hoverable" style={{ ...styles.card, borderTop: `4px solid ${colores[i % colores.length]}`, animationDelay: `calc(var(--stagger) * ${i})` }}>
                <div style={styles.cardHeader}>
                  <span style={{ fontSize: '28px' }} aria-hidden="true">{iconoParaUbicacion(u.tipo_ubicacion)}</span>
                  <p style={styles.cardNombre}>{u.tipo_ubicacion}</p>
                </div>

                <p style={{ ...styles.montoValor, color: colores[i % colores.length] }}>{formatearMonto(u.monto_vendido)}</p>
                <p style={styles.montoLabel}>vendido este período</p>

                <div style={styles.barraFila}>
                  <BarraProgreso pct={(u.monto_vendido / maxMonto) * 100} color={colores[i % colores.length]} />
                </div>

                <div style={styles.metricasFila}>
                  <div style={styles.metricaChica}>
                    <p style={styles.metricaChicaValor}>{u.margen_promedio}%</p>
                    <p style={styles.metricaChicaLabel}>Margen</p>
                  </div>
                  <div style={styles.metricaChica}>
                    <p style={styles.metricaChicaValor}>{u.cantidad_articulos}</p>
                    <p style={styles.metricaChicaLabel}>Artículos</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px', lineHeight: '1.6' },
  cargando: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: theme.color.textMuted, fontSize: theme.font.size.lg, gap: '12px', textAlign: 'center' },

  selectorPeriodoWrapper: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  selectorPeriodoLabel: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted },
  selectorPeriodo: { padding: '9px 14px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text, background: theme.color.surface, cursor: 'pointer' },

  destacado: { display: 'flex', alignItems: 'center', gap: '16px', borderRadius: theme.radius.xxl, padding: '20px 24px', marginBottom: '20px', boxShadow: theme.shadow.floating },
  destacadoTitulo: { color: '#fff', fontSize: theme.font.size.lg, fontWeight: theme.font.weight.black, margin: 0 },
  destacadoSub: { color: 'rgba(255,255,255,0.9)', fontSize: theme.font.size.base, margin: '4px 0 0 0' },

  card: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
  cardNombre: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },

  montoValor: { fontSize: '30px', fontWeight: theme.font.weight.black, margin: 0, lineHeight: 1 },
  montoLabel: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '2px 0 14px 0' },

  barraFila: { marginBottom: '16px' },

  metricasFila: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' },
  metricaChica: { textAlign: 'center', background: theme.color.surfaceMuted, borderRadius: theme.radius.sm, padding: '10px 4px' },
  metricaChicaValor: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.text, margin: 0 },
  metricaChicaLabel: { fontSize: theme.font.size.xs, color: theme.color.textMuted, margin: '2px 0 0 0' },
};

export default RentabilidadUbicacion;