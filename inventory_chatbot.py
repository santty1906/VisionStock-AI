from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, Optional


@dataclass
class LabelStats:
    label: str
    recent: int
    previous: int
    total: int

    @property
    def trend(self) -> float:
        if self.previous == 0:
            return 1.0 if self.recent > 0 else 0.0
        return (self.recent - self.previous) / self.previous


def parse_ts(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        return None


def label_stats(
    detections: Iterable[dict],
    window_days: int = 7,
) -> list[LabelStats]:
    now = datetime.now()
    recent_cutoff = now - timedelta(days=window_days)
    previous_cutoff = recent_cutoff - timedelta(days=window_days)

    totals: dict[str, int] = {}
    recent_counts: dict[str, int] = {}
    previous_counts: dict[str, int] = {}

    for det in detections:
        label = det.get("label") or "Sin etiqueta"
        totals[label] = totals.get(label, 0) + 1
        ts = parse_ts(det.get("ts"))
        if not ts:
            continue
        if ts >= recent_cutoff:
            recent_counts[label] = recent_counts.get(label, 0) + 1
        elif ts >= previous_cutoff:
            previous_counts[label] = previous_counts.get(label, 0) + 1

    stats = []
    for label, total in totals.items():
        stats.append(
            LabelStats(
                label=label,
                recent=recent_counts.get(label, 0),
                previous=previous_counts.get(label, 0),
                total=total,
            )
        )

    return sorted(stats, key=lambda s: (s.recent, s.total), reverse=True)


def format_list(items: list[str]) -> str:
    if not items:
        return "—"
    return ", ".join(items)


def plan_summary(detections: list[dict], window_days: int = 7) -> dict:
    stats = label_stats(detections, window_days=window_days)

    top_movers = [f"{s.label} ({s.recent})" for s in stats[:5] if s.recent > 0]
    slow_movers = [s.label for s in stats if s.recent == 0][:5]
    trending_up = [s.label for s in stats if s.trend >= 0.4 and s.recent >= 2][:4]
    trending_down = [s.label for s in stats if s.trend <= -0.4 and s.previous >= 2][:4]

    return {
        "top_movers": top_movers,
        "slow_movers": slow_movers,
        "trending_up": trending_up,
        "trending_down": trending_down,
        "total_labels": len(stats),
        "total_events": sum(s.total for s in stats),
        "window_days": window_days,
    }


def build_reply(prompt: str, detections: list[dict]) -> str:
    clean = (prompt or "").strip().lower()
    summary = plan_summary(detections)

    if any(word in clean for word in ("reabaste", "stock", "falt", "reponer")):
        return "\n".join(
            [
                "📦 Reabastecimiento sugerido",
                f"• Top movimiento ({summary['window_days']} días): {format_list(summary['top_movers'])}.",
                f"• Etiquetas sin movimiento reciente: {format_list(summary['slow_movers'])}.",
                f"• Tendencia al alza: {format_list(summary['trending_up'])}.",
                "• Acción: ajusta mínimos para las etiquetas en alza y confirma stock físico en las de baja rotación.",
            ]
        )

    if any(word in clean for word in ("plan", "semana", "conteo", "agenda")):
        return "\n".join(
            [
                "🗓️ Plan de inventario sugerido",
                "1) Lunes: conteo rápido de top 10 etiquetas y verificación de discrepancias.",
                "2) Miércoles: revisión de entradas recientes (AutoScan) y actualización de mínimos.",
                "3) Viernes: auditoría de etiquetas sin movimiento + exportar CSV.",
                f"• Enfoque de la semana: {format_list(summary['top_movers'])}.",
            ]
        )

    if any(word in clean for word in ("organiza", "ubic", "layout", "bodega", "almacen")):
        return "\n".join(
            [
                "🧭 Organización recomendada",
                "• Ubica alta rotación cerca del acceso para reducir tiempos.",
                "• Separa baja rotación en zonas más profundas.",
                f"• Alta rotación actual: {format_list(summary['top_movers'])}.",
                "• Marca zonas con etiquetas físicas (A/B/C) y registra con AutoScan.",
            ]
        )

    if any(word in clean for word in ("alerta", "riesgo", "variacion", "tendencia")):
        return "\n".join(
            [
                "📈 Tendencias",
                f"• Subiendo: {format_list(summary['trending_up'])}.",
                f"• Bajando: {format_list(summary['trending_down'])}.",
                "• Usa estas señales para ajustar mínimos y máximos.",
            ]
        )

    return "\n".join(
        [
            "✅ Puedo ayudarte con:",
            "• Planificación semanal",
            "• Reabastecimiento y mínimos",
            "• Organización de bodega",
            "• Tendencias y alertas",
            "Escribe por ejemplo: “plan semanal”, “reabastecimiento” o “tendencias”.",
        ]
    )