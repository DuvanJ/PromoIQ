markdown
# PromoIQ — Contexto del Proyecto para Claude

## 1. Overview del Proyecto

**PromoIQ** es un sistema de inteligencia de dinámicas comerciales con IA.
Permite gestionar campañas comerciales, analizar artículos en promoción, cargar catálogos y ventas,
y consultar un asistente IA personalizado por usuario.



### Roles del sistema
| Rol | Acceso |
|---|---|
| superadmin | Control total — todos los países |
| admin | Panel por país (CR / GT / SV) |
| comercial | Asistente IA personalizado + análisis |
| planning | Trazabilidad + asistente IA |
| tiendas | Consultas e información |

### Rutas del proyecto

C:\Users\Usuario\PromoIQ
├── backend\app\ # FastAPI + Python
│ ├── routers\ # auth, dinamicas, admin, admin_pais,
│ │ # asistente, consultas, exportar, notificaciones
│ ├── utils\security.py # bcrypt con passlib
│ ├── database.py # SQL Server Windows Auth
│ ├── models.py # Pydantic models
│ ├── auth.py # JWT
│ └── main.py # App principal
├── frontend\src\ # React
│ ├── components
│ │ ├── admin\ # TopBar, CargaInformacion, AsistePersonalizado,
│ │ │ # ChatIA, Dinamicas, Exportar, HistorialChat,
│ │ │ # Reportes, Usuarios
│ │ ├── AdminDashboard.js
│ │ ├── SuperAdminDashboard.js
│ │ ├── Login.js
│ │ ├── ErrorGlobal.js
│ │ └── SesionExpirada.js
│ ├── utils\api.js # axios con interceptores + timeout 5min
│ └── assets\ # Vidri Novex.png
└── venv\ # Python virtual environment


---

## 2. Tecnologías y Herramientas Clave

### Backend
| Tecnología | Uso |
|---|---|
| Python + FastAPI | API REST principal |
| SQL Server Express | Base de datos (DESKTOP-DU6R536\SQLEXPRESS) |
| Claude API (claude-sonnet-4-6) | Motor de IA |
| passlib + bcrypt==4.0.1 | Encriptación de contraseñas |
| JWT (python-jose) | Autenticación |
| pandas + openpyxl | Procesamiento de Excel |
| smtplib | Notificaciones email via Gmail SMTP |

### Frontend
| Tecnología | Uso |
|---|---|
| React | UI principal |
| axios | HTTP client con instancia centralizada |
| react-markdown | Renderizado de respuestas IA |

### Base de Datos — Tablas principales
```sql
cat_roles           -- superadmin, admin, comercial, planning, tiendas
usuarios            -- bcrypt passwords, rol_id, pais, activo
dinamicas           -- campañas comerciales, activa BIT
dinamica_detalle    -- SKU|descripcion|ubicacion|tipo_campana|pais
consultas_log       -- historial IA
carga_log           -- log de cargas Excel
conversaciones      -- conversaciones asistente personalizado
conversacion_mensajes
usuario_perfil_ia   -- email, favoritos, nombre_asistente, nivel_detalle
articulos_maestro   -- catálogo completo ~
articulos_sucursales -- existencia/disponible por sucursal
ventas_mes          -- ventas mensuales por canal
```

### Variables de entorno (`.env` en `backend/`)
```env
ANTHROPIC_API_KEY=...
MAIL_USERNAME=...@gmail.com
MAIL_PASSWORD=...        # App Password 16 chars
MAIL_FROM=...
MAIL_FROM_NAME=PromoIQ Notificaciones
```

---

## 3. Comandos Frecuentes

### Iniciar el backend
```powershell
& C:/Users/Usuario/PromoIQ/venv/Scripts/Activate.ps1
cd C:/Users/Usuario/PromoIQ/backend
uvicorn app.main:app --reload
```

### Iniciar el frontend
```powershell
cd C:/Users/Usuario/PromoIQ/frontend
npm start
```

### Subir cambios a GitHub
```powershell
cd C:\Users\Usuario\PromoIQ
git add .
git commit -m "Descripción del cambio"
git push
```

### Instalar dependencias Python
```powershell
pip install nombre-paquete --break-system-packages
# bcrypt siempre usar versión fija:
pip install bcrypt==4.0.1
```

### Verificar conexión BD en SSMS
```sql
USE PromoIQ;
SELECT id, nombre, LEFT(password,10) FROM usuarios;
```

---

## 4. Estilo de Código y Convenciones

