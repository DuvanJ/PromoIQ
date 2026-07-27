// ============================================================
// Componente: App.js
// Descripción: Router principal de PromoIQ
// Maneja: autenticación, roles y errores globales
// ============================================================

import React, { useState } from 'react';
import Login from './components/Login';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import AdminDashboard from './components/AdminDashboard';
import ErrorGlobal from './components/ErrorGlobal';
import SesionExpirada from './components/SesionExpirada';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [sesionExpirada, setSesionExpirada] = useState(false);

  const handleLogin = (datos) => {
    setUsuario(datos);
    setSesionExpirada(false);
    localStorage.setItem('token', datos.access_token);
    localStorage.setItem('usuario', JSON.stringify(datos.usuario));
  };

  const handleLogout = () => {
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
  <>
    <style>{`
      input[placeholder="Buscar artículo, dinámica, usuario..."]::placeholder {
        color: #8892A4 !important;
      }
    `}</style>
    <div translate="no">
      {/* Manejador global de errores */}
      <ErrorGlobal onSesionExpirada={handleSesionExpirada} />
      {sesionExpirada && (
        <SesionExpirada onVolverLogin={() => setSesionExpirada(false)} />
      )}
      {!usuario ? (
        <Login onLogin={handleLogin} />
      ) : (
        renderDashboard()
      )}
    </div>
  </>
);
}




export default App;