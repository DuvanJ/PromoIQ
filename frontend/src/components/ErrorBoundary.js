// ============================================================
// Componente: ErrorBoundary.js
// Descripción: Captura errores de renderizado de React
// Evita la pantalla blanca — muestra una pantalla de recuperación
// en vez de que la app entera desaparezca.
// ============================================================

import React from 'react';
import { theme } from '../styles/theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tieneError: false };
  }

  static getDerivedStateFromError() {
    return { tieneError: true };
  }

  componentDidCatch(error, info) {
    // Log para diagnóstico — visible en consola del navegador
    console.error('Error de renderizado capturado:', error, info);
  }

  handleReintentar = () => {
    this.setState({ tieneError: false });
  };

  handleVolverInicio = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.reload();
  };

  render() {
    if (this.state.tieneError) {
      return (
        <div style={styles.container}>
          <div
            className="pd-stagger-item"
            style={styles.card}
            role="alert"
            aria-labelledby="error-boundary-titulo"
          >
            <span style={styles.icono} aria-hidden="true">⚠️</span>
            <h2 id="error-boundary-titulo" style={styles.titulo}>Algo salió mal</h2>
            <p style={styles.mensaje}>
              PromoIQ encontró un error inesperado al mostrar esta pantalla.
              Podés intentar de nuevo o volver al inicio de sesión.
            </p>
            <div style={styles.botones}>
              <button className="pd-pressable" style={styles.btnReintentar} onClick={this.handleReintentar}>
                Reintentar
              </button>
              <button className="pd-pressable" style={styles.btnVolver} onClick={this.handleVolverInicio}>
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: theme.color.background, zIndex: 9998,
    fontFamily: theme.font.family,
  },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, padding: '40px',
    maxWidth: '420px', textAlign: 'center',
    boxShadow: theme.shadow.modal,
  },
  icono: { fontSize: '48px', display: 'block', marginBottom: '16px' },
  titulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: '0 0 8px 0' },
  mensaje: { fontSize: theme.font.size.md, color: theme.color.textSecondary, lineHeight: '1.6', margin: '0 0 24px 0' },
  botones: { display: 'flex', gap: '10px', justifyContent: 'center' },
  btnReintentar: {
    padding: '12px 24px', background: theme.color.gradient,
    color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md,
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer',
    fontFamily: theme.font.family,
  },
  btnVolver: {
    padding: '12px 24px', background: 'transparent',
    border: `1.5px solid ${theme.color.border}`, color: theme.color.textSecondary, borderRadius: theme.radius.md,
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, cursor: 'pointer',
    fontFamily: theme.font.family,
  },
};

export default ErrorBoundary;
