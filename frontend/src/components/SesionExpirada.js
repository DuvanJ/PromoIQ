// ============================================================
// Componente: SesionExpirada.js
// Descripción: Pantalla que aparece cuando el token expira
// ============================================================

import React from 'react';

function SesionExpirada({ onVolverLogin }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <span style={styles.icono}>🔒</span>
        <h2 style={styles.titulo}>Sesión expirada</h2>
        <p style={styles.mensaje}>
          Tu sesión ha expirado por seguridad. Por favor ingresá nuevamente para continuar.
        </p>
        <button style={styles.boton} onClick={onVolverLogin}>
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
    fontFamily: 'Calibri, sans-serif',
  },
  card: {
    background: '#ffffff', borderRadius: '20px',
    padding: '48px 40px', textAlign: 'center',
    maxWidth: '400px', width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  icono: { fontSize: '56px', display: 'block', marginBottom: '16px' },
  titulo: { fontSize: '24px', fontWeight: '800', color: '#1E2761', margin: '0 0 12px' },
  mensaje: { fontSize: '15px', color: '#8892A4', lineHeight: '1.6', margin: '0 0 32px' },
  boton: {
    width: '100%', padding: '14px',
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff', border: 'none', borderRadius: '10px',
    fontSize: '16px', fontWeight: '700', cursor: 'pointer',
  },
};

export default SesionExpirada;