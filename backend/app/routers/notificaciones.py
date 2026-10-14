# ============================================================
# Router: notificaciones.py
# Descripción: Sistema de notificaciones por email
# Tipos: alertas de dinámicas por vencer y nueva carga
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.database import get_connection
from app.auth import verificar_token
import smtplib
from app.logging_config import app_logger
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import os
from datetime import datetime

load_dotenv()

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "PromoIQ Notificaciones")

# ── Función base para enviar email ────────────────────────
def enviar_email(destinatario: str, asunto: str, html: str):
    """Envía un email HTML via Gmail SMTP"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = asunto
        msg['From'] = f"{MAIL_FROM_NAME} <{MAIL_FROM}>"
        msg['To'] = destinatario

        parte_html = MIMEText(html, 'html', 'utf-8')
        msg.attach(parte_html)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_FROM, destinatario, msg.as_string())

        app_logger.info(f"[enviar_email] Email enviado a {destinatario}")
        return True
    except Exception as e:
        app_logger.warning(f"[enviar_email] Error enviando email a {destinatario}: {e}")
        return False


def obtener_destinatarios_vencimiento(usuario: dict, pais: str = None):
    """
    Devuelve la lista de usuarios que recibirían la notificación de
    dinámicas por vencer, según el país filtrado.
    Reutilizada tanto por el preview como por el envío real.
    """
    conn = get_connection()
    cursor = conn.cursor()

    pais_filtro = usuario["pais"] if usuario["rol"] != "superadmin" else pais

    if pais_filtro:
        cursor.execute("""
            SELECT u.id, u.nombre, p.email_notificaciones, u.pais
            FROM usuario_perfil_ia p
            INNER JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.email_confirmado = 1
            AND p.email_notificaciones IS NOT NULL
            AND u.pais = ? AND u.activo = 1
            ORDER BY u.pais, u.nombre
        """, (pais_filtro,))
    else:
        cursor.execute("""
            SELECT u.id, u.nombre, p.email_notificaciones, u.pais
            FROM usuario_perfil_ia p
            INNER JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.email_confirmado = 1
            AND p.email_notificaciones IS NOT NULL
            AND u.activo = 1
            ORDER BY u.pais, u.nombre
        """)

    destinatarios = cursor.fetchall()
    conn.close()

    return [
        {
            "id": d[0],
            "nombre": d[1],
            "email": d[2],
            "pais": d[3]
        }
        for d in destinatarios
    ]


# ── Template HTML base ────────────────────────────────────
def template_base(titulo: str, contenido: str, color: str = "#1E2761") -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F4F7FB;font-family:Calibri,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,{color},#0077B6);padding:32px;text-align:center;">
                            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:900;">PromoIQ</h1>
                            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Centro de Inteligencia de Dinámicas Comerciales</p>
                        </td>
                    </tr>

                    <!-- Título -->
                    <tr>
                        <td style="padding:32px 40px 16px;">
                            <h2 style="color:{color};margin:0;font-size:22px;font-weight:800;">{titulo}</h2>
                        </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                        <td style="padding:0 40px 32px;">
                            {contenido}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background:#F4F7FB;padding:20px 40px;text-align:center;">
                            <p style="color:#8892A4;font-size:12px;margin:0;">
                                Este email fue enviado por PromoIQ · VIDRI/NOVEX 2026<br>
                                {datetime.now().strftime("%d/%m/%Y %H:%M")}
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

# ── Template: Dinámica por vencer ─────────────────────────
def template_dinamica_vencer(nombre_usuario: str, dinamicas: list) -> str:
    filas = ""
    for d in dinamicas:
        color_dias = "#B91C1C" if d['dias'] <= 3 else "#B45309"
        filas += f"""
        <tr style="border-bottom:1px solid #F4F7FB;">
            <td style="padding:12px 16px;font-size:14px;color:#1E2761;font-weight:600;">{d['nombre']}</td>
            <td style="padding:12px 16px;font-size:14px;color:#555;">{d['fecha_fin']}</td>
            <td style="padding:12px 16px;">
                <span style="background:{color_dias}20;color:{color_dias};font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;">
                    {d['dias']} días
                </span>
            </td>
            <td style="padding:12px 16px;font-size:14px;color:#555;">{d['articulos']} artículos</td>
        </tr>
        """

    contenido = f"""
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hola <strong>{nombre_usuario}</strong>, te informamos que las siguientes 
        dinámicas comerciales están próximas a vencer:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" 
           style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr style="background:#1E2761;">
            <th style="padding:12px 16px;color:#fff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Dinámica</th>
            <th style="padding:12px 16px;color:#fff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Fecha fin</th>
            <th style="padding:12px 16px;color:#fff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Días restantes</th>
            <th style="padding:12px 16px;color:#fff;font-size:12px;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Artículos</th>
        </tr>
        {filas}
    </table>

    <div style="margin-top:24px;padding:16px;background:#FEF3C7;border-radius:10px;border-left:4px solid #B45309;">
        <p style="color:#B45309;font-size:13px;margin:0;font-weight:600;">
            ⚠️ Recordá actualizar o renovar estas dinámicas antes de su vencimiento 
            para evitar interrupciones en las campañas comerciales.
        </p>
    </div>
    """

    return template_base(
        f"⏰ {len(dinamicas)} dinámica{'s' if len(dinamicas) > 1 else ''} por vencer",
        contenido,
        "#B45309"
    )

# ── Template: Nueva carga de información ──────────────────
def template_nueva_carga(
    nombre_usuario: str,
    archivo: str,
    dinamica: str,
    registros: int,
    pais: str,
    cargado_por: str
) -> str:
    pais_label = {"CR": "🇨🇷 Costa Rica", "GT": "🇬🇹 Guatemala", "SV": "🇸🇻 El Salvador"}.get(pais, pais)
    color_pais = {"CR": "#002B7F", "GT": "#1A6DB5", "SV": "#0F47AF"}.get(pais, "#1E2761")

    contenido = f"""
    <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hola <strong>{nombre_usuario}</strong>, se ha realizado una nueva carga 
        de información en PromoIQ para tu país.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;margin-bottom:20px;">
        <tr style="background:{color_pais};">
            <td colspan="2" style="padding:16px 20px;">
                <p style="color:#ffffff;font-size:16px;font-weight:800;margin:0;">📤 Detalle de la carga</p>
            </td>
        </tr>
        <tr style="background:#F8FAFC;">
            <td style="padding:12px 20px;font-size:13px;color:#8892A4;font-weight:700;width:40%;">ARCHIVO</td>
            <td style="padding:12px 20px;font-size:14px;color:#1E2761;font-weight:600;">{archivo}</td>
        </tr>
        <tr>
            <td style="padding:12px 20px;font-size:13px;color:#8892A4;font-weight:700;">DINÁMICA</td>
            <td style="padding:12px 20px;font-size:14px;color:#1E2761;font-weight:600;">{dinamica}</td>
        </tr>
        <tr style="background:#F8FAFC;">
            <td style="padding:12px 20px;font-size:13px;color:#8892A4;font-weight:700;">REGISTROS</td>
            <td style="padding:12px 20px;">
                <span style="background:#F0FDF4;color:#06847A;font-size:16px;font-weight:900;padding:4px 12px;border-radius:20px;">
                    ✅ {registros} registros
                </span>
            </td>
        </tr>
        <tr>
            <td style="padding:12px 20px;font-size:13px;color:#8892A4;font-weight:700;">PAÍS</td>
            <td style="padding:12px 20px;font-size:14px;color:#1E2761;font-weight:600;">{pais_label}</td>
        </tr>
        <tr style="background:#F8FAFC;">
            <td style="padding:12px 20px;font-size:13px;color:#8892A4;font-weight:700;">CARGADO POR</td>
            <td style="padding:12px 20px;font-size:14px;color:#1E2761;font-weight:600;">{cargado_por}</td>
        </tr>
        <tr>
            <td style="padding:12px 20px;font-size:13px;color:#8892A4;font-weight:700;">FECHA</td>
            <td style="padding:12px 20px;font-size:14px;color:#1E2761;font-weight:600;">
                {datetime.now().strftime("%d/%m/%Y %H:%M")}
            </td>
        </tr>
    </table>

    <div style="padding:16px;background:#EEF2FF;border-radius:10px;border-left:4px solid #1E2761;">
        <p style="color:#1E2761;font-size:13px;margin:0;font-weight:600;">
            ℹ️ La información ya está disponible en PromoIQ para consultas 
            y análisis por todos los usuarios de {pais_label}.
        </p>
    </div>
    """

    return template_base(
        "📤 Nueva carga de información",
        contenido,
        color_pais
    )

# ── ENDPOINTS ─────────────────────────────────────────────

@router.post("/test")
def test_email(usuario=Depends(verificar_token)):
    """Envía un email de prueba al usuario logueado"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT email_notificaciones FROM usuario_perfil_ia
        WHERE usuario_id = ?
    """, (usuario["id"],))

    perfil = cursor.fetchone()
    conn.close()

    if not perfil or not perfil[0]:
        raise HTTPException(
            status_code=400,
            detail="No tenés email configurado. Agregalo desde el Asistente IA."
        )

    html = template_base(
        "✅ Email de prueba",
        f"""
        <p style="color:#555;font-size:15px;line-height:1.6;">
            Hola <strong>{usuario['nombre']}</strong>, este es un email de prueba de PromoIQ.
            Las notificaciones están configuradas correctamente. 🎉
        </p>
        <div style="padding:16px;background:#F0FDF4;border-radius:10px;border-left:4px solid #06847A;margin-top:16px;">
            <p style="color:#06847A;font-size:13px;margin:0;font-weight:600;">
                ✅ Tu email corporativo está verificado y listo para recibir notificaciones.
            </p>
        </div>
        """
    )

    exito = enviar_email(perfil[0], "✅ PromoIQ — Email de prueba", html)

    if exito:
        return {"mensaje": f"Email de prueba enviado a {perfil[0]}"}
    raise HTTPException(status_code=500, detail="Error enviando el email")



@router.get("/dinamicas-vencer/preview")
def preview_dinamicas_vencer(
    dias_limite: int = 7,
    pais: str = None,
    usuario=Depends(verificar_token)
):
    """
    Previsualiza qué dinámicas están por vencer y quiénes recibirían
    la notificación, sin enviar nada todavía.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")

    pais_filtro = usuario["pais"] if usuario["rol"] != "superadmin" else pais

    conn = get_connection()
    cursor = conn.cursor()

    if pais_filtro:
        cursor.execute("""
            SELECT d.nombre, d.fecha_fin,
                   DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias,
                   COUNT(dd.id) as articulos
            FROM dinamicas d
            LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id AND dd.activo = 1
            WHERE d.activa = 1 AND d.pais = ?
            AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND ?
            GROUP BY d.nombre, d.fecha_fin
            ORDER BY dias ASC
        """, (pais_filtro, dias_limite))
    else:
        cursor.execute("""
            SELECT d.nombre, d.fecha_fin,
                   DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias,
                   COUNT(dd.id) as articulos
            FROM dinamicas d
            LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id AND dd.activo = 1
            WHERE d.activa = 1
            AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND ?
            GROUP BY d.nombre, d.fecha_fin
            ORDER BY dias ASC
        """, (dias_limite,))

    dinamicas = [
        {
            "nombre": r[0],
            "fecha_fin": r[1].strftime("%d/%m/%Y"),
            "dias": r[2],
            "articulos": r[3]
        }
        for r in cursor.fetchall()
    ]
    conn.close()

    destinatarios = obtener_destinatarios_vencimiento(usuario, pais)

    return {
        "dinamicas": dinamicas,
        "destinatarios": destinatarios,
        "total_destinatarios": len(destinatarios)
    }



