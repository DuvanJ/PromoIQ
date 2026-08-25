import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';

function Notificaciones() {
  const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
  const esSuperAdmin = usuarioActual.rol === 'superadmin';

  const [pais, setPais] = useState(''); // '' = todos los países (solo superadmin)
  const [diasLimite, setDiasLimite] = useState(7);

  const [paso, setPaso] = useState('configurar'); // 'configurar' | 'preview' | 'resultado'
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [preview, setPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);

  useEffect(() => {
    if (!esSuperAdmin) setPais(usuarioActual.pais || '');
    api.get('/paises')
      .then(res => setPaises(res.data))
      .catch(err => console.error('Error cargando catálogo de países:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Busca el label completo (bandera + nombre) para un código de país;
  // si el catálogo todavía no cargó o el código no existe, muestra el
  // código tal cual en vez de dejarlo vacío.
  const labelPais = (codigo) => {
    const encontrado = paises.find(p => p.codigo === codigo);
    return encontrado ? encontrado.label : codigo;
  };

  const cargarPreview = async () => {
    setCargandoPreview(true);
    setError('');
    try {
      const params = new URLSearchParams({ dias_limite: diasLimite });
      if (pais) params.append('pais', pais);
      const res = await api.get(`/notificaciones/dinamicas-vencer/preview?${params}`);
      setPreview(res.data);
      setPaso('preview');
    } catch (err) {
      setError('No se pudo cargar la previsualización.');
    } finally {
      setCargandoPreview(false);
    }
  };

  const enviarNotificaciones = async () => {
    setEnviando(true);
    setError('');
    try {
      const params = new URLSearchParams({ dias_limite: diasLimite });
      if (pais) params.append('pais', pais);
      const res = await api.post(`/notificaciones/dinamicas-vencer?${params}`, {});
      setResultado(res.data);
      setPaso('resultado');
    } catch (err) {
      setError('Error enviando las notificaciones. Intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const reiniciar = () => {
    setPaso('configurar');
    setPreview(null);
    setResultado(null);
    setError('');
  };

  return (
    <div>
      <p style={styles.descripcion}>
        Enviá alertas por correo a los usuarios sobre dinámicas comerciales próximas a vencer.
        Solo se notifica a quienes tienen su email corporativo confirmado.
      </p>

      {/* Indicador de pasos */}
      <div style={styles.pasos}>
        {[
          { id: 'configurar', num: 1, label: 'Configurar' },
          { id: 'preview', num: 2, label: 'Revisar destinatarios' },
          { id: 'resultado', num: 3, label: 'Confirmación' },
        ].map((p, i) => {
          const activo = paso === p.id;
          const completado =
            (p.id === 'configurar' && (paso === 'preview' || paso === 'resultado')) ||
            (p.id === 'preview' && paso === 'resultado');
          return (
            <div key={p.id} style={styles.pasoWrapper}>
              <div style={{
                ...styles.pasoCirculo,
                background: activo || completado ? theme.color.primary : theme.color.border,
                color: activo || completado ? theme.color.textOnPrimary : theme.color.textMuted,
              }}>
                {completado ? '✓' : p.num}
              </div>
              <span style={{
                ...styles.pasoLabel,
                color: activo || completado ? theme.color.primary : theme.color.textMuted,
                fontWeight: activo ? theme.font.weight.bold : theme.font.weight.regular,
              }}>
                {p.label}
              </span>
              {i < 2 && <div style={{ ...styles.pasoLinea, background: completado ? theme.color.primary : theme.color.border }} />}
            </div>
          );
        })}
      </div>

      {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

      {/* PASO 1: Configurar */}
      {paso === 'configurar' && (
        <div style={styles.card}>
          <h3 style={styles.cardTitulo}>⚙️ Configurar alerta</h3>

          {esSuperAdmin && (
            <div style={styles.campo}>
              <label htmlFor="notif-pais" style={styles.label}>País</label>
              <select
                id="notif-pais"
                className="pd-hoverable"
                style={styles.select}
                value={pais}
                onChange={(e) => setPais(e.target.value)}
              >
                <option value="">🌎 Todos los países</option>
                {paises.map(p => (
                  <option key={p.codigo} value={p.codigo}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.campo}>
            <label htmlFor="notif-dias" style={styles.label}>Notificar dinámicas que vencen en los próximos</label>
            <select
              id="notif-dias"
              className="pd-hoverable"
              style={styles.select}
              value={diasLimite}
              onChange={(e) => setDiasLimite(parseInt(e.target.value))}
            >
              <option value={3}>3 días</option>
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
            </select>
          </div>

          <button
            className="pd-pressable"
            style={{ ...styles.btnPrimario, opacity: cargandoPreview ? 0.7 : 1 }}
            onClick={cargarPreview}
            disabled={cargandoPreview}
          >
            {cargandoPreview ? '⏳ Cargando...' : '👀 Revisar antes de enviar'}
          </button>
        </div>
      )}

      {/* PASO 2: Preview */}
      {paso === 'preview' && preview && (
        <div>
          {preview.dinamicas.length === 0 ? (
            <div style={styles.sinDatosBox}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">✅</span>
              <p style={styles.sinDatosTexto}>No hay dinámicas por vencer en el período seleccionado.</p>
              <button className="pd-pressable" style={styles.btnSecundario} onClick={reiniciar}>← Volver</button>
            </div>
          ) : (
            <>
              <div className="pd-grid-2" style={{ marginBottom: '16px' }}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>📦 Dinámicas por vencer ({preview.dinamicas.length})</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {preview.dinamicas.map((d, i) => (
                      <div key={i} style={styles.dinamicaItem}>
                        <span style={styles.dinamicaNombre}>{d.nombre}</span>
                        <span style={{
                          ...styles.diasBadge,
                          background: d.dias <= 3 ? theme.color.errorBg : theme.color.warningBg,
                          color: d.dias <= 3 ? theme.color.error : theme.color.warning,
                        }}>
                          {d.dias} días · {d.articulos} arts.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>📧 Destinatarios ({preview.total_destinatarios})</h3>
                  {preview.destinatarios.length === 0 ? (
                    <p style={styles.sinDatos}>Ningún usuario tiene email confirmado en este alcance.</p>
                  ) : (
                    <div className="pd-table-scroll" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                      <table style={styles.tabla}>
                        <caption style={{ position: 'absolute', left: '-9999px' }}>Usuarios que recibirán la notificación</caption>
                        <thead>
                          <tr>
                            <th scope="col" style={styles.th}>Usuario</th>
                            <th scope="col" style={styles.th}>Email</th>
                            {esSuperAdmin && !pais && <th scope="col" style={styles.th}>País</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.destinatarios.map((d) => (
                            <tr key={d.id}>
                              <td style={styles.td}>{d.nombre}</td>
                              <td style={styles.td}>{d.email}</td>
                              {esSuperAdmin && !pais && <td style={styles.td}>{labelPais(d.pais)}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button className="pd-pressable" style={styles.btnSecundario} onClick={reiniciar}>← Volver</button>
                <button
                  className="pd-pressable"
                  style={{
                    ...styles.btnPrimario,
                    flex: '1 1 200px',
                    opacity: enviando || preview.total_destinatarios === 0 ? 0.7 : 1,
                    cursor: enviando || preview.total_destinatarios === 0 ? 'not-allowed' : 'pointer',
                  }}
                  onClick={enviarNotificaciones}
                  disabled={enviando || preview.total_destinatarios === 0}
                >
                  {enviando ? '📤 Enviando...' : `📤 Confirmar y enviar a ${preview.total_destinatarios} usuario${preview.total_destinatarios !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* PASO 3: Resultado */}
      {paso === 'resultado' && resultado && (
        <div style={styles.resultadoBox}>
          <span style={{ fontSize: '56px' }} aria-hidden="true">📤</span>
          <h2 style={styles.resultadoTitulo}>{resultado.mensaje}</h2>
          <p style={styles.resultadoSub}>
            Los envíos ocurren en segundo plano — revisá la consola del servidor para confirmar la entrega real de cada email.
          </p>
          <button className="pd-pressable" style={styles.btnPrimario} onClick={reiniciar}>
            Enviar otra notificación
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  pasos: { display: 'flex', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' },
  pasoWrapper: { display: 'flex', alignItems: 'center', gap: '8px' },
  pasoCirculo: { width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, flexShrink: 0 },
  pasoLabel: { fontSize: theme.font.size.base, whiteSpace: 'nowrap' },
  pasoLinea: { height: '2px', width: '40px', margin: '0 8px' },
  errorBox: { display: 'flex', alignItems: 'center', gap: '8px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm, padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginBottom: '16px' },
  card: { background: theme.color.surface, borderRadius: theme.radius.xl, padding: '20px', boxShadow: theme.shadow.sm, marginBottom: '16px' },
  cardTitulo: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.color.primary, margin: '0 0 16px 0' },
  campo: { marginBottom: '16px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  select: { width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, color: theme.color.text, background: theme.color.surfaceMuted, outline: 'none', boxSizing: 'border-box' },
  btnPrimario: { padding: '14px 24px', background: theme.color.gradient, color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, cursor: 'pointer', fontFamily: theme.font.family },
  btnSecundario: { padding: '14px 20px', background: theme.color.background, color: theme.color.primary, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.md, cursor: 'pointer', fontWeight: theme.font.weight.semibold },
  dinamicaItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: theme.color.surfaceMuted, borderRadius: theme.radius.sm, gap: '10px', flexWrap: 'wrap' },
  dinamicaNombre: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.color.text },
  diasBadge: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, whiteSpace: 'nowrap' },
  tabla: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, borderBottom: `2px solid ${theme.color.border}`, position: 'sticky', top: 0, background: theme.color.surface },
  td: { padding: '8px 10px', fontSize: theme.font.size.base, color: theme.color.text, borderBottom: `1px solid ${theme.color.background}` },
  sinDatos: { color: theme.color.textMuted, fontSize: theme.font.size.base },
  sinDatosBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px', background: theme.color.surface, borderRadius: theme.radius.xl, boxShadow: theme.shadow.sm },
  sinDatosTexto: { fontSize: theme.font.size.lg, color: theme.color.text, textAlign: 'center', margin: 0 },
  resultadoBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '48px', background: theme.color.surface, borderRadius: theme.radius.xl, boxShadow: theme.shadow.sm, textAlign: 'center' },
  resultadoTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: 0 },
  resultadoSub: { fontSize: theme.font.size.base, color: theme.color.textMuted, maxWidth: '480px', margin: '0 0 12px 0' },
};

export default Notificaciones;