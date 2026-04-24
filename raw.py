import numpy as np
from scipy.signal import butter, filtfilt, resample, find_peaks
import tensorflow as tf
from tensorflow.keras.models import load_model
import matplotlib.pyplot as plt

# ================= PARAMETERS =================
fs_target = 360
fs_actual = 200
WINDOW = 220

# ================= FOCAL LOSS =================
def focal_loss(gamma=2., alpha=.25):
    def loss(y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1-1e-7)
        cross_entropy = -y_true * tf.math.log(y_pred)
        weight = alpha * tf.pow(1-y_pred, gamma)
        return tf.reduce_sum(weight * cross_entropy, axis=1)
    return loss

# ================= LOAD MODEL =================
model = load_model(
    "final_ecg_arrhythmia_model.h5",
    custom_objects={"loss": focal_loss()}
)

# ================= FILTER =================
def bandpass_filter(signal):
    low = 0.5/(fs_target/2)
    high = 35/(fs_target/2)
    b,a = butter(3,[low,high],btype="band")
    return filtfilt(b,a,signal)

# ================= LOAD ECG =================
file_path = "Pasted text_raw_example.txt"

signal = []
with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        try:
            signal.append(float(line.strip()))
        except:
            continue

signal = np.array(signal)

# ================= RESAMPLE =================
signal = resample(signal, int(len(signal) * fs_target / fs_actual))

# ================= NORMALIZE =================
signal = signal - np.mean(signal)
signal = signal / (np.std(signal) + 1e-8)

# ================= FILTER =================
signal = bandpass_filter(signal)

# 🔥 INVERT SIGNAL (important for your case)
signal = -signal

# ================= SMOOTH =================
signal = np.convolve(signal, np.ones(5)/5, mode='same')

# =========================================================
# 🔥 YOUR PEAK DETECTION BLOCK (CORRECTLY PLACED)
# =========================================================

min_distance = int(0.6 * fs_target)

peaks, _ = find_peaks(
    signal,
    distance=min_distance,
    height=np.mean(signal) + 0.8*np.std(signal)
)

r_peaks = peaks

# ================= SAFETY FILTER =================
rr = np.diff(r_peaks) / fs_target
valid = (rr > 0.5) & (rr < 1.2)

r_peaks = r_peaks[1:][valid]

if len(r_peaks) < 5:
    print("⚠️ Peak detection failed")
    exit()

# =========================================================

# ================= HEART RATE =================
rr = np.diff(r_peaks) / fs_target
hr = 60 / np.median(rr)
rr_std = np.std(rr)

# ================= SEGMENTATION =================
beats = []
for peak in r_peaks:
    if peak-WINDOW >= 0 and peak+WINDOW < len(signal):

        beat = signal[peak-WINDOW:peak+WINDOW]

        # ALIGNMENT
        max_idx = np.argmax(beat)
        shift = WINDOW - max_idx
        beat = np.roll(beat, shift)

        beat = (beat - np.mean(beat)) / (np.std(beat) + 1e-8)
        beats.append(beat)

if len(beats) == 0:
    print("⚠️ No valid beats")
    exit()

beats = np.array(beats).reshape(-1, WINDOW*2, 1)

# ================= MODEL =================
pred = model.predict(beats, verbose=0)
pred_classes = np.argmax(pred, axis=1)

arr_percent = np.sum(pred_classes == 1) / len(pred_classes) * 100
confidence = np.mean(np.max(pred, axis=1)) * 100

# ================= FINAL DECISION =================
if rr_std < 0.08 and arr_percent < 80:
    status = "✅ Normal"
elif rr_std > 0.15 and arr_percent > 80:
    status = "⚠️ Possible Arrhythmia"
else:
    status = "⚠️ Uncertain (Check Signal)"

# ================= FINAL OUTPUT =================
print("\n========== FINAL RESULT ==========")
print(f"❤️ Heart Rate: {hr:.2f} BPM")
print(f"📊 Arrhythmia %: {arr_percent:.2f}%")
print(f"📉 RR STD: {rr_std:.3f}")
print(f"🎯 Confidence: {confidence:.2f}%")
print(f"🫀 Status: {status}")

# ================= PLOT =================
t = np.arange(len(signal)) / fs_target

plt.figure(figsize=(12,4))
plt.plot(t, signal)
plt.scatter(r_peaks/fs_target, signal[r_peaks], color='red')
plt.title("ECG + Clean R Peaks")
plt.grid()
plt.show()