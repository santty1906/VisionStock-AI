# learned_db.py  (PYTHON 3.9 compatible)
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple

import numpy as np

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "learned_objects.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS learned_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    label TEXT NOT NULL,
    emb BLOB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learned_label ON learned_embeddings(label);
CREATE INDEX IF NOT EXISTS idx_learned_ts ON learned_embeddings(ts);
"""


def _ensure_parent(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def _connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    _ensure_parent(db_path)
    conn = sqlite3.connect(str(db_path), timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    try:
        yield conn
    finally:
        conn.close()

def init_db(db_path: Path = DB_PATH) -> None:
    with _connect(db_path) as conn:
        conn.executescript(SCHEMA)
        conn.commit()

def save_object(label: str, emb, ts: Optional[str] = None, db_path: Path = DB_PATH) -> None:
    label = (label or "").strip()
    if not label:
        raise ValueError("label must not be empty")

    init_db(db_path)
    if ts is None:
        ts = datetime.now().isoformat(timespec="seconds")

    emb = np.asarray(emb, dtype="float32")
    blob = emb.tobytes()

    with _connect(db_path) as conn:
        conn.execute(
            "INSERT INTO learned_embeddings (ts, label, emb) VALUES (?, ?, ?)",
            (ts, label, blob)
        )
        conn.commit()

def load_embeddings_grouped(db_path: Path = DB_PATH) -> Dict[str, List[np.ndarray]]:
    init_db(db_path)

    with _connect(db_path) as conn:
        rows = conn.execute("SELECT label, emb FROM learned_embeddings").fetchall()
        groups: Dict[str, List[np.ndarray]] = {}
        for label, blob in rows:
            vec = np.frombuffer(blob, dtype="float32")
            groups.setdefault(label, []).append(vec)
        return groups

def get_last_learned(n: int = 5, db_path: Path = DB_PATH) -> List[Tuple[str, str]]:
    init_db(db_path)

    with _connect(db_path) as conn:
        rows = conn.execute(
            "SELECT label, ts FROM learned_embeddings ORDER BY id DESC LIMIT ?",
            (int(n),)
        ).fetchall()
        return [(r[0], r[1]) for r in rows]

def get_label_counts(limit: int = 15, db_path: Path = DB_PATH) -> List[Tuple[str, int]]:
    init_db(db_path)

    with _connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT label, COUNT(*) as c
            FROM learned_embeddings
            GROUP BY label
            ORDER BY c DESC
            LIMIT ?
            """,
            (int(limit),)
        ).fetchall()
        return [(r[0], int(r[1])) for r in rows]
