# 📦 VisionStock-AI

Real-time intelligent inventory system powered by **YOLOv8 + CLIP**.

The project combines:

* 🔍 Object detection using YOLOv8
* 🧠 Intelligent recognition with CLIP
* ⚡ REST API with FastAPI
* 🖥️ React Frontend
* 📦 Automatic real-time inventory management

---

# 🚀 Running the Full Project (Frontend + Backend)

> This is the main way to run the complete system.

The project consists of:

* **Python Backend** → AI processing and API
* **React Frontend** → visual dashboard and interface

---

# 🧩 General Architecture

```text
React Frontend (inventory-app)
            ↓
        FastAPI API
            ↓
YOLOv8 + CLIP + OpenCV
            ↓
      SQLite Database
```

---

# 📋 Requirements

## Backend

* Python 3.9+
* pip
* Webcam / Camera device

---

## Frontend

* Node.js 18+
* npm

---

# ⚙️ Full Installation

# 1️⃣ Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/VisionStock-AI.git
cd VisionStock-AI
```

---

# 2️⃣ Configure Python Environment

## Create Virtual Environment

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

## Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

# 🖥️ Configure React Frontend

Go to the frontend folder:

```bash
cd inventory-app
```

Install dependencies:

```bash
npm install
```

---

# ▶️ Run the Complete System

# 🔹 Terminal 1 → FastAPI Backend

From the project root:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Backend available at:

```text
http://localhost:8000
```

Swagger Documentation:

```text
http://localhost:8000/docs
```

---

# 🔹 Terminal 2 → React Frontend

Go to the frontend folder:

```bash
cd inventory-app
```

Start React:

```bash
npm start
```

Frontend available at:

```text
http://localhost:3000
```

---

# ✅ Complete System Workflow

## Python Backend

The backend handles:

* frame capture
* object detection
* product recognition
* inventory storage
* CLIP embedding generation
* REST API endpoints

---

## React Frontend

The frontend consumes the API to:

* visualize inventory
* display statistics
* show detections
* build dashboards
* manage detected products

---

# 🧠 Python Architecture

## `vision_service.py`

Main system service.

Features:

* YOLOv8 detection
* CLIP recognition
* focus validation
* automatic storage
* incremental learning

---

## `main.py`

Main FastAPI server.

Endpoints for:

* statistics
* detections
* CSV export
* learning
* image processing

---

## `recognizer.py`

Intelligent recognition engine based on:

* CLIP
* prototypes
* kNN fallback

---

## `camara.py`

Live camera script for:

* detection
* automatic inventory
* CLIP classification
* image captures

---

## `camara_learn.py`

FaceID-style training mode to dynamically learn new objects.

---

# 🌐 Main Endpoints

## 📊 Statistics

```http
GET /stats
GET /counts
```

---

## 📦 Detections

```http
GET /detections?page=1&page_size=25
```

Filters:

* `label`
* `last_minutes`

---

## 📁 Export CSV

```http
GET /export.csv
```

---

## 🖼️ Process Frame

```http
POST /vision/frame
```

---

## 🧠 Learn New Objects

```http
POST /learn/frame?label=OBJECT
```

---

# 🎥 Camera Scripts

# Live Detection

```bash
python camara.py --show
```

---

# Higher Accuracy

```bash
python camara.py --model yolov8l.pt --conf 0.5 --imgsz 1280 --device cuda
```

---

# CLIP Zero-Shot

```bash
python camara.py --use-clip --clip-labels "mouse,phone,glasses"
```

---

# 🧠 Guided Scanning

```bash
python camara_learn.py
```

Controls:

* `S` → start scanning
* `P` → ignore people
* `Q` → quit

---

# 🗄️ Databases

## `inventario.db`

Stores:

* timestamps
* labels
* confidence
* bounding boxes
* captures

---

## `learned_objects.db`

Stores CLIP embeddings for incremental recognition.

---

# ⚡ Performance

## Better Accuracy

* use `yolov8l.pt`
* increase `--imgsz`
* increase `--conf`

---

## Faster Performance

* use `yolov8n.pt`
* use CUDA GPU
* reduce `--imgsz`

---

# 🔮 Future Improvements

* Advanced React dashboard
* JWT authentication
* Docker + GPU support
* RTSP streaming
* More robust database
* Continuous training pipeline
* Improved recognition accuracy

---

# 👨‍💻 Author

Project developed for the Samsung Innovation Campus Hackathon.
