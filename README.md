# 📦 VisionStock-AI, Inventario Inteligente con YOLOv8 + CLIP

Sistema de visión en tiempo real para inventario automático utilizando **YOLOv8 + CLIP**.

Toda la lógica central está desarrollada en **Python** usando:

* FastAPI
* OpenCV
* YOLOv8
* CLIP
* SQLite

El frontend React incluido en `/inventory-app`.

---

# 🚀 Características

* ✅ Detección de objetos en tiempo real
* ✅ Reconocimiento inteligente con CLIP
* ✅ Aprendizaje incremental de nuevos objetos
* ✅ API REST con FastAPI
* ✅ Inventario persistente en SQLite
* ✅ Exportación CSV
* ✅ Capturas automáticas
* ✅ Escaneo guiado tipo FaceID
* ✅ Soporte GPU CUDA
* ✅ Frontend React opcional

---

# 🧠 Arquitectura Python

## `vision_service.py`

Servicio reutilizable que:

* recibe frames BGR
* detecta objetos con YOLOv8
* recorta detecciones
* filtra por calidad y enfoque
* reconoce usando CLIP (`Recognizer`)
* guarda eventos en SQLite (`inventario.db`)
* soporta aprendizaje incremental (`learn_frame`)

---

## `main.py` (FastAPI)

Expone endpoints REST para:

* estadísticas
* exportación CSV
* procesamiento de frames
* aprendizaje incremental

También monta automáticamente:

```text
/captures
```

para visualizar imágenes guardadas.

---

## `db.py`

Manejo de SQLite:

* inserción de detecciones
* exportación CSV
* limpieza de inventario

---

## `learned_db.py`

Almacena embeddings CLIP por etiqueta y devuelve resúmenes de objetos aprendidos.

---

## `recognizer.py`

Sistema híbrido de reconocimiento usando:

* CLIP
* prototipos
* fallback kNN

---

## `clip_classifier.py`

Clasificador zero-shot con CLIP utilizado desde `camara.py`.

---

## `camara.py`

Script principal de cámara en vivo:

* detección en tiempo real
* inventario automático
* capturas opcionales
* clasificación CLIP

---

## `camara_learn.py`

Flujo guiado estilo FaceID para:

* escanear múltiples vistas
* generar embeddings CLIP
* habilitar reconocimiento inmediato

---

# 📋 Requisitos

* Python 3.9+
* Cámara accesible en el sistema
* GPU CUDA opcional (recomendada)

> ⚠️ En CPU el sistema funciona más lento.

---

# ⚙️ Instalación rápida

## 1️⃣ Clonar repositorio

```bash
git clone https://github.com/TU-USUARIO/VisionStock-AI.git
cd VisionStock-AI
```

---

## 2️⃣ Crear entorno virtual

### Linux / Mac

```bash
python -m venv .venv
source .venv/bin/activate
```

### Windows PowerShell

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

---

## 3️⃣ Instalar dependencias

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4️⃣ Descargar pesos YOLOv8

Colocar los pesos en la raíz del proyecto:

* `yolov8m.pt`
* `yolov8n.pt`
* `yolov8l.pt`

---

# ▶️ Cómo correr la API (FastAPI + CLIP + YOLO)

## Iniciar servidor

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

API disponible en:

```text
http://localhost:8000
```

Swagger Docs:

```text
http://localhost:8000/docs
```

---

# 🌐 Endpoints principales

## 📊 Estadísticas

```http
GET /stats
GET /counts
```

---

## 📦 Detecciones paginadas

```http
GET /detections?page=1&page_size=25
```

Filtros disponibles:

* `label`
* `last_minutes`

---

## 📁 Exportar CSV

```http
GET /export.csv
```

---

## 🖼️ Procesar frame

```http
POST /vision/frame
```

Procesa:

* detección YOLO
* validación de enfoque
* reconocimiento CLIP
* guardado automático

---

## 🧠 Aprendizaje incremental

```http
POST /learn/frame?label=OBJETO
```

Guarda embeddings CLIP y recarga el reconocedor automáticamente.

---

## 📚 Objetos aprendidos

```http
GET /learned/summary
```

---

## 🧹 Limpiar inventario

```http
POST /inventory/clear
```

Header requerido:

```text
X-Token
```

Variable de entorno:

```bash
INVENTORY_TOKEN
```

Valor por defecto:

```text
1234
```

---

# 📸 Capturas automáticas

Las imágenes se guardan en:

```text
/captures
```

y FastAPI las expone automáticamente.

---

# 🎥 Scripts de cámara

# 🔍 Detección + inventario (`camara.py`)

## Modo básico

```bash
python camara.py --show
```

---

## Mayor precisión

```bash
python camara.py --model yolov8l.pt --conf 0.5 --imgsz 1280 --device cuda --save-captures
```

---

## CLIP zero-shot

```bash
python camara.py --use-clip --clip-labels "celular,lentes,mouse,caja_audifonos"
```

---

## Controles

* `Q` o `ESC` → salir
* cooldown por etiqueta
* filtrado de áreas pequeñas
* bloqueo de personas por defecto

---

# 🧠 Escaneo guiado tipo FaceID (`camara_learn.py`)

```bash
python camara_learn.py
```

## Controles

* `S` → iniciar escaneo guiado
* `P` → alternar ignorar personas
* `Q` o `ESC` → salir

El sistema captura automáticamente:

* center
* left
* right
* up
* down
* near
* far
* tilt

Luego genera embeddings CLIP automáticamente.

---

# ⚡ Consideraciones de rendimiento

## 🎯 Mejor precisión

* usar `yolov8l.pt`
* aumentar `--imgsz`
* aumentar `--conf`

---

## 🚀 Mayor velocidad

* usar `yolov8n.pt`
* reducir `--imgsz`
* usar GPU CUDA

---

## 🔎 Calidad de enfoque

`VisionService` y `camara_learn.py` utilizan Laplacian para validar nitidez antes de guardar detecciones.

---

# 🗄️ Bases de datos

## `inventario.db`

Guarda:

* timestamps
* cámara
* labels
* confianza
* bounding boxes
* capturas

---

## `learned_objects.db`

Guarda embeddings CLIP para reconocimiento incremental.

---

# 🖥️ Frontend React 

Existe un frontend React dentro de:

```text
/inventory-app
```

El frontend puede utilizarse como:

* panel administrativo
* dashboard
* visualizador de inventario
* interfaz futura del sistema

## Ejecutarlo

```bash
cd inventory-app
npm install
npm start
```

Disponible en:

```text
http://localhost:3000
```

---

# 🔄 Cómo correr la aplicación completa

## Terminal 1 → Backend Python

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Terminal 2 → Frontend React

```bash
cd inventory-app
npm start
```

---

# 🛣️ Próximos pasos / mejoras opcionales

* Integrar completamente el frontend React
* Dashboard en tiempo real
* Autenticación JWT
* Tokens por cámara
* Docker + soporte GPU
* Health checks
* Base de datos más robusta
* Mejoras en precisión y reconocimiento
* Entrenamiento automático continuo

---

# 👨‍💻 Autor

Proyecto desarrollado para hackatón de visión computacional e inventario inteligente.
