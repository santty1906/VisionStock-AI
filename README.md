# 👁️ Visión Artificial para Reconocimiento de Objetos Cotidianos

## 📌 Descripción del proyecto
Visión Artificial para Reconocimiento de Objetos Cotidianos es un sistema de visión artificial en tiempo real orientado a la automatización del inventario, especialmente diseñado para empresas de almacenes y supermercados.

El programa permite detectar y reconocer objetos cotidianos utilizando cámaras, registrando automáticamente los productos identificados en una base de datos, reduciendo errores humanos y optimizando los procesos de control de stock.

El proyecto está desarrollado exclusivamente en Python, utilizando tecnologías modernas de visión por computadora y aprendizaje profundo.

## 🎯 Público objetivo
Este proyecto está destinado principalmente a:
- 🏬 Supermercados
- 📦 Almacenes
- 🏪 Tiendas minoristas
- 🚚 Centros de distribución
- Empresas interesadas en inventarios automáticos mediante visión artificial

## 🚀 ¿Qué hace el programa?
- Detecta objetos en tiempo real mediante cámara
- Reconoce productos cotidianos usando modelos de IA
- Registra automáticamente cada detección en una base de datos
- Permite aprender nuevos objetos sin reentrenar el modelo completo
- Proporciona una API para consultar estadísticas y exportar inventario
- Guarda evidencias visuales de cada detección

## 🧠 Tecnologías utilizadas
- Python 3.9+
- YOLOv8 – detección de objetos
- CLIP – reconocimiento visual y aprendizaje incremental
- FastAPI – API REST
- OpenCV – captura y procesamiento de imágenes
- SQLite – almacenamiento de inventario

## 👥 Integrantes del equipo

### Santiago López
Desarrollo principal, manejo de cámara y selección de modelos preentrenados. Participó en todas las etapas del proyecto.

### Enzo Dellasera
Desarrollo completo del sistema, diseño del proyecto y gestión de bases de datos.

### Rubén Bernuil Bermúdez
Apoyo en el desarrollo del código y en la estructura general del proyecto.

### Jose Batista
Apoyo en la presentación del proyecto.

## 🧩 Arquitectura del proyecto (Python)

### vision_service.py
Servicio central de visión: procesa frames, detecta con YOLOv8, reconoce con CLIP y guarda los resultados en la base de datos.

### main.py (FastAPI)
Expone endpoints REST para el procesamiento de imágenes, aprendizaje de objetos y consulta del inventario.

### db.py
Gestión de la base de datos de inventario y exportación de datos.

### learned_db.py
Almacena embeddings CLIP para objetos aprendidos dinámicamente.

### recognizer.py
Sistema de reconocimiento basado en CLIP y kNN.

### camara.py
Script de cámara en vivo para detección e inventario automático.

### camara_learn.py
Escaneo guiado de objetos para aprendizaje incremental.

## ⚙️ Requisitos
- Python 3.9 o superior
- Cámara conectada
- GPU con CUDA (opcional, recomendada)

## 🛠️ Instalación rápida
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## ▶️ Ejecución
### API
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Cámara
``` 
python camara.py
```

## 🗄️ Bases de datos
- inventario.db: registro de detecciones
- learned_objects.db: objetos aprendidos

## 🔮 Mejoras futuras
- Integración de un panel visual en React (opcional)
- Base de datos más robusta
- Mejoras en precisión y rendimiento
- Seguridad y autenticación en la API
