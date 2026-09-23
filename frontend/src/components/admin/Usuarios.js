import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { theme } from '../../styles/theme';
import InstruccionesModulo from '../InstruccionesModulo';

const ROLES = [
  { value: 'superadmin', label: 'Super Administrador' },
  { value: 'admin', label: 'Administrador' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'planning', label: 'Planning' },
  { value: 'tiendas', label: 'Tiendas' },
];

const colorRol = {
  superadmin: theme.color.primary,
  admin:      theme.color.accent,
  comercial:  theme.color.successStrong,
  planning:   theme.color.warning,
  tiendas:    theme.color.error,
};

function Usuarios() {
  const usuarioActual = JSON.parse(localStorage.getItem('usuario') || '{}');
  const esSuperAdmin = usuarioActual.rol === 'superadmin';

  const [tabActiva, setTabActiva] = useState('usuarios'); // 'usuarios' | 'tiendas' | 'paises'

  // ── Usuarios ─────────────────────────────────────────
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [modal, setModal] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [form, setForm] = useState({
    nombre: '', email: '', password: '',
    rol_codigo: 'comercial', pais: '', numero_colaborador: ''
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const mensajeTimerRef = useRef(null);

  // ── Catálogo de países — dinámico, viene de /paises ────
  const [paises, setPaises] = useState([]);
  const [cargandoPaises, setCargandoPaises] = useState(true);

  // ── Gestión de países (CRUD) ───────────────────────────
  const [modalPais, setModalPais] = useState(null); // 'crear' | 'editar' | 'eliminar'
  const [paisSeleccionado, setPaisSeleccionado] = useState(null);
  const [formPais, setFormPais] = useState({
    codigo: '', nombre: '', bandera_emoji: '',
    color_primario: '#1E2761', color_secundario: '#0077B6',
    moneda_simbolo: '$', moneda_codigo: 'USD'
  });
  const [errorPais, setErrorPais] = useState('');
  const [procesandoPais, setProcesandoPais] = useState(false);

  // ── Gestión de tiendas (CRUD) ──────────────────────────
  // Admin siempre gestiona las de su propio país (fijo, sin selector).
  // Superadmin elige qué país gestionar con el selector de arriba.
  const [tiendas, setTiendas] = useState([]);
  const [cargandoTiendas, setCargandoTiendas] = useState(true);
  const [paisTiendas, setPaisTiendas] = useState(usuarioActual.pais || '');
  const [modalTienda, setModalTienda] = useState(null); // 'crear' | 'editar' | 'eliminar'
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(null);
  const [formTienda, setFormTienda] = useState({ codigo: '', nombre: '', pais: '' });
  const [errorTienda, setErrorTienda] = useState('');
  const [procesandoTienda, setProcesandoTienda] = useState(false);

  // Paleta de colores predefinida — más amigable que escribir hex a mano
  const PALETA_COLORES = [
    '#002B7F', '#CE1126', '#1A6DB5', '#4997D0', '#0F47AF', '#F0C010',
    '#1E2761', '#0077B6', '#06847A', '#B45309', '#7C3AED', '#DB2777',
  ];

  useEffect(() => {
    cargarUsuarios();
    cargarPaises();
    return () => clearTimeout(mensajeTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tabActiva === 'tiendas') cargarTiendas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabActiva, paisTiendas]);

  // Cierra el modal abierto con Escape
  useEffect(() => {
    if (!modal && !modalPais && !modalTienda) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modal) cerrarModal();
        if (modalPais) cerrarModalPais();
        if (modalTienda) cerrarModalTienda();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, modalPais, modalTienda]);

  const cargarPaises = async () => {
    setCargandoPaises(true);
    try {
      const res = await api.get('/paises');
      setPaises(res.data);
      if (res.data.length > 0) {
        setForm(prev => ({ ...prev, pais: prev.pais || res.data[0].codigo }));
        // Superadmin arranca gestionando el primer país del catálogo
        // hasta que elija otro con el selector.
        setPaisTiendas(prev => prev || res.data[0].codigo);
      }
    } catch (err) {
      console.error('Error cargando catálogo de países:', err);
    } finally {
      setCargandoPaises(false);
    }
  };

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
    setForm({ nombre: '', email: '', password: '', rol_codigo: 'comercial', pais: paises[0]?.codigo || '', numero_colaborador: '' });
    setError('');
    setModal('crear');
  };

  const abrirVer = (u) => {
    setUsuarioSeleccionado(u);
    setModal('ver');
  };

  const abrirEditar = (u) => {
    setUsuarioSeleccionado(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol_codigo: u.rol_codigo, pais: u.pais || '', numero_colaborador: u.numero_colaborador || '' });
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
    clearTimeout(mensajeTimerRef.current);
    mensajeTimerRef.current = setTimeout(() => setMensaje(''), 3000);
  };

  const handleCrear = async () => {
    if (procesando) return;

    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim()) {
      setError('Nombre, email y contraseña son obligatorios');
      return;
    }
    if (form.rol_codigo !== 'tiendas' && !form.numero_colaborador.trim()) {
      setError('El número de colaborador es obligatorio para este rol');
      return;
    }

    setProcesando(true);
    try {
      await api.post(
        `/admin/usuarios/crear?nombre=${encodeURIComponent(form.nombre)}&email=${encodeURIComponent(form.email)}&password=${encodeURIComponent(form.password)}&rol_codigo=${form.rol_codigo}&pais=${form.pais}&tiendas=&numero_colaborador=${encodeURIComponent(form.numero_colaborador)}`,
        {}
      );
      cerrarModal();
      cargarUsuarios();
      mostrarMensaje('✅ Usuario creado correctamente');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error creando usuario');
    } finally {
      setProcesando(false);
    }
  };

  const handleEditar = async () => {
    if (procesando) return;
    setProcesando(true);
    try {
      await api.put(
        `/admin/usuarios/${usuarioSeleccionado.id}?nombre=${encodeURIComponent(form.nombre)}&email=${encodeURIComponent(form.email)}&rol_codigo=${form.rol_codigo}&pais=${form.pais}&tiendas=&activo=${usuarioSeleccionado.activo}&numero_colaborador=${encodeURIComponent(form.numero_colaborador)}`,
        {}
      );
      cerrarModal();
      cargarUsuarios();
      mostrarMensaje('✅ Usuario actualizado correctamente');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error editando usuario');
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminar = async () => {
    if (procesando) return;
    setProcesando(true);
    try {
      await api.delete(`/admin/usuarios/${usuarioSeleccionado.id}`);
      cerrarModal();
      cargarUsuarios();
      mostrarMensaje('✅ Usuario desactivado correctamente');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error eliminando usuario');
    } finally {
      setProcesando(false);
    }
  };

  // ── Gestión de países (CRUD) ───────────────────────────
  const abrirCrearPais = () => {
    setFormPais({
      codigo: '', nombre: '', bandera_emoji: '',
      color_primario: PALETA_COLORES[0], color_secundario: PALETA_COLORES[1],
      moneda_simbolo: '$', moneda_codigo: 'USD'
    });
    setErrorPais('');
    setModalPais('crear');
  };

  const abrirEditarPais = (p) => {
    setPaisSeleccionado(p);
    setFormPais({
      codigo: p.codigo, nombre: p.nombre, bandera_emoji: p.bandera === '🏳️' ? '' : p.bandera,
      color_primario: p.color_primario, color_secundario: p.color_secundario,
      moneda_simbolo: p.moneda_simbolo || '$', moneda_codigo: p.moneda_codigo || 'USD'
    });
    setErrorPais('');
    setModalPais('editar');
  };

  const abrirEliminarPais = (p) => {
    setPaisSeleccionado(p);
    setErrorPais('');
    setModalPais('eliminar');
  };

  const cerrarModalPais = () => {
    setModalPais(null);
    setPaisSeleccionado(null);
    setErrorPais('');
  };

  const handleCrearPais = async () => {
    if (procesandoPais) return;
    if (!formPais.codigo.trim() || !formPais.nombre.trim()) {
      setErrorPais('El código y el nombre son obligatorios');
      return;
    }
    if (!formPais.moneda_simbolo.trim() || !formPais.moneda_codigo.trim()) {
      setErrorPais('El símbolo y el código de moneda son obligatorios');
      return;
    }
    setProcesandoPais(true);
    try {
      await api.post('/paises', formPais);
      cerrarModalPais();
      cargarPaises();
      mostrarMensaje('✅ País creado correctamente');
    } catch (err) {
      setErrorPais(err.response?.data?.detail || 'Error creando país');
    } finally {
      setProcesandoPais(false);
    }
  };

  const handleEditarPais = async () => {
    if (procesandoPais) return;
    setProcesandoPais(true);
    try {
      await api.put(`/paises/${paisSeleccionado.codigo}`, formPais);
      cerrarModalPais();
      cargarPaises();
      mostrarMensaje('✅ País actualizado correctamente');
    } catch (err) {
      setErrorPais(err.response?.data?.detail || 'Error editando país');
    } finally {
      setProcesandoPais(false);
    }
  };

  const handleEliminarPais = async () => {
    if (procesandoPais) return;
    setProcesandoPais(true);
    try {
      await api.delete(`/paises/${paisSeleccionado.codigo}`);
      cerrarModalPais();
      cargarPaises();
      mostrarMensaje('✅ País desactivado correctamente');
    } catch (err) {
      setErrorPais(err.response?.data?.detail || 'Error desactivando país');
    } finally {
      setProcesandoPais(false);
    }
  };

  // ── Gestión de tiendas (CRUD) ───────────────────────────
  const cargarTiendas = async () => {
    setCargandoTiendas(true);
    try {
      const paisConsulta = esSuperAdmin ? paisTiendas : usuarioActual.pais;
      const params = paisConsulta ? `?pais=${paisConsulta}` : '';
      const res = await api.get(`/tiendas${params}`);
      setTiendas(res.data);
    } catch (err) {
      console.error('Error cargando tiendas:', err);
    } finally {
      setCargandoTiendas(false);
    }
  };

  const abrirCrearTienda = () => {
    setFormTienda({ codigo: '', nombre: '', pais: esSuperAdmin ? paisTiendas : usuarioActual.pais });
    setErrorTienda('');
    setModalTienda('crear');
  };

  const abrirEditarTienda = (t) => {
    setTiendaSeleccionada(t);
    setFormTienda({ codigo: t.codigo, nombre: t.nombre, pais: t.pais });
    setErrorTienda('');
    setModalTienda('editar');
  };

  const abrirEliminarTienda = (t) => {
    setTiendaSeleccionada(t);
    setErrorTienda('');
    setModalTienda('eliminar');
  };

  const cerrarModalTienda = () => {
    setModalTienda(null);
    setTiendaSeleccionada(null);
    setErrorTienda('');
  };

  const handleCrearTienda = async () => {
    if (procesandoTienda) return;
    if (!formTienda.codigo.trim() || !formTienda.nombre.trim()) {
      setErrorTienda('El código y el nombre son obligatorios');
      return;
    }
    setProcesandoTienda(true);
    try {
      await api.post('/tiendas', formTienda);
      cerrarModalTienda();
      cargarTiendas();
      mostrarMensaje('✅ Tienda creada correctamente');
    } catch (err) {
      setErrorTienda(err.response?.data?.detail || 'Error creando tienda');
    } finally {
      setProcesandoTienda(false);
    }
  };

  const handleEditarTienda = async () => {
    if (procesandoTienda) return;
    setProcesandoTienda(true);
    try {
      await api.put(`/tiendas/${tiendaSeleccionada.id}`, formTienda);
      cerrarModalTienda();
      cargarTiendas();
      mostrarMensaje('✅ Tienda actualizada correctamente');
    } catch (err) {
      setErrorTienda(err.response?.data?.detail || 'Error editando tienda');
    } finally {
      setProcesandoTienda(false);
    }
  };

  const handleEliminarTienda = async () => {
    if (procesandoTienda) return;
    setProcesandoTienda(true);
    try {
      await api.delete(`/tiendas/${tiendaSeleccionada.id}`);
      cerrarModalTienda();
      cargarTiendas();
      mostrarMensaje('✅ Tienda desactivada correctamente');
    } catch (err) {
      setErrorTienda(err.response?.data?.detail || 'Error desactivando tienda');
    } finally {
      setProcesandoTienda(false);
    }
  };

  const usuariosFiltrados = usuarios.filter(u => {
    const coincideTexto =
      u.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
      u.email?.toLowerCase().includes(filtro.toLowerCase()) ||
      u.rol_nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
      u.numero_colaborador?.toLowerCase().includes(filtro.toLowerCase());
    const coincideRol = !filtroRol || u.rol_codigo === filtroRol;
    return coincideTexto && coincideRol;
  });

  // Busca el label completo (bandera + nombre) de un código de país
  const labelPais = (codigo) => {
    if (!codigo) return 'Todos';
    const encontrado = paises.find(p => p.codigo === codigo);
    return encontrado ? encontrado.label : codigo;
  };

  return (
    <div>
      {tabActiva === 'usuarios' && (
        <InstruccionesModulo
          id="gestion-usuarios"
          texto="Gestioná las cuentas del sistema. Los roles admin, comercial, planning y superadmin son cuentas individuales, con su propio número de colaborador — el rol tiendas sigue siendo una cuenta compartida por tienda, sin número de colaborador."
        />
      )}
      {tabActiva === 'tiendas' && (
        <InstruccionesModulo
          id="gestion-tiendas"
          texto="Administrá las tiendas de cada país. Cada una que crees acá aparece como opción al cargar dinámicas comerciales o layouts de tienda — un archivo se sube por tienda."
        />
      )}
      {tabActiva === 'paises' && esSuperAdmin && (
        <InstruccionesModulo
          id="gestion-paises"
          texto="Agregá un país nuevo y queda disponible en todo el sistema al instante — selector de login, dashboards, reportes. No olvides configurar su moneda: es la que se muestra junto a los montos de ventas y precios de ese país, sin ninguna conversión automática."
        />
      )}

      {mensaje && <div style={styles.mensajeExito} role="status" aria-live="polite">{mensaje}</div>}

      {/* Tabs — Usuarios y Tiendas las ve cualquier admin; Países es exclusiva de superadmin */}
      <div style={styles.tabs} role="tablist">
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'usuarios' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('usuarios')}
          role="tab"
          aria-selected={tabActiva === 'usuarios'}
        >
          👥 Usuarios
        </button>
        <button
          className="pd-pressable"
          style={{ ...styles.tab, ...(tabActiva === 'tiendas' ? styles.tabActiva : {}) }}
          onClick={() => setTabActiva('tiendas')}
          role="tab"
          aria-selected={tabActiva === 'tiendas'}
        >
          🏪 Tiendas
        </button>
        {esSuperAdmin && (
          <button
            className="pd-pressable"
            style={{ ...styles.tab, ...(tabActiva === 'paises' ? styles.tabActiva : {}) }}
            onClick={() => setTabActiva('paises')}
            role="tab"
            aria-selected={tabActiva === 'paises'}
          >
            🌎 Países
          </button>
        )}
      </div>

      {/* ── TAB USUARIOS ──────────────────────────────── */}
      {tabActiva === 'usuarios' && (
        <div role="tabpanel">
          <div style={styles.accionesRow}>
            <div style={styles.buscadorWrapper}>
              <span style={styles.buscadorIcon} aria-hidden="true">🔍</span>
              <label htmlFor="buscador-usuarios" style={styles.srOnly}>Buscar por nombre, email, rol o número de colaborador</label>
              <input
                id="buscador-usuarios"
                className="pd-hoverable"
                style={styles.buscador}
                type="text"
                placeholder="Buscar por nombre, email, rol o N° colaborador..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
            <label htmlFor="filtro-rol" style={styles.srOnly}>Filtrar por rol</label>
            <select
              id="filtro-rol"
              className="pd-hoverable"
              style={{ ...styles.select, flex: '0 1 200px' }}
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
            >
              <option value="">Todos los roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button className="pd-pressable" style={styles.btnRefresh} onClick={cargarUsuarios}>🔄 Actualizar</button>
            <button className="pd-pressable" style={styles.btnCrear} onClick={abrirCrear} disabled={cargandoPaises}>+ Nuevo usuario</button>
          </div>

          <div style={styles.card}>
            {cargando ? (
              <div style={styles.sinDatos}><span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span><p>Cargando usuarios...</p></div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="pd-stagger-item" style={styles.sinDatos}><span style={{ fontSize: '40px' }} aria-hidden="true">👥</span><p>No hay usuarios</p></div>
            ) : (
              <div className="pd-table-scroll">
                <table style={styles.tabla}>
                  <caption style={styles.srOnly}>Lista de usuarios del sistema</caption>
                  <thead>
                    <tr>
                      {['Usuario', 'N° Colaborador', 'Email', 'Rol', 'País', 'Estado', 'Último acceso', 'Acciones'].map(h => (
                        <th key={h} style={styles.th} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((u, i) => (
                      <tr key={u.id} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                        <td style={styles.td}>
                          <div style={styles.usuarioCell}>
                            <div style={{ ...styles.avatar, background: colorRol[u.rol_codigo] || theme.color.primary }} aria-hidden="true">
                              {u.nombre.charAt(0).toUpperCase()}
                            </div>
                            <span style={styles.usuarioNombre}>{u.nombre}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          {u.numero_colaborador
                            ? <span style={styles.codigoBadge}>{u.numero_colaborador}</span>
                            : <span style={{ color: theme.color.textMuted }}>—</span>}
                        </td>
                        <td style={styles.td}>{u.email}</td>
                        <td style={styles.td}>
                          <span style={{
                            ...styles.rolBadge,
                            background: (colorRol[u.rol_codigo] || theme.color.primary) + '18',
                            color: colorRol[u.rol_codigo] || theme.color.primary,
                            border: `1px solid ${colorRol[u.rol_codigo] || theme.color.primary}40`,
                          }}>
                            {u.rol_nombre}
                          </span>
                        </td>
                        <td style={styles.td}>{labelPais(u.pais)}</td>
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
                            <button className="pd-pressable" style={styles.btnVer} onClick={() => abrirVer(u)}>
                              👁️ Ver
                            </button>
                            <button className="pd-pressable" style={styles.btnEditar} onClick={() => abrirEditar(u)}>
                              ✏️ Editar
                            </button>
                            <button className="pd-pressable" style={styles.btnEliminar} onClick={() => abrirEliminar(u)}>
                              🗑️ Desactivar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB TIENDAS ───────────────────────────────── */}
      {tabActiva === 'tiendas' && (
        <div role="tabpanel">
          <div style={styles.accionesRow}>
            {esSuperAdmin && (
              <>
                <label htmlFor="tiendas-pais-select" style={styles.srOnly}>País a gestionar</label>
                <select
                  id="tiendas-pais-select"
                  className="pd-hoverable"
                  style={{ ...styles.select, flex: '0 1 220px' }}
                  value={paisTiendas}
                  onChange={(e) => setPaisTiendas(e.target.value)}
                >
                  {paises.map(p => (
                    <option key={p.codigo} value={p.codigo}>{p.label}</option>
                  ))}
                </select>
              </>
            )}
            <button className="pd-pressable" style={styles.btnRefresh} onClick={cargarTiendas}>🔄 Actualizar</button>
            <button className="pd-pressable" style={styles.btnCrear} onClick={abrirCrearTienda}>+ Nueva tienda</button>
          </div>

          <div style={styles.card}>
            {cargandoTiendas ? (
              <div style={styles.sinDatos}><span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span><p>Cargando tiendas...</p></div>
            ) : tiendas.length === 0 ? (
              <div className="pd-stagger-item" style={styles.sinDatos}>
                <span style={{ fontSize: '40px' }} aria-hidden="true">🏪</span>
                <p>No hay tiendas registradas para este país todavía</p>
              </div>
            ) : (
              <div className="pd-table-scroll">
                <table style={styles.tabla}>
                  <caption style={styles.srOnly}>Lista de tiendas del país seleccionado</caption>
                  <thead>
                    <tr>
                      {['Código', 'Nombre', 'País', 'Acciones'].map(h => (
                        <th key={h} style={styles.th} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiendas.map((t, i) => (
                      <tr key={t.id} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                        <td style={styles.td}>
                          <span style={styles.codigoBadge}>{t.codigo}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.usuarioNombre}>{t.nombre}</span>
                        </td>
                        <td style={styles.td}>{labelPais(t.pais)}</td>
                        <td style={styles.td}>
                          <div style={styles.acciones}>
                            <button className="pd-pressable" style={styles.btnEditar} onClick={() => abrirEditarTienda(t)}>
                              ✏️ Editar
                            </button>
                            <button className="pd-pressable" style={styles.btnEliminar} onClick={() => abrirEliminarTienda(t)}>
                              🗑️ Desactivar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB PAÍSES ────────────────────────────────── */}
      {tabActiva === 'paises' && esSuperAdmin && (
        <div role="tabpanel">
          <div style={styles.accionesRow}>
            <button className="pd-pressable" style={styles.btnRefresh} onClick={cargarPaises}>🔄 Actualizar</button>
            <button className="pd-pressable" style={styles.btnCrear} onClick={abrirCrearPais}>+ Nuevo país</button>
          </div>

          <div style={styles.card}>
            {cargandoPaises ? (
              <div style={styles.sinDatos}><span style={{ fontSize: '40px' }} aria-hidden="true">⏳</span><p>Cargando países...</p></div>
            ) : paises.length === 0 ? (
              <div className="pd-stagger-item" style={styles.sinDatos}><span style={{ fontSize: '40px' }} aria-hidden="true">🌎</span><p>No hay países registrados</p></div>
            ) : (
              <div className="pd-table-scroll">
                <table style={styles.tabla}>
                  <caption style={styles.srOnly}>Lista de países operativos</caption>
                  <thead>
                    <tr>
                      {['País', 'Código', 'Moneda', 'Colores', 'Acciones'].map(h => (
                        <th key={h} style={styles.th} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paises.map((p, i) => (
                      <tr key={p.codigo} style={i % 2 === 0 ? styles.trPar : styles.trImpar}>
                        <td style={styles.td}>
                          <div style={styles.usuarioCell}>
                            <span style={{ fontSize: '22px' }} aria-hidden="true">{p.bandera}</span>
                            <span style={styles.usuarioNombre}>{p.nombre}</span>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.codigoBadge}>{p.codigo}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.codigoBadge}>
                            {p.moneda_simbolo || '$'} {p.moneda_codigo || 'USD'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{ ...styles.colorSwatch, background: p.color_primario }} title={p.color_primario} aria-hidden="true" />
                            <span style={{ ...styles.colorSwatch, background: p.color_secundario }} title={p.color_secundario} aria-hidden="true" />
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.acciones}>
                            <button className="pd-pressable" style={styles.btnEditar} onClick={() => abrirEditarPais(p)}>
                              ✏️ Editar
                            </button>
                            <button className="pd-pressable" style={styles.btnEliminar} onClick={() => abrirEliminarPais(p)}>
                              🗑️ Desactivar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Ver Usuario */}
      {modal === 'ver' && usuarioSeleccionado && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div
            className="pd-modal-card"
            style={{ ...styles.modal, maxWidth: '460px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-ver-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-ver-titulo" style={styles.modalTitulo}>👁️ Detalle de Usuario</h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModal} aria-label="Cerrar">✕</button>
            </div>

            <div style={styles.verAvatar}>
              <div style={{
                ...styles.verAvatarCircle,
                background: colorRol[usuarioSeleccionado.rol_codigo] || theme.color.primary,
              }} aria-hidden="true">
                {usuarioSeleccionado.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={styles.verNombre}>{usuarioSeleccionado.nombre}</p>
                <span style={{
                  ...styles.rolBadge,
                  background: (colorRol[usuarioSeleccionado.rol_codigo] || theme.color.primary) + '18',
                  color: colorRol[usuarioSeleccionado.rol_codigo] || theme.color.primary,
                  border: `1px solid ${colorRol[usuarioSeleccionado.rol_codigo] || theme.color.primary}40`,
                }}>
                  {usuarioSeleccionado.rol_nombre}
                </span>
              </div>
            </div>

            <div style={styles.verGrid}>
              {[
                { label: 'N° Colaborador', valor: usuarioSeleccionado.numero_colaborador || '—' },
                { label: 'Email', valor: usuarioSeleccionado.email },
                { label: 'País', valor: labelPais(usuarioSeleccionado.pais) },
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
              <button className="pd-pressable" style={styles.btnGuardar} onClick={() => { cerrarModal(); abrirEditar(usuarioSeleccionado); }}>
                ✏️ Editar usuario
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Usuario */}
      {(modal === 'crear' || modal === 'editar') && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-crear-editar-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-crear-editar-titulo" style={styles.modalTitulo}>
                {modal === 'crear' ? '➕ Nuevo Usuario' : '✏️ Editar Usuario'}
              </h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModal} aria-label="Cerrar">✕</button>
            </div>

            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="usuario-nombre" style={styles.label}>Nombre</label>
                <input
                  id="usuario-nombre"
                  className="pd-hoverable"
                  style={styles.input}
                  type="text"
                  placeholder="Nombre completo"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  autoFocus
                />
              </div>
              <div style={styles.campo}>
                <label htmlFor="usuario-email" style={styles.label}>Email</label>
                <input
                  id="usuario-email"
                  className="pd-hoverable"
                  style={styles.input}
                  type="email"
                  placeholder="correo@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              {modal === 'crear' && (
                <div style={styles.campo}>
                  <label htmlFor="usuario-password" style={styles.label}>Contraseña</label>
                  <input
                    id="usuario-password"
                    className="pd-hoverable"
                    style={styles.input}
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              )}
              <div style={styles.campo}>
                <label htmlFor="usuario-rol" style={styles.label}>Rol</label>
                <select
                  id="usuario-rol"
                  className="pd-hoverable"
                  style={styles.select}
                  value={form.rol_codigo}
                  onChange={(e) => setForm({ ...form, rol_codigo: e.target.value })}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div style={styles.campo}>
                <label htmlFor="usuario-pais" style={styles.label}>País</label>
                <select
                  id="usuario-pais"
                  className="pd-hoverable"
                  style={styles.select}
                  value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                >
                  <option value="">Todos los países</option>
                  {paises.map(p => <option key={p.codigo} value={p.codigo}>{p.label}</option>)}
                </select>
              </div>
              {form.rol_codigo !== 'tiendas' && (
                <div style={styles.campo}>
                  <label htmlFor="usuario-colaborador" style={styles.label}>Número de colaborador</label>
                  <input
                    id="usuario-colaborador"
                    className="pd-hoverable"
                    style={styles.input}
                    type="text"
                    placeholder="Ej: 1024"
                    value={form.numero_colaborador}
                    onChange={(e) => setForm({ ...form, numero_colaborador: e.target.value })}
                  />
                </div>
              )}
            </div>

            {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}

            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnGuardar, opacity: procesando ? 0.7 : 1, cursor: procesando ? 'not-allowed' : 'pointer' }}
                onClick={modal === 'crear' ? handleCrear : handleEditar}
                disabled={procesando}
              >
                {procesando ? 'Guardando...' : (modal === 'crear' ? 'Crear usuario' : 'Guardar cambios')}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModal} disabled={procesando}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Usuario */}
      {modal === 'eliminar' && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}
        >
          <div
            className="pd-modal-card"
            style={{ ...styles.modal, maxWidth: '420px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-eliminar-usuario-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-eliminar-usuario-titulo" style={styles.modalTitulo}>🗑️ Desactivar Usuario</h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModal} aria-label="Cerrar">✕</button>
            </div>
            <div style={styles.eliminarBox}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">⚠️</span>
              <p style={styles.eliminarTexto}>
                ¿Estás seguro que querés desactivar a <strong>{usuarioSeleccionado?.nombre}</strong>?
                El usuario no podrá ingresar al sistema.
              </p>
            </div>
            {error && <div style={styles.errorBox} role="alert">⚠️ {error}</div>}
            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnEliminarConfirm, opacity: procesando ? 0.7 : 1, cursor: procesando ? 'not-allowed' : 'pointer' }}
                onClick={handleEliminar}
                disabled={procesando}
              >
                {procesando ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModal} disabled={procesando}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar País */}
      {(modalPais === 'crear' || modalPais === 'editar') && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModalPais(); }}
        >
          <div
            className="pd-modal-card"
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-pais-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-pais-titulo" style={styles.modalTitulo}>
                {modalPais === 'crear' ? '➕ Nuevo País' : '✏️ Editar País'}
              </h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModalPais} aria-label="Cerrar">✕</button>
            </div>

            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="pais-codigo" style={styles.label}>Código</label>
                <input
                  id="pais-codigo"
                  className="pd-hoverable"
                  style={{ ...styles.input, textTransform: 'uppercase' }}
                  type="text"
                  placeholder="Ej: PA"
                  maxLength={5}
                  value={formPais.codigo}
                  onChange={(e) => setFormPais({ ...formPais, codigo: e.target.value.toUpperCase() })}
                  disabled={modalPais === 'editar'}
                  autoFocus={modalPais === 'crear'}
                />
              </div>
              <div style={styles.campo}>
                <label htmlFor="pais-nombre" style={styles.label}>Nombre</label>
                <input
                  id="pais-nombre"
                  className="pd-hoverable"
                  style={styles.input}
                  type="text"
                  placeholder="Ej: Panamá"
                  value={formPais.nombre}
                  onChange={(e) => setFormPais({ ...formPais, nombre: e.target.value })}
                />
              </div>
            </div>

            <div style={styles.campo}>
              <label htmlFor="pais-bandera" style={styles.label}>Emoji de bandera (opcional)</label>
              <input
                id="pais-bandera"
                className="pd-hoverable"
                style={styles.input}
                type="text"
                placeholder="🇵🇦 (dejalo vacío para usar una genérica)"
                maxLength={10}
                value={formPais.bandera_emoji}
                onChange={(e) => setFormPais({ ...formPais, bandera_emoji: e.target.value })}
              />
            </div>

            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="pais-moneda-simbolo" style={styles.label}>Símbolo de moneda</label>
                <input
                  id="pais-moneda-simbolo"
                  className="pd-hoverable"
                  style={styles.input}
                  type="text"
                  placeholder="Ej: ₡, Q, $"
                  maxLength={5}
                  value={formPais.moneda_simbolo}
                  onChange={(e) => setFormPais({ ...formPais, moneda_simbolo: e.target.value })}
                />
              </div>
              <div style={styles.campo}>
                <label htmlFor="pais-moneda-codigo" style={styles.label}>Código de moneda (ISO)</label>
                <input
                  id="pais-moneda-codigo"
                  className="pd-hoverable"
                  style={{ ...styles.input, textTransform: 'uppercase' }}
                  type="text"
                  placeholder="Ej: CRC, GTQ, USD"
                  maxLength={5}
                  value={formPais.moneda_codigo}
                  onChange={(e) => setFormPais({ ...formPais, moneda_codigo: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <p style={styles.ayudaMoneda}>
              💡 Este símbolo se muestra junto a los montos de ventas y precios de este país en todo el sistema — no convierte valores, solo cambia cómo se ven.
            </p>

            <div style={styles.campo}>
              <label style={styles.label}>Color primario</label>
              <div style={styles.paletaRow}>
                {PALETA_COLORES.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="pd-pressable"
                    style={{
                      ...styles.paletaSwatch,
                      background: c,
                      outline: formPais.color_primario === c ? `3px solid ${theme.color.primary}` : 'none',
                      outlineOffset: '2px',
                    }}
                    onClick={() => setFormPais({ ...formPais, color_primario: c })}
                    aria-label={`Elegir color primario ${c}`}
                    aria-pressed={formPais.color_primario === c}
                  />
                ))}
              </div>
            </div>

            <div style={styles.campo}>
              <label style={styles.label}>Color secundario</label>
              <div style={styles.paletaRow}>
                {PALETA_COLORES.map(c => (
                  <button
                    key={c}
                    type="button"
                    className="pd-pressable"
                    style={{
                      ...styles.paletaSwatch,
                      background: c,
                      outline: formPais.color_secundario === c ? `3px solid ${theme.color.primary}` : 'none',
                      outlineOffset: '2px',
                    }}
                    onClick={() => setFormPais({ ...formPais, color_secundario: c })}
                    aria-label={`Elegir color secundario ${c}`}
                    aria-pressed={formPais.color_secundario === c}
                  />
                ))}
              </div>
            </div>

            <div style={styles.previewBox}>
              <span style={styles.previewLabel}>Vista previa:</span>
              <div style={{
                ...styles.previewBanner,
                background: `linear-gradient(135deg, ${formPais.color_primario}, ${formPais.color_secundario})`,
              }}>
                {formPais.bandera_emoji || '🏳️'} {formPais.nombre || 'Nombre del país'} · {formPais.moneda_simbolo || '$'}1,000
              </div>
            </div>

            {errorPais && <div style={styles.errorBox} role="alert">⚠️ {errorPais}</div>}

            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnGuardar, opacity: procesandoPais ? 0.7 : 1, cursor: procesandoPais ? 'not-allowed' : 'pointer' }}
                onClick={modalPais === 'crear' ? handleCrearPais : handleEditarPais}
                disabled={procesandoPais}
              >
                {procesandoPais ? 'Guardando...' : (modalPais === 'crear' ? 'Crear país' : 'Guardar cambios')}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModalPais} disabled={procesandoPais}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar País */}
      {modalPais === 'eliminar' && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModalPais(); }}
        >
          <div
            className="pd-modal-card"
            style={{ ...styles.modal, maxWidth: '420px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-eliminar-pais-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-eliminar-pais-titulo" style={styles.modalTitulo}>🗑️ Desactivar País</h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModalPais} aria-label="Cerrar">✕</button>
            </div>
            <div style={styles.eliminarBox}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">⚠️</span>
              <p style={styles.eliminarTexto}>
                ¿Estás seguro que querés desactivar <strong>{paisSeleccionado?.nombre}</strong>?
                Dejará de aparecer en los selectores, pero sus datos históricos (usuarios, dinámicas, catálogo, ventas) se conservan.
              </p>
            </div>
            {errorPais && <div style={styles.errorBox} role="alert">⚠️ {errorPais}</div>}
            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnEliminarConfirm, opacity: procesandoPais ? 0.7 : 1, cursor: procesandoPais ? 'not-allowed' : 'pointer' }}
                onClick={handleEliminarPais}
                disabled={procesandoPais}
              >
                {procesandoPais ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModalPais} disabled={procesandoPais}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Tienda */}
      {(modalTienda === 'crear' || modalTienda === 'editar') && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModalTienda(); }}
        >
          <div
            className="pd-modal-card"
            style={{ ...styles.modal, maxWidth: '480px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-tienda-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-tienda-titulo" style={styles.modalTitulo}>
                {modalTienda === 'crear' ? '➕ Nueva Tienda' : '✏️ Editar Tienda'}
              </h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModalTienda} aria-label="Cerrar">✕</button>
            </div>

            <div className="pd-grid-2">
              <div style={styles.campo}>
                <label htmlFor="tienda-codigo" style={styles.label}>Código</label>
                <input
                  id="tienda-codigo"
                  className="pd-hoverable"
                  style={styles.input}
                  type="text"
                  placeholder="Ej: CR-01"
                  value={formTienda.codigo}
                  onChange={(e) => setFormTienda({ ...formTienda, codigo: e.target.value })}
                  autoFocus
                />
              </div>
              <div style={styles.campo}>
                <label htmlFor="tienda-nombre" style={styles.label}>Nombre</label>
                <input
                  id="tienda-nombre"
                  className="pd-hoverable"
                  style={styles.input}
                  type="text"
                  placeholder="Ej: Curridabat"
                  value={formTienda.nombre}
                  onChange={(e) => setFormTienda({ ...formTienda, nombre: e.target.value })}
                />
              </div>
            </div>

            {esSuperAdmin ? (
              <div style={styles.campo}>
                <label htmlFor="tienda-pais" style={styles.label}>País</label>
                <select
                  id="tienda-pais"
                  className="pd-hoverable"
                  style={styles.select}
                  value={formTienda.pais}
                  onChange={(e) => setFormTienda({ ...formTienda, pais: e.target.value })}
                >
                  {paises.map(p => <option key={p.codigo} value={p.codigo}>{p.label}</option>)}
                </select>
              </div>
            ) : (
              <div style={styles.campo}>
                <label style={styles.label}>País</label>
                <div style={styles.paisFijo}>
                  {labelPais(usuarioActual.pais)}
                  <span style={styles.paisFijoTag}>Asignado a tu cuenta</span>
                </div>
              </div>
            )}

            {errorTienda && <div style={styles.errorBox} role="alert">⚠️ {errorTienda}</div>}

            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnGuardar, opacity: procesandoTienda ? 0.7 : 1, cursor: procesandoTienda ? 'not-allowed' : 'pointer' }}
                onClick={modalTienda === 'crear' ? handleCrearTienda : handleEditarTienda}
                disabled={procesandoTienda}
              >
                {procesandoTienda ? 'Guardando...' : (modalTienda === 'crear' ? 'Crear tienda' : 'Guardar cambios')}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModalTienda} disabled={procesandoTienda}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Tienda */}
      {modalTienda === 'eliminar' && (
        <div
          className="pd-modal-overlay"
          style={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModalTienda(); }}
        >
          <div
            className="pd-modal-card"
            style={{ ...styles.modal, maxWidth: '420px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-eliminar-tienda-titulo"
          >
            <div style={styles.modalHeader}>
              <h3 id="modal-eliminar-tienda-titulo" style={styles.modalTitulo}>🗑️ Desactivar Tienda</h3>
              <button className="pd-pressable" style={styles.modalClose} onClick={cerrarModalTienda} aria-label="Cerrar">✕</button>
            </div>
            <div style={styles.eliminarBox}>
              <span style={{ fontSize: '48px' }} aria-hidden="true">⚠️</span>
              <p style={styles.eliminarTexto}>
                ¿Estás seguro que querés desactivar <strong>{tiendaSeleccionada?.nombre}</strong>?
                Dejará de aparecer como opción al cargar dinámicas, pero sus datos históricos se conservan.
              </p>
            </div>
            {errorTienda && <div style={styles.errorBox} role="alert">⚠️ {errorTienda}</div>}
            <div style={styles.modalBotones}>
              <button
                className="pd-pressable"
                style={{ ...styles.btnEliminarConfirm, opacity: procesandoTienda ? 0.7 : 1, cursor: procesandoTienda ? 'not-allowed' : 'pointer' }}
                onClick={handleEliminarTienda}
                disabled={procesandoTienda}
              >
                {procesandoTienda ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
              <button className="pd-pressable" style={styles.btnCancelar} onClick={cerrarModalTienda} disabled={procesandoTienda}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 },
  descripcion: { fontSize: theme.font.size.md, color: theme.color.textMuted, marginBottom: '20px' },
  mensajeExito: {
    background: theme.color.successBg, border: `1px solid ${theme.color.successBorder}`, borderRadius: theme.radius.sm,
    padding: '12px 16px', color: theme.color.success, fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, marginBottom: '16px',
  },
  tabs: { display: 'flex', gap: '4px', marginBottom: '20px', background: theme.color.background, padding: '4px', borderRadius: theme.radius.lg, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' },
  tab: { padding: '10px 20px', borderRadius: theme.radius.md, border: 'none', background: 'transparent', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.textMuted, cursor: 'pointer', fontFamily: theme.font.family, whiteSpace: 'nowrap' },
  tabActiva: { background: theme.color.surface, color: theme.color.primary, boxShadow: theme.shadow.sm },
  accionesRow: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' },
  buscadorWrapper: { flex: '1 1 220px', position: 'relative', display: 'flex', alignItems: 'center' },
  buscadorIcon: { position: 'absolute', left: '14px', fontSize: theme.font.size.xl },
  buscador: {
    width: '100%', padding: '12px 12px 12px 44px', borderRadius: theme.radius.md,
    border: `1.5px solid ${theme.color.border}`, fontSize: theme.font.size.md, outline: 'none',
    fontFamily: theme.font.family, background: theme.color.surface, boxSizing: 'border-box',
  },
  btnRefresh: {
    padding: '12px 16px', background: theme.color.background, border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md, fontSize: theme.font.size.base, cursor: 'pointer', color: theme.color.primary,
    fontWeight: theme.font.weight.semibold, whiteSpace: 'nowrap',
  },
  btnCrear: {
    padding: '12px 20px', background: theme.color.gradient,
    color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md,
    fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  card: {
    background: theme.color.surface, borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.sm, overflow: 'hidden',
  },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.size.base, minWidth: '820px' },
  th: {
    padding: '12px 16px', background: theme.color.background, color: theme.color.primary,
    fontWeight: theme.font.weight.bold, textAlign: 'left', fontSize: theme.font.size.sm,
    textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 16px', color: '#444444', borderBottom: `1px solid ${theme.color.background}`, verticalAlign: 'middle' },
  trPar: { background: theme.color.surface },
  trImpar: { background: '#FAFBFC' },
  usuarioCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%', color: theme.color.textOnPrimary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, flexShrink: 0,
  },
  usuarioNombre: { fontWeight: theme.font.weight.semibold, color: theme.color.primary },
  rolBadge: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, display: 'inline-block' },
  activoBadge: { background: theme.color.successBg, color: theme.color.success, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill },
  inactivoBadge: { background: theme.color.errorBg, color: theme.color.error, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill },
  codigoBadge: { background: theme.color.accentSoft, color: theme.color.primary, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, padding: '3px 10px', borderRadius: theme.radius.pill, fontFamily: 'monospace' },
  colorSwatch: { width: '22px', height: '22px', borderRadius: '50%', border: `1px solid ${theme.color.border}`, display: 'inline-block' },
  acciones: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  btnVer: {
    padding: '6px 12px', background: theme.color.successBg, border: `1px solid ${theme.color.successBorder}`,
    borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.success,
  },
  btnEditar: {
    padding: '6px 12px', background: theme.color.accentSoft, border: `1px solid ${theme.color.accentSoftBorder}`,
    borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.primary,
  },
  btnEliminar: {
    padding: '6px 12px', background: theme.color.errorBg, border: `1px solid ${theme.color.errorSoftBorder}`,
    borderRadius: theme.radius.sm, cursor: 'pointer', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.color.error,
  },
  sinDatos: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px', color: theme.color.textMuted, fontSize: theme.font.size.md, gap: '12px',
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    padding: '16px', boxSizing: 'border-box',
  },
  modal: {
    background: theme.color.surface, borderRadius: theme.radius.xxl, padding: 'clamp(16px, 4vw, 32px)',
    width: '100%', maxWidth: '560px', maxHeight: '85vh', overflow: 'auto',
    boxShadow: theme.shadow.modal,
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px' },
  modalTitulo: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: theme.font.size.xl, cursor: 'pointer', color: theme.color.textMuted, flexShrink: 0 },
  verAvatar: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  verAvatarCircle: {
    width: '56px', height: '56px', borderRadius: '50%', color: theme.color.textOnPrimary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', fontWeight: theme.font.weight.black, flexShrink: 0,
  },
  verNombre: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.black, color: theme.color.primary, margin: '0 0 6px 0' },
  verGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' },
  verItem: { background: theme.color.background, borderRadius: theme.radius.sm, padding: '12px' },
  verLabel: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px 0' },
  verValor: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.color.primary, margin: 0 },
  campo: { marginBottom: '16px' },
  label: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.primary, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`,
    fontSize: theme.font.size.md, outline: 'none', boxSizing: 'border-box',
    fontFamily: theme.font.family, background: theme.color.surfaceMuted,
  },
  select: {
    width: '100%', padding: '10px 12px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`,
    fontSize: theme.font.size.md, outline: 'none', boxSizing: 'border-box', background: theme.color.surfaceMuted, color: theme.color.text,
  },
  ayudaMoneda: { fontSize: theme.font.size.sm, color: theme.color.textMuted, margin: '-8px 0 16px 0', lineHeight: '1.5' },
  paisFijo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: theme.radius.sm, border: `1.5px solid ${theme.color.border}`, background: theme.color.background, fontSize: theme.font.size.md, color: theme.color.text, fontWeight: theme.font.weight.semibold, flexWrap: 'wrap', gap: '4px' },
  paisFijoTag: { fontSize: theme.font.size.sm, color: theme.color.textMuted, background: theme.color.border, padding: '2px 8px', borderRadius: theme.radius.pill, fontWeight: theme.font.weight.regular },
  paletaRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  paletaSwatch: { width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer' },
  previewBox: { marginBottom: '16px' },
  previewLabel: { display: 'block', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.color.textMuted, marginBottom: '8px' },
  previewBanner: { padding: '14px 20px', borderRadius: theme.radius.lg, color: '#ffffff', fontWeight: theme.font.weight.bold, fontSize: theme.font.size.md },
  errorBox: {
    background: theme.color.errorBg, border: `1px solid ${theme.color.errorBorder}`, borderRadius: theme.radius.sm,
    padding: '10px 14px', color: theme.color.error, fontSize: theme.font.size.base, marginTop: '16px',
  },
  modalBotones: { display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' },
  btnGuardar: {
    flex: '1 1 160px', padding: '12px', background: theme.color.gradient,
    color: theme.color.textOnPrimary, border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer',
  },
  btnCancelar: {
    flex: '1 1 120px', padding: '12px', background: theme.color.background, color: theme.color.textMuted,
    border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, fontSize: theme.font.size.md, cursor: 'pointer',
  },
  eliminarBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '20px 0', gap: '16px' },
  eliminarTexto: { fontSize: theme.font.size.lg, color: theme.color.textSecondary, lineHeight: '1.6' },
  btnEliminarConfirm: {
    flex: '1 1 120px', padding: '12px', background: theme.color.error, color: theme.color.textOnPrimary,
    border: 'none', borderRadius: theme.radius.md, fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, cursor: 'pointer',
  },
};

export default Usuarios;