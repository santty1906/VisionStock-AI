# 👁️ Everyday Object Recognition Vision System (VisionStock-AI)

## 📌 Project Description
VisionStock-AI is a real-time computer vision system designed to automate inventory management processes, especially for warehouses and supermarkets.

The system detects and recognizes everyday objects using camera input and automatically registers identified products into a database. This reduces human error and optimizes stock control operations.

The project is fully developed in Python, leveraging modern computer vision and deep learning technologies.

## 🎯 Target Audience
This project is primarily intended for:
- 🏬 Supermarkets
- 📦 Warehouses
- 🏪 Retail stores
- 🚚 Distribution centers
- Companies interested in automated inventory systems using computer vision

## 🚀 Features
- Real-time object detection using a camera  
- Recognition of everyday products using AI models  
- Automatic database registration for each detected item  
- Incremental learning of new objects without full model retraining  
- REST API for statistics and inventory export  
- Storage of visual evidence for each detection 

## 🧠 Technologies Used
- Python 3.9+  
- YOLOv8 – Object detection  
- CLIP – Visual recognition and incremental learning  
- FastAPI – REST API  
- OpenCV – Image capture and processing  
- SQLite – Inventory storage 

## 👥 Team Members

### Santiago López
Lead development, camera integration, and pretrained model selection. Participated in all stages of the project.

### Enzo Dellasera
Full system development, project design, and database management.

### Rubén Bernuil Bermúdez
Code development support and overall project structure contribution.

### Jose Batista
Project presentation support.

## 🧩 Project Architecture (Python)

### `vision_service.py`
Core vision service: processes frames, performs detection with YOLOv8, recognizes objects using CLIP, and stores results in the database.

### `main.py`
FastAPI application exposing REST endpoints for image processing, object learning, and inventory queries.

### `db.py`
Handles inventory database management and data export.

### `learned_db.py`
Stores CLIP embeddings for dynamically learned objects.

### `recognizer.py`
Recognition system based on CLIP and k-Nearest Neighbors (kNN).

### `camara.py`
Live camera script for automatic detection and inventory logging.

### `camara_learn.py`
Guided object scanning script for incremental learning.

## ⚙️ Requirements
- Python 3.9 or higher  
- Connected camera  
- CUDA-enabled GPU (optional but recommended) 

## 🛠️ Installation
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## ▶️ Running the System
### API
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Camera
``` 
python camara.py
```

## 🗄️ Databases
- inventario.db: Stores detection records
- learned_objects.db: Stores dynamically learned object embeddings

## 🔮 Future Improvements
- Optional React-based visual dashboard integration
- More robust database system (PostgreSQL/MySQL)
- Accuracy and performance optimization
- API security and authentication
- Deployment in cloud environments

