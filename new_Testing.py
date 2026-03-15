import numpy as np
import wfdb
from scipy.signal import butter, filtfilt
import tensorflow as tf
from tensorflow.keras.models import load_model
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

# ================= PARAMETERS =================
DATA_PATH = r"C:\Users\NVH Krishna\Desktop\Theme_Based\Ecg_Dataset\mitdbdir\\"
TEST_RECORD = "233"

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

        # normalize
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

print("Model loaded successfully")


# ================= PREDICT =================
pred = model.predict(beats)

pred_classes = np.argmax(pred, axis=1)


# ================= SAMPLE OUTPUT =================
print("\nSample predictions:\n")

for i in range(min(20, len(pred_classes))):

    predicted = "Normal" if pred_classes[i] == 0 else "Arrhythmia"
    actual = "Normal" if true_labels[i] == 0 else "Arrhythmia"

    print(f"Beat {i+1}: Predicted={predicted} | Actual={actual}")


# ================= ACCURACY =================
accuracy = accuracy_score(true_labels, pred_classes)

print("\nPrediction Accuracy:", round(accuracy*100,2), "%")


# ================= CONFUSION MATRIX =================
print("\nConfusion Matrix\n")

print(confusion_matrix(true_labels, pred_classes))


# ================= CLASSIFICATION REPORT =================
print("\nClassification Report\n")

print(classification_report(true_labels, pred_classes))


# ================= FINAL ECG REPORT =================
arrhythmia_beats = np.sum(pred_classes == 1)
normal_beats = np.sum(pred_classes == 0)

total = len(pred_classes)

arr_percent = (arrhythmia_beats / total) * 100

print("\n------ FINAL ECG REPORT ------")

print("Total Beats Analysed:", total)
print("Normal Beats:", normal_beats)
print("Arrhythmia Beats:", arrhythmia_beats)
print("Arrhythmia Percentage:", round(arr_percent,2), "%")

if arr_percent > 10:
    print("\n🫀 FINAL RESULT: ARRHYTHMIA DETECTED")
else:
    print("\n🫀 FINAL RESULT: ECG NORMAL")