### Python (Backend)
```python
# ── Sección del código ────────────────────────────────────
# Comentar solo lo importante — funciones complejas y decisiones de diseño

# Siempre usar safe_decimal para valores numéricos del Excel
def safe_decimal(val):
    try:
        if pd.isna(val): return None
        s = str(val).strip().replace(',', '.')
        if s in ['', 'nan', 'NaN']: return None
        f = float(s)
        if f > 99999999.99 or f < -99999999.99: return None
        return round(f, 2)
    except: return None

# Siempre cerrar conexiones en finally
conn = get_connection()
try:
    # lógica
    conn.commit()
finally:
    conn.close()

# Filtros por país/rol siempre así:
filtro_pais = "AND dd.pais = ?" if pais and rol != "superadmin" else ""
params = (pais,) if pais and rol != "superadmin" else ()
```

### React (Frontend)
```javascript
// ── Instancia axios centralizada — SIEMPRE usar api, nunca axios directo
import api from '../../utils/api';

// Colores por país — consistente en todo el sistema
const TEMAS = {
  CR: { primary: '#002B7F', secondary: '#CE1126',
        gradient: 'linear-gradient(135deg, #002B7F, #CE1126)' },
  GT: { primary: '#4997D0', secondary: '#1A6DB5',
        gradient: 'linear-gradient(135deg, #1A6DB5, #4997D0)' },
  SV: { primary: '#0F47AF', secondary: '#F0C010',
        gradient: 'linear-gradient(135deg, #0F47AF, #1565C0)' },
  superadmin: { primary: '#1E2761', secondary: '#0077B6',
                gradient: 'linear-gradient(135deg, #1E2761, #0077B6)' },
};

// Estilos siempre en objeto al final del archivo
const styles = { ... };
```

### Convenciones generales
- **Nombres en español** para variables de negocio (`dinamica`, `articulo`, `pais`)
- **Nombres en inglés** para lógica técnica (`router`, `handler`, `cursor`)
- **Commits descriptivos** en español: `"Agregar búsqueda por SKU en asistente"`
- **No subir** `.env`, `venv/`, `node_modules/` al repositorio
- **Siempre reiniciar** uvicorn después de cambios en el backend
- **Siempre usar** `translate="no"` en el div raíz de React

### Interpretación de datos del catálogo

Existencia Bodega = Stock en Centro de Distribución (bodega central)
Disponible = Unidades en tienda/sucursal actualmente
Exclusivo = 1 → artículo SÍ se vende en esa tienda
Exclusivo = 0 → artículo NO habilitado para esa tienda
(no debería tener existencias)
Consumo Mensual = Promedio de unidades vendidas por mes en esa sucursal


### Formatos Excel

Dinámicas: SKU | Descripcion | Promo
Catálogo: 40+ columnas (deduplicar por SKU)
Ventas: SKU | Descripcion | Expres | Mostrador |
Externo | E-Commerce | Total general
(SKU 00000 → extraer SKU real de Descripcion)


---

## 5. Arquitectura de la IA

### Contexto enviado al asistente personalizado
1. Dinámicas activas (TOP 50 por ubicación)
2. Historial dinámicas últimos 3 meses
3. Catálogo de SKUs en dinámica (cruzado)
4. Ventas del mes más reciente (TOP 50)
5. Cruce ventas × dinámicas
6. **Búsqueda dinámica por SKU** — cuando el usuario menciona un número de 4-8 dígitos, busca automáticamente en:
   - `articulos_maestro` (info completa)
   - `articulos_sucursales` (inventario por tienda)
   - `ventas_mes` (historial de ventas)
   - `dinamica_detalle` (dinámicas asociadas)

### Endpoints principales de IA

POST /asistente/conversaciones/nueva
POST /asistente/conversaciones/{id}/mensaje
GET /asistente/conversaciones
GET /asistente/conversaciones/{id}/mensajes
POST /asistente/bienvenida
POST /asistente/despedida
POST /asistente/perfil/email
POST /asistente/perfil/personalizacion
GET /asistente/perfil/completo


### Personalización del asistente
- Nombre del asistente (guardado en `usuario_perfil_ia.nombre_asistente`)
- Nivel de detalle: `rapido` / `detallado` / `experto`
- Email corporativo para notificaciones
- Mensaje de bienvenida generado por IA al iniciar sesión
- Mensaje de despedida generado por IA al cerrar sesión

---

## 6. GitHub

Repositorio: https://github.com/DuvanJ/PromoIQ.git
Branch principal: main
