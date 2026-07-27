import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

const ROLES = [
  { value: 'superadmin', label: 'Super Administrador' },
  { value: 'admin', label: 'Administrador' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'planning', label: 'Planning' },
  { value: 'tiendas', label: 'Tiendas' },
];

const PAISES = [
  { value: '', label: 'Todos los países' },
  { value: 'CR', label: '🇨🇷 Costa Rica' },
  { value: 'GT', label: '🇬🇹 Guatemala' },
  { value: 'SV', label: '🇸🇻 El Salvador' },
];

const colorRol = {
  superadmin: '#1E2761',
  admin:      '#0077B6',
  comercial:  '#06847A',
  planning:   '#B45309',
  tiendas:    '#B91C1C',
};

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [form, setForm] = useState({
    nombre: '', email: '', password: '',
    rol_codigo: 'comercial', pais: 'CR'
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    cargarUsuarios();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const res = await api.get('/admin/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setCargando(false);
    }
  };

  const abrirCrear = () => {
    setForm({ nombre: '', email: '', password: '', rol_codigo: 'comercial', pais: 'CR' });
    setError('');
    setModal('crear');
  };

  const abrirVer = (u) => {
    setUsuarioSeleccionado(u);
    setModal('ver');
  };

  const abrirEditar = (u) => {
    setUsuarioSeleccionado(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol_codigo: u.rol_codigo, pais: u.pais || '' });
    setError('');
    setModal('editar');
  };

  const abrirEliminar = (u) => {
    setUsuarioSeleccionado(u);
    setError('');
    setModal('eliminar');
  };

  const cerrarModal = () => {
    setModal(null);
    setUsuarioSeleccionado(null);
    setError('');
  };

  const mostrarMensaje = (msg) => {
    setMensaje(msg);
    setTimeout(() => setMensaje(''), 3000);
  };

  const handleCrear = async () => {
    try {
      await api.post(
        `/admin/usuarios/crear?nombre=${encodeURIComponent(form.nombre)}&email=${encodeURIComponent(form.email)}&password=${encodeURIComponent(form.password)}&rol_codigo=${form.rol_codigo}&pais=${form.pais}&tiendas=`,
        {}
      );
      cerrarModal();
      cargarUsuarios();
      mostrarMensaje('✅ Usuario creado correctamente');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error creando usuario');
    }
  };

  const handleEditar = async () => {
    try {
      await api.put(
        `/admin/usuarios/${usuarioSeleccionado.id}?nombre=${encodeURIComponent(form.nombre)}&email=${encodeURIComponent(form.email)}&rol_codigo=${form.rol_codigo}&pais=${form.pais}&tiendas=&activo=${usuarioSeleccionado.activo}`,
        {}
      );
      cerrarModal();
      cargarUsuarios();
      mostrarMensaje('✅ Usuario actualizado correctamente');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error editando usuario');
    }
  };

  const handleEliminar = async () => {
    try {
      await api.delete(`/admin/usuarios/${usuarioSeleccionado.id}`);
      cerrarModal();
      cargarUsuarios();
      mostrarMensaje('✅ Usuario desactivado correctamente');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error eliminando usuario');
    }
  };

  const usuariosFiltrados = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    u.email?.toLowerCase().includes(filtro.toLowerCase()) ||
    u.rol_nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div>
      <p style={styles.descripcion}>
        Gestión completa de usuarios del sistema.
      </p>

      {mensaje && <div style={styles.mensajeExito}>{mensaje}</div>}

      <div style={styles.accionesRow}>
        <div style={styles.buscadorWrapper}>
          <span style={styles.buscadorIcon}>🔍</span>
          <input
            style={styles.buscador}
            type="text"
            placeholder="Buscar por nombre, email o rol..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <button style={styles.btnRefresh} onClick={cargarUsuarios}>🔄 Actualizar</button>
        <button style={styles.btnCrear} onClick={abrirCrear}>+ Nuevo usuario</button>
      </div>

      <div style={styles.card}>
        {cargando ? (
          <div style={styles.sinDatos}><span style={{ fontSize: '40px' }}>⏳</span><p>Cargando usuarios...</p></div>
        ) : usuariosFiltrados.length === 0 ? (
          <div style={styles.sinDatos}><span style={{ fontSize: '40px' }}>👥</span><p>No hay usuarios</p></div>
        ) : (
          <table style={styles.tabla}>
            <thead>
              <tr>
                {['Usuario', 'Email', 'Rol', 'País', 'Estado', 'Último acceso', 'Acciones'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u, i) => (
                <tr key={u.id} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                  <td style={styles.td}>
                    <div style={styles.usuarioCell}>
                      <div style={{ ...styles.avatar, background: colorRol[u.rol_codigo] || '#1E2761' }}>
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      <span style={styles.usuarioNombre}>{u.nombre}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.rolBadge,
                      background: (colorRol[u.rol_codigo] || '#1E2761') + '18',
                      color: colorRol[u.rol_codigo] || '#1E2761',
                      border: `1px solid ${colorRol[u.rol_codigo] || '#1E2761'}40`
                    }}>
                      {u.rol_nombre}
                    </span>
                  </td>
                  <td style={styles.td}>{u.pais || 'Todos'}</td>
                  <td style={styles.td}>
                    <span style={u.activo ? styles.activoBadge : styles.inactivoBadge}>
                      {u.activo ? '● Activo' : '● Inactivo'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {u.ultimo_acceso && u.ultimo_acceso !== 'None'
                      ? new Date(u.ultimo_acceso).toLocaleString('es-CR')
                      : 'Nunca'}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.acciones}>
                      <button style={styles.btnVer} onClick={() => abrirVer(u)}>
                        👁️ Ver
                      </button>
                      <button style={styles.btnEditar} onClick={() => abrirEditar(u)}>
                        ✏️ Editar
                      </button>
                      <button style={styles.btnEliminar} onClick={() => abrirEliminar(u)}>
                        🗑️ Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Ver */}
      {modal === 'ver' && usuarioSeleccionado && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '460px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitulo}>👁️ Detalle de Usuario</h3>
              <button style={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>

            <div style={styles.verAvatar}>
              <div style={{
                ...styles.verAvatarCircle,
                background: colorRol[usuarioSeleccionado.rol_codigo] || '#1E2761'
              }}>
                {usuarioSeleccionado.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={styles.verNombre}>{usuarioSeleccionado.nombre}</p>
                <span style={{
                  ...styles.rolBadge,
                  background: (colorRol[usuarioSeleccionado.rol_codigo] || '#1E2761') + '18',
                  color: colorRol[usuarioSeleccionado.rol_codigo] || '#1E2761',
                  border: `1px solid ${colorRol[usuarioSeleccionado.rol_codigo] || '#1E2761'}40`
                }}>
                  {usuarioSeleccionado.rol_nombre}
                </span>
              </div>
            </div>

            <div style={styles.verGrid}>
              {[
                { label: 'Email', valor: usuarioSeleccionado.email },
                { label: 'País', valor: usuarioSeleccionado.pais || 'Todos' },
                { label: 'Estado', valor: usuarioSeleccionado.activo ? 'Activo' : 'Inactivo' },
                { label: 'Creado', valor: new Date(usuarioSeleccionado.creado_en).toLocaleDateString('es-CR') },
                { label: 'Último acceso', valor: usuarioSeleccionado.ultimo_acceso && usuarioSeleccionado.ultimo_acceso !== 'None' ? new Date(usuarioSeleccionado.ultimo_acceso).toLocaleString('es-CR') : 'Nunca' },
              ].map((item, i) => (
                <div key={i} style={styles.verItem}>
                  <p style={styles.verLabel}>{item.label}</p>
                  <p style={styles.verValor}>{item.valor}</p>
                </div>
              ))}
            </div>

            <div style={styles.modalBotones}>
              <button style={styles.btnGuardar} onClick={() => { cerrarModal(); abrirEditar(usuarioSeleccionado); }}>
                ✏️ Editar usuario
              </button>
              <button style={styles.btnCancelar} onClick={cerrarModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar */}
      {(modal === 'crear' || modal === 'editar') && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitulo}>
                {modal === 'crear' ? '➕ Nuevo Usuario' : '✏️ Editar Usuario'}
              </h3>
              <button style={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.campo}>
                <label style={styles.label}>Nombre</label>
                <input style={styles.input} type="text" placeholder="Nombre completo"
                  value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div style={styles.campo}>
                <label style={styles.label}>Email</label>
                <input style={styles.input} type="email" placeholder="correo@empresa.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              {modal === 'crear' && (
                <div style={styles.campo}>
                  <label style={styles.label}>Contraseña</label>
                  <input style={styles.input} type="password" placeholder="••••••••"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              )}
              <div style={styles.campo}>
                <label style={styles.label}>Rol</label>
                <select style={styles.select} value={form.rol_codigo}
                  onChange={(e) => setForm({ ...form, rol_codigo: e.target.value })}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                <select style={styles.select} value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}>
                  {PAISES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {error && <div style={styles.errorBox}>⚠️ {error}</div>}

            <div style={styles.modalBotones}>
              <button style={styles.btnGuardar} onClick={modal === 'crear' ? handleCrear : handleEditar}>
                {modal === 'crear' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
              <button style={styles.btnCancelar} onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {modal === 'eliminar' && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '420px' }}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitulo}>🗑️ Desactivar Usuario</h3>
              <button style={styles.modalClose} onClick={cerrarModal}>✕</button>
            </div>
            <div style={styles.eliminarBox}>
              <span style={{ fontSize: '48px' }}>⚠️</span>
              <p style={styles.eliminarTexto}>
                ¿Estás seguro que querés desactivar a <strong>{usuarioSeleccionado?.nombre}</strong>?
                El usuario no podrá ingresar al sistema.
              </p>
            </div>
            {error && <div style={styles.errorBox}>⚠️ {error}</div>}
            <div style={styles.modalBotones}>
              <button style={styles.btnEliminarConfirm} onClick={handleEliminar}>Sí, desactivar</button>
              <button style={styles.btnCancelar} onClick={cerrarModal}>Cancelar</button>
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
  accionesRow: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' },
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
  btnCrear: {
    padding: '12px 20px', background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  card: {
    background: '#ffffff', borderRadius: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    padding: '12px 16px', background: '#F4F7FB', color: '#1E2761',
    fontWeight: '700', textAlign: 'left', fontSize: '12px',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  td: { padding: '12px 16px', color: '#444', borderBottom: '1px solid #F4F7FB', verticalAlign: 'middle' },
  trPar: { background: '#ffffff' },
  trImpar: { background: '#FAFBFC' },
  usuarioCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%', color: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: '700', flexShrink: 0,
  },
  usuarioNombre: { fontWeight: '600', color: '#1E2761' },
  rolBadge: { fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', display: 'inline-block' },
  activoBadge: { background: '#F0FDF4', color: '#15803D', fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' },
  inactivoBadge: { background: '#FFF0F0', color: '#B91C1C', fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' },
  acciones: { display: 'flex', gap: '6px' },
  btnVer: {
    padding: '6px 12px', background: '#F0FDF4', border: '1px solid #BBF7D0',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#15803D',
  },
  btnEditar: {
    padding: '6px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#1E2761',
  },
  btnEliminar: {
    padding: '6px 12px', background: '#FFF0F0', border: '1px solid #FCA5A5',
    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#B91C1C',
  },
  sinDatos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px', color: '#8892A4', fontSize: '14px', gap: '12px',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#ffffff', borderRadius: '16px', padding: '32px',
    width: '560px', maxHeight: '85vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  modalTitulo: { fontSize: '18px', fontWeight: '800', color: '#1E2761', margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8892A4' },
  verAvatar: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
  verAvatarCircle: {
    width: '56px', height: '56px', borderRadius: '50%', color: '#ffffff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', fontWeight: '900', flexShrink: 0,
  },
  verNombre: { fontSize: '18px', fontWeight: '800', color: '#1E2761', margin: '0 0 6px 0' },
  verGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' },
  verItem: { background: '#F4F7FB', borderRadius: '8px', padding: '12px' },
  verLabel: { fontSize: '11px', fontWeight: '700', color: '#8892A4', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' },
  verValor: { fontSize: '14px', fontWeight: '600', color: '#1E2761', margin: 0 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  campo: { marginBottom: '4px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: '#1E2761', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Calibri, sans-serif', background: '#F8FAFC',
  },
  select: {
    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E2E8F0',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#F8FAFC', color: '#333',
  },
  errorBox: {
    background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px',
    padding: '10px 14px', color: '#D32F2F', fontSize: '13px', marginTop: '16px',
  },
  modalBotones: { display: 'flex', gap: '12px', marginTop: '24px' },
  btnGuardar: {
    flex: 1, padding: '12px', background: 'linear-gradient(135deg, #1E2761 0%, #0077B6 100%)',
    color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  },
  btnCancelar: {
    flex: 1, padding: '12px', background: '#F4F7FB', color: '#8892A4',
    border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '14px', cursor: 'pointer',
  },
  eliminarBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 0', gap: '16px' },
  eliminarTexto: { fontSize: '15px', color: '#555', lineHeight: '1.6' },
  btnEliminarConfirm: {
    flex: 1, padding: '12px', background: '#B91C1C', color: '#ffffff',
    border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  },
  modalSub: { fontSize: '14px', color: '#8892A4', marginBottom: '20px' },
};

export default Usuarios;