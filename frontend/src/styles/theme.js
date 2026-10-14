// ============================================================
// theme.js
// Puente entre los tokens definidos en GlobalStyles.css (:root)
// y los estilos inline que ya usan los componentes del proyecto
// (style={{ ...styles.algo }}).
//
// Fuente de verdad única: si cambia un color, tiempo o radio,
// se edita en GlobalStyles.css y automáticamente se refleja acá,
// porque son las mismas variables CSS (var(--token)).
//
// Uso en un componente:
//   import { theme } from '../../styles/theme';
//   background: theme.color.primary
//   borderRadius: theme.radius.lg
//   transition: `transform ${theme.motion.duration.instant} ${theme.motion.easing.out}`
// ============================================================

export const theme = {
  color: {
    primary: 'var(--color-primary)',
    primaryLight: 'var(--color-primary-light)',
    accent: 'var(--color-accent)',
    gradient: 'var(--gradient-brand)',

    surface: 'var(--color-surface)',
    surfaceMuted: 'var(--color-surface-muted)',
    background: 'var(--color-background)',
    border: 'var(--color-border)',

    text: 'var(--color-text)',
    textSecondary: 'var(--color-text-secondary)',
    textMuted: 'var(--color-text-muted)',
    textOnPrimary: 'var(--color-text-on-primary)',

    success: 'var(--color-success)',
    successBg: 'var(--color-success-bg)',
    successBorder: 'var(--color-success-border)',
    successStrong: 'var(--color-success-strong)',
    error: 'var(--color-error)',
    errorBg: 'var(--color-error-bg)',

warning: 'var(--color-warning)',
warningBg: 'var(--color-warning-bg)',
warningBorder: 'var(--color-warning-border)',
errorBorder: 'var(--color-error-border)',
accentSoft: 'var(--color-accent-soft)',
accentSoftBorder: 'var(--color-accent-soft-border)',
successAccent: 'var(--color-success-accent)',
dropBorder: 'var(--color-drop-border)',


warningSoftBg: 'var(--color-warning-soft-bg)',
warningSoftBorder: 'var(--color-warning-soft-border)',
warningStrong: 'var(--color-warning-strong)',
errorSoftBorder: 'var(--color-error-soft-border)',
chart3: 'var(--color-chart-3)',



reportA: 'var(--color-report-a)',
reportBBg: 'var(--color-report-b-bg)',
reportBBorder: 'var(--color-report-b-border)',

chart4: 'var(--color-chart-4)',

countryCrStart: 'var(--color-country-cr-start)',
countryCrEnd: 'var(--color-country-cr-end)',
countryGtStart: 'var(--color-country-gt-start)',
countryGtEnd: 'var(--color-country-gt-end)',
countrySvStart: 'var(--color-country-sv-start)',
countrySvEnd: 'var(--color-country-sv-end)',

countrySvAccent: 'var(--color-country-sv-accent)',

loginBackdrop: 'var(--color-login-backdrop)',



  },

  font: {
    family: 'var(--font-family)',
    // Los tamaños quedan como números (no como var()) porque se
    // usan casi siempre con "px" concatenado o en cálculos.
    size: { xs: 10, sm: 11, base: 13, md: 14, lg: 15, xl: 16, xxl: 18, display: 20, hero: 36 },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
  },

  space: {
    xs: 'var(--space-xs)',
    sm: 'var(--space-sm)',
    md: 'var(--space-md)',
    lg: 'var(--space-lg)',
    xl: 'var(--space-xl)',
    xxl: 'var(--space-xxl)',
    xxxl: 'var(--space-xxxl)',
  },

  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    xxl: 'var(--radius-xxl)',
    pill: 'var(--radius-pill)',
    round: '50%',
  },

  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    header: 'var(--shadow-header)',
    floating: 'var(--shadow-floating)',
    modal: 'var(--shadow-modal)',
  },

  // Movimiento: usar SIEMPRE estos valores en vez de inventar
  // duraciones/curvas nuevas por componente. Ver GlobalStyles.css
  // para la justificación de cada uno (filosofía "Operate": rápido
  // y consistente, nada de rebote excesivo en una herramienta que
  // se usa muchas veces al día).
  motion: {
    duration: {
      instant: 'var(--dur-instant)',   // 120ms — presión de botón
      fast: 'var(--dur-fast)',         // 150ms — hover, color
      base: 'var(--dur-base)',         // 200ms — dropdowns, listas
      modalIn: 'var(--dur-modal-in)',  // 280ms — apertura de modal
      modalOut: 'var(--dur-modal-out)',// 180ms — cierre de modal
    },
    easing: {
      out: 'var(--ease-out)',
      inOut: 'var(--ease-in-out)',
      hover: 'var(--ease-hover)',
      linear: 'var(--ease-linear)',
    },
    stagger: 'var(--stagger)', // 40ms entre ítems de una lista
  },
};

export default theme;
