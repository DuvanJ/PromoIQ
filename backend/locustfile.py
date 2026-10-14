"""
Prueba de carga para PromoIQ — simula usuarios reales navegando el
sistema: login, dashboard, consultas de catálogo y ventas.

Uso:
    locust -f locustfile.py --host=http://127.0.0.1:8000
"""

from locust import HttpUser, task, between
import random

# ── Credenciales de prueba ─────────────────────────────────
SUPERADMIN = {"tipo_acceso": "colaborador", "numero_colaborador": "1", "pais": "GLOBAL", "password": "admin123"}
COMERCIAL_CR = {"tipo_acceso": "colaborador", "numero_colaborador": "2", "pais": "CR", "password": "admin123"}


class UsuarioComercial(HttpUser):
    """Simula a alguien con rol comercial (Duvan) — puede ver ventas,
    dashboard y alertas de su país, pero NO el catálogo administrativo."""
    wait_time = between(2, 6)
    weight = 3  # más usuarios de este tipo que de superadmin — más realista

    def on_start(self):
        respuesta = self.client.post("/auth/login", json=COMERCIAL_CR)
        if respuesta.status_code == 200:
            self.token = respuesta.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = None
            self.headers = {}

    @task(3)
    def ver_dashboard(self):
        if self.token:
            self.client.get("/pais/dashboard", headers=self.headers, name="/pais/dashboard")

    @task(3)
    def ver_ventas_comercial(self):
        if self.token:
            self.client.get("/pais/ventas-comercial", headers=self.headers, name="/pais/ventas-comercial")

    @task(2)
    def ver_alertas(self):
        if self.token:
            self.client.get("/pais/alertas", headers=self.headers, name="/pais/alertas")

    @task(1)
    def health_check(self):
        self.client.get("/health", name="/health")


class UsuarioSuperadmin(HttpUser):
    """Simula al Superadmin — accede al catálogo administrativo y
    comparativas entre países, pero no a ventas-comercial (sin país propio)."""
    wait_time = between(2, 6)
    weight = 1  # menos usuarios de este tipo — hay un solo superadmin real

    def on_start(self):
        respuesta = self.client.post("/auth/login", json=SUPERADMIN)
        if respuesta.status_code == 200:
            self.token = respuesta.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            self.token = None
            self.headers = {}

    @task(2)
    def buscar_articulos_catalogo(self):
        if self.token:
            self.client.get(
                "/dinamicas/catalogo/articulos?busqueda=lu&pagina=1",
                headers=self.headers,
                name="/dinamicas/catalogo/articulos"
            )

    @task(1)
    def ver_comparativa_paises(self):
        if self.token:
            self.client.get("/admin/comparativa-paises", headers=self.headers, name="/admin/comparativa-paises")

    @task(1)
    def health_check(self):
        self.client.get("/health", name="/health")