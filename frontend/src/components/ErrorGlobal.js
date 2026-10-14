// ============================================================
// Componente: ErrorGlobal.js
// Descripción: Manejador global de errores y sesión expirada
// Se monta una sola vez en App.js y escucha eventos globales
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { theme } from '../styles/theme';

function ErrorGlobal({ onSesionExpirada }) {
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Escuchar errores globales
    const handleError = (e) => {
      clearTimeout(timerRef.current);
      setError(e.detail);
      timerRef.current = setTimeout(() => setError(null), 5000);
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
      clearTimeout(timerRef.current);
    };
  }, [onSesionExpirada]);

  if (!error) return null;

  const colores = {
    conexion:  { bg: theme.color.errorBg, border: theme.color.errorSoftBorder, color: theme.color.error },
    permiso:   { bg: theme.color.warningSoftBg, border: theme.color.warningSoftBorder, color: theme.color.warning },
    notfound:  { bg: theme.color.accentSoft, border: theme.color.accentSoftBorder, color: theme.color.primary },
    servidor:  { bg: theme.color.errorBg, border: theme.color.errorSoftBorder, color: theme.color.error },
  };

  const c = colores[error.tipo] || colores.servidor;

  const cerrar = () => {
    clearTimeout(timerRef.current);
    setError(null);
  };

  return (
    <div
      className="pd-toast"
      style={{
        ...styles.container,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
      role="alert"
      aria-live="assertive"
    >
      <span style={styles.icono} aria-hidden="true">{error.icono}</span>
      <div>
        <p style={{ ...styles.titulo, color: c.color }}>
          {error.tipo === 'conexion'  ? 'Error de conexión' :
           error.tipo === 'permiso'   ? 'Sin permisos' :
           error.tipo === 'notfound'  ? 'No encontrado' : 'Error del servidor'}
        </p>
        <p style={styles.mensaje}>{error.mensaje}</p>
      </div>
      <button className="pd-pressable" style={styles.cerrar} onClick={cerrar} aria-label="Cerrar mensaje">✕</button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed', bottom: '24px', left: '50%',
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 20px', borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.floating,
    zIndex: 9999, minWidth: '340px', maxWidth: '500px',
    fontFamily: theme.font.family,
  },
  icono: { fontSize: '24px', flexShrink: 0 },
  titulo: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, margin: 0 },
  mensaje: { fontSize: theme.font.size.base, color: theme.color.textSecondary, margin: '2px 0 0 0' },
  cerrar: {
    marginLeft: 'auto', background: 'none', border: 'none',
    cursor: 'pointer', color: theme.color.textMuted, fontSize: theme.font.size.xl, flexShrink: 0,
  },
};

export default ErrorGlobal;
