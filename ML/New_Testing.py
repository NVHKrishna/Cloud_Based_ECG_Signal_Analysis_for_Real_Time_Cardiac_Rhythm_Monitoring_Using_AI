import numpy as np
import wfdb
import os
from bson import ObjectId
from scipy.signal import butter, filtfilt
import tensorflow as tf
from tensorflow.keras.models import load_model
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

import sys

# ================= PARAMETERS =================
if len(sys.argv) >= 3:
    TEST_RECORD = sys.argv[1]
    DATA_PATH = sys.argv[2]
else:
    DATA_PATH = r"C:\Users\NVH Krishna\Desktop\Theme_Based\Ecg_Dataset\mitdbdir\\"
    TEST_RECORD = "108"

if not DATA_PATH.endswith("\\") and not DATA_PATH.endswith("/"):
    DATA_PATH += "\\"
    
WINDOW = 220
fs = 360

# ================= FOCAL LOSS =================
def focal_loss(gamma=2., alpha=.25):

    def loss(y_true, y_pred):

        y_pred = tf.clip_by_value(y_pred, 1e-7, 1-1e-7)

        cross_entropy = -y_true * tf.math.log(y_pred)

        weight = alpha * tf.pow(1-y_pred, gamma)

        return tf.reduce_sum(weight * cross_entropy, axis=1)

    return loss

# ================= BANDPASS FILTER =================
def bandpass_filter(signal):

    low = 0.5 / (fs/2)
    high = 40 / (fs/2)

    b, a = butter(2, [low, high], btype="band")

    return filtfilt(b, a, signal)


# ================= LOAD ECG =================
record = wfdb.rdrecord(DATA_PATH + TEST_RECORD)
annotation = wfdb.rdann(DATA_PATH + TEST_RECORD, "atr")

signal = record.p_signal[:,0]

r_peaks = annotation.sample
labels = annotation.symbol

print("Total ECG samples:", len(signal))
print("Total annotated beats:", len(r_peaks))


# ================= FILTER ECG =================
signal = bandpass_filter(signal)

# ================= SEGMENT BEATS =================
beats = []
true_labels = []

for i, peak in enumerate(r_peaks):

    if peak-WINDOW >= 0 and peak+WINDOW < len(signal):

        beat = signal[peak-WINDOW : peak+WINDOW]

        beat = (beat - np.mean(beat)) / (np.std(beat) + 1e-8)

        beats.append(beat)

        if labels[i] == 'N':
            true_labels.append(0)
        else:
            true_labels.append(1)


beats = np.array(beats, dtype=np.float32)
true_labels = np.array(true_labels)

print("Total beats extracted:", len(beats))

# ================= RESHAPE FOR CNN =================
beats = beats.reshape(-1, WINDOW*2, 1)

# ================= LOAD MODEL =================
model = load_model(
    "final_ecg_arrhythmia_model.h5",
    custom_objects={"loss": focal_loss()}
)

print("Model loaded successfully !!")

# ================= PREDICT =================
pred = model.predict(beats)
pred_classes = np.argmax(pred, axis=1)


# ================= HEART RATE (EVERY 10 BEATS) =================
valid_r_peaks = []

for i, peak in enumerate(r_peaks):
    if peak - WINDOW >= 0 and peak + WINDOW < len(signal):
        valid_r_peaks.append(peak)

valid_r_peaks = np.array(valid_r_peaks)

print("\n------ HEART RATE (EVERY 10 BEATS) ------\n")

rr_intervals = []

for i in range(1, len(valid_r_peaks)):

    rr = (valid_r_peaks[i] - valid_r_peaks[i-1]) / fs

    if rr < 0.3 or rr > 2.0:
        continue

    rr_intervals.append(rr)

    if len(rr_intervals) % 10 == 0:

        last_10_rr = rr_intervals[-10:]

        robust_hr = 60 / np.median(last_10_rr)
        mean_hr = 60 / np.mean(last_10_rr)

        print(f"Beats {len(rr_intervals)-9} to {len(rr_intervals)} → "
              f"HR (Robust): {robust_hr:.2f} BPM | HR (Mean): {mean_hr:.2f} BPM")


# ================= ACCURACY =================
accuracy = accuracy_score(true_labels, pred_classes)
print("\nPrediction Accuracy:", round(accuracy*100,2), "%")


# ================= CONFUSION MATRIX =================
print("\nConfusion Matrix\n")
print(confusion_matrix(true_labels, pred_classes))


# ================= CLASSIFICATION REPORT =================
print("\nClassification Report\n")
print(classification_report(true_labels, pred_classes))


