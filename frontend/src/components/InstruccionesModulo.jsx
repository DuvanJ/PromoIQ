// ============================================================
// Componente: InstruccionesModulo.jsx
// Descripción: Banner de orientación al inicio de cada vista,
// explicando en una o dos frases qué hace el módulo y cómo usarlo.
// Se puede cerrar — una vez cerrado, no vuelve a aparecer en esa
// sesión (se guarda en sessionStorage por el id del módulo).
// ============================================================

import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { theme } from '../styles/theme';

function InstruccionesModulo({ id, texto, tema }) {
  const clave = `promoiq_instrucciones_${id}`;
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(clave));

  if (!visible) return null;

  const cerrar = () => {
    sessionStorage.setItem(clave, '1');
    setVisible(false);
  };

  const color = tema?.primary || theme.color.primary;

  return (
    <div style={{ ...styles.banner, borderLeft: `4px solid ${color}` }}>
      <Info size={18} color={color} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
      <p style={styles.texto}>{texto}</p>
      <button
        className="pd-pressable"
        style={styles.cerrar}
        onClick={cerrar}
        aria-label="Cerrar instrucciones"
      >
        <X size={16} />
      </button>
    </div>
  );
}

const styles = {
  banner: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    background: theme.color.accentSoft, borderRadius: theme.radius.lg,
    padding: '14px 16px', marginBottom: '20px',
  },
  texto: {
    flex: 1, fontSize: theme.font.size.base, color: theme.color.text,
    lineHeight: '1.5', margin: 0,
  },
  cerrar: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: theme.color.textMuted, flexShrink: 0, padding: '2px',
  },
};

export default InstruccionesModulo;