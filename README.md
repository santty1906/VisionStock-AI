# 📦 VisionStock-AI

Sistema inteligente de inventario automático en tiempo real utilizando **YOLOv8 + CLIP**.

El proyecto combina:

* 🔍 Detección de objetos con YOLOv8
* 🧠 Reconocimiento inteligente con CLIP
* ⚡ API REST con FastAPI
* 🖥️ Frontend React
* 📦 Inventario automático en tiempo real

---

# 🚀 Ejecución completa del proyecto (Frontend + Backend)

> Esta es la forma principal de correr el sistema completo.

El proyecto funciona con:

* **Backend Python** → procesamiento IA y API
* **Frontend React** → panel visual e interfaz

---

# 🧩 Arquitectura general

```text id="36j3al"
React Frontend (inventory-app)
            ↓
        FastAPI API
            ↓
YOLOv8 + CLIP + OpenCV
            ↓
      SQLite Database
```

---

# 📋 Requisitos

## Backend

* Python 3.9+
* pip
* Cámara web

---

## Frontend

* Node.js 18+
* npm

---

# ⚙️ Instalación completa

# 1️⃣ Clonar repositorio

```bash id="w8l6wn"
git clone https://github.com/TU-USUARIO/VisionStock-AI.git
cd VisionStock-AI
```

---

# 2️⃣ Configurar entorno Python

## Crear entorno virtual

### Linux / Mac

```bash id="4bghq4"
python -m venv .venv
source .venv/bin/activate
```

### Windows PowerShell

```powershell id="g1h9me"
python -m venv .venv
.venv\Scripts\Activate.ps1
```

---

## Instalar dependencias Python

```bash id="gfl4n5"
pip install --upgrade pip
pip install -r requirements.txt
```

---

# 🖥️ Configurar Frontend React

Entrar al frontend:

```bash id="z8djwd"
cd inventory-app
```

Instalar dependencias:

```bash id="jlwm3v"
npm install
```

---

# ▶️ Cómo correr TODO el sistema

# 🔹 Terminal 1 → Backend FastAPI

Desde la raíz del proyecto:

```bash id="6q7f9h"
uvicorn main:app --host 0.0.0.0 --port 8000
```

Backend disponible en:

```text id="9m1rkp"
http://localhost:8000
```

Swagger Docs:

```text id="k7r4h0"
http://localhost:8000/docs
```

---

# 🔹 Terminal 2 → Frontend React

Entrar al frontend:

```bash id="t95muj"
cd inventory-app
```

Iniciar React:

```bash id="y8k2m4"
npm start
```

Frontend disponible en:

```text id="7ny0t0"
http://localhost:3000
```

---

# ✅ Flujo completo del sistema

## Backend Python

El backend se encarga de:

* capturar frames
* detectar objetos
* reconocer productos
* guardar inventario
* generar embeddings CLIP
* exponer endpoints REST

---

## Frontend React

El frontend consume la API para:

* visualizar inventario
* mostrar estadísticas
* mostrar detecciones
* crear dashboards
* administrar productos detectados

---

# 🧠 Arquitectura Python

## `vision_service.py`

Servicio principal del sistema.

Funciones:

* detección YOLOv8
* reconocimiento CLIP
* validación de enfoque
* guardado automático
* aprendizaje incremental

---

## `main.py`

Servidor FastAPI principal.

Endpoints para:

* estadísticas
* detecciones
* exportación CSV
* aprendizaje
* procesamiento de imágenes

---

## `recognizer.py`

Motor inteligente basado en:

* CLIP
* prototipos
* kNN fallback

---

## `camara.py`

Script de cámara en vivo para:

* detección
* inventario automático
* clasificación CLIP
* capturas

---

## `camara_learn.py`

Modo entrenamiento tipo FaceID para aprender nuevos objetos dinámicamente.

---

# 🌐 Endpoints principales

## 📊 Estadísticas

```http id="o4s8cv"
GET /stats
GET /counts
```

---

## 📦 Detecciones

```http id="nvjlwm"
GET /detections?page=1&page_size=25
```

Filtros:

* `label`
* `last_minutes`

---

## 📁 Exportar CSV

```http id="ngwh92"
GET /export.csv
```

---

## 🖼️ Procesar frame

```http id="83ib4r"
POST /vision/frame
```

---

## 🧠 Aprender nuevos objetos

```http id="1lj1aa"
POST /learn/frame?label=OBJETO
```

---

# 🎥 Scripts de cámara

# Detección en vivo

```bash id="f9s4b0"
python camara.py --show
```

---

# Mayor precisión

```bash id="jlwmdu"
python camara.py --model yolov8l.pt --conf 0.5 --imgsz 1280 --device cuda
```

---

# CLIP zero-shot

```bash id="zk7wr7"
python camara.py --use-clip --clip-labels "mouse,celular,lentes"
```

---

# 🧠 Escaneo guiado

```bash id="qrmn3y"
python camara_learn.py
```

Controles:

* `S` → iniciar escaneo
* `P` → ignorar personas
* `Q` → salir

---

# 🗄️ Bases de datos

## `inventario.db`

Almacena:

* timestamps
* labels
* confianza
* bounding boxes
* capturas

---

## `learned_objects.db`

Guarda embeddings CLIP para reconocimiento incremental.

---

# ⚡ Rendimiento

## Mejor precisión

* usar `yolov8l.pt`
* aumentar `--imgsz`
* aumentar `--conf`

---

## Mayor velocidad

* usar `yolov8n.pt`
* usar GPU CUDA
* reducir `--imgsz`

---

# 🔮 Mejoras futuras

* Dashboard React avanzado
* Autenticación JWT
* Docker + GPU
* Streaming RTSP
* Base de datos robusta
* Entrenamiento automático continuo
* Mejor precisión de reconocimiento

---

# 👨‍💻 Autor

Proyecto desarrollado para hackatón de Samsung Innovations Campus.
