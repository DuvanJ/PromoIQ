import React from 'react';
import { theme } from '../../styles/theme';

// Estado vacío elegante para países sin datos cargados aún
const EmptyStateCountry = ({ pais, tema, onIrACargaInformacion }) => {
  const nombrePais = { GT: 'Guatemala', SV: 'El Salvador', CR: 'Costa Rica' }[pais] || pais;

  return (
    <div className="pd-stagger-item" style={styles.container}>
      <div style={{ ...styles.iconCircle, background: tema.gradient }} aria-hidden="true">
        <span style={styles.iconText}>{pais}</span>
      </div>
      <h2 style={styles.titulo}>Aún no hay datos para {nombrePais}</h2>
      <p style={styles.descripcion}>
        Este panel se activará automáticamente en cuanto se cargue el primer
        catálogo, dinámica o archivo de ventas para {nombrePais}.
      </p>
      {onIrACargaInformacion && (
        <button
          className="pd-pressable pd-hoverable"
          style={{ ...styles.boton, background: tema.primary }}
          onClick={onIrACargaInformacion}
        >
          Cargar información
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '64px 24px',
    minHeight: '360px',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    color: theme.color.textOnPrimary,
    fontWeight: theme.font.weight.semibold,
    fontSize: theme.font.size.md,
  },
  titulo: {
    fontSize: theme.font.size.display,
    fontWeight: theme.font.weight.semibold,
    margin: '0 0 8px',
    color: theme.color.text,
    fontFamily: theme.font.family,
  },
  descripcion: {
    fontSize: theme.font.size.md,
    color: theme.color.textMuted,
    maxWidth: 420,
    lineHeight: 1.5,
    margin: '0 0 24px',
    fontFamily: theme.font.family,
  },
  boton: {
    color: theme.color.textOnPrimary,
    border: 'none',
    borderRadius: theme.radius.sm,
    padding: '10px 24px',
    fontSize: theme.font.size.md,
    fontWeight: theme.font.weight.medium,
    cursor: 'pointer',
    fontFamily: theme.font.family,
  },
};

export default EmptyStateCountry;
