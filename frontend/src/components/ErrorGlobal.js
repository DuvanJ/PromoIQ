// ============================================================
// Componente: ErrorGlobal.js
// Descripción: Manejador global de errores y sesión expirada
// Se monta una sola vez en App.js y escucha eventos globales
// ============================================================

import React, { useState, useEffect } from 'react';

function ErrorGlobal({ onSesionExpirada }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    // Escuchar errores globales
    const handleError = (e) => {
      setError(e.detail);
      setTimeout(() => setError(null), 5000);
    };

    // Escuchar sesión expirada
    const handleSesionExpirada = () => {
      onSesionExpirada();
    };

    window.addEventListener('promoiq:error', handleError);
    window.addEventListener('promoiq:sesion-expirada', handleSesionExpirada);

    return () => {
      window.removeEventListener('promoiq:error', handleError);
      window.removeEventListener('promoiq:sesion-expirada', handleSesionExpirada);
    };
  }, [onSesionExpirada]);

  if (!error) return null;

  const colores = {
    conexion:  { bg: '#FFF0F0', border: '#FCA5A5', color: '#B91C1C' },
    permiso:   { bg: '#FEF3C7', border: '#FCD34D', color: '#B45309' },
    notfound:  { bg: '#EEF2FF', border: '#C7D2FE', color: '#1E2761' },
    servidor:  { bg: '#FFF0F0', border: '#FCA5A5', color: '#B91C1C' },
  };

  const c = colores[error.tipo] || colores.servidor;

  return (
    <div style={{
      ...styles.container,
      background: c.bg,
      border: `1px solid ${c.border}`,
    }}>
      <span style={styles.icono}>{error.icono}</span>
      <div>
        <p style={{ ...styles.titulo, color: c.color }}>
          {error.tipo === 'conexion'  ? 'Error de conexión' :
           error.tipo === 'permiso'   ? 'Sin permisos' :
           error.tipo === 'notfound'  ? 'No encontrado' : 'Error del servidor'}
        </p>
        <p style={styles.mensaje}>{error.mensaje}</p>
      </div>
      <button style={styles.cerrar} onClick={() => setError(null)}>✕</button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed', bottom: '24px', left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 20px', borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
    zIndex: 9999, minWidth: '340px', maxWidth: '500px',
    fontFamily: 'Calibri, sans-serif',
    animation: 'slideUp 0.3s ease',
  },
  icono: { fontSize: '24px', flexShrink: 0 },
  titulo: { fontSize: '14px', fontWeight: '700', margin: 0 },
  mensaje: { fontSize: '13px', color: '#555', margin: '2px 0 0 0' },
  cerrar: {
    marginLeft: 'auto', background: 'none', border: 'none',
    cursor: 'pointer', color: '#8892A4', fontSize: '16px', flexShrink: 0,
  },
};

export default ErrorGlobal;