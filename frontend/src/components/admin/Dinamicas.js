import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

function Dinamicas() {
  const [dinamicas, setDinamicas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState(null);
  const [dinamicaSeleccionada, setDinamicaSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [filtroPais, setFiltroPais] = useState('');

  useEffect(() => {
    cargarDinamicas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDinamicas = async () => {
    setCargando(true);
    try {
      const res = await api.get('/admin/dinamicas');
      setDinamicas(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const abrirDetalle = async (d) => {
    setDinamicaSeleccionada(d);
    setDetalle(null);
    setCargandoDetalle(true);
    setModal('detalle');
    setFiltroPais('');
    try {
      const res = await api.get(`/admin/dinamicas/${d.id}/detalle`);
      setDetalle(res.data);
    } catch (err) {
      setError('Error cargando detalle');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const toggleDinamica = async (d) => {
    try {
      await api.put(`/admin/dinamicas/${d.id}/toggle`, {});
      cargarDinamicas();
      mostrarMensaje(`✅ Dinámica ${d.activa ? 'desactivada' : 'activada'} correctamente`);
    } catch (err) {
      mostrarMensaje('❌ Error actualizando dinámica');
    }
  };

  const eliminarDinamica = async () => {
    try {
      await api.delete(`/admin/dinamicas/${dinamicaSeleccionada.id}`);
      setModal(null);
      cargarDinamicas();
      mostrarMensaje('✅ Dinámica eliminada correctamente');
    } catch (err) {
      setError('Error eliminando dinámica');
    }
  };

  const mostrarMensaje = (msg) => {
    setMensaje(msg);
    setTimeout(() => setMensaje(''), 3000);
  };

  const dinamicasFiltradas = dinamicas.filter(d =>
    d.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  const articulosFiltrados = detalle?.articulos?.filter(a =>
    filtroPais ? a.pais === filtroPais : true
  ) || [];

  const diasRestantes = (fechaFin) => {
    const hoy = new Date();
    const fin = new Date(fechaFin);
    const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div>
      <p style={styles.descripcion}>
        Gestión de dinámicas comerciales. Podés ver el detalle, activar, desactivar y eliminar dinámicas.
      </p>

      {mensaje && <div style={styles.mensajeExito}>{mensaje}</div>}

      {/* Barra de acciones */}
      <div style={styles.accionesRow}>
        <div style={styles.buscadorWrapper}>
          <span style={styles.buscadorIcon}>🔍</span>
          <input
            style={styles.buscador}
            type="text"
            placeholder="Buscar dinámica..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <button style={styles.btnRefresh} onClick={cargarDinamicas}>
          🔄 Actualizar
        </button>
      </div>

      {/* Cards de dinámicas */}
      {cargando ? (
        <div style={styles.sinDatos}>
          <span style={{ fontSize: '40px' }}>⏳</span>
          <p>Cargando dinámicas...</p>
        </div>
      ) : dinamicasFiltradas.length === 0 ? (
        <div style={styles.sinDatos}>
          <span style={{ fontSize: '40px' }}>📦</span>
          <p>No hay dinámicas registradas</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {dinamicasFiltradas.map((d) => {
            const dias = diasRestantes(d.fecha_fin);
            const vencida = dias < 0;
            const proxima = dias <= 7 && dias >= 0;

            return (
              <div key={d.id} style={{
                ...styles.card,
                borderLeft: `4px solid ${d.activa ? '#06D6A0' : '#E2E8F0'}`
              }}>
                {/* Header de la card */}
                <div style={styles.cardHeader}>
                  <div style={styles.cardTituloWrapper}>
                    <h3 style={styles.cardTitulo}>{d.nombre}</h3>
                    <span style={d.activa ? styles.activaBadge : styles.inactivaBadge}>
                      {d.activa ? '● Activa' : '● Inactiva'}
                    </span>
                  </div>
                  {d.descripcion && (
                    <p style={styles.cardDescripcion}>{d.descripcion}</p>
                  )}
                </div>

                {/* Info */}
                <div style={styles.cardInfo}>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Inicio</span>
                    <span style={styles.infoValor}>
                      {new Date(d.fecha_inicio).toLocaleDateString('es-CR')}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Fin</span>
                    <span style={styles.infoValor}>
                      {new Date(d.fecha_fin).toLocaleDateString('es-CR')}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>Artículos</span>
                    <span style={{ ...styles.infoValor, fontWeight: '800', color: '#0077B6' }}>
                      {d.total_articulos}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>
                      {vencida ? 'Vencida' : 'Días restantes'}
                    </span>
                    <span style={{
                      ...styles.infoValor,
                      color: vencida ? '#B91C1C' : proxima ? '#B45309' : '#15803D',
                      fontWeight: '800'
                    }}>
                      {vencida ? 'Vencida' : `${dias} días`}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div style={styles.cardAcciones}>
                  <button style={styles.btnVer} onClick={() => abrirDetalle(d)}>
                    👁️ Ver detalle
                  </button>
                  <button
                    style={d.activa ? styles.btnDesactivar : styles.btnActivar}
                    onClick={() => toggleDinamica(d)}
                  >
                    {d.activa ? '⏸️ Desactivar' : '▶️ Activar'}
                  </button>
                  <button
                    style={styles.btnEliminar}
                    onClick={() => { setDinamicaSeleccionada(d); setModal('eliminar'); }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal detalle */}
      {modal === 'detalle' && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalGrande}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitulo}>📦 {dinamicaSeleccionada?.nombre}</h3>
                <p style={styles.modalSub}>
                  {new Date(dinamicaSeleccionada?.fecha_inicio).toLocaleDateString('es-CR')} →{' '}
                  {new Date(dinamicaSeleccionada?.fecha_fin).toLocaleDateString('es-CR')}
                </p>
              </div>
              <button style={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>

            {cargandoDetalle ? (
              <div style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }}>⏳</span>
                <p>Cargando artículos...</p>
              </div>
            ) : detalle && (
              <>
                {/* Resumen */}
                <div style={styles.resumenGrid}>
                  {[
                    { label: 'Total artículos', valor: detalle.articulos.length, color: '#0077B6' },
                    { label: 'CR', valor: detalle.articulos.filter(a => a.pais === 'CR').length, color: '#06D6A0' },
                    { label: 'GT', valor: detalle.articulos.filter(a => a.pais === 'GT').length, color: '#F9C74F' },
                    { label: 'SV', valor: detalle.articulos.filter(a => a.pais === 'SV').length, color: '#F96167' },
                  ].map((m, i) => (
                    <div key={i} style={styles.resumenCard}>
                      <p style={{ ...styles.resumenValor, color: m.color }}>{m.valor}</p>
                      <p style={styles.resumenLabel}>{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Filtro por país */}
                <div style={styles.filtroPaisRow}>
                  {['', 'CR', 'GT', 'SV'].map(p => (
                    <button
                      key={p}
                      style={{
                        ...styles.filtroPaisBtn,
                        ...(filtroPais === p ? styles.filtroPaisBtnActivo : {})
                      }}
                      onClick={() => setFiltroPais(p)}
                    >
                      {p === '' ? '🌎 Todos' : p === 'CR' ? '🇨🇷 CR' : p === 'GT' ? '🇬🇹 GT' : '🇸🇻 SV'}
                    </button>
                  ))}
                  <span style={styles.totalFiltrado}>
                    {articulosFiltrados.length} artículos
                  </span>
                </div>

                {/* Tabla de artículos */}
                <div style={styles.tablaWrapper}>
                  <table style={styles.tabla}>
                    <thead>
                      <tr>
                        {['Código', 'Descripción', 'Categoría', 'P. Regular', 'P. Dinámica', 'Ahorro', 'Ubicación', 'Tienda', 'País'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {articulosFiltrados.map((a, i) => (
                        <tr key={i} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                          <td style={styles.td}><strong>{a.codigo}</strong></td>
                          <td style={styles.td}>{a.descripcion}</td>
                          <td style={styles.td}>{a.categoria || '-'}</td>
                          <td style={styles.td}>${a.precio_regular?.toFixed(2)}</td>
                          <td style={{ ...styles.td, color: '#0077B6', fontWeight: '700' }}>
                            ${a.precio_dinamica?.toFixed(2)}
                          </td>
                          <td style={{ ...styles.td, color: '#15803D', fontWeight: '700' }}>
                            ${a.ahorro?.toFixed(2)}
                          </td>
                          <td style={styles.td}>{a.ubicacion || '-'}</td>
                          <td style={styles.td}>{a.tienda || '-'}</td>
                          <td style={styles.td}>
                            <span style={styles.paisBadge}>{a.pais}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={styles.btnCerrar} onClick={() => setModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {modal === 'eliminar' && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '420px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitulo}>🗑️ Eliminar Dinámica</h3>
              <button style={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={styles.eliminarBox}>
              <span style={{ fontSize: '48px' }}>⚠️</span>
              <p style={styles.eliminarTexto}>
                ¿Estás seguro que querés eliminar <strong>{dinamicaSeleccionada?.nombre}</strong>?
                Se eliminarán todos los artículos asociados. Esta acción no se puede deshacer.
              </p>
            </div>
            {error && <div style={styles.errorBox}>⚠️ {error}</div>}
            <div style={styles.modalBotones}>
              <button style={styles.btnEliminarConfirm} onClick={eliminarDinamica}>
                Sí, eliminar
              </button>
              <button style={styles.btnCancelar} onClick={() => setModal(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  descripcion: { fontSize: '14px', color: '#8892A4', marginBottom: '20px' },
  mensajeExito: {
    background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px',
    padding: '12px 16px', color: '#15803D', fontSize: '14px', fontWeight: '600', marginBottom: '16px',
  },
  accionesRow: { display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' },
  buscadorWrapper: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: '16px' },
  buscador: {
    width: '100%', padding: '12px 12px 12px 44px', borderRadius: '10px',
    border: '1.5px solid #E2E8F0', fontSize: '14px', outline: 'none',
    fontFamily: 'Calibri, sans-serif', background: '#ffffff', boxSizing: 'border-box',
  },
  btnRefresh: {
    padding: '12px 16px', background: '#F4F7FB', border: '1px solid #E2E8F0',
    borderRadius: '10px', fontSize: '13px', cursor: 'pointer', color: '#1E2761',
    fontWeight: '600', whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#ffffff', borderRadius: '14px',
    padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  cardHeader: { marginBottom: '16px' },
  cardTituloWrapper: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  cardTitulo: { fontSize: '16px', fontWeight: '800', color: '#1E2761', margin: 0, flex: 1 },
  cardDescripcion: { fontSize: '13px', color: '#8892A4', margin: 0 },
  activaBadge: {
    background: '#F0FDF4', color: '#15803D', fontSize: '11px',
    fontWeight: '700', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
  },
  inactivaBadge: {
    background: '#F4F7FB', color: '#8892A4', fontSize: '11px',
    fontWeight: '700', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
  },
  cardInfo: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px', marginBottom: '16px',
    background: '#F8FAFC', borderRadius: '10px', padding: '12px',
  },
  infoItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  infoLabel: { fontSize: '10px', color: '#8892A4', fontWeight: '700', textTransform: 'uppercase' },
  infoValor: { fontSize: '13px', color: '#333', fontWeight: '600' },
  cardAcciones: { display: 'flex', gap: '8px' },
  btnVer: {
    flex: 1, padding: '8px 12px', background: '#EEF2FF',
    border: '1px solid #C7D2FE', borderRadius: '8px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#1E2761',
  },
  btnActivar: {
    flex: 1, padding: '8px 12px', background: '#F0FDF4',
    border: '1px solid #BBF7D0', borderRadius: '8px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#15803D',
  },
  btnDesactivar: {
    flex: 1, padding: '8px 12px', background: '#FEF3C7',
    border: '1px solid #FCD34D', borderRadius: '8px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#92400E',
  },
  btnEliminar: {
    padding: '8px 12px', background: '#FFF0F0',
    border: '1px solid #FCA5A5', borderRadius: '8px',
    cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#B91C1C',
  },
  sinDatos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px', color: '#8892A4', fontSize: '14px', gap: '12px',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalGrande: {
    background: '#ffffff', borderRadius: '16px', padding: '32px',
    width: '90vw', maxWidth: '1000px', maxHeight: '85vh',
    overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modal: {
    background: '#ffffff', borderRadius: '16px', padding: '32px',
    width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: '20px',
  },
  modalTitulo: { fontSize: '18px', fontWeight: '800', color: '#1E2761', margin: 0 },
  modalSub: { fontSize: '13px', color: '#8892A4', margin: '4px 0 0 0' },
  modalClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8892A4' },
  resumenGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px', marginBottom: '16px',
  },
  resumenCard: {
    background: '#F4F7FB', borderRadius: '10px',
    padding: '14px', textAlign: 'center',
  },
  resumenValor: { fontSize: '28px', fontWeight: '900', margin: 0, lineHeight: 1 },
  resumenLabel: { fontSize: '12px', color: '#8892A4', margin: '4px 0 0 0' },
  filtroPaisRow: {
    display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px',
  },
  filtroPaisBtn: {
    padding: '6px 14px', background: '#F4F7FB', border: '1px solid #E2E8F0',
    borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#555',
  },
  filtroPaisBtnActivo: {
    background: '#1E2761', color: '#ffffff', border: '1px solid #1E2761',
  },
  totalFiltrado: { fontSize: '13px', color: '#8892A4', marginLeft: 'auto' },
  tablaWrapper: { overflow: 'auto', maxHeight: '400px' },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '10px 12px', background: '#F4F7FB', color: '#1E2761',
    fontWeight: '700', textAlign: 'left', fontSize: '11px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    position: 'sticky', top: 0,
  },
  td: { padding: '10px 12px', color: '#444', borderBottom: '1px solid #F4F7FB' },
  trPar: { background: '#ffffff' },
  trImpar: { background: '#FAFBFC' },
  paisBadge: {
    background: '#EEF2FF', color: '#1E2761', fontSize: '11px',
    fontWeight: '700', padding: '2px 8px', borderRadius: '20px',
  },
  modalBotones: { display: 'flex', gap: '12px', marginTop: '24px' },
  btnGuardar: {
    flex: 1, padding: '12px',
    background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  },
  btnCancelar: {
    flex: 1, padding: '12px', background: '#F4F7FB', color: '#8892A4',
    border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', cursor: 'pointer',
  },
  btnCerrar: {
    padding: '10px 24px', background: '#1E2761', color: '#ffffff',
    border: 'none', borderRadius: '10px', fontSize: '14px',
    fontWeight: '700', cursor: 'pointer',
  },
  eliminarBox: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', padding: '20px 0', gap: '16px',
  },
  eliminarTexto: { fontSize: '15px', color: '#555', lineHeight: '1.6' },
  btnEliminarConfirm: {
    flex: 1, padding: '12px', background: '#B91C1C', color: '#ffffff',
    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  },
  errorBox: {
    background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px',
    padding: '10px 14px', color: '#D32F2F', fontSize: '13px', marginTop: '16px',
  },
};

export default Dinamicas;