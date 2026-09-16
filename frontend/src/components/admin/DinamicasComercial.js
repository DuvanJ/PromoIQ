// ============================================================
// Componente: DinamicasComercial.js
// Descripción: Vista de solo lectura de TODAS las dinámicas del
// país — activas (grilla simple, siempre pocas) y finalizadas
// (con búsqueda, filtro por año y paginación, porque crecen sin
// límite con el tiempo). Exclusivo del rol Comercial.
// ============================================================

import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function DinamicasComercial({ tema }) {
  const [activas, setActivas] = useState([]);
  const [cargandoActivas, setCargandoActivas] = useState(true);

  const [finalizadas, setFinalizadas] = useState([]);
  const [cargandoFinalizadas, setCargandoFinalizadas] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [anios, setAnios] = useState([]);
  const [filtroAnio, setFiltroAnio] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalFinalizadas, setTotalFinalizadas] = useState(0);

  useEffect(() => {
    cargarActivas();
    cargarAnios();
  }, []);

  useEffect(() => {
    cargarFinalizadas(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroAnio]);

  const cargarActivas = async () => {
    setCargandoActivas(true);
    try {
      const res = await api.get('/pais/dinamicas');
      setActivas(res.data.filter(d => d.activa));
    } catch (err) {
      console.error('Error cargando dinámicas activas:', err);
    } finally {
      setCargandoActivas(false);
    }
  };

  const cargarAnios = async () => {
    try {
      const res = await api.get('/pais/anios-dinamicas-finalizadas');
      setAnios(res.data);
    } catch (err) {
      console.error('Error cargando años:', err);
    }
  };

  const cargarFinalizadas = async (paginaNueva) => {
    setCargandoFinalizadas(true);
    try {
      const params = new URLSearchParams({ pagina: paginaNueva, por_pagina: 12 });
      if (busqueda.trim()) params.append('busqueda', busqueda.trim());
      if (filtroAnio) params.append('anio', filtroAnio);
      const res = await api.get(`/pais/dinamicas-finalizadas-buscar?${params}`);
      setFinalizadas(res.data.registros);
      setPagina(res.data.pagina);
      setTotalPaginas(res.data.total_paginas || 1);
      setTotalFinalizadas(res.data.total);
    } catch (err) {
      console.error('Error cargando dinámicas finalizadas:', err);
    } finally {
      setCargandoFinalizadas(false);
    }
  };

  const colorAcento = tema?.primary || theme.color.primary;

  const diasRestantes = (fechaFin) =>
    Math.ceil((new Date(fechaFin) - new Date()) / (1000 * 60 * 60 * 24));

  const Tarjeta = ({ d, esActiva }) => {
    const dias = diasRestantes(d.fecha_fin);
    return (
      <div className="pd-stagger-item" style={{
        ...styles.card,
        borderLeft: `4px solid ${esActiva ? (dias < 7 ? theme.color.error : colorAcento) : theme.color.border}`,
        opacity: esActiva ? 1 : 0.85,
      }}>
        <p style={styles.cardNombre}>{d.nombre}</p>
        <p style={styles.cardFechas}>
          {new Date(d.fecha_inicio).toLocaleDateString('es-CR')} — {new Date(d.fecha_fin).toLocaleDateString('es-CR')}
        </p>
        <div style={styles.cardFooter}>
          <span style={styles.cardArticulos}>🏷️ {d.total_articulos} artículos</span>
          {esActiva ? (
            <span style={{ ...styles.cardEstado, color: dias < 0 ? theme.color.error : dias < 7 ? theme.color.warning : theme.color.successStrong }}>
              {dias < 0 ? 'Vencida' : `${dias} días restantes`}
            </span>
          ) : (
            <span style={{ ...styles.cardEstado, color: theme.color.textMuted }}>Finalizada</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <p style={styles.descripcion}>
        Todas las dinámicas de tu país — activas y ya finalizadas, con sus fechas y cantidad de artículos.
      </p>

      {/* ── ACTIVAS ────────────────────────────────────── */}
      <h3 style={{ ...styles.seccionTitulo, color: colorAcento }}>
        🟢 Activas ({activas.length})
      </h3>
      {cargandoActivas ? (
        <p style={styles.sinDatos}>Cargando...</p>
      ) : activas.length === 0 ? (
        <p style={styles.sinDatos}>No hay dinámicas activas en este momento.</p>
      ) : (
        <div className="pd-grid-3" style={{ marginBottom: '32px' }}>
          {activas.map(d => <Tarjeta key={d.id} d={d} esActiva={true} />)}
        </div>
      )}

      {/* ── FINALIZADAS — con búsqueda, filtro por año y paginación ── */}
      <h3 style={{ ...styles.seccionTitulo, color: theme.color.textMuted }}>
        ⚪ Finalizadas ({totalFinalizadas})
      </h3>

      <div style={styles.filtrosRow}>
        <input
          className="pd-hoverable"
          style={styles.buscador}
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && cargarFinalizadas(1)}
          aria-label="Buscar dinámica finalizada por nombre"
        />
        <select
          className="pd-hoverable"
          style={styles.selectAnio}
          value={filtroAnio}
          onChange={(e) => setFiltroAnio(e.target.value)}
          aria-label="Filtrar por año"
        >
          <option value="">Todos los años</option>
          {anios.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button className="pd-pressable" style={styles.btnBuscar} onClick={() => cargarFinalizadas(1)}>
          🔍 Buscar
        </button>
      </div>

      {cargandoFinalizadas ? (
        <p style={styles.sinDatos}>Cargando...</p>
      ) : finalizadas.length === 0 ? (
        <p style={styles.sinDatos}>No se encontraron dinámicas finalizadas con esos filtros.</p>
      ) : (
        <>
          <div className="pd-grid-3" style={{ marginBottom: '16px' }}>
            {finalizadas.map(d => <Tarjeta key={d.id} d={d} esActiva={false} />)}
          </div>
          <div style={styles.paginacion}>
            <button className="pd-pressable" style={styles.btnPagina} disabled={pagina <= 1} onClick={() => cargarFinalizadas(pagina - 1)}>← Anterior</button>
            <span style={styles.paginaTexto}>Página {pagina} de {totalPaginas}</span>
            <button className="pd-pressable" style={styles.btnPagina} disabled={pagina >= totalPaginas} onClick={() => cargarFinalizadas(pagina + 1)}>Siguiente →</button>
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  seccionTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, margin: '0 0 14px 0' },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base, marginBottom: '20px' },

  filtrosRow: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' },
  buscador: { flex: '1 1 220px', padding: '10px 14px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, outline: 'none', fontFamily: theme.font.family, background: theme.color.surface, boxSizing: 'border-box' },
  selectAnio: { padding: '10px 14px', borderRadius: theme.radius.md, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.base, background: theme.color.surface, color: theme.color.text, cursor: 'pointer' },
  btnBuscar: { padding: '10px 18px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.base, cursor: 'pointer', fontWeight: theme.font.weight.semibold, color: theme.color.primary, whiteSpace: 'nowrap' },

  card: { background: theme.color.surface, borderRadius: theme.radius.lg, padding: '16px', boxShadow: theme.shadow.sm },
  cardNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 6px 0' },
  cardFechas: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '0 0 12px 0' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' },
  cardArticulos: { fontSize: theme.font.size.sm, color: theme.color.textMuted },
  cardEstado: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold },

  paginacion: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' },
  btnPagina: { padding: '8px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, cursor: 'pointer', color: theme.color.primary },
  paginaTexto: { fontSize: theme.font.size.sm, color: theme.color.textMuted },
};

export default DinamicasComercial;