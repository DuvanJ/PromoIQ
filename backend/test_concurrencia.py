"""
Pruebas de concurrencia para PromoIQ — dispara pares de acciones
CASI simultáneas sobre el mismo recurso, para detectar condiciones
de carrera que una prueba de carga normal (Locust) no revela, porque
Locust mide volumen, no coincidencia exacta en el tiempo.

Uso:
    python test_concurrencia.py
"""

import requests
import threading
import time

BASE_URL = "http://127.0.0.1:8000"

SUPERADMIN = {"tipo_acceso": "colaborador", "numero_colaborador": "1", "pais": "GLOBAL", "password": "admin123"}


def login(credenciales):
    r = requests.post(f"{BASE_URL}/auth/login", json=credenciales)
    r.raise_for_status()
    return r.json()["access_token"]


# ── Prueba 1: creación de usuarios con el mismo numero_colaborador+pais ──
def test_creacion_usuario_duplicado():
    print("\n=== Prueba 1: dos creaciones simultáneas, mismo numero_colaborador+pais ===")
    token = login(SUPERADMIN)
    headers = {"Authorization": f"Bearer {token}"}

    numero_prueba = "9999"  # usar un número que no exista todavía
    resultados = []

    def crear(nombre_sufijo):
        url = (
            f"{BASE_URL}/admin/usuarios/crear"
            f"?nombre=PruebaConcurrencia{nombre_sufijo}"
            f"&email=prueba{nombre_sufijo}@test.com"
            f"&password=test123"
            f"&rol_codigo=comercial"
            f"&pais=CR"
            f"&numero_colaborador={numero_prueba}"
        )
        r = requests.post(url, headers=headers)
        resultados.append((nombre_sufijo, r.status_code, r.json()))

    hilo_a = threading.Thread(target=crear, args=("A",))
    hilo_b = threading.Thread(target=crear, args=("B",))
    hilo_a.start()
    hilo_b.start()
    hilo_a.join()
    hilo_b.join()

    exitosos = [r for r in resultados if r[1] == 200]
    rechazados = [r for r in resultados if r[1] != 200]

    print(f"Exitosos: {len(exitosos)} | Rechazados: {len(rechazados)}")
    for nombre, status, body in resultados:
        print(f"  [{nombre}] status={status} → {body}")

    if len(exitosos) == 1 and len(rechazados) == 1:
        print("✅ CORRECTO: solo uno de los dos se creó, el índice único protegió el duplicado")
    elif len(exitosos) == 2:
        print("🔴 PROBLEMA: los DOS se crearon — el índice único no está evitando el duplicado bajo concurrencia")
    else:
        print("⚠️ Resultado inesperado — revisar manualmente")


# ── Prueba 2b: edición simultánea CON bloqueo optimista ──
def test_edicion_simultanea_con_bloqueo(registro_id: int, dinamica_id: int, sku_busqueda: str):
    """
    Simula el comportamiento real del frontend: ambos "usuarios" leen
    el registro primero (obteniendo su fecha_actualizacion), y luego
    intentan guardar mandando esa marca como fecha_actualizacion_vista.
    Con el bloqueo optimista, solo UNO de los dos debería tener éxito.

    Usa el parámetro `busqueda` para traer solo el SKU de interés, en
    vez de paginar entre miles de registros ordenados por SKU (que no
    coincide con el orden de id).
    """
    print(f"\n=== Prueba 2b: dos ediciones simultáneas CON bloqueo optimista, registro {registro_id} ===")
    token = login(SUPERADMIN)
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.get(
        f"{BASE_URL}/dinamicas/{dinamica_id}/detalle?pagina=1&por_pagina=10&busqueda={sku_busqueda}",
        headers=headers
    )
    print(f"Status del listado: {r.status_code}")
    body = r.json()
    print(f"Total registros que matchean la búsqueda: {body.get('total', 'N/A')}")

    registros = body.get("registros", [])
    registro = next((x for x in registros if x["id"] == registro_id), None)
    if not registro:
        print(f"⚠️ No se encontró el registro {registro_id} entre los {len(registros)} devueltos")
        print(f"IDs devueltos: {[x['id'] for x in registros]}")
        return

    fecha_vista = registro.get("fecha_actualizacion")
    print(f"Registro encontrado. fecha_actualizacion = {fecha_vista}")

    if not fecha_vista:
        print("⚠️ El registro no tiene fecha_actualizacion (es None) — el ALTER TABLE pudo no haberla inicializado para esta fila")
        return

    resultados = []

    def editar(valor_precio):
        r = requests.put(
            f"{BASE_URL}/dinamicas/detalle/{registro_id}",
            headers=headers,
            json={"precio_dinamica": valor_precio, "fecha_actualizacion_vista": fecha_vista}
        )
        try:
            cuerpo = r.json()
        except Exception:
            cuerpo = r.text
        resultados.append((valor_precio, r.status_code, cuerpo))

    hilo_a = threading.Thread(target=editar, args=(111.11,))
    hilo_b = threading.Thread(target=editar, args=(222.22,))
    hilo_a.start()
    hilo_b.start()
    hilo_a.join()
    hilo_b.join()

    for valor, status, cuerpo in resultados:
        print(f"  Intento con precio={valor} → status={status} → {cuerpo}")

    exitosos = [r for r in resultados if r[1] == 200]
    conflictos = [r for r in resultados if r[1] == 409]

    if len(exitosos) == 1 and len(conflictos) == 1:
        print("✅ CORRECTO: uno se guardó, el otro fue rechazado por conflicto (409)")
    elif len(exitosos) == 2:
        print("🔴 PROBLEMA: ambos se guardaron sin detectar el conflicto")
    else:
        print("⚠️ Resultado inesperado — revisar manualmente")


if __name__ == "__main__":
    test_creacion_usuario_duplicado()
    test_edicion_simultanea_con_bloqueo(registro_id=1, dinamica_id=1, sku_busqueda="440841")