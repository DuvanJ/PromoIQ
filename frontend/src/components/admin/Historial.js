import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

function Historial() {
  const [consultas, setConsultas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    cargarHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarHistorial = async () => {
    try {
      const res = await api.get('/admin/historial');
      setConsultas(res.data);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setCargando(false);
    }
  };

  const consultasFiltradas = consultas.filter(c =>
    c.pregunta?.toLowerCase().includes(filtro.toLowerCase()) ||
    c.usuario?.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalTokens = consultas.reduce((acc, c) => acc + (c.tokens || 0), 0);
  const costoEstimado = ((totalTokens * 0.000003)).toFixed(4);

  return (
    <div>
      <p style={styles.descripcion}>
        Registro completo de todas las consultas realizadas a la IA por los usuarios del sistema.
      </p>

      {/* Métricas rápidas */}
      <div style={styles.metricas}>
        {[
          { label: 'Total consultas', valor: consultas.length, icon: '💬', color: '#0077B6' },
          { label: 'Tokens usados', valor: totalTokens.toLocaleString(), icon: '⚡', color: '#06D6A0' },
          { label: 'Costo estimado', valor: `$${costoEstimado}`, icon: '💲', color: '#F9C74F' },
        ].map((m, i) => (
          <div key={i} style={styles.metricaCard}>
            <span style={styles.metricaIcon}>{m.icon}</span>
            <div>
              <p style={{ ...styles.metricaValor, color: m.color }}>{m.valor}</p>
              <p style={styles.metricaLabel}>{m.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={styles.buscadorRow}>
        <div style={styles.buscadorWrapper}>
          <span style={styles.buscadorIcon}>🔍</span>
          <input
            style={styles.buscador}
            type="text"
            placeholder="Buscar por usuario o pregunta..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <button style={styles.btnRefresh} onClick={cargarHistorial}>
          🔄 Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div style={styles.card}>
        {cargando ? (
          <div style={styles.sinDatos}>
            <span style={{ fontSize: '40px' }}>⏳</span>
            <p>Cargando historial...</p>
          </div>
        ) : consultasFiltradas.length === 0 ? (
          <div style={styles.sinDatos}>
            <span style={{ fontSize: '40px' }}>📭</span>
            <p>No hay consultas registradas</p>
          </div>
        ) : (
          <table style={styles.tabla}>
            <thead>
              <tr>
                {['#', 'Usuario', 'Pregunta', 'Tokens', 'Fecha', 'Ver'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {consultasFiltradas.map((c, i) => (
                <tr
                  key={i}
                  style={i % 2 === 0 ? styles.trPar : styles.trImpar}
                >
                  <td style={styles.td}>{c.id}</td>
                  <td style={styles.td}>
                    <div style={styles.usuarioCell}>
                      <div style={styles.avatar}>
                        {(c.usuario || 'U').charAt(0).toUpperCase()}
                      </div>
                      {c.usuario || 'Desconocido'}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {c.pregunta?.length > 60
                      ? c.pregunta.substring(0, 60) + '...'
                      : c.pregunta}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.tokenBadge}>{c.tokens || 0}</span>
                  </td>
                  <td style={styles.td}>
                    {new Date(c.fecha).toLocaleString('es-CR')}
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.btnVer}
                      onClick={() => setConsultaSeleccionada(c)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle */}
      {consultaSeleccionada && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitulo}>Detalle de consulta</h3>
              <button
                style={styles.modalClose}
                onClick={() => setConsultaSeleccionada(null)}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalInfo}>
              <span><strong>Usuario:</strong> {consultaSeleccionada.usuario}</span>
              <span><strong>Tokens:</strong> {consultaSeleccionada.tokens}</span>
              <span><strong>Fecha:</strong> {new Date(consultaSeleccionada.fecha).toLocaleString('es-CR')}</span>
            </div>

            <div style={styles.preguntaBox}>
              <p style={styles.boxLabel}>Pregunta</p>
              <p style={styles.preguntaTexto}>{consultaSeleccionada.pregunta}</p>
            </div>

            <div style={styles.respuestaBox}>
              <p style={styles.boxLabel}>Respuesta de la IA</p>
              <p style={styles.respuestaTexto}>{consultaSeleccionada.respuesta}</p>
            </div>

            <button
              style={styles.btnCerrar}
              onClick={() => setConsultaSeleccionada(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: {
    fontSize: '14px',
    color: '#8892A4',
    marginBottom: '20px',
  },
  metricas: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  metricaCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  metricaIcon: {
    fontSize: '32px',
  },
  metricaValor: {
    fontSize: '28px',
    fontWeight: '900',
    margin: 0,
    lineHeight: 1,
  },
  metricaLabel: {
    fontSize: '12px',
    color: '#8892A4',
    margin: '4px 0 0 0',
  },
  buscadorRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  buscadorWrapper: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  buscadorIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '16px',
  },
  buscador: {
    width: '100%',
    padding: '12px 12px 12px 44px',
    borderRadius: '10px',
    border: '1.5px solid #E2E8F0',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'Calibri, sans-serif',
    background: '#ffffff',
    boxSizing: 'border-box',
  },
  btnRefresh: {
    padding: '12px 20px',
    background: '#F4F7FB',
    border: '1px solid #E2E8F0',
    borderRadius: '10px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#1E2761',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  },
  card: {
    background: '#ffffff',
    borderRadius: '14px',
    padding: '0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  tabla: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '12px 16px',
    background: '#F4F7FB',
    color: '#1E2761',
    fontWeight: '700',
    textAlign: 'left',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '12px 16px',
    color: '#444',
    borderBottom: '1px solid #F4F7FB',
    verticalAlign: 'middle',
  },
  trPar: { background: '#ffffff' },
  trImpar: { background: '#FAFBFC' },
  usuarioCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: '#1E2761',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0,
  },
  tokenBadge: {
    background: '#EEF2FF',
    color: '#1E2761',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: '20px',
  },
  btnVer: {
    padding: '5px 12px',
    background: '#EEF2FF',
    border: 'none',
    borderRadius: '6px',
    color: '#1E2761',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  sinDatos: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#8892A4',
    fontSize: '14px',
    gap: '12px',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '32px',
    width: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitulo: {
    fontSize: '18px',
    fontWeight: '800',
    color: '#1E2761',
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#8892A4',
  },
  modalInfo: {
    display: 'flex',
    gap: '20px',
    background: '#F4F7FB',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#555',
    flexWrap: 'wrap',
  },
  preguntaBox: {
    background: '#EEF2FF',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '12px',
  },
  respuestaBox: {
    background: '#F0FDF4',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '20px',
  },
  boxLabel: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#8892A4',
    margin: '0 0 8px 0',
  },
  preguntaTexto: {
    fontSize: '14px',
    color: '#1E2761',
    fontWeight: '600',
    margin: 0,
  },
  respuestaTexto: {
    fontSize: '13px',
    color: '#333',
    lineHeight: '1.6',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  btnCerrar: {
    width: '100%',
    padding: '12px',
    background: '#1E2761',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
};

export default Historial;