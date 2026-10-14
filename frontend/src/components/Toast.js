import React, { useEffect, useState } from 'react';
import { theme } from '../styles/theme';

function Toast({ mensaje, onCerrar, duracion = 4000 }) {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const timerSalida = setTimeout(() => setSaliendo(true), duracion);
    const timerCierre = setTimeout(() => onCerrar(), duracion + 200);
    return () => {
      clearTimeout(timerSalida);
      clearTimeout(timerCierre);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={saliendo ? 'pd-corner-toast-out' : 'pd-stagger-item'}
      style={styles.toast}
      role="status"
      aria-live="polite"
    >
      <span style={styles.icono} aria-hidden="true">👋</span>
      <p style={styles.texto}>{mensaje}</p>
    </div>
  );
}

const styles = {
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: theme.color.gradient,
    color: theme.color.textOnPrimary,
    padding: '14px 20px',
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.floating,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    maxWidth: '360px',
    zIndex: 3000,
  },
  icono: { fontSize: theme.font.size.xl, flexShrink: 0 },
  texto: { fontSize: theme.font.size.md, lineHeight: '1.4', margin: 0 },
};

export default Toast;
