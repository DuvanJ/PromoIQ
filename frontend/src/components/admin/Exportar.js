// ============================================================
// Componente: Exportar.js
// Descripción: Módulo para exportar reportes a Excel
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function Exportar() {
  const [descargando, setDescargando] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const mensajeTimerRef = useRef(null);

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);

  useEffect(() => {
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando catálogo de países:', err));
    return () => clearTimeout(mensajeTimerRef.current);
  }, []);

  const paisEncontrado = paises.find(p => p.codigo === usuario.pais);
  const paisLabel = paisEncontrado
    ? paisEncontrado.label
    : (usuario.pais ? usuario.pais : '🌎 Todos los países');

  const descargar = async (tipo) => {
    setDescargando(tipo);
    setMensaje('');
    try {
      const res = await api.get(`/exportar/${tipo}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;

      const disposition = res.headers['content-disposition'];
      const filename = disposition
        ? disposition.split('filename=')[1]
        : `PromoIQ_${tipo}_${new Date().toISOString().slice(0,10)}.xlsx`;

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMensaje(`✅ Reporte descargado exitosamente`);
      clearTimeout(mensajeTimerRef.current);
      mensajeTimerRef.current = setTimeout(() => setMensaje(''), 4000);
    } catch (err) {
      setMensaje('❌ Error generando el reporte. Intentá de nuevo.');
      clearTimeout(mensajeTimerRef.current);
      mensajeTimerRef.current = setTimeout(() => setMensaje(''), 4000);
    } finally {
      setDescargando(null);
    }
  };

  const reportes = [
    {
      id: 'articulos',
      icon: '🏷️',
      titulo: 'Artículos en Dinámica',
      descripcion: 'Exporta todos los artículos en campaña con precios, ubicaciones, tiendas y ahorro calculado.',
      color: theme.color.reportA,
      bg: theme.color.accentSoft,
      border: theme.color.accentSoftBorder,
      hojas: ['Artículos en Dinámica'],
      incluye: ['Código y descripción', 'Precios regular y dinámica', 'Ahorro calculado', 'Ubicación y tienda', 'Tipo de campaña'],
    },
    {
      id: 'historial',
      icon: '💬',
      titulo: 'Historial de Consultas IA',
      descripcion: 'Exporta el registro completo de consultas realizadas a la IA con usuarios, tokens y fechas.',
      color: theme.color.accent,
      bg: theme.color.reportBBg,
      border: theme.color.reportBBorder,
      hojas: ['Historial de Consultas'],
      incluye: ['Nombre del usuario', 'Rol del usuario', 'Pregunta realizada', 'Tokens consumidos', 'Fecha y hora'],
    },
    {
      id: 'reporte-completo',
      icon: '📊',
      titulo: 'Reporte Completo',
      descripcion: 'Reporte ejecutivo con múltiples hojas: artículos, resumen por ubicación y por tipo de campaña.',
      color: theme.color.successStrong,
      bg: theme.color.successBg,
      border: theme.color.successBorder,
      hojas: ['Artículos', 'Por Ubicación', 'Por Tipo Campaña'],
      incluye: ['Todos los artículos en dinámica', 'Resumen por ubicación', 'Resumen por tipo de campaña', 'Precios y ahorros', 'Estadísticas generales'],
      destacado: true,
    },
  ];

  return (
    <div>
      <p style={styles.descripcion}>
        Generá y descargá reportes en formato Excel con información actualizada de PromoIQ.
        Los datos se filtran automáticamente según tu país: <strong>{paisLabel}</strong>
      </p>

      {mensaje && (
        <div
          role="status"
          aria-live="polite"
          style={{
            ...styles.mensajeBox,
            background: mensaje.startsWith('✅') ? theme.color.successBg : theme.color.errorBg,
            border: `1px solid ${mensaje.startsWith('✅') ? theme.color.successBorder : theme.color.errorSoftBorder}`,
            color: mensaje.startsWith('✅') ? theme.color.success : theme.color.error,
          }}
        >
          {mensaje}
        </div>
      )}

      {/* Cards de reportes */}
      <div className="pd-grid-3">
        {reportes.map((r, i) => (
          <div
            key={r.id}
            className="pd-stagger-item"
            style={{
              ...styles.card,
              border: `2px solid ${r.destacado ? r.color : r.border}`,
              animationDelay: `calc(var(--stagger) * ${i})`,
              ...(r.destacado ? styles.cardDestacado : {})
            }}
          >
            {r.destacado && (
              <div style={{ ...styles.destacadoBadge, background: r.color }}>
                ⭐ Recomendado
              </div>
            )}

            <div style={{ ...styles.cardHeader, background: r.bg }}>
              <div style={{ ...styles.cardIcono, background: r.color + '20', border: `2px solid ${r.color}30` }} aria-hidden="true">
                <span style={{ fontSize: '32px' }}>{r.icon}</span>
              </div>
              <div style={styles.cardTituloWrapper}>
                <h3 style={{ ...styles.cardTitulo, color: r.color }}>{r.titulo}</h3>
                <div style={styles.hojasWrapper}>
                  {r.hojas.map((h, i) => (
                    <span key={i} style={{ ...styles.hojaBadge, background: r.color + '15', color: r.color, border: `1px solid ${r.color}30` }}>
                      📄 {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={styles.cardBody}>
              <p style={styles.cardDescripcion}>{r.descripcion}</p>

              <div style={styles.incluyeWrapper}>
                <p style={styles.incluyeTitulo}>Incluye:</p>
                {r.incluye.map((item, i) => (
                  <div key={i} style={styles.incluyeItem}>
                    <span style={{ ...styles.incluyeDot, background: r.color }} aria-hidden="true" />
                    <span style={styles.incluyeTexto}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.cardFooter}>
              <button
                className="pd-pressable"
                style={{
                  ...styles.btnDescargar,
                  background: descargando === r.id ? r.color + '80' : r.color,
                  cursor: descargando === r.id ? 'not-allowed' : 'pointer',
                  opacity: descargando && descargando !== r.id ? 0.6 : 1,
                }}
                onClick={() => descargar(r.id)}
                disabled={!!descargando}
              >
                {descargando === r.id ? (
                  <span style={styles.btnCargando}>
                    <span className="pd-spinner-light" aria-hidden="true" /> Generando...
                  </span>
                ) : (
                  '⬇️ Descargar Excel'
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Info general */}
      <div style={styles.infoBox}>
        <span style={{ fontSize: '20px' }} aria-hidden="true">ℹ️</span>
        <div>
          <p style={styles.infoTitulo}>Sobre los reportes</p>
          <p style={styles.infoTexto}>
            Los archivos Excel se generan con formato profesional, encabezados con color,
            filas alternadas y columnas ajustadas automáticamente.
            Los precios se formatean como moneda y las fechas en formato legible.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  mensajeBox: {
    padding: '12px 16px', borderRadius: theme.radius.sm,
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, marginBottom: '16px',
  },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xxl,
    overflow: 'hidden', boxShadow: theme.shadow.md,
    display: 'flex', flexDirection: 'column', position: 'relative', marginBottom: '4px',
  },
  cardDestacado: {
    boxShadow: theme.shadow.floating,
    transform: 'translateY(-4px)',
  },
  destacadoBadge: {
    position: 'absolute', top: '12px', right: '12px',
    color: theme.color.textOnPrimary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.black,
    padding: '4px 10px', borderRadius: theme.radius.pill,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '20px',
  },
  cardIcono: {
    width: '60px', height: '60px', borderRadius: theme.radius.xl,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardTituloWrapper: { flex: 1, minWidth: 0 },
  cardTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.black, margin: '0 0 8px 0' },
  hojasWrapper: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  hojaBadge: {
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold,
    padding: '2px 8px', borderRadius: theme.radius.pill,
  },
  cardBody: { padding: '16px 20px', flex: 1 },
  cardDescripcion: { fontSize: theme.font.size.base, color: theme.color.textSecondary, lineHeight: '1.6', marginBottom: '16px' },
  incluyeWrapper: { background: theme.color.surfaceMuted, borderRadius: theme.radius.md, padding: '12px' },
  incluyeTitulo: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  incluyeItem: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
  incluyeDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  incluyeTexto: { fontSize: theme.font.size.sm, color: '#444444' },
  cardFooter: { padding: '16px 20px', borderTop: `1px solid ${theme.color.background}` },
  btnDescargar: {
    width: '100%', padding: '12px',
    color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md,
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold,
    fontFamily: theme.font.family,
    transition: `opacity ${theme.motion.duration.fast} ${theme.motion.easing.hover}`,
  },
  btnCargando: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  infoBox: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md, padding: '16px 20px', marginTop: '20px',
  },
  infoTitulo: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 4px 0' },
  infoTexto: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: 0, lineHeight: '1.6' },
};

export default Exportar;