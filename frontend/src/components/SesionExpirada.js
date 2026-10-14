// ============================================================
// Componente: SesionExpirada.js
// Descripción: Pantalla que aparece cuando el token expira
// ============================================================

import React from 'react';
import { theme } from '../styles/theme';

function SesionExpirada({ onVolverLogin }) {
  return (
    <div className="pd-modal-overlay" style={styles.overlay}>
      <div
        className="pd-modal-card"
        style={styles.card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sesion-expirada-titulo"
        aria-describedby="sesion-expirada-mensaje"
      >
        <span style={styles.icono} aria-hidden="true">🔒</span>
        <h2 id="sesion-expirada-titulo" style={styles.titulo}>Sesión expirada</h2>
        <p id="sesion-expirada-mensaje" style={styles.mensaje}>
          Tu sesión ha expirado por seguridad. Por favor ingresá nuevamente para continuar.
        </p>
        <button className="pd-pressable" style={styles.boton} onClick={onVolverLogin} autoFocus>
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 9999,
    fontFamily: theme.font.family,
  },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xxl,
    padding: '48px 40px', textAlign: 'center',
    maxWidth: '400px', width: '90%',
    boxShadow: theme.shadow.modal,
  },
  icono: { fontSize: '56px', display: 'block', marginBottom: '16px' },
  titulo: { fontSize: '24px', fontWeight: theme.font.weight.black, color: theme.color.primary, margin: '0 0 12px' },
  mensaje: { fontSize: theme.font.size.lg, color: theme.color.textMuted, lineHeight: '1.6', margin: '0 0 32px' },
  boton: {
    width: '100%', padding: '14px',
    background: theme.color.gradient,
    color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md,
    fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, cursor: 'pointer',
  },
};

export default SesionExpirada;