@router.post("/dinamicas-vencer")
def notificar_dinamicas_vencer(
    background_tasks: BackgroundTasks,
    dias_limite: int = 7,
    pais: str = None,
    usuario=Depends(verificar_token)
):
    """
    Envía alertas a todos los usuarios con email configurado
    sobre dinámicas que vencen en los próximos días.
    Los envíos ocurren en background — esta respuesta confirma que se encolaron,
    no que ya llegaron.
    """
    if usuario["rol"] not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso no autorizado")

    pais_filtro = usuario["pais"] if usuario["rol"] != "superadmin" else pais

    conn = get_connection()
    cursor = conn.cursor()

    if pais_filtro:
        cursor.execute("""
            SELECT d.nombre, d.fecha_fin,
                   DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias,
                   COUNT(dd.id) as articulos
            FROM dinamicas d
            LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id AND dd.activo = 1
            WHERE d.activa = 1 AND d.pais = ?
            AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND ?
            GROUP BY d.nombre, d.fecha_fin
            ORDER BY dias ASC
        """, (pais_filtro, dias_limite))
    else:
        cursor.execute("""
            SELECT d.nombre, d.fecha_fin,
                   DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias,
                   COUNT(dd.id) as articulos
            FROM dinamicas d
            LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id AND dd.activo = 1
            WHERE d.activa = 1
            AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND ?
            GROUP BY d.nombre, d.fecha_fin
            ORDER BY dias ASC
        """, (dias_limite,))

    dinamicas = [
        {
            "nombre": r[0],
            "fecha_fin": r[1].strftime("%d/%m/%Y"),
            "dias": r[2],
            "articulos": r[3]
        }
        for r in cursor.fetchall()
    ]
    conn.close()

    if not dinamicas:
        return {"mensaje": "No hay dinámicas por vencer en ese período", "en_cola": 0}

    destinatarios = obtener_destinatarios_vencimiento(usuario, pais)

    if not destinatarios:
        return {"mensaje": "No hay usuarios con email configurado", "en_cola": 0}

    en_cola = 0
    for d in destinatarios:
        html = template_dinamica_vencer(d["nombre"], dinamicas)
        background_tasks.add_task(
            enviar_email,
            d["email"],
            f"⏰ PromoIQ — {len(dinamicas)} dinámica{'s' if len(dinamicas) > 1 else ''} por vencer",
            html
        )
        en_cola += 1

    return {
        "mensaje": f"{en_cola} notificación{'es' if en_cola != 1 else ''} encolada{'s' if en_cola != 1 else ''} para envío",
        "dinamicas": len(dinamicas),
        "en_cola": en_cola
    }


