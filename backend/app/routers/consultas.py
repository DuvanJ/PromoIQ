from fastapi import APIRouter, HTTPException, Depends
from app.database import get_connection
from app.auth import verificar_token
from app.models import ArticuloQuery
from anthropic import Anthropic
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/consultas", tags=["Consultas IA"])
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def obtener_contexto_por_rol(usuario: dict) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    rol = usuario["rol"]
    tienda = usuario["tienda"]
    pais = usuario["pais"]

    # Superadmin ve todo sin filtro
    if rol == "superadmin":
        cursor.execute("""
            SELECT d.nombre, dd.articulo_codigo, dd.articulo_descripcion,
                   dd.precio_regular, dd.precio_dinamica, dd.ubicacion,
                   dd.tienda, dd.tipo_campana, dd.categoria,
                   d.fecha_inicio, d.fecha_fin, dd.pais
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
        """)

    # Admin, Comercial y Planning ven solo su país
    elif rol in ["admin", "comercial", "planning"]:
        cursor.execute("""
            SELECT d.nombre, dd.articulo_codigo, dd.articulo_descripcion,
                   dd.precio_regular, dd.precio_dinamica, dd.ubicacion,
                   dd.tienda, dd.tipo_campana, dd.categoria,
                   d.fecha_inicio, d.fecha_fin, dd.pais
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ?
        """, (pais,))

    # Tienda ve solo su país y su tienda específica
    elif rol == "tiendas":
        cursor.execute("""
            SELECT d.nombre, dd.articulo_codigo, dd.articulo_descripcion,
                   dd.precio_regular, dd.precio_dinamica, dd.ubicacion,
                   dd.tienda, dd.tipo_campana, dd.categoria,
                   d.fecha_inicio, d.fecha_fin, dd.pais
            FROM dinamica_detalle dd
            INNER JOIN dinamicas d ON dd.dinamica_id = d.id
            WHERE dd.activo = 1 AND d.activa = 1
            AND dd.pais = ?
            AND dd.tienda LIKE ?
        """, (pais, f'{tienda}%',))

    articulos = cursor.fetchall()
    conn.close()

    if not articulos:
        return "No hay artículos en dinámica disponibles para tu perfil."

    if rol == "planning":
        contexto = "Información completa de trazabilidad:\n\n"
        for a in articulos:
            contexto += (
                f"- Dinámica: {a[0]} | Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} | Tipo campaña: {a[7]} "
                f"| Categoría: {a[8]} | Vigencia: {a[9]} al {a[10]} | País: {a[11]}\n"
            )

    elif rol == "comercial":
        contexto = "Información comercial y de análisis:\n\n"
        for a in articulos:
            contexto += (
                f"- Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ahorro: ${round((a[3] or 0) - (a[4] or 0), 2)} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} "
                f"| Tipo campaña: {a[7]} | Categoría: {a[8]}\n"
            )

    elif rol == "tiendas":
        contexto = f"Información de dinámicas para tu tienda ({tienda}):\n\n"
        for a in articulos:
            contexto += (
                f"- Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio dinámica: ${a[4]} "
                f"| Ubicación en tienda: {a[5]} "
                f"| Tipo campaña: {a[7]}\n"
            )

    elif rol == "superadmin":
        contexto = "Información completa de todos los países:\n\n"
        for a in articulos:
            contexto += (
                f"- País: {a[11]} | Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} "
                f"| Tipo campaña: {a[7]} | Categoría: {a[8]}\n"
            )

    else:
        contexto = "Información general de dinámicas:\n\n"
        for a in articulos:
            contexto += (
                f"- Código: {a[1]} | Descripción: {a[2]} "
                f"| Precio regular: ${a[3]} | Precio dinámica: ${a[4]} "
                f"| Ubicación: {a[5]} | Tienda: {a[6]} "
                f"| Tipo campaña: {a[7]}\n"
            )

    return contexto

def get_system_prompt(rol: str, nombre: str, pais: str) -> str:
    paises = {"CR": "Costa Rica", "GT": "Guatemala", "SV": "El Salvador", "": "todos los países"}
    nombre_pais = paises.get(pais, pais)

    prompts = {
        "superadmin": f"""Eres el asistente de PromoIQ para {nombre}, Super Administrador.
Tenés acceso completo a la información de todos los países (Costa Rica, Guatemala y El Salvador).
Respondé siempre en español, de forma clara y organizada.
Nunca inventes información — solo usá los datos disponibles.""",

        "admin": f"""Eres el asistente de PromoIQ para {nombre}, Administrador de {nombre_pais}.
Tenés acceso completo a la información de dinámicas comerciales de {nombre_pais}.
Respondé siempre en español, de forma clara y organizada.
Nunca inventes información — solo usá los datos disponibles.""",

        "comercial": f"""Eres el asistente de PromoIQ para {nombre}, equipo Comercial de {nombre_pais}.
Tu especialidad es el análisis de campañas y dinámicas comerciales de {nombre_pais}.
Podés analizar patrones, comparar precios e identificar oportunidades.
Respondé siempre en español con enfoque comercial y estratégico.
Nunca inventes información — solo usá los datos disponibles.""",

        "planning": f"""Eres el asistente de PromoIQ para {nombre}, equipo Planning de {nombre_pais}.
Tu especialidad es la trazabilidad completa de dinámicas de {nombre_pais}.
Alertá sobre inconsistencias o datos faltantes cuando los detectes.
Respondé siempre en español con enfoque en trazabilidad y control.
Nunca inventes información — solo usá los datos disponibles.""",

        "tiendas": f"""Eres el asistente de PromoIQ para {nombre}, equipo de Tienda en {nombre_pais}.
Solo tenés acceso a la información de tu tienda específica.
Respondé de forma simple y directa sobre artículos, precios y ubicaciones.
Nunca inventes información — solo usá los datos disponibles.""",
    }
    return prompts.get(rol, prompts["admin"])

@router.post("/preguntar")
def preguntar(query: ArticuloQuery, usuario=Depends(verificar_token)):
    try:
        contexto = obtener_contexto_por_rol(usuario)
        system_prompt = get_system_prompt(
            usuario["rol"],
            usuario["nombre"],
            usuario["pais"]
        )

        respuesta = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": f"""Información disponible en el sistema:
{contexto}

Pregunta: {query.pregunta}"""
            }]
        )

        # Guardar en log
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO consultas_log (usuario_id, pregunta, respuesta, tokens_usados)
                VALUES (?, ?, ?, ?)
            """, (
                usuario["id"],
                query.pregunta,
                respuesta.content[0].text,
                respuesta.usage.input_tokens + respuesta.usage.output_tokens
            ))
            conn.commit()
        except:
            pass
        finally:
            conn.close()

        return {
            "pregunta": query.pregunta,
            "respuesta": respuesta.content[0].text,
            "usuario_rol": usuario["rol"],
            "pais": usuario["pais"],
            "tokens_usados": respuesta.usage.input_tokens + respuesta.usage.output_tokens
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando IA: {str(e)}")