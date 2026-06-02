"""Reusable YOLO + CLIP vision pipeline for API and scripts."""

import logging
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Tuple

import cv2
import numpy as np
from ultralytics import YOLO

from db import insert_detection
from recognizer import Recognizer, resolve_device
from learned_db import save_object
from vision_utils import (
    center_in_rect,
    crop_safe,
    get_reticle_rect,
    iou,
    laplacian_sharpness,
    normalize_recognizer_output,
    safe_filename_component,
)

PERSON_CLASS_ID = 0  # COCO: person


logger = logging.getLogger(__name__)


def safe_recognize(rec: Recognizer, crop_bgr: np.ndarray):
    """
    Reconocer de forma robusta sin depender de un método único.
    """
    # 1) Si existe predict_bgr / classify_bgr, úsalo
    for fn in ["predict_bgr", "classify_bgr"]:
        if hasattr(rec, fn):
            try:
                return getattr(rec, fn)(crop_bgr)
            except Exception:
                pass

    # 2) Embedding + recognize (tu recognizer.py debería tener embed_bgr + recognize)
    emb = rec.embed_bgr(crop_bgr)

    if hasattr(rec, "recognize"):
        try:
            return rec.recognize(emb)  # (label, best_score, second_score, ambiguous)
        except Exception:
            pass

    # 3) Otros nombres posibles
    for fn in ["predict_embedding", "predict_emb", "match_embedding", "classify_embedding"]:
        if hasattr(rec, fn):
            try:
                return getattr(rec, fn)(emb)
            except Exception:
                pass

    return None


@dataclass
class VisionConfig:
    yolo_model_path: str = "yolov8m.pt"
    device: str = "auto"
    imgsz: int = 896
    yolo_conf: float = 0.22

    # calidad
    min_sharp: float = 35.0

    # reconocimiento mínimo para “ok”
    min_recog_conf: float = 0.22

    # guardar
    save_cooldown_sec: float = 2.5


