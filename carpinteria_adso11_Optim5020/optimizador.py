"""
optimizador.py
Motor de despiece 5020 y algoritmo de optimización de corte 1D (First-Fit Decreasing).
Referencia: Línea Comercial 5020 – Ventana Corredera 2 Hojas.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import math


# ─────────────────────────────────────────────
# CONSTANTES DEL SISTEMA
# ─────────────────────────────────────────────
LONGITUD_BARRA_MM: int = 6000        # Longitud estándar de barra de aluminio (mm)
GROSOR_DISCO_MM: int = 4             # Pérdida por corte de sierra (mm)
MIN_DIMENSION_MM: int = 300          # Mínimo constructivo de una ventana
MAX_DIMENSION_MM: int = 3000         # Máximo constructivo de una ventana


# ─────────────────────────────────────────────
# CLASES DE DOMINIO
# ─────────────────────────────────────────────

@dataclass
class Pieza:
    """Representa una pieza de aluminio resultante del despiece."""
    nombre: str
    referencia: str
    longitud_mm: int
    cantidad: int
    angulo_corte: str = "90°"          # Ángulo de corte (90° o 45°)
    descripcion: str = ""              # Nota técnica adicional
    componente_svg: str = ""           # ID del elemento SVG asociado

    def __post_init__(self) -> None:
        if self.longitud_mm <= 0:
            raise ValueError(f"Longitud inválida para pieza '{self.nombre}': {self.longitud_mm} mm")
        if self.cantidad <= 0:
            raise ValueError(f"Cantidad inválida para pieza '{self.nombre}': {self.cantidad}")

    @property
    def longitud_total_mm(self) -> int:
        """Longitud total consumida (pieza + cortes)."""
        return self.longitud_mm

    def to_dict(self) -> dict:
        return {
            "nombre": self.nombre,
            "referencia": self.referencia,
            "longitud_mm": self.longitud_mm,
            "cantidad": self.cantidad,
            "angulo_corte": self.angulo_corte,
            "descripcion": self.descripcion,
            "componente_svg": self.componente_svg,
        }


@dataclass
class Corte:
    """Representa un corte individual asignado dentro de una barra."""
    pieza: Pieza
    posicion_inicio_mm: int
    posicion_fin_mm: int

    @property
    def longitud_mm(self) -> int:
        return self.pieza.longitud_mm

    def to_dict(self) -> dict:
        return {
            "nombre": self.pieza.nombre,
            "referencia": self.pieza.referencia,
            "longitud_mm": self.longitud_mm,
            "posicion_inicio_mm": self.posicion_inicio_mm,
            "posicion_fin_mm": self.posicion_fin_mm,
            "componente_svg": self.pieza.componente_svg,
        }


@dataclass
class Barra:
    """Representa una barra de aluminio de 6000 mm en proceso de llenado."""
    numero: int
    longitud_total_mm: int = LONGITUD_BARRA_MM
    cortes: list[Corte] = field(default_factory=list)
    _espacio_usado_mm: int = 0

    @property
    def espacio_disponible_mm(self) -> int:
        return self.longitud_total_mm - self._espacio_usado_mm

    @property
    def sobrante_mm(self) -> int:
        return self.espacio_disponible_mm

    @property
    def porcentaje_uso(self) -> float:
        return round((self._espacio_usado_mm / self.longitud_total_mm) * 100, 1)

    def puede_alojar(self, longitud_pieza_mm: int) -> bool:
        """Verifica si la pieza + el disco de corte caben en el espacio restante."""
        costo_total = longitud_pieza_mm + GROSOR_DISCO_MM
        return costo_total <= self.espacio_disponible_mm

    def agregar_corte(self, pieza: Pieza) -> bool:
        """
        Intenta agregar una pieza a la barra.
        Retorna True si se pudo agregar, False en caso contrario.
        """
        if not self.puede_alojar(pieza.longitud_mm):
            return False

        inicio = self._espacio_usado_mm
        # El disco de sierra se consume ANTES de la pieza (excepto en el primero)
        if self.cortes:
            inicio += GROSOR_DISCO_MM
            self._espacio_usado_mm += GROSOR_DISCO_MM

        fin = inicio + pieza.longitud_mm
        self._espacio_usado_mm += pieza.longitud_mm

        corte = Corte(pieza=pieza, posicion_inicio_mm=inicio, posicion_fin_mm=fin)
        self.cortes.append(corte)
        return True

    def to_dict(self) -> dict:
        return {
            "numero": self.numero,
            "longitud_total_mm": self.longitud_total_mm,
            "espacio_usado_mm": self._espacio_usado_mm,
            "sobrante_mm": self.sobrante_mm,
            "porcentaje_uso": self.porcentaje_uso,
            "cortes": [c.to_dict() for c in self.cortes],
        }


# ─────────────────────────────────────────────
# MOTOR DE DESPIECE 5020
# ─────────────────────────────────────────────

class MotorDespiece5020:
    """
    Calcula todas las piezas de corte para la Ventana Corredera 2 Hojas
    según las fórmulas comerciales estándar de la línea 5020.

    Nomenclatura de la fórmula:
        A = Ancho total exterior de la ventana (mm)
        H = Alto total exterior de la ventana (mm)

    Fórmulas de descuento estándar 5020 – 2 hojas correderas:
        Cabezal   (1 ud): A - 0
        Sillar    (1 ud): A - 0
        Jambas    (2 ud): H - 0
        Zócalo M  (1 ud): A - 4   (zócalo macho / viga central)
        Ganchos   (4 ud): H - 20  (perfiles verticales de hoja)
        Traslapes (4 ud): H - 20  (parantes con traslape de hoja)
        Horizontales de hoja (4 ud): (A / 2) - 10
    """

    REFERENCIA = "5020"

    def __init__(self, ancho_mm: int, alto_mm: int) -> None:
        self._validar_dimensiones(ancho_mm, alto_mm)
        self.ancho_mm = ancho_mm
        self.alto_mm = alto_mm

    @staticmethod
    def _validar_dimensiones(ancho_mm: int, alto_mm: int) -> None:
        for nombre, valor in [("Ancho", ancho_mm), ("Alto", alto_mm)]:
            if not isinstance(valor, (int, float)):
                raise TypeError(f"{nombre} debe ser un número.")
            if valor < MIN_DIMENSION_MM:
                raise ValueError(
                    f"{nombre} mínimo permitido: {MIN_DIMENSION_MM} mm. Recibido: {valor} mm."
                )
            if valor > MAX_DIMENSION_MM:
                raise ValueError(
                    f"{nombre} máximo permitido: {MAX_DIMENSION_MM} mm. Recibido: {valor} mm."
                )

    def calcular_piezas(self) -> list[Pieza]:
        """Retorna la lista completa de piezas según las fórmulas 5020."""
        A = self.ancho_mm
        H = self.alto_mm

        piezas: list[Pieza] = [
            Pieza(
                nombre="Cabezal",
                referencia=self.REFERENCIA,
                longitud_mm=A,
                cantidad=1,
                angulo_corte="90°",
                descripcion="Perfil horizontal superior del marco fijo.",
                componente_svg="svg-cabezal",
            ),
            Pieza(
                nombre="Sillar",
                referencia=self.REFERENCIA,
                longitud_mm=A,
                cantidad=1,
                angulo_corte="90°",
                descripcion="Perfil horizontal inferior del marco fijo.",
                componente_svg="svg-sillar",
            ),
            Pieza(
                nombre="Jamba",
                referencia=self.REFERENCIA,
                longitud_mm=H,
                cantidad=2,
                angulo_corte="90°",
                descripcion="Perfiles verticales laterales del marco fijo (izq. y der.).",
                componente_svg="svg-jamba",
            ),
            Pieza(
                nombre="Zócalo",
                referencia=self.REFERENCIA,
                longitud_mm=A - 4,
                cantidad=1,
                angulo_corte="90°",
                descripcion="Viga central intermedia del marco (descuento: A - 4 mm).",
                componente_svg="svg-zocalo",
            ),
            Pieza(
                nombre="Gancho de Hoja",
                referencia=self.REFERENCIA,
                longitud_mm=H - 20,
                cantidad=4,
                angulo_corte="90°",
                descripcion="Perfiles verticales internos de cada hoja corrediza (descuento: H - 20 mm).",
                componente_svg="svg-gancho",
            ),
            Pieza(
                nombre="Traslape de Hoja",
                referencia=self.REFERENCIA,
                longitud_mm=H - 20,
                cantidad=4,
                angulo_corte="90°",
                descripcion="Parantes con traslape para el cierre de la hoja (descuento: H - 20 mm).",
                componente_svg="svg-traslape",
            ),
            Pieza(
                nombre="Horizontal de Hoja",
                referencia=self.REFERENCIA,
                longitud_mm=math.floor(A / 2) - 10,
                cantidad=4,
                angulo_corte="90°",
                descripcion="Perfiles horizontales superior e inferior de cada hoja (descuento: A/2 - 10 mm).",
                componente_svg="svg-horizontal-hoja",
            ),
        ]

        return piezas


# ─────────────────────────────────────────────
# ALGORITMO DE OPTIMIZACIÓN (FFD – 1D BIN PACKING)
# ─────────────────────────────────────────────

class Optimizador:
    """
    Implementa el algoritmo First-Fit Decreasing (FFD) para el problema
    de empaquetado 1D (Cutting Stock Problem).

    Estrategia:
        1. Expande cada Pieza en unidades individuales (según su cantidad).
        2. Ordena todas las unidades de mayor a menor longitud (FFD).
        3. Itera cada pieza e intenta ubicarla en la primera barra con espacio
           suficiente (considerando el grosor del disco de sierra).
        4. Si ninguna barra existente puede alojarla, abre una nueva.
    """

    def __init__(self, piezas: list[Pieza]) -> None:
        if not piezas:
            raise ValueError("La lista de piezas no puede estar vacía.")
        self.piezas = piezas

    def _expandir_unidades(self) -> list[Pieza]:
        """Convierte cada Pieza(cantidad=N) en N instancias individuales."""
        unidades: list[Pieza] = []
        for pieza in self.piezas:
            for _ in range(pieza.cantidad):
                unidades.append(pieza)
        return unidades

    def optimizar(self) -> list[Barra]:
        """
        Ejecuta el algoritmo FFD y retorna la lista de barras con sus cortes asignados.
        """
        # Paso 1: Expandir y ordenar descendentemente
        unidades = self._expandir_unidades()
        unidades_ordenadas = sorted(unidades, key=lambda p: p.longitud_mm, reverse=True)

        barras: list[Barra] = []

        for pieza in unidades_ordenadas:
            # Validación: pieza más larga que la barra
            if pieza.longitud_mm > LONGITUD_BARRA_MM:
                raise ValueError(
                    f"La pieza '{pieza.nombre}' ({pieza.longitud_mm} mm) "
                    f"supera la longitud de la barra ({LONGITUD_BARRA_MM} mm). "
                    "No es posible optimizar."
                )

            asignada = False
            # Paso 2: Buscar la primera barra que pueda alojar la pieza (First-Fit)
            for barra in barras:
                if barra.agregar_corte(pieza):
                    asignada = True
                    break

            # Paso 3: Abrir nueva barra si no hay espacio
            if not asignada:
                nueva_barra = Barra(numero=len(barras) + 1)
                if not nueva_barra.agregar_corte(pieza):
                    raise RuntimeError(
                        f"Error crítico: La pieza '{pieza.nombre}' ({pieza.longitud_mm} mm) "
                        "no pudo ser asignada ni en una barra vacía."
                    )
                barras.append(nueva_barra)

        return barras


# ─────────────────────────────────────────────
# FUNCIÓN DE ORQUESTACIÓN PRINCIPAL
# ─────────────────────────────────────────────

def calcular_optimizacion(ancho_mm: int, alto_mm: int) -> dict:
    """
    Punto de entrada principal del módulo.
    Ejecuta el despiece 5020 y la optimización FFD, retornando un dict
    serializable listo para la respuesta JSON del API.

    Args:
        ancho_mm: Ancho total de la ventana en milímetros.
        alto_mm:  Alto total de la ventana en milímetros.

    Returns:
        dict con claves: 'piezas', 'barras', 'resumen'.

    Raises:
        ValueError: Si las dimensiones son inválidas.
        RuntimeError: Si el algoritmo de optimización falla.
    """
    # 1. Despiece
    motor = MotorDespiece5020(ancho_mm=ancho_mm, alto_mm=alto_mm)
    piezas = motor.calcular_piezas()

    # 2. Optimización
    optimizador = Optimizador(piezas=piezas)
    barras = optimizador.optimizar()

    # 3. Resumen ejecutivo
    total_piezas = sum(p.cantidad for p in piezas)
    total_barras = len(barras)
    total_material_mm = total_barras * LONGITUD_BARRA_MM
    total_sobrante_mm = sum(b.sobrante_mm for b in barras)
    total_usado_mm = total_material_mm - total_sobrante_mm
    eficiencia = round((total_usado_mm / total_material_mm) * 100, 1) if total_material_mm > 0 else 0.0

    return {
        "dimensiones": {
            "ancho_mm": ancho_mm,
            "alto_mm": alto_mm,
        },
        "piezas": [p.to_dict() for p in piezas],
        "barras": [b.to_dict() for b in barras],
        "resumen": {
            "total_tipos_pieza": len(piezas),
            "total_piezas_individuales": total_piezas,
            "total_barras_usadas": total_barras,
            "longitud_barra_mm": LONGITUD_BARRA_MM,
            "grosor_disco_mm": GROSOR_DISCO_MM,
            "total_material_mm": total_material_mm,
            "total_usado_mm": total_usado_mm,
            "total_sobrante_mm": total_sobrante_mm,
            "eficiencia_porcentaje": eficiencia,
        },
    }
