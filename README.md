# Cloud-Based ECG Signal Analysis for Real-Time Cardiac Rhythm Monitoring Using AI
Cloud-based real-time ECG monitoring system using IoT and AI. ECG signals are preprocessed and R-peaks detected with the Pan–Tompkins algorithm, then classified by a lightweight 1D-CNN for arrhythmia detection. A web dashboard provides live waveform visualization, heart-rate trends, and abnormal-rhythm alerts for remote healthcare monitoring.

# ❤️ ECG Monitoring & Arrhythmia Detection System

A full-stack real-time ECG monitoring system that captures heart signals using hardware sensors, processes them, and detects arrhythmias using machine learning.

This project combines **Embedded Systems + Web Development + AI + Cloud Deployment**.

---

## 📌 Table of Contents
- Overview
- Features
- System Architecture
- Arrhythmia Detection
- Tech Stack
- Hardware Setup
- Project Structure
- Installation
- AWS EC2 Deployment
- Usage
- API Endpoints
- Screenshots
- Dataset
- Future Improvements
- Author

---

## 🧠 Overview

This system captures ECG signals using **AD8232 + ESP32**, sends data to a backend server, processes it using Python ML models, and visualizes results in a web dashboard.

It also detects abnormal heart rhythms (**arrhythmias**) using RR interval analysis and classification.

---

## 🚀 Features

- 📡 Real-time ECG signal acquisition
- 📊 Live ECG waveform visualization
- ❤️ Arrhythmia detection (ML-based)
- 📉 RR interval analysis
- 🗂️ Patient data storage
- 🔐 Authentication system (JWT)
- ☁️ Cloud deployment (AWS EC2)


## 🏗️ System Architecture

       AD8232 Sensor
            ↓ 
      ESP32 Microcontroller
            ↓ (WiFi / Serial)
     Cloud Server (AWS EC2)      
            ↓
     Application Layer (EC2):
    Backend API (Node.js + Express)
    Python ML Service (Arrhythmia Detection)
    Database (MongoDB)
    Frontend (React – served to user)
             ↓ 
     User / Doctor (Browser / App)


## ❤️ Arrhythmia Detection

Arrhythmia = irregular Heart rhythm.

### 🔍 Types Detected
- Normal (N)
- PVC (Premature Ventricular Contraction)
- APB (Atrial Premature Beat)
- LBBB
- RBBB

---

### ⚙️ Detection Pipeline

1. ECG signal acquisition  
2. Noise filtering  
3. R-peak detection  
4. RR interval calculation  
5. Feature extraction  
6. ML classification  

---

## ⚙️ Tech Stack

### Frontend
- React.js
- Tailwind CSS
- Vite

### Backend
- Node.js
- Express.js
- MongoDB

### Machine Learning
- Python
- NumPy, Pandas
- TensorFlow / Scikit-learn

### Hardware
- ESP32
- AD8232 ECG Sensor

---

## 🔌 Hardware Setup

### Connections

| AD8232 | ESP32 |
|--------|------|
| OUTPUT | GPIO34 (A0) |
| LO+    | Digital |
| LO-    | Digital |
| 3.3V   | 3.3V |
| GND    | GND |

---

### Electrode Placement
- RA → Right Arm  
- LA → Left Arm  
- RL → Right Leg  

---

## 📁 Project Structure

```
project/
│
├── backend/                     # Node.js + Express backend
│   ├── models/                 # MongoDB schemas
│   │   ├── User.js
│   │   ├── ECG.js
│   │   └── Report.js
│   │
│   ├── routes/                 # API routes
│   │   ├── auth.js
│   │   ├── ecg.js
│   │   └── patient.js
│   │
│   ├── utils/                  # Utility functions
│   │   ├── authMiddleware.js
│   │   ├── ecgEngine.js
│   │   ├── predict.py          # ML integration
│   │   └── run_report.py
│   │
│   ├── .env                    # Environment variables
│   ├── server.js               # Entry point
│   └── package.json
│
├── src/                        # React frontend
│   ├── components/
│   │   ├── ECGChart.jsx
│   │   ├── ProtectedRoute.jsx
│   │
│   ├── context/
│   │   └── AuthContext.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── LoginPage.jsx
│   │   └── LandingPage.jsx
│   │
│   ├── utils/
│   │   └── ecgSimulator.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── python/                     # ML & signal processing
│   ├── predict.py
│   ├── ecg_processing.py
│   └── requirements.txt
│
├── Test_data/                  # ECG dataset
│   ├── RECORDS
│   ├── ANNOTATORS
│   └── samples/
│
├── images/                     # README images
│   ├── dashboard.png
│   ├── login.png
│   └── ecg_chart.png
│
├── python_serial_supabase.py   # ESP32 data receiver script
│
├── index.html                  # Frontend root
├── package.json                # Frontend config
├── package-lock.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
│
└── README.md
```

![ECG Output]   
(images/ecg_chart.png)