@router.post("/nueva-carga")
def notificar_nueva_carga(
    archivo: str,
    dinamica_id: int,
    registros: int,
    pais: str,
    background_tasks: BackgroundTasks,
    usuario=Depends(verificar_token)
):
    """
    Notifica a los usuarios del país sobre una nueva carga de información.
    Se llama automáticamente después de cada carga exitosa.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Obtener nombre de la dinámica
    cursor.execute("SELECT nombre FROM dinamicas WHERE id = ?", (dinamica_id,))
    din = cursor.fetchone()
    nombre_dinamica = din[0] if din else "Dinámica"

    # Obtener usuarios con email del país
    cursor.execute("""
        SELECT u.nombre, p.email_notificaciones
        FROM usuario_perfil_ia p
        INNER JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.email_confirmado = 1
        AND p.email_notificaciones IS NOT NULL
        AND u.pais = ? AND u.activo = 1
    """, (pais,))

    usuarios_notificar = cursor.fetchall()
    conn.close()

    if not usuarios_notificar:
        return {"mensaje": "No hay usuarios con email configurado en este país", "en_cola": 0}

        en_cola = 0
    for u in usuarios_notificar:
        nombre_dest = u[0]
        email_dest = u[1]
        html = template_nueva_carga(
            nombre_dest, archivo, nombre_dinamica,
            registros, pais, usuario["nombre"]
        )
        background_tasks.add_task(
            enviar_email,
            email_dest,
            f"📤 PromoIQ — Nueva carga de información en {pais}",
            html
        )
        en_cola += 1

    return {
        "mensaje": f"{en_cola} notificación{'es' if en_cola != 1 else ''} encolada{'s' if en_cola != 1 else ''} para envío",
        "destinatarios": en_cola
    }

@router.get("/mis-notificaciones")
def mis_notificaciones(usuario=Depends(verificar_token)):
    """Retorna el estado de notificaciones del usuario"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT email_notificaciones, email_confirmado
        FROM usuario_perfil_ia WHERE usuario_id = ?
    """, (usuario["id"],))

    perfil = cursor.fetchone()
    conn.close()

    if not perfil:
        return {"email_configurado": False, "email": None}

    return {
        "email_configurado": bool(perfil[1]),
        "email": perfil[0]
    }



from datetime import datetime as dt_module

def job_notificar_vencimientos_automatico():
    """
    Job programado que corre una vez al día (independiente de que alguien
    haya iniciado sesión). Revisa dinámicas por vencer en cada país,
    evita reenviar la misma dinámica el mismo día, y envía las alertas.
    """
    app_logger.info("[job_vencimientos] Ejecutando job automático de notificaciones de vencimiento...")
    conn = get_connection()
    cursor = conn.cursor()
    hoy = dt_module.now().date()

    for pais in ["CR", "GT", "SV"]:
        cursor.execute("""
            SELECT d.id, d.nombre, d.fecha_fin,
                   DATEDIFF(DAY, GETDATE(), d.fecha_fin) as dias,
                   COUNT(dd.id) as articulos
            FROM dinamicas d
            LEFT JOIN dinamica_detalle dd ON d.id = dd.dinamica_id AND dd.activo = 1 AND dd.pais = ?
            WHERE d.activa = 1 AND d.pais = ?
            AND DATEDIFF(DAY, GETDATE(), d.fecha_fin) BETWEEN 0 AND 7
            GROUP BY d.id, d.nombre, d.fecha_fin
        """, (pais, pais))
        dinamicas_pais = cursor.fetchall()

        dinamicas_a_notificar = []
        for d in dinamicas_pais:
            dinamica_id = d[0]
            cursor.execute("""
                SELECT COUNT(*) FROM notificacion_vencimiento_log
                WHERE dinamica_id = ? AND fecha_envio = ?
            """, (dinamica_id, hoy))
            ya_enviado = cursor.fetchone()[0] > 0
            if not ya_enviado:
                dinamicas_a_notificar.append({
                    "id": dinamica_id,
                    "nombre": d[1],
                    "fecha_fin": d[2].strftime("%d/%m/%Y"),
                    "dias": d[3],
                    "articulos": d[4]
                })

        if not dinamicas_a_notificar:
            continue

        cursor.execute("""
            SELECT u.nombre, p.email_notificaciones
            FROM usuario_perfil_ia p
            INNER JOIN usuarios u ON p.usuario_id = u.id
            WHERE p.email_confirmado = 1 AND p.email_notificaciones IS NOT NULL
            AND u.pais = ? AND u.activo = 1
        """, (pais,))
        destinatarios = cursor.fetchall()

        for u in destinatarios:
            nombre_dest, email_dest = u[0], u[1]
            html = template_dinamica_vencer(nombre_dest, dinamicas_a_notificar)
            enviar_email(
                email_dest,
                f"⏰ PromoIQ — {len(dinamicas_a_notificar)} dinámica{'s' if len(dinamicas_a_notificar) > 1 else ''} por vencer",
                html
            )

        # Registrar como enviadas para no repetirlas hoy
        for d in dinamicas_a_notificar:
            try:
                cursor.execute("""
                    INSERT INTO notificacion_vencimiento_log (dinamica_id, pais, fecha_envio)
                    VALUES (?, ?, ?)
                """, (d["id"], pais, hoy))
                conn.commit()
            except Exception as e:
                app_logger.warning(f"[job_vencimientos] Error registrando notificación enviada (dinámica {d['id']}, {pais}): {e}")

    conn.close()
    app_logger.info("[job_vencimientos] Job de notificaciones completado.")