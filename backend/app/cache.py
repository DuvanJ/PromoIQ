# ============================================================
# Módulo: cache.py
# Descripción: Cache simple en memoria con TTL (time-to-live),
# para evitar recalcular consultas pesadas en cada request.
#
# Incluye protección contra "cache stampede": si varias peticiones
# llegan casi al mismo tiempo pidiendo una clave que todavía no está
# en cache, solo UNA de ellas calcula el valor — las demás esperan
# ese resultado en vez de recalcular todas en paralelo (que es lo
# que saturaba el pool de conexiones bajo carga concurrente).
#
# Limitación conocida: vive en memoria del proceso — con varios
# workers de uvicorn, cada uno tiene su propia copia (no
# compartida). Para la escala actual está bien; si en el futuro
# se escala a múltiples instancias, esto debería migrar a un
# cache compartido (ej. Redis).
# ============================================================

import time
import threading
from app.logging_config import app_logger

_cache_lock = threading.Lock()
_cache_store = {}       # clave -> (valor, timestamp_expiracion)
_locks_por_clave = {}   # clave -> threading.Lock() individual


def _obtener_lock(clave: str) -> threading.Lock:
    """Devuelve (creándolo si hace falta) el lock específico de una clave."""
    with _cache_lock:
        if clave not in _locks_por_clave:
            _locks_por_clave[clave] = threading.Lock()
        return _locks_por_clave[clave]


def cache_get(clave: str):
    """Devuelve el valor cacheado si existe y no expiró, o None."""
    with _cache_lock:
        entrada = _cache_store.get(clave)
        if not entrada:
            return None
        valor, expira_en = entrada
        if time.time() > expira_en:
            del _cache_store[clave]
            return None
        return valor


def cache_set(clave: str, valor, ttl_segundos: int = 600):
    """Guarda un valor en cache con un tiempo de vida (default 10 min)."""
    with _cache_lock:
        _cache_store[clave] = (valor, time.time() + ttl_segundos)


def cache_invalidar(clave: str):
    """Elimina una clave específica del cache, si existe."""
    with _cache_lock:
        if clave in _cache_store:
            del _cache_store[clave]
            app_logger.info(f"[cache] Invalidada la clave '{clave}'")


def cache_invalidar_prefijo(prefijo: str):
    """Elimina todas las claves que empiecen con el prefijo dado."""
    with _cache_lock:
        claves_a_borrar = [k for k in _cache_store if k.startswith(prefijo)]
        for k in claves_a_borrar:
            del _cache_store[k]
        if claves_a_borrar:
            app_logger.info(f"[cache] Invalidadas {len(claves_a_borrar)} clave(s) con prefijo '{prefijo}'")


def cache_obtener_o_calcular(clave: str, funcion_calculo, ttl_segundos: int = 600):
    """
    Devuelve el valor cacheado si existe; si no, calcula UNA sola vez
    (incluso con varias peticiones concurrentes pidiendo la misma
    clave al mismo tiempo) y lo guarda. Esto evita la "estampida" de
    cálculos redundantes en paralelo que se vio en la prueba de carga.
    """
    valor = cache_get(clave)
    if valor is not None:
        return valor

    lock = _obtener_lock(clave)
    with lock:
        # Volver a chequear: mientras esperábamos el lock, es posible
        # que otra petición ya haya calculado y guardado el valor
        valor = cache_get(clave)
        if valor is not None:
            return valor

        valor = funcion_calculo()
        cache_set(clave, valor, ttl_segundos)
        return valor