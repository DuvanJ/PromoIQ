# ============================================================
# scheduler_standalone.py
# Descripción: Proceso independiente para tareas programadas.
# Se ejecuta APARTE de uvicorn — así escalar el servidor web con
# --workers no duplica los jobs (cada worker de uvicorn tendría
# su propio scheduler si viviera dentro de main.py).
#
# Uso local:
#   python scheduler_standalone.py
#
# Se deja corriendo en una terminal aparte (o como tarea de
# Windows / servicio) mientras uvicorn corre en la suya. El día
# de la migración a Azure, este archivo se reemplaza por una
# Azure Function con Timer Trigger que llame la misma función
# job_notificar_vencimientos_automatico — la lógica del job no
# cambia, solo quién la dispara.
# ============================================================

import time
from apscheduler.schedulers.background import BackgroundScheduler
from app.routers.notificaciones import job_notificar_vencimientos_automatico
from app.logging_config import app_logger

scheduler = BackgroundScheduler()

scheduler.add_job(
    job_notificar_vencimientos_automatico,
    'cron',
    hour=8,
    minute=0,
    id='notificar_vencimientos',
    replace_existing=True
)


def iniciar():
    scheduler.start()
    app_logger.info("Scheduler standalone iniciado — corre todos los días a las 8:00 AM")
    print("🕐 Scheduler standalone iniciado — corre todos los días a las 8:00 AM")
    print("   (dejá esta terminal abierta; Ctrl+C para detener)")

    try:
        # Mantiene el proceso vivo indefinidamente — BackgroundScheduler
        # corre en un hilo aparte, así que sin este loop el script
        # terminaría inmediatamente y el scheduler moriría con él.
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        app_logger.info("Scheduler standalone detenido manualmente")
        print("🛑 Scheduler standalone detenido")


if __name__ == "__main__":
    iniciar()