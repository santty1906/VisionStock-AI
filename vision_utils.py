from __future__ import annotations

import re
from typing import Any, Optional, Tuple

import cv2
import numpy as np


_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def safe_filename_component(value: str, default: str = "item") -> str:
    text = _SAFE_NAME_RE.sub("_", (value or "").strip())
    text = text.strip("._-")
    return text or default


def laplacian_sharpness(bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def crop_safe(frame: np.ndarray, box: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
    x1, y1, x2, y2 = box
    h, w = frame.shape[:2]
    x1 = max(0, min(w - 1, int(x1)))
    x2 = max(0, min(w, int(x2)))
    y1 = max(0, min(h - 1, int(y1)))
    y2 = max(0, min(h, int(y2)))
    if x2 <= x1 or y2 <= y1:
        return None
    return frame[y1:y2, x1:x2]


def get_reticle_rect(shape, size: int = 260) -> Tuple[int, int, int, int]:
    h, w = shape[:2]
    cx, cy = w // 2, h // 2
    half = size // 2
    return (cx - half, cy - half, cx + half, cy + half)


def center_in_rect(box, rect) -> bool:
    x1, y1, x2, y2 = box
    rx1, ry1, rx2, ry2 = rect
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    return (rx1 <= cx <= rx2) and (ry1 <= cy <= ry2)


def rect_area(r) -> int:
    x1, y1, x2, y2 = r
    return max(0, x2 - x1) * max(0, y2 - y1)


def iou(a, b) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    iw = max(0, inter_x2 - inter_x1)
    ih = max(0, inter_y2 - inter_y1)
    inter = iw * ih
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter + 1e-9
    return float(inter / union)


def center_distance(box, frame_shape) -> int:
    h, w = frame_shape[:2]
    cx, cy = w // 2, h // 2
    x1, y1, x2, y2 = box
    bx, by = (x1 + x2) // 2, (y1 + y2) // 2
    return abs(cx - bx) + abs(cy - by)


def blend_box(old, new, alpha: float = 0.65):
    ox1, oy1, ox2, oy2 = old
    nx1, ny1, nx2, ny2 = new
    return (
        int(alpha * ox1 + (1 - alpha) * nx1),
        int(alpha * oy1 + (1 - alpha) * ny1),
        int(alpha * ox2 + (1 - alpha) * nx2),
        int(alpha * oy2 + (1 - alpha) * ny2),
    )


def box_area(box) -> int:
    x1, y1, x2, y2 = box
    return max(0, x2 - x1) * max(0, y2 - y1)


def box_aspect(box) -> float:
    x1, y1, x2, y2 = box
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
    return float(w) / float(h)


def normalize_recognizer_output(out: Any):
    if out is None:
        return None, 0.0, False

    if isinstance(out, dict):
        label = out.get("label") or out.get("name")
        score = out.get("score") or out.get("confidence") or 0.0
        ambiguous = out.get("ambiguous") or False
        return label, float(score), bool(ambiguous)

    if isinstance(out, (tuple, list)) and len(out) >= 2:
        label = out[0]
        score = float(out[1]) if out[1] is not None else 0.0
        ambiguous = bool(out[2]) if len(out) >= 3 else False
        return label, score, ambiguous

    if isinstance(out, str):
        return out, 1.0, False

    return None, 0.0, False