// ============================================================
// Utilidad: moneda.js
// Descripción: Formatea montos según la moneda del país activo.
// Cada país ya carga sus datos en su propia moneda (colones,
// quetzales, dólares) — este helper solo decide cómo MOSTRARLO,
// no hace ninguna conversión entre monedas.
// ============================================================

export function formatoMoneda(valor, paisInfo) {
  const simbolo = paisInfo?.moneda_simbolo || '$';
  const monto = (valor || 0).toLocaleString('es-CR', { maximumFractionDigits: 0 });
  return `${simbolo}${monto}`;
}

export function formatoMonedaDecimales(valor, paisInfo) {
  const simbolo = paisInfo?.moneda_simbolo || '$';
  const monto = (valor || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${simbolo}${monto}`;
}