"""
app.py
Servidor Flask para el sistema de optimización de corte 5020.
"""

from __future__ import annotations

from typing import Optional, Tuple

from flask import Flask, render_template, request, jsonify, make_response
from flask.wrappers import Response
from optimizador import calcular_optimizacion
import logging
import os

# ─────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────

app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
logger = logging.getLogger(__name__)

CORS_ORIGIN: str = os.environ.get("CORS_ORIGIN", "*")


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _json_response(payload: dict, status: int) -> Response:
    """Crea una Response JSON con headers CORS correctos."""
    res = make_response(jsonify(payload), status)
    res.headers["Content-Type"] = "application/json; charset=utf-8"
    res.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
    res.headers["Access-Control-Allow-Headers"] = "Content-Type"
    res.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return res


def _error(
    mensaje: str,
    status: int,
    detalles: Optional[dict] = None,   # ← corregido: Optional[dict] en lugar de dict
) -> Response:
    payload: dict = {"error": True, "mensaje": mensaje}
    if detalles:
        payload["detalles"] = detalles
    return _json_response(payload, status)


def _extraer_entero(
    data: dict,
    clave: str,
) -> Tuple[Optional[int], Optional[str]]:
    """
    Extrae y convierte un valor del dict a entero.
    Retorna (valor, None) en éxito o (None, mensaje_error) en fallo.
    """
    valor_raw = data.get(clave)
    if valor_raw is None:
        return None, f"El campo '{clave}' es requerido."
    try:
        return int(float(str(valor_raw))), None
    except (ValueError, TypeError):
        return None, f"'{clave}' debe ser un número entero. Recibido: '{valor_raw}'."


# ─────────────────────────────────────────────
# RUTAS
# ─────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index() -> str:
    return render_template("index.html")


@app.route("/api/optimizar", methods=["POST", "OPTIONS"])
def api_optimizar() -> Response:
    # Preflight CORS
    if request.method == "OPTIONS":
        res = make_response("", 204)
        res.headers["Access-Control-Allow-Origin"] = CORS_ORIGIN
        res.headers["Access-Control-Allow-Headers"] = "Content-Type"
        res.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        return res

    # ── Verificar Content-Type ──────────────────
    if not request.is_json:
        return _error("El Content-Type debe ser 'application/json'.", 400)

    # ── Parsear body ───────────────────────────
    data: Optional[dict] = request.get_json(silent=True)
    if data is None:
        return _error("El cuerpo de la petición no es JSON válido o está vacío.", 400)

    # ── Validar campos ─────────────────────────
    ancho_mm, e1 = _extraer_entero(data, "ancho_mm")
    if e1 or ancho_mm is None:
        return _error("Datos de entrada inválidos.", 400, detalles={"ancho_mm": e1})

    alto_mm, e2 = _extraer_entero(data, "alto_mm")
    if e2 or alto_mm is None:
        return _error("Datos de entrada inválidos.", 400, detalles={"alto_mm": e2})

    # Aquí el linter ya sabe al 100% que ambos son estrictamente 'int'
    # ── Calcular ───────────────────────────────
    try:
        logger.info("Calculando: ancho=%d mm, alto=%d mm", ancho_mm, alto_mm)
        resultado: dict = calcular_optimizacion(ancho_mm=ancho_mm, alto_mm=alto_mm)
        return _json_response(resultado, 200)

    except (ValueError, TypeError) as exc:
        logger.warning("Validación de dominio: %s", exc)
        return _error(str(exc), 400)

    except RuntimeError as exc:
        logger.error("Error de optimización: %s", exc)
        return _error(str(exc), 422)

    except Exception as exc:
        logger.exception("Error interno: %s", exc)
        return _error("Error interno del servidor. Revisa los logs de Flask.", 500)


# ─────────────────────────────────────────────
# MANEJADORES DE ERROR GLOBALES
# ─────────────────────────────────────────────

@app.errorhandler(404)
def not_found(_err: Exception) -> Response:
    if request.path.startswith("/api/"):
        return _error("Endpoint no encontrado.", 404)
    return make_response(render_template("index.html"), 404)


@app.errorhandler(405)
def method_not_allowed(_err: Exception) -> Response:
    return _error("Método HTTP no permitido para esta ruta.", 405)


@app.errorhandler(500)
def internal_error(_err: Exception) -> Response:
    return _error("Error interno del servidor.", 500)


# ─────────────────────────────────────────────
# ARRANQUE
# ─────────────────────────────────────────────

if __name__ == "__main__":
    port: int = int(os.environ.get("PORT", 8080))
    debug: bool = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    # En Windows, "0.0.0.0" puede ser bloqueado por el firewall/Hyper-V.
    # Usamos 127.0.0.1 por defecto y solo abrimos a todas las interfaces
    # si el usuario lo solicita explícitamente con HOST=0.0.0.0
    host: str = os.environ.get("HOST", "127.0.0.1")

    logger.info("Iniciando servidor en http://%s:%d", host, port)
    app.run(host=host, port=port, debug=debug)