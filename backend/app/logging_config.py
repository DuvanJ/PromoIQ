import logging
from logging.handlers import RotatingFileHandler
import os

# ── Configuración centralizada de logging ──────────────────
# Dos archivos separados:
#  - app.log: errores y eventos generales (excepciones, arranque, etc.)
#  - access.log: una línea por cada request (método, ruta, status, tiempo)
#
# RotatingFileHandler evita que los logs crezcan sin límite en disco —
# al llegar a maxBytes, rota el archivo y conserva backupCount copias
# viejas antes de descartarlas.

LOG_DIR = os.getenv("LOG_DIR", "logs")
os.makedirs(LOG_DIR, exist_ok=True)

MAX_BYTES = 5 * 1024 * 1024  # 5 MB por archivo
BACKUP_COUNT = 5             # conserva hasta 5 archivos rotados


def _crear_logger(nombre: str, archivo: str, nivel=logging.INFO) -> logging.Logger:
    logger = logging.getLogger(nombre)
    logger.setLevel(nivel)

    if logger.handlers:
        return logger  # evita duplicar handlers si se importa más de una vez

    handler = RotatingFileHandler(
        os.path.join(LOG_DIR, archivo),
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    formato = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formato)
    logger.addHandler(handler)

    # También muestra en consola — útil mientras siga corriendo local
    consola = logging.StreamHandler()
    consola.setFormatter(formato)
    logger.addHandler(consola)

    return logger


app_logger = _crear_logger("promoiq.app", "app.log")
access_logger = _crear_logger("promoiq.access", "access.log")
