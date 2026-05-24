# CVWarehouse

A computer vision platform for real-time warehouse inventory tracking, monitoring, and 3D visualization — built as a Computer Science Capstone Project at Georgia Southern University (Spring 2026).

---

## Overview

Warehouse inventory inaccuracy is a widespread problem: industry data shows the average inventory accuracy across businesses sits at only 83%, with 58% of operations falling below 80%. CVWarehouse addresses this by combining real-time object detection, damage assessment, collision monitoring, and 3D model generation into a unified web dashboard.

The system integrates with an **AVA telepresence robot** and overhead **RTSP security cameras** to provide live visibility into warehouse operations — including point-and-click robot navigation directly through the video stream interface.

---

## Features

- **Real-time Object Detection & Counting** — YOLO-powered detection across live video feeds, recorded video, and static images. Outputs object IDs, bounding boxes, and counts.
- **Damage Detection** — Analyzes detected objects for physical damage and calculates a quantitative damage percentage where possible.
- **Collision Detection** — Tracks object movement across frames using bounding box overlap and motion analysis; logs collision events with timestamps.
- **3D Model Generation** — Photogrammetry pipeline (Meshroom/COLMAP) generates `.obj` 3D models from multi-angle images captured by the AVA robot.
- **Interactive 3D UI** — Blender-generated warehouse model rendered in the browser; users can navigate the environment and inspect objects.
- **Analytics Dashboard** — All detection outputs stored as JSON and visualized in a web dashboard for reporting and review.
- **AVA Robot Integration** — Robot captures imagery of pallets and warehouse layouts; supports point-and-click navigation via overhead camera stream.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Object Detection | YOLO, OpenCV |
| Damage Detection | CLIP / YOLO extensions |
| Collision Tracking | DeepSORT |
| 3D Reconstruction | Meshroom, COLMAP |
| 3D Visualization | Blender, Unity/Unreal Engine |
| Backend | Python, Flask |
| Frontend | HTML, CSS, JavaScript |
| Data Storage | JSON |
| Robot Platform | AVA Telepresence Robot |

---

## Installation & Setup

### Prerequisites
- Python 3.x with pip
- VSCode with the **Live Server** extension
- (Optional) [Meshroom](https://alicevision.org/#meshroom) for 3D model generation

---

### 1. Flask Backend

```bash
pip install flask
python app.py
```

The Flask server must be running to access full functionality.

---

### 2. Web Frontend

1. Open the project in VSCode
2. Right-click `index.html` → **Open with Live Server**
3. The app will launch at `http://localhost:5500`

---

### 3. AVA Robot Module

```bash
# Create a virtual environment if one doesn't exist
python -m venv venv

# Install pipenv and project dependencies
pip install pipenv
pipenv install

# Upgrade requests (required)
pip install --upgrade requests
```

> Pulls dependencies from `Pipfile.lock`. Ensure you run these commands from the project root.

---

### 4. 3D Model Generation (Meshroom)

1. Download [Meshroom](https://alicevision.org/#meshroom) for your OS (or skip — the app supports direct `.obj` upload)
2. In the backend config, set `MESHROOM_BATCH` and `MESHROOM_CACHE` to your local Meshroom installation path
3. Set both to `None` if Meshroom is unavailable
4. Install remaining dependencies:

```bash
pip install -r requirements.txt
```

> See `backend/README.md` for additional model usage instructions.

---

## Project Structure

```
CVWarehouse/
├── assets/          # Static assets (images, models)
├── backend/         # Flask API + detection models
├── css/             # Stylesheets
├── src/             # Core source files
├── index.html       # Main entry point
├── cams.html        # Camera feed interface
├── data.html        # 3D model viewer
├── env.html         # Environment configuration view
├── Pipfile          # AVA robot dependencies
└── Pipfile.lock
```

---

## Team

| Name | Role |
|---|---|
| Carson Mullis | AVA Robot Integration, Project Lead |
| Christian Ramsey | 3D Model Color & UI Tools |
| Jaheim Cain | 3D Environment & Gaussian Splat |
| James Traylor | Object Detection & Database |
| Xander Wulff | Database Design & Damage Detection |
| Lance Travis | 3D Environment Generation |

---

## Future Work

- Automated AVA traversal for full-room photogrammetry
- Login system accessible to CS department students
- In-environment object inspection with database-pulled metadata
- Damage visualization overlaid on 3D models
- Export of 3D models for use in external environments