# ================= FINAL CLASSIFICATION LOGIC =================
arrhythmia_beats = np.sum(pred_classes == 1)
normal_beats = np.sum(pred_classes == 0)
total = len(pred_classes)
arr_percent = (arrhythmia_beats / total) * 100

median_rr = np.median(rr_intervals) if rr_intervals else 0.0
avg_rr = np.mean(rr_intervals) if rr_intervals else 0.0

if arr_percent > 10:
    final_result_str = "Arrhythmia Detected"

else:
    final_result_str = "Normal"

# ================= SAVE TO DATABASE =================
try:
    from pymongo import MongoClient
    from datetime import datetime
    
    # Connection to MongoDB
    client = MongoClient("mongodb://localhost:27017/")
    db = client["ecg_db"]
    reports_col = db["reports"]
    
    # ── Get logged-in user ──
    ACTIVE_USER_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "current_user.txt")
    user_id = None
    
    if len(sys.argv) >= 4:
        try:
            user_id = ObjectId(sys.argv[3])
            print(f"\n🔗 Linking report to passed user_id from CLI: {user_id}")
        except Exception:
            pass

    if not user_id and os.path.exists(ACTIVE_USER_FILE):
        raw = open(ACTIVE_USER_FILE).read().strip()
        if raw:
            try:
                user_id = ObjectId(raw)
                print(f"\n🔗 Linking report to logged-in user: {user_id}")
            except Exception:
                pass
    
    if not user_id:
        # Fallback: use the most recent real user (non-OAuth)
        user = db["users"].find_one({"provider": "local"}, sort=[("_id", -1)])
        if not user:
            user = db["users"].find_one(sort=[("_id", -1)])
        user_id = user["_id"] if user else None
        print(f"⚠️  No active login file found — falling back to user: {user_id}")

    report_data = {
        "record": TEST_RECORD,
        "totalBeats": int(total),
        "normalBeats": int(normal_beats),
        "arrhythmiaBeats": int(arrhythmia_beats),
        "arrhythmiaPercent": float(round(arr_percent, 2)),
        "accuracy": float(round(accuracy * 100, 2)),
        "finalResult": final_result_str,
        "avgHeartRate": float(round(60 / avg_rr, 2)) if avg_rr > 0 else 0.0,
        "robustHeartRate": float(round(60 / median_rr, 2)) if median_rr > 0 else 0.0,
        "avgRRms": float(round(avg_rr * 1000, 1)) if avg_rr > 0 else 0.0,
        "hrWindows": [
            {
                "beatRange": f"{i*10+1}–{(i+1)*10}",
                "robustHR": round(60 / np.median(rr_intervals[i*10:(i+1)*10]), 2),
                "meanHR": round(60 / np.mean(rr_intervals[i*10:(i+1)*10]), 2)
            }
            for i in range(len(rr_intervals)//10)
        ],
        "rrIntervals": [round(float(r * 1000), 1) for r in rr_intervals[:2000]],
        "userId": user_id,
        "timestamp": datetime.now()
    }
    
    # Overwrite previous reports for THIS USER only
    if user_id:
        reports_col.delete_many({"userId": user_id})
    else:
        reports_col.delete_many({}) # Fallback for no user
    
    # Insert into database
    reports_col.insert_one(report_data)
    print("\n✅ Report successfully saved to MongoDB.")
    client.close()
    
except Exception as e:
    print(f"\n Failed to save report to MongoDB: {e}")

print(f"\n------ FINAL ECG REPORT ------")
print(f"Total Beats Analysed: {total}")
print(f"Normal Beats: {normal_beats}")
print(f"Arrhythmia Beats: {arrhythmia_beats}")
print(f"Arrhythmia Percentage: {round(arr_percent, 2)} %")
print(f"Median RR: {round(median_rr, 3)} s")
print(f"Average RR (Clean): {round(avg_rr, 3)} s")
print(f"Average Heart Rate (Mean): {round(60 / avg_rr, 2) if avg_rr > 0 else 0.0} BPM")
print(f"Average Heart Rate (Robust): {round(60 / median_rr, 2) if median_rr > 0 else 0.0} BPM")

if final_result_str == "Arrhythmia Detected":
    print("\n🫀 FINAL RESULT: ARRHYTHMIA DETECTED......")
elif final_result_str == "Normal":
    print("\n🫀 FINAL RESULT: Normal......")
else:
    print(f"\n🫀 FINAL RESULT: {final_result_str.upper()}")