class VisionService:
    def __init__(
        self,
        yolo_model_path: str = "yolov8m.pt",
        device: str = "auto",
        imgsz: int = 896,
        yolo_conf: float = 0.22,
        min_sharp: float = 35.0,
        min_recog_conf: float = 0.22,
        save_cooldown_sec: float = 2.5,
        captures_dir: str = "captures",
    ):
        resolved_device = resolve_device(device)
        self.cfg = VisionConfig(
            yolo_model_path=yolo_model_path,
            device=resolved_device,
            imgsz=int(imgsz),
            yolo_conf=float(yolo_conf),
            min_sharp=float(min_sharp),
            min_recog_conf=float(min_recog_conf),
            save_cooldown_sec=float(save_cooldown_sec),
        )

        self.model = YOLO(self.cfg.yolo_model_path)
        try:
            self.model.fuse()
        except Exception:
            pass

        self.rec = Recognizer(device=self.cfg.device, threshold=0.32, ambiguous_margin=0.03, use_knn_fallback=True, knn_topk=5)

        self.captures_dir = Path(captures_dir)
        self.captures_dir.mkdir(exist_ok=True)

        self._last_saved_by_label: Dict[str, float] = {}

    def _save_inventory_event(
        self,
        label: str,
        confidence: float,
        box_xyxy: Tuple[int, int, int, int],
        crop_bgr: np.ndarray,
        camera_id: str,
        model_name: str,
    ) -> str:
        ts_dt = datetime.now()
        ts_iso = ts_dt.isoformat(timespec="seconds").replace(":", "-")
        img_name = f"{ts_iso}_{safe_filename_component(label)}.jpg"
        img_abs = self.captures_dir / img_name
        img_rel = f"captures/{img_name}"

        cv2.imwrite(str(img_abs), crop_bgr)

        x1, y1, x2, y2 = box_xyxy
        insert_detection(
            ts=ts_dt,
            camera_id=camera_id,
            model=model_name,
            label=label,
            confidence=float(confidence),
            box_xyxy=(int(x1), int(y1), int(x2), int(y2)),
            image_path=img_rel,
        )
        return img_rel

    def _pick_box_or_reticle(self, frame_bgr: np.ndarray, reticle: Tuple[int, int, int, int], ignore_person: bool):
        """
        ✅ IMPORTANTE:
        - Si YOLO no detecta el objeto (muy común con engrapadora/clipsadora),
          usamos el recorte de la retícula como “box”.
        """
        best_box = None
        best_person_iou = 0.0

        res = self.model.predict(
            frame_bgr,
            conf=self.cfg.yolo_conf,
            imgsz=self.cfg.imgsz,
            device=self.cfg.device,
            verbose=False,
        )[0]

        if res.boxes is not None and len(res.boxes) > 0:
            for b in res.boxes:
                cls_id = int(b.cls[0])
                x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
                box = (x1, y1, x2, y2)

                # si es persona, medimos si invade retícula
                if cls_id == PERSON_CLASS_ID:
                    best_person_iou = max(best_person_iou, iou(box, reticle))
                    continue

                # escoger la primera caja cuyo centro cae en retícula
                if center_in_rect(box, reticle):
                    best_box = box
                    break

        # si hay persona tapando la retícula, bloqueamos
        if ignore_person and best_person_iou >= 0.35:
            return None, "person_in_reticle", {"person_iou": best_person_iou}

        # si YOLO no dio caja útil, usamos retícula
        if best_box is None:
            return reticle, "using_reticle_crop", {"person_iou": best_person_iou}

        return best_box, "yolo_box", {"person_iou": best_person_iou}

    def process_frame(
        self,
        frame_bgr: np.ndarray,
        reticle_size: int = 260,
        ignore_person: bool = True,
        save_to_inventory: bool = True,
        force_save: bool = False,
        camera_id: str = "web",
        model_name: str = "yolo+clip",
    ) -> Dict[str, Any]:
        reticle = get_reticle_rect(frame_bgr.shape, size=int(reticle_size))

        box, box_mode, dbg = self._pick_box_or_reticle(frame_bgr, reticle, ignore_person=ignore_person)
        if box is None:
            return {
                "ok": False,
                "recognized": False,
                "saved": False,
                "reason": "person_in_reticle",
                "label": None,
                "score": 0.0,
                "box": None,
                "reticle": list(reticle),
                "debug": {"box_mode": box_mode, **dbg},
            }

        crop = crop_safe(frame_bgr, box)
        if crop is None:
            return {
                "ok": False,
                "recognized": False,
                "saved": False,
                "reason": "bad_crop",
                "label": None,
                "score": 0.0,
                "box": list(box),
                "reticle": list(reticle),
                "debug": {"box_mode": box_mode, **dbg},
            }

        sharp = laplacian_sharpness(crop)
        if sharp < self.cfg.min_sharp:
            return {
                "ok": False,
                "recognized": False,
                "saved": False,
                "reason": "low_sharpness",
                "label": None,
                "score": 0.0,
                "box": list(box),
                "reticle": list(reticle),
                "debug": {"sharp": sharp, "box_mode": box_mode, **dbg},
            }

        # reconocer
        out = safe_recognize(self.rec, crop)
        label, score, ambiguous = normalize_recognizer_output(out)

        recognized = label is not None
        ok = recognized and (score >= self.cfg.min_recog_conf) and not ambiguous

        saved = False
        image_path = None
        reason = "ok" if ok else ("unrecognized" if not recognized else ("ambiguous" if ambiguous else "low_conf"))

        # guardar en inventario
        if save_to_inventory and recognized:
            now = time.time()
            last = self._last_saved_by_label.get(label, 0.0)
            cooldown_ok = (now - last) >= self.cfg.save_cooldown_sec

            if force_save or (ok and cooldown_ok):
                image_path = self._save_inventory_event(
                    label=label,
                    confidence=score,
                    box_xyxy=box,
                    crop_bgr=crop,
                    camera_id=camera_id,
                    model_name=model_name,
                )
                saved = True
                self._last_saved_by_label[label] = now
                reason = "saved"

        return {
            "ok": bool(ok),
            "recognized": bool(recognized),
            "saved": bool(saved),
            "reason": reason,
            "label": label,
            "score": float(score),
            "ambiguous": bool(ambiguous),
            "box": list(box),
            "reticle": list(reticle),
            "image_path": image_path,
            "debug": {
                "sharp": sharp,
                "min_sharp": self.cfg.min_sharp,
                "min_recog_conf": self.cfg.min_recog_conf,
                "box_mode": box_mode,
                **dbg,
            },
        }

    def learn_frame(
        self,
        frame_bgr: np.ndarray,
        label: str,
        reticle_size: int = 260,
        ignore_person: bool = True,
        cooldown_ms: int = 1200,
    ) -> Dict[str, Any]:
        label = (label or "").strip()
        if not label:
            return {"saved": False, "reason": "empty_label", "debug": {}}

        reticle = get_reticle_rect(frame_bgr.shape, size=int(reticle_size))

        box, box_mode, dbg = self._pick_box_or_reticle(frame_bgr, reticle, ignore_person=ignore_person)
        if box is None:
            return {
                "saved": False,
                "reason": "person_in_reticle",
                "debug": {"box_mode": box_mode, **dbg, "reticle": list(reticle)},
            }

        crop = crop_safe(frame_bgr, box)
        if crop is None:
            return {"saved": False, "reason": "bad_crop", "debug": {"box": list(box), "reticle": list(reticle)}}

        sharp = laplacian_sharpness(crop)
        if sharp < max(40.0, self.cfg.min_sharp):
            return {
                "saved": False,
                "reason": "low_sharpness",
                "debug": {"sharp": sharp, "box": list(box), "reticle": list(reticle), "box_mode": box_mode},
            }

        # embedding + guardar
        emb = self.rec.embed_bgr(crop)
        ts = datetime.now().isoformat(timespec="seconds")
        save_object(label, emb, ts)

        # ✅ MUY IMPORTANTE: recargar prototipos para que reconozca de una vez
        self.rec.reload()

        return {
            "saved": True,
            "reason": "learned",
            "debug": {
                "label": label,
                "sharp": sharp,
                "box": list(box),
                "reticle": list(reticle),
                "box_mode": box_mode,
                **dbg,
            },
        }
