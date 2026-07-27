// ============================================================
// Componente: Exportar.js
// Descripción: Módulo para exportar reportes a Excel
// ============================================================

import React, { useState } from 'react';
import api from '../../utils/api';

function Exportar() {
  const [descargando, setDescargando] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const paisLabel = {
    CR: '🇨🇷 Costa Rica',
    GT: '🇬🇹 Guatemala',
    SV: '🇸🇻 El Salvador',
    '': '🌎 Todos los países'
  }[usuario.pais] || usuario.pais;

  const descargar = async (tipo) => {
    setDescargando(tipo);
    setMensaje('');
    try {
      // responseType blob para archivos binarios — el token lo agrega el interceptor
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
      setTimeout(() => setMensaje(''), 4000);
    } catch (err) {
      setMensaje('❌ Error generando el reporte. Intentá de nuevo.');
      setTimeout(() => setMensaje(''), 4000);
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
      color: '#002B7F',
      bg: '#EEF2FF',
      border: '#C7D2FE',
      hojas: ['Artículos en Dinámica'],
      incluye: ['Código y descripción', 'Precios regular y dinámica', 'Ahorro calculado', 'Ubicación y tienda', 'Tipo de campaña'],
    },
    {
      id: 'historial',
      icon: '💬',
      titulo: 'Historial de Consultas IA',
      descripcion: 'Exporta el registro completo de consultas realizadas a la IA con usuarios, tokens y fechas.',
      color: '#0077B6',
      bg: '#E0F2FE',
      border: '#BAE6FD',
      hojas: ['Historial de Consultas'],
      incluye: ['Nombre del usuario', 'Rol del usuario', 'Pregunta realizada', 'Tokens consumidos', 'Fecha y hora'],
    },
    {
      id: 'reporte-completo',
      icon: '📊',
      titulo: 'Reporte Completo',
      descripcion: 'Reporte ejecutivo con múltiples hojas: artículos, resumen por ubicación y por tipo de campaña.',
      color: '#06847A',
      bg: '#F0FDF4',
      border: '#BBF7D0',
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
        <div style={{
          ...styles.mensajeBox,
          background: mensaje.startsWith('✅') ? '#F0FDF4' : '#FFF0F0',
          border: `1px solid ${mensaje.startsWith('✅') ? '#BBF7D0' : '#FCA5A5'}`,
          color: mensaje.startsWith('✅') ? '#15803D' : '#B91C1C',
        }}>
          {mensaje}
        </div>
      )}

      {/* Cards de reportes */}
      <div style={styles.grid}>
        {reportes.map((r) => (
          <div key={r.id} style={{
            ...styles.card,
            border: `2px solid ${r.destacado ? r.color : r.border}`,
            ...(r.destacado ? styles.cardDestacado : {})
          }}>
            {r.destacado && (
              <div style={{ ...styles.destacadoBadge, background: r.color }}>
                ⭐ Recomendado
              </div>
            )}

            {/* Header de la card */}
            <div style={{ ...styles.cardHeader, background: r.bg }}>
              <div style={{ ...styles.cardIcono, background: r.color + '20', border: `2px solid ${r.color}30` }}>
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

            {/* Cuerpo */}
            <div style={styles.cardBody}>
              <p style={styles.cardDescripcion}>{r.descripcion}</p>

              <div style={styles.incluyeWrapper}>
                <p style={styles.incluyeTitulo}>Incluye:</p>
                {r.incluye.map((item, i) => (
                  <div key={i} style={styles.incluyeItem}>
                    <span style={{ ...styles.incluyeDot, background: r.color }} />
                    <span style={styles.incluyeTexto}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer con botón */}
            <div style={styles.cardFooter}>
              <button
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
                    <span style={styles.spinner} /> Generando...
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
        <span style={{ fontSize: '20px' }}>ℹ️</span>
        <div>
          <p style={styles.infoTitulo}>Sobre los reportes</p>
          <p style={styles.infoTexto}>
            Los archivos Excel se generan con formato profesional, encabezados con color,
            filas alternadas y columnas ajustadas automáticamente.
            Los precios se formatean como moneda y las fechas en formato legible.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  descripcion: { fontSize: '14px', color: '#8892A4', marginBottom: '20px' },
  mensajeBox: {
    padding: '12px 16px', borderRadius: '8px',
    fontSize: '14px', fontWeight: '600', marginBottom: '16px',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px', marginBottom: '20px',
  },
  card: {
    background: '#ffffff', borderRadius: '16px',
    overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    display: 'flex', flexDirection: 'column', position: 'relative',
  },
  cardDestacado: {
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    transform: 'translateY(-4px)',
  },
  destacadoBadge: {
    position: 'absolute', top: '12px', right: '12px',
    color: '#ffffff', fontSize: '11px', fontWeight: '800',
    padding: '4px 10px', borderRadius: '20px',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '20px',
  },
  cardIcono: {
    width: '60px', height: '60px', borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cardTituloWrapper: { flex: 1 },
  cardTitulo: { fontSize: '15px', fontWeight: '800', margin: '0 0 8px 0' },
  hojasWrapper: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  hojaBadge: {
    fontSize: '11px', fontWeight: '600',
    padding: '2px 8px', borderRadius: '20px',
  },
  cardBody: { padding: '16px 20px', flex: 1 },
  cardDescripcion: { fontSize: '13px', color: '#555', lineHeight: '1.6', marginBottom: '16px' },
  incluyeWrapper: { background: '#F8FAFC', borderRadius: '10px', padding: '12px' },
  incluyeTitulo: { fontSize: '11px', fontWeight: '700', color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' },
  incluyeItem: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' },
  incluyeDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  incluyeTexto: { fontSize: '12px', color: '#444' },
  cardFooter: { padding: '16px 20px', borderTop: '1px solid #F4F7FB' },
  btnDescargar: {
    width: '100%', padding: '12px',
    color: '#ffffff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700',
    fontFamily: 'Calibri, sans-serif',
    transition: 'opacity 0.2s',
  },
  btnCargando: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  spinner: {
    width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
  },
  infoBox: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    background: '#F4F7FB', border: '1px solid #E2E8F0',
    borderRadius: '10px', padding: '16px 20px',
  },
  infoTitulo: { fontSize: '13px', fontWeight: '700', color: '#1E2761', margin: '0 0 4px 0' },
  infoTexto: { fontSize: '12px', color: '#8892A4', margin: 0, lineHeight: '1.6' },
};

export default Exportar;