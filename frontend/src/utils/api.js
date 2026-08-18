// ============================================================
// Utilidad: api.js
// Descripción: Configuración global de axios con interceptores
// Maneja: errores de red, sesión expirada, sin permisos
// ============================================================

import axios from 'axios';

// En desarrollo cae a localhost; en producción tomá el valor de
// REACT_APP_API_URL definido en el .env correspondiente.
const BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

// Instancia global de axios
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000, // 5 minutos para archivos grandes
});

// ── Interceptor de REQUEST ────────────────────────────────
// Agrega el token automáticamente a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Interceptor de RESPONSE ───────────────────────────────
// Maneja errores globalmente según el código HTTP
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Sin conexión al servidor
      window.dispatchEvent(new CustomEvent('promoiq:error', {
        detail: {
          tipo: 'conexion',
          mensaje: 'No se puede conectar al servidor. Verificá que el backend esté corriendo.',
          icono: '🔌'
        }
      }));
      return Promise.reject(error);
    }

    const { status } = error.response;

    if (status === 401) {
      // Un 401 en el propio login (contraseña incorrecta, usuario
      // inexistente) NO es una sesión expirada — es un intento de
      // login fallido. Login.js ya muestra su propio mensaje de
      // error, así que acá solo limpiamos cualquier token viejo
      // sin disparar la pantalla global de "sesión expirada".
      const esLogin = error.config?.url?.includes('/auth/login');
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      if (!esLogin) {
        window.dispatchEvent(new CustomEvent('promoiq:sesion-expirada'));
      }
      return Promise.reject(error);
    }

    if (status === 403) {
      window.dispatchEvent(new CustomEvent('promoiq:error', {
        detail: {
          tipo: 'permiso',
          mensaje: 'No tenés permisos para realizar esta acción.',
          icono: '🔒'
        }
      }));
      return Promise.reject(error);
    }

    if (status === 404) {
      window.dispatchEvent(new CustomEvent('promoiq:error', {
        detail: {
          tipo: 'notfound',
          mensaje: 'El recurso solicitado no fue encontrado.',
          icono: '🔍'
        }
      }));
      return Promise.reject(error);
    }

    if (status === 500) {
      window.dispatchEvent(new CustomEvent('promoiq:error', {
        detail: {
          tipo: 'servidor',
          mensaje: 'Error interno del servidor. Intentá de nuevo en unos momentos.',
          icono: '⚠️'
        }
      }));
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;