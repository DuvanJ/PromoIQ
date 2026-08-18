// ============================================================
// Componente: App.js
// Descripción: Router principal de PromoIQ
// Maneja: autenticación, roles y errores globales
// ============================================================

import React, { useState } from 'react';
import api from './utils/api';
import Login from './components/Login';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import AdminDashboard from './components/AdminDashboard';
import ErrorGlobal from './components/ErrorGlobal';
import SesionExpirada from './components/SesionExpirada';
import SesionTransicion from './components/SesionTransicion';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

const ROLES_CON_ASISTENTE = ['comercial', 'planning'];
const DURACION_HOLD = 480;   // tiempo que se lee el mensaje, con la marca cubriendo la pantalla
const DURACION_SALIDA = 180; // debe coincidir con --dur-modal-out

function App() {
  const [usuario, setUsuario] = useState(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);
  const [toastMensaje, setToastMensaje] = useState(null);
  const [transicion, setTransicion] = useState(null); // null | { mensaje, saliendo }

  const handleLogin = (datos) => {
    const nombre = datos.usuario?.nombre?.split(' ')[0] || '';
    setTransicion({ mensaje: `Iniciando sesión${nombre ? `, ${nombre}` : ''}`, saliendo: false });

    setTimeout(() => {
      aplicarLogin(datos);
      setTransicion(t => t ? { ...t, saliendo: true } : t);
      setTimeout(() => setTransicion(null), DURACION_SALIDA);
    }, DURACION_HOLD);
  };

  const aplicarLogin = async (datos) => {
    setUsuario(datos);
    setSesionExpirada(false);
    localStorage.setItem('token', datos.access_token);
    localStorage.setItem('usuario', JSON.stringify(datos.usuario));

    const rol = datos.usuario?.rol;
    if (rol && ROLES_CON_ASISTENTE.includes(rol)) {
      try {
        const res = await api.post('/asistente/bienvenida?contexto=toast', {});
        setToastMensaje(res.data.mensaje);
      } catch (err) {
        console.error('Error obteniendo bienvenida:', err);
      }
    }
  };

  const handleLogout = () => {
    setTransicion({ mensaje: 'Cerrando sesión', saliendo: false });
    dispararDespedida();

    setTimeout(() => {
      aplicarLogout();
      setTransicion(t => t ? { ...t, saliendo: true } : t);
      setTimeout(() => setTransicion(null), DURACION_SALIDA);
    }, DURACION_HOLD);
  };

  const dispararDespedida = async () => {
    const rol = usuario?.usuario?.rol;
    if (rol && ROLES_CON_ASISTENTE.includes(rol)) {
      try {
        const res = await api.post('/asistente/despedida', {});
        setToastMensaje(res.data.mensaje);
      } catch (err) {
        console.error('Error obteniendo despedida:', err);
      }
    }
  };

  const aplicarLogout = () => {
    sessionStorage.removeItem('promoiq_chatia_mensajes'); // limpia el chat guardado al cerrar sesión
    setUsuario(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  };

  const handleSesionExpirada = () => {
    setUsuario(null);
    setSesionExpirada(true);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  };

  const renderDashboard = () => {
    const rol = usuario.usuario.rol;
    if (rol === 'superadmin') {
      return <SuperAdminDashboard usuario={usuario.usuario} onLogout={handleLogout} />;
    }
    return <AdminDashboard usuario={usuario.usuario} onLogout={handleLogout} />;
  };

  return (
    <ErrorBoundary>
      <div translate="no">
        {/* Manejador global de errores */}
        <ErrorGlobal onSesionExpirada={handleSesionExpirada} />
        {sesionExpirada && (
          <SesionExpirada onVolverLogin={() => setSesionExpirada(false)} />
        )}
        {toastMensaje && (
          <Toast mensaje={toastMensaje} onCerrar={() => setToastMensaje(null)} />
        )}

        {!usuario ? (
          <Login onLogin={handleLogin} />
        ) : (
          renderDashboard()
        )}

        {/* Cubre la pantalla mientras se cambia de sesión — el
            cambio real (setUsuario) ocurre debajo, invisible,
            mientras esto está sobre todo lo demás. */}
        {transicion && (
          <SesionTransicion mensaje={transicion.mensaje} saliendo={transicion.saliendo} />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;