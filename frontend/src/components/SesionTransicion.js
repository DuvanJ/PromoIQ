// ============================================================
// Componente: SesionTransicion.js
// Descripción: Pantalla de transición de marca que cubre el
// cambio entre Login y Dashboard al iniciar/cerrar sesión.
// Es una transición infrecuente y deliberada — a diferencia de
// los micro-interacciones del resto del sistema, acá sí vale la
// pena tomarse un momento extra para comunicar qué está pasando.
// ============================================================

import React from 'react';
import { theme } from '../styles/theme';

function SesionTransicion({ mensaje, saliendo }) {
  return (
    <div
      className={saliendo ? 'pd-page-out' : 'pd-modal-overlay'}
      style={styles.overlay}
      role="status"
      aria-live="polite"
    >
      <div style={styles.contenido}>
        <div style={styles.logo}>PromoIQ</div>
        <span
          className="pd-spinner-light"
          style={styles.spinner}
          aria-hidden="true"
        />
        <p style={styles.mensaje}>
          {mensaje}
          <span style={styles.dots} aria-hidden="true">
            <span className="pd-dot-light" />
            <span className="pd-dot-light" style={{ animationDelay: '0.2s' }} />
            <span className="pd-dot-light" style={{ animationDelay: '0.4s' }} />
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: theme.color.gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5000,
  },
  contenido: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    textAlign: 'center',
    padding: '24px',
  },
  logo: {
    fontSize: '32px',
    fontWeight: theme.font.weight.black,
    color: theme.color.textOnPrimary,
    letterSpacing: '-1px',
  },
  spinner: {
    width: '28px',
    height: '28px',
    borderWidth: '3px',
  },
  mensaje: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: theme.font.size.lg,
    color: 'rgba(255,255,255,0.9)',
    margin: 0,
    fontWeight: theme.font.weight.medium,
  },
  dots: {
    display: 'inline-flex',
    gap: '3px',
    marginLeft: '2px',
  },
};

export default SesionTransicion;
