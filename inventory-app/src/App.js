import React, { useEffect, useMemo, useRef, useState } from "react";

const API = "http://127.0.0.1:8000";
const INVENTORY_TOKEN = "1234";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function fmtTs(ts) {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
      d.getHours()
    )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  } catch {
    return ts;
  }
}

function useInterval(callback, delay) {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // cámara / UI
  const [cameraOn, setCameraOn] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [ignorePerson, setIgnorePerson] = useState(true);

  // modo aprender
  const [learnLabel, setLearnLabel] = useState("");
  const [learning, setLearning] = useState(false);
  const [learnCount, setLearnCount] = useState(0);

  // autoscan timing
  const [cooldownMs, setCooldownMs] = useState(1200);

  // dashboard detections (inventario.db)
  const [stats, setStats] = useState({ total_events: 0, total_labels: 0 });
  const [counts, setCounts] = useState([]);
  const [items, setItems] = useState([]);
  const [viewMode, setViewMode] = useState("cards");
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [labelFilter, setLabelFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);

  // learned (learned_objects.db)
  const [learnedTop, setLearnedTop] = useState([]); // [{label,count}]
  const [learnedLast, setLearnedLast] = useState([]); // [[label,ts],...]

  // filtro por tiempo
  const [lastMinutes, setLastMinutes] = useState(0);

  // UX
  const [status, setStatus] = useState({ type: "info", msg: "Listo." });
  const [lastOverlay, setLastOverlay] = useState(null);
  const [reticle, setReticle] = useState(null);
  const [box, setBox] = useState(null);
  const [frameBusy, setFrameBusy] = useState(false);

  // chatbot
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState(() => [
    {
      id: 1,
      role: "bot",
      ts: Date.now(),
      text:
        "Hola 👋 Soy tu asistente de inventario. Puedo ayudarte a planificar conteos, reabastecimiento y organización. ¿Qué necesitas hoy?",
    },
  ]);

  // requisito de guardado inventario
  const MIN_SAVE_SCORE = 0.94;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // ---------- Helpers cámara ----------
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
      setStatus({ type: "ok", msg: "Cámara encendida." });

      // ✅ IMPORTANTÍSIMO: setear canvas al tamaño real del video
      setTimeout(() => syncCanvasToVideo(), 200);
    } catch (e) {
      console.error(e);
      setStatus({ type: "err", msg: "No pude encender la cámara. Revisa permisos." });
    }
  }

  function stopCamera() {
    try {
      const stream = videoRef.current?.srcObject;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch {}
    setCameraOn(false);
    setAutoScan(false);
    setLearning(false);
    setStatus({ type: "info", msg: "Cámara apagada." });
  }

  function syncCanvasToVideo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    // ✅ esto hace que el overlay SIEMPRE se dibuje alineado al video
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    // retícula centrada
    const size = 260;
    const x1 = Math.round(w / 2 - size / 2);
    const y1 = Math.round(h / 2 - size / 2);
    const x2 = x1 + size;
    const y2 = y1 + size;
    setReticle([x1, y1, x2, y2]);
  }

  async function getFrameBlob() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    // ✅ asegurar tamaño correcto ANTES de capturar
    syncCanvasToVideo();

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.90);
    });
  }

  // dibujar retícula + bbox + textos
  function drawOverlay() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");

    // ✅ asegurar tamaño correcto en cada frame
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // retícula (verde guía)
    if (reticle) {
      const [x1, y1, x2, y2] = reticle;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 255, 120, 0.95)";
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const cx = Math.round((x1 + x2) / 2);
      const cy = Math.round((y1 + y2) / 2);
      ctx.beginPath();
      ctx.moveTo(cx - 18, cy);
      ctx.lineTo(cx + 18, cy);
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx, cy + 18);
      ctx.stroke();
    }

    // bbox detectado (cyan)
    if (box) {
      const [x1, y1, x2, y2] = box;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 200, 255, 0.95)";
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    // overlay friendly
    if (lastOverlay) {
      const { title, subtitle, badge, badgeColor } = lastOverlay;

      ctx.font = "18px Arial";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(14, 14, 560, 92);

      ctx.fillStyle = "white";
      ctx.fillText(title || "", 24, 44);

      ctx.font = "14px Arial";
      ctx.fillText(subtitle || "", 24, 70);

      if (badge) {
        ctx.fillStyle = badgeColor || "rgba(255, 200, 0, 0.95)";
        ctx.fillRect(24, 78, Math.min(340, 12 * badge.length + 26), 26);
        ctx.fillStyle = "black";
        ctx.font = "14px Arial";
        ctx.fillText(badge, 32, 97);
      }
    }
  }

  useEffect(() => {
    if (!cameraOn) return;
    let raf = 0;
    const loop = () => {
      drawOverlay();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, reticle, box, lastOverlay]);

  // ---------- API ----------
  async function apiGet(path) {
    const r = await fetch(`${API}${path}`);
    if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
    return r.json();
  }

  async function sendFrameTo(endpoint, { label, save, force_save, cooldown_ms } = {}) {
    const blob = await getFrameBlob();
    if (!blob) throw new Error("No pude capturar frame (cámara apagada).");

    const fd = new FormData();
    fd.append("file", blob, "frame.jpg");

    const params = new URLSearchParams();
    if (label != null) params.set("label", label);
    if (save != null) params.set("save", String(save));
    if (force_save != null) params.set("force_save", String(force_save));
    if (cooldown_ms != null) params.set("cooldown_ms", String(cooldown_ms));
    params.set("ignore_person", String(ignorePerson));

    const url = `${API}${endpoint}?${params.toString()}`;

    const r = await fetch(url, { method: "POST", body: fd });
    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!r.ok) throw new Error(data?.detail || `POST ${endpoint} -> ${r.status}`);
    return data;
  }

  async function refreshDashboard() {
    try {
      const s = await apiGet("/stats");
      setStats(s);

      const c = await apiGet("/counts?limit=20");
      setCounts(c);

      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("page_size", String(pageSize));
      if (labelFilter) qs.set("label", labelFilter);
      if (lastMinutes && Number(lastMinutes) > 0) qs.set("last_minutes", String(lastMinutes));

      const d = await apiGet(`/detections?${qs.toString()}`);
      setItems(d.items || []);
      setTotal(d.total || 0);
    } catch (e) {
      console.error(e);
      setStatus({ type: "err", msg: "No pude cargar datos del backend. ¿Uvicorn encendido?" });
    }
  }

  async function refreshLearned() {
    try {
      const s = await apiGet("/learned/summary?limit=30");
      setLearnedTop(s.top || []);
      setLearnedLast(s.last || []);
    } catch (e) {
      console.error(e);
      // no molestamos al usuario con error todo el tiempo
    }
  }

  useEffect(() => {
    refreshDashboard();
    refreshLearned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, labelFilter, lastMinutes]);

  useInterval(() => {
    refreshDashboard();
    refreshLearned();
  }, 2500);

  // ---------- Acciones ----------
  async function onLearnToggle() {
    if (!cameraOn) {
      setStatus({ type: "warn", msg: "Enciende la cámara primero." });
      return;
    }
    if (!learnLabel.trim()) {
      setStatus({ type: "warn", msg: "Escribe una etiqueta para aprender (ej: 'lentes')." });
      return;
    }
    setLearning((v) => !v);
    if (!learning) {
      setLearnCount(0);
      setStatus({ type: "info", msg: `Modo aprender ON: ${learnLabel.trim()}` });
    } else {
      setStatus({ type: "info", msg: "Modo aprender OFF." });
    }
  }

  async function learnOne() {
    const label = learnLabel.trim();
    if (!label) {
      setStatus({ type: "warn", msg: "Escribe una etiqueta." });
      return;
    }
    setFrameBusy(true);
    try {
      // ✅ hacemos aprender más crítico: cooldown_ms usa tu input cooldownMs
      const res = await sendFrameTo("/learn/frame", { label, cooldown_ms: Math.max(400, Number(cooldownMs) || 1200) });

      const saved = !!res.saved;
      if (saved) setLearnCount((x) => x + 1);

      setBox(res.debug?.box || res.box || null);

      setLastOverlay({
        title: saved ? `Aprendido: ${label}` : `Aprender: ${label}`,
        subtitle: saved
          ? "Muestra guardada. Ya debería reconocerlo."
          : `No se guardó: ${res.reason || "condiciones no cumplidas"}`,
        badge: saved ? "✅ Guardado" : "⚠️ Ajusta posición/luz",
        badgeColor: saved ? "rgba(0,255,120,0.95)" : "rgba(255,200,0,0.95)",
      });

      setStatus({
        type: saved ? "ok" : "warn",
        msg: saved ? `Muestra guardada para "${label}".` : `No guardó: ${res.reason}`,
      });

      if (saved) {
        // ✅ refrescar “aprendidos” inmediatamente
        refreshLearned();
      }
    } catch (e) {
      console.error(e);
      setStatus({ type: "err", msg: `Error aprendiendo: ${e.message}` });
    } finally {
      setFrameBusy(false);
    }
  }

  async function recognizeOne(save = false) {
    setFrameBusy(true);
    try {
      const res = await sendFrameTo("/vision/frame", { save, force_save: false });

      setBox(res.box || null);

      const recognized = !!res.recognized;
      const label = res.label || "No reconocido";
      const scoreNum = res.score != null ? Number(res.score) : null;
      const scoreTxt = scoreNum != null ? scoreNum.toFixed(2) : "-";

      // ✅ si score < 0.94, no lo tratamos como “entrada de inventario”
      const meets = scoreNum != null && scoreNum >= MIN_SAVE_SCORE;

      if (!recognized) {
        setLastOverlay({
          title: "No reconocido",
          subtitle: res.reason ? `Motivo: ${res.reason}` : "Ajusta el objeto dentro del cuadro verde",
          badge: "⚠️ Ajusta retícula",
          badgeColor: "rgba(255,200,0,0.95)",
        });
        setStatus({ type: "warn", msg: res.reason ? `No: ${res.reason}` : "No reconocido." });
      } else {
        if (save) {
          setLastOverlay({
            title: `Detectado: ${label}`,
            subtitle: `Confianza: ${scoreTxt} (mínimo para guardar: ${MIN_SAVE_SCORE})`,
            badge: meets ? "📦 Guardado en inventario" : "⚠️ Confianza baja: NO se guarda",
            badgeColor: meets ? "rgba(0,255,120,0.95)" : "rgba(255,200,0,0.95)",
          });
          setStatus({
            type: meets ? "ok" : "warn",
            msg: meets ? `Entrada registrada: ${label}` : `No se registró (conf ${scoreTxt} < ${MIN_SAVE_SCORE}).`,
          });
        } else {
          setLastOverlay({
            title: `Detectado: ${label}`,
            subtitle: `Confianza: ${scoreTxt}`,
            badge: "✅ Reconocido",
            badgeColor: "rgba(0,200,255,0.95)",
          });
          setStatus({ type: "ok", msg: `Reconocido: ${label} (${scoreTxt})` });
        }
      }

      // refrescar tabla inventario después de “registrar”
      if (save) refreshDashboard();
    } catch (e) {
      console.error(e);
      setStatus({ type: "err", msg: `Error: ${e.message}` });
    } finally {
      setFrameBusy(false);
    }
  }

  // aprender continuo
  useInterval(
    () => {
      if (!learning || frameBusy) return;
      learnOne();
    },
    learning ? Math.max(700, Number(cooldownMs) || 1200) : null
  );

  // autoscan
  useInterval(
    () => {
      if (!autoScan || frameBusy) return;
      recognizeOne(true);
    },
    autoScan ? Math.max(700, Number(cooldownMs) || 1200) : null
  );

  async function clearInventory() {
    if (!window.confirm("¿Seguro que quieres vaciar el inventario (detections)?")) return;
    try {
      const r = await fetch(`${API}/inventory/clear`, {
        method: "POST",
        headers: { "X-Token": INVENTORY_TOKEN },
      });
      if (!r.ok) throw new Error(await r.text());
      setStatus({ type: "ok", msg: "Inventario vaciado." });
      refreshDashboard();
    } catch (e) {
      console.error(e);
      setStatus({ type: "err", msg: "No se pudo vaciar. Revisa token / backend." });
    }
  }

  function exportCSV() {
    const qs = new URLSearchParams();
    if (labelFilter) qs.set("label", labelFilter);
    if (lastMinutes && Number(lastMinutes) > 0) qs.set("last_minutes", String(lastMinutes));
    window.open(`${API}/export.csv?${qs.toString()}`, "_blank");
  }

   function pushChatMessage(message) {
    setChatMessages((prev) => [...prev, message]);
  }

  async function fetchChatbotReply(prompt) {
    const r = await fetch(`${API}/chatbot/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, window_days: 7 }),
    });
    if (!r.ok) throw new Error(`Chatbot error: ${r.status}`);
    return r.json();
  }

  async function handleChatSend(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    pushChatMessage({ id: now, role: "user", ts: now, text: trimmed });
    try {
      const res = await fetchChatbotReply(trimmed);
      pushChatMessage({ id: now + 1, role: "bot", ts: now + 1, text: res.reply || "Sin respuesta." });
    } catch (e) {
      console.error(e);
      pushChatMessage({
        id: now + 1,
        role: "bot",
        ts: now + 1,
        text: "No pude conectar con el chatbot. Verifica que el backend esté activo.",
      });
    } finally {
      setChatInput("");
    }
  }

  // ---------- UI ----------
  const theme = {
    bg: "#0b1220",
    card: "#0f1a2e",
    card2: "#101c33",
    text: "#e8eefc",
    muted: "#aab7d6",
    line: "rgba(255,255,255,0.08)",
    primary: "#2d6cff",
    ok: "#26d07c",
    warn: "#ffca3a",
    err: "#ff5c7a",
    accent: "#33d6ff",
  };

  const statusColor =
    status.type === "ok"
      ? theme.ok
      : status.type === "warn"
      ? theme.warn
      : status.type === "err"
      ? theme.err
      : theme.muted;

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "system-ui, Arial" }}>
      {/* Header */}
      <div
        style={{
          padding: "18px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${theme.line}`,
          background: "linear-gradient(180deg, rgba(45,108,255,0.16), rgba(0,0,0,0))",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: theme.primary }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Inventario Inteligente</div>
            <div style={{ fontSize: 12, color: theme.muted }}>Aprender → Reconocer → Registrar</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={exportCSV} style={btn(theme, "ghost")}>Exportar CSV</button>
          <button onClick={clearInventory} style={btn(theme, "danger")}>Vaciar inventario</button>
        </div>
      </div>

      {/* Layout */}
      <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1.4fr 0.8fr", gap: 14 }}>
        {/* Cámara */}
        <div style={card(theme)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>📷 Cámara</div>
            <div style={{ fontSize: 12, color: theme.muted }}>
              Pon el objeto dentro del cuadro verde (bien enfocado)
            </div>
          </div>

          <div
            style={{
              position: "relative",
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${theme.line}`,
              background: "#000",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={() => syncCanvasToVideo()}
              style={{ width: "100%", display: cameraOn ? "block" : "none" }}
            />
            {!cameraOn && (
              <div style={{ padding: 26, textAlign: "center", color: theme.muted }}>
                Cámara apagada. Presiona <b>Encender cámara</b>.
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                opacity: cameraOn ? 1 : 0,
              }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${theme.line}`,
              background: theme.card2,
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13 }}>
              <span style={{ color: statusColor, fontWeight: 800 }}>●</span> {status.msg}
            </div>
            <div style={{ fontSize: 12, color: theme.muted }}>
              {learning ? `Aprendiendo… (${learnCount})` : autoScan ? "AutoScan activo" : "Idle"}
            </div>
          </div>
        </div>

        {/* Controles + aprendidos + stats */}
        <div style={{ display: "grid", gap: 14 }}>
          <div style={card(theme)}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🎛️ Controles</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {!cameraOn ? (
                <button onClick={startCamera} style={btn(theme, "primary")}>Encender cámara</button>
              ) : (
                <button onClick={stopCamera} style={btn(theme, "ghost")}>Apagar cámara</button>
              )}

              <button
                disabled={!cameraOn || frameBusy}
                onClick={() => recognizeOne(false)}
                style={btn(theme, "ghost", (!cameraOn || frameBusy) && disabledStyle())}
              >
                Reconocer 1 frame
              </button>

              <button
                disabled={!cameraOn || frameBusy}
                onClick={() => recognizeOne(true)}
                style={btn(theme, "primary", (!cameraOn || frameBusy) && disabledStyle())}
                title={`Guarda solo si conf >= ${MIN_SAVE_SCORE}`}
              >
                Registrar 1 entrada
              </button>

              <button
                disabled={!cameraOn}
                onClick={() => setAutoScan((v) => !v)}
                style={btn(theme, autoScan ? "primary" : "ghost")}
              >
                AutoScan {autoScan ? "ON" : "OFF"}
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => setIgnorePerson((v) => !v)} style={btn(theme, ignorePerson ? "ghost" : "primary")}>
                Personas {ignorePerson ? "OFF" : "ON"}
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: theme.muted, marginBottom: 6 }}>Intervalo (ms)</div>
                <input type="number" value={cooldownMs} onChange={(e) => setCooldownMs(e.target.value)} style={input(theme)} min={700} />
              </div>
            </div>

            <div style={{ marginTop: 12, borderTop: `1px solid ${theme.line}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 6 }}>Etiqueta a aprender</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={learnLabel}
                  onChange={(e) => setLearnLabel(e.target.value)}
                  placeholder='Ej: "lentes", "mouse"...'
                  style={input(theme)}
                />
                <button
                  disabled={!cameraOn || frameBusy}
                  onClick={onLearnToggle}
                  style={btn(theme, learning ? "primary" : "ghost", (!cameraOn || frameBusy) && disabledStyle())}
                >
                  {learning ? `Aprendiendo… (${learnCount})` : "Aprender"}
                </button>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: theme.muted }}>
                Aprende guardando muestras reales. Luego registra solo si <b>conf ≥ {MIN_SAVE_SCORE}</b>.
              </div>
            </div>
          </div>

          {/* Objetos aprendidos */}
          <div style={card(theme)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🧠 Objetos aprendidos</div>
              <button onClick={refreshLearned} style={btn(theme, "ghost")}>Actualizar</button>
            </div>

            <div style={{ fontSize: 12, color: theme.muted, marginBottom: 8 }}>
              Esto viene de <code>/learned/summary</code>. Si aquí no sale, NO está guardado.
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {learnedTop?.length ? (
                learnedTop.slice(0, 12).map((x) => (
                  <span
                    key={x.label}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${theme.line}`,
                      fontSize: 12,
                    }}
                  >
                    <b>{x.label}</b>: {x.count}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: theme.muted }}>Aún no hay objetos aprendidos.</span>
              )}
            </div>

            <div style={{ fontSize: 12, color: theme.muted, marginBottom: 6 }}>Últimos aprendidos</div>
            <div style={{ border: `1px solid ${theme.line}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                  <tr>
                    <Th theme={theme}>Etiqueta</Th>
                    <Th theme={theme}>Fecha</Th>
                  </tr>
                </thead>
                <tbody>
                  {learnedLast?.length ? (
                    learnedLast.slice(0, 8).map((row, idx) => (
                      <tr key={idx} style={{ borderTop: `1px solid ${theme.line}` }}>
                        <Td theme={theme} style={{ fontWeight: 800 }}>{row[0]}</Td>
                        <Td theme={theme}>{fmtTs(row[1])}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td theme={theme} colSpan={2} style={{ color: theme.muted, padding: 12 }}>—</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stats inventario */}
          <div style={card(theme)}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>📊 Resumen inventario</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={mini(theme)}>
                <div style={{ fontSize: 12, color: theme.muted }}>Total eventos</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{stats.total_events ?? 0}</div>
              </div>
              <div style={mini(theme)}>
                <div style={{ fontSize: 12, color: theme.muted }}>Etiquetas únicas</div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>{stats.total_labels ?? 0}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 6 }}>Top categorías</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(counts || []).slice(0, 10).map((c) => (
                  <span
                    key={c.label}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${theme.line}`,
                      fontSize: 12,
                    }}
                  >
                    <b>{c.label}</b>: {c.count}
                  </span>
                ))}
                {!counts?.length && <span style={{ fontSize: 12, color: theme.muted }}>—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Últimas detecciones */}
        <div style={card(theme)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🧾 Últimas detecciones</div>
              <div style={{ fontSize: 12, color: theme.muted }}>Vista rápida con acciones y detalle.</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => setViewMode("cards")} style={btn(theme, viewMode === "cards" ? "primary" : "ghost")}>
                Tarjetas
              </button>
              <button onClick={() => setViewMode("table")} style={btn(theme, viewMode === "table" ? "primary" : "ghost")}>
                Tabla
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            {(counts || []).slice(0, 6).map((c) => (
              <button
                key={c.label}
                onClick={() => {
                  setLabelFilter(c.label);
                  setPage(1);
                }}
               style={chip(theme, labelFilter === c.label)}
              >
                 {c.label} <span style={{ opacity: 0.75 }}>({c.count})</span>
              </button>
          ))}
            {!counts?.length && <span style={{ fontSize: 12, color: theme.muted }}>Sin categorías aún.</span>}
          </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
            <input
              value={labelFilter}
              onChange={(e) => {
                setLabelFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filtrar por etiqueta…"
              style={{ ...input(theme), width: 220 }}
            />

            <select
              value={lastMinutes}
              onChange={(e) => {
                setLastMinutes(Number(e.target.value));
                setPage(1);
              }}
              style={{ ...input(theme), width: 220 }}
            >
              <option value={0}>Sin filtro de tiempo</option>
              <option value={5}>Últimos 5 min</option>
              <option value={15}>Últimos 15 min</option>
              <option value={60}>Última hora</option>
              <option value={240}>Últimas 4 horas</option>
            </select>

            <button onClick={() => refreshDashboard()} style={btn(theme, "ghost")} title="Refrescar">
              ↻
            </button>
          </div>

          {viewMode === "cards" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {items?.length ? (
                items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedDetection(r)}
                    style={detectCard(theme, selectedDetection?.id === r.id)}
                  >
                   <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {r.image_path ? (
                        <img
                          src={`${API}/${r.image_path}`}
                          alt="preview"
                          style={{
                            width: 72,
                            height: 54,
                            objectFit: "cover",
                            borderRadius: 10,
                            border: `1px solid ${theme.line}`,
                          }}
                        />
                      ) : (
                        <div style={{ width: 72, height: 54, borderRadius: 10, background: theme.card2 }} />
                      )}
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: theme.muted }}>{fmtTs(r.ts)}</div>
                        <div style={{ fontSize: 12, color: theme.accent }}>
                          Conf: {r.confidence != null ? Number(r.confidence).toFixed(2) : "-"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div style={{ color: theme.muted, fontSize: 13 }}>No hay detecciones. Usa “Registrar 1 entrada” o AutoScan.</div>
              )}
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: `1px solid ${theme.line}`, borderRadius: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                  <tr>
                                       <Th theme={theme}>Foto</Th>
                    <Th theme={theme}>Etiqueta</Th>
                    <Th theme={theme}>Conf</Th>
                    <Th theme={theme}>Fecha</Th>
                    <Th theme={theme}>Cámara</Th>
                    <Th theme={theme}>Modelo</Th> 
                  </tr>
                                  </thead>
                <tbody>
                  {items?.length ? (
                    items.map((r) => (
                      <tr key={r.id} style={{ borderTop: `1px solid ${theme.line}` }}>
                        <Td theme={theme}>
                          {r.image_path ? (
                            <img
                              src={`${API}/${r.image_path}`}
                              alt="preview"
                              style={{
                                width: 66,
                                height: 44,
                                objectFit: "cover",
                                borderRadius: 10,
                                border: `1px solid ${theme.line}`,
                              }}
                            />
                          ) : (
                            <span style={{ color: theme.muted }}>—</span>
                          )}
                        </Td>
                        <Td theme={theme} style={{ fontWeight: 800 }}>{r.label}</Td>
                        <Td theme={theme}>{r.confidence != null ? Number(r.confidence).toFixed(2) : "-"}</Td>
                        <Td theme={theme}>{fmtTs(r.ts)}</Td>
                        <Td theme={theme}>{r.camera_id}</Td>
                        <Td theme={theme}>{r.model}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td theme={theme} colSpan={6} style={{ color: theme.muted, padding: 14 }}>
                        No hay detecciones. Usa “Registrar 1 entrada” o AutoScan.
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {selectedDetection && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: `1px solid ${theme.line}`, background: theme.card2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{selectedDetection.label}</div>
                  <div style={{ fontSize: 12, color: theme.muted }}>{fmtTs(selectedDetection.ts)}</div>
                </div>
                <button onClick={() => setSelectedDetection(null)} style={btn(theme, "ghost")}>Cerrar</button>
              </div>
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                <div><b>Confianza</b>: {selectedDetection.confidence != null ? Number(selectedDetection.confidence).toFixed(2) : "-"}</div>
                <div><b>Cámara</b>: {selectedDetection.camera_id}</div>
                <div><b>Modelo</b>: {selectedDetection.model}</div>
              </div>
            </div>
          )}
        
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <div style={{ fontSize: 12, color: theme.muted }}>
              Página {page} / {totalPages} — Total: {total}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} style={btn(theme, "ghost")} disabled={page <= 1}>
                Anterior
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={btn(theme, "ghost")} disabled={page >= totalPages}>
                Siguiente
              </button>
            </div>
          </div>
        </div>

{/* Chatbot */}
        <div style={card(theme)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>💬 Asistente de inventario</div>
              <div style={{ fontSize: 12, color: theme.muted }}>Planifica y organiza con recomendaciones rápidas.</div>
            </div>
            <button onClick={() => refreshDashboard()} style={btn(theme, "ghost")}>Actualizar datos</button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[
              "Plan semanal",
              "Reabastecimiento",
              "Organizar bodega",
              "Últimas detecciones",
            ].map((quick) => (
              <button key={quick} onClick={() => handleChatSend(quick)} style={chip(theme, false)}>
                {quick}
              </button>
            ))}
          </div>

          <div style={{ border: `1px solid ${theme.line}`, borderRadius: 14, padding: 12, background: theme.card2, maxHeight: 280, overflowY: "auto" }}>
            {chatMessages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: 10, textAlign: msg.role === "user" ? "right" : "left" }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "8px 10px",
                    borderRadius: 12,
                    background: msg.role === "user" ? theme.primary : "rgba(255,255,255,0.08)",
                    color: theme.text,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.text}
                </div>
                <div style={{ fontSize: 10, color: theme.muted, marginTop: 4 }}>
                  {fmtTs(msg.ts)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleChatSend(chatInput);
              }}
              placeholder="Escribe tu consulta..."
              style={input(theme)}
            />
            <button onClick={() => handleChatSend(chatInput)} style={btn(theme, "primary")}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- UI helpers ----------
function card(theme) {
  return {
    background: theme.card,
    border: `1px solid ${theme.line}`,
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  };
}

function mini(theme) {
  return {
    background: theme.card2,
    border: `1px solid ${theme.line}`,
    borderRadius: 14,
    padding: 12,
  };
}

function disabledStyle() {
  return { opacity: 0.55, cursor: "not-allowed" };
}

function btn(theme, variant, extra = {}) {
  const base = {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.line}`,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    background: "rgba(255,255,255,0.06)",
    color: theme.text,
  };

  if (variant === "primary") {
    return {
      ...base,
      background: theme.primary,
      border: "1px solid rgba(255,255,255,0.12)",
      color: "white",
      ...extra,
    };
  }
  if (variant === "danger") {
    return {
      ...base,
      background: "#ff3b5c",
      border: "1px solid rgba(255,255,255,0.12)",
      color: "white",
      ...extra,
    };
  }
  return { ...base, ...extra };
}
function chip(theme, active) {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${theme.line}`,
    background: active ? theme.primary : "rgba(255,255,255,0.06)",
    color: theme.text,
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
  };
}

function detectCard(theme, active) {
  return {
    border: `1px solid ${active ? theme.primary : theme.line}`,
    background: active ? "rgba(45,108,255,0.15)" : theme.card2,
    borderRadius: 14,
    padding: 10,
    textAlign: "left",
    cursor: "pointer",
  };
}

function input(theme) {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${theme.line}`,
    background: "rgba(255,255,255,0.06)",
    color: theme.text,
    outline: "none",
    fontWeight: 650,
  };
}

function Th({ children, theme }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 10px",
        fontSize: 12,
        color: theme.muted,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, theme, ...rest }) {
  return (
    <td
      style={{
        padding: "10px 10px",
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
      {...rest}
    >
      {children}
    </td>
  );
}
