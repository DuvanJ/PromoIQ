# ============================================================
# Módulo: limites.py
# Descripción: Control de consumo de tokens de IA — dos niveles:
# tope general por país + sub-límites por país y rol combinados.
# Alcanzar CUALQUIERA de los dos corta el acceso.
# ============================================================

from fastapi import HTTPException
from app.database import get_connection
import datetime


def verificar_limite_tokens(pais: str, rol: str = None):
    """
    Chequea, ANTES de llamar a Claude, si ya se alcanzó:
    1. El tope mensual general del país, o
    2. El sub-límite mensual de ese rol dentro del país

    Lo que se cumpla primero corta el acceso — así el corte
    ahorra el costo real, no solo avisa después.
    """
    if not pais:
        return

    conn = get_connection()
    cursor = conn.cursor()
    hoy = datetime.date.today()

    # ── Nivel 1: tope general del país ──────────────────────
    cursor.execute("""
        SELECT limite_mensual_corte, activo FROM limites_tokens_pais WHERE pais = ?
    """, (pais,))
    fila_pais = cursor.fetchone()

    if fila_pais and fila_pais[1]:
        cursor.execute("""
            SELECT ISNULL(SUM(tokens_usados), 0) FROM consultas_log
            WHERE pais_consultado = ? AND MONTH(fecha) = ? AND YEAR(fecha) = ?
        """, (pais, hoy.month, hoy.year))
        consumido_pais = cursor.fetchone()[0]

        if consumido_pais >= fila_pais[0]:
            conn.close()
            raise HTTPException(
                status_code=429,
                detail=f"Se alcanzó el límite general de consultas a la IA de este mes para {pais}. "
                       f"Contactá a un administrador para ampliarlo."
            )

    # ── Nivel 2: sub-límite del rol dentro del país ─────────
    if rol:
        cursor.execute("""
            SELECT limite_mensual_corte, activo FROM limites_tokens_rol
            WHERE pais = ? AND rol = ?
        """, (pais, rol))
    fila_rol = cursor.fetchone()

    if fila_rol and fila_rol[1]:
        cursor.execute("""
            SELECT ISNULL(SUM(cl.tokens_usados), 0)
            FROM consultas_log cl
            INNER JOIN usuarios u ON cl.usuario_id = u.id
            INNER JOIN cat_roles r ON u.rol_id = r.id
            WHERE cl.pais_consultado = ? AND r.codigo = ?
            AND MONTH(cl.fecha) = ? AND YEAR(cl.fecha) = ?
        """, (pais, rol, hoy.month, hoy.year))
        consumido_rol = cursor.fetchone()[0]

        if consumido_rol >= fila_rol[0]:
            conn.close()
            raise HTTPException(
                status_code=429,
                detail=f"Se alcanzó el límite mensual de consultas a la IA para el rol "
                       f"{rol.capitalize()} en {pais}. Contactá a un administrador para ampliarlo."
            )
    conn.close()