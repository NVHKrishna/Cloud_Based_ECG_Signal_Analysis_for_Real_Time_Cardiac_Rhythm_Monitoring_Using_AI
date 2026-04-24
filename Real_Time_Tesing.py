# --------------------------------------------------------------------------------------------------------------------
import numpy as np
import pandas as pd
import time
from scipy.signal import butter, filtfilt, resample
import neurokit2 as nk
import tensorflow as tf
from tensorflow.keras.models import load_model

# ================= PARAMETERS =================
fs = 360
WINDOW = 220
BUFFER_SIZE = 10000

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
print("✅ Model Loaded")

# ================= FILTER =================
def bandpass_filter(signal):
    low = 0.5 / (fs/2)
    high = 40 / (fs/2)
    b, a = butter(2, [low, high], btype="band")
    return filtfilt(b, a, signal)

# ================= LOAD CSV ECG =================
file_path = r"PTB diagnostic ecg database csv files\s0001_re.csv"

df = pd.read_csv(file_path)

print("Available columns:", df.columns)

# ================= SELECT LEAD =================
# Change if needed after checking columns
signal = df["ii"].values

print("Original Samples:", len(signal))

# ================= RESAMPLE =================
# Assuming original is 1000 Hz → convert to 360 Hz
signal = resample(signal, int(len(signal) * 360 / 1000))

print("Resampled Samples:", len(signal))

# ================= REAL-TIME SIMULATION =================
buffer = []

for i in range(len(signal)):

    buffer.append(signal[i])

    # keep buffer size limited
    if len(buffer) > BUFFER_SIZE:
        buffer = buffer[-BUFFER_SIZE:]

    # process every ~1.5 sec
    if i % 500 == 0 and len(buffer) > 2000:

        try:
            sig = np.array(buffer)

            # ===== FILTER =====
            sig = bandpass_filter(sig)

            # ===== NORMALIZE =====
            sig = (sig - np.mean(sig)) / (np.std(sig) + 1e-8)

            # ===== R-PEAK DETECTION =====
            _, info = nk.ecg_process(sig, sampling_rate=fs)
            r_peaks = info["ECG_R_Peaks"]

            # ===== SEGMENTATION =====
            beats = []
            for peak in r_peaks:
                if peak-WINDOW >= 0 and peak+WINDOW < len(sig):
                    beats.append(sig[peak-WINDOW : peak+WINDOW])

            if len(beats) == 0:
                continue

            beats = np.array(beats).reshape(-1, WINDOW*2, 1)

            # ===== PREDICTION =====
            pred = model.predict(beats, verbose=0)
            pred_classes = np.argmax(pred, axis=1)

            # ===== HEART RATE =====
            if len(r_peaks) > 1:
                rr = np.diff(r_peaks) / fs
                hr = 60 / np.median(rr)
            else:
                hr = 0

            # ===== ARRHYTHMIA % =====
            arr_percent = np.sum(pred_classes == 1) / len(pred_classes) * 100

            # ===== FINAL STATUS =====
            status = "⚠️ Arrhythmia Detected" if arr_percent > 10 else "✅ Normal"

            # ===== CONFIDENCE =====
            confidence = np.max(pred) * 100

            # ===== OUTPUT =====
            print("\n-----------------------------")
            print(f"⏱ Samples Processed: {i}")
            print(f"❤️ Heart Rate: {hr:.2f} BPM")
            print(f"📊 Arrhythmia %: {arr_percent:.2f}%")
            print(f"🎯 Confidence: {confidence:.2f}%")
            print(f"🫀 Status: {status}")
            print("-----------------------------")

        except Exception as e:
            print("⚠️ Error:", e)

    # simulate real-time speed
    time.sleep(1/fs)
    
    
    import matplotlib.pyplot as plt

# create time axis
time_axis = np.arange(len(sig)) / fs

plt.figure(figsize=(12,4))
plt.plot(time_axis, sig)

plt.title("ECG Signal (Lead II)")
plt.xlabel("Time (seconds)")
plt.ylabel("Amplitude")

plt.grid()
plt.show()
    
    
    
    
    
    
# ----------------------------------------RAW DATA----------------------------------------------------------------
# import numpy as np
# import pandas as pd
# from scipy.signal import butter, filtfilt
# import neurokit2 as nk
# import tensorflow as tf
# from tensorflow.keras.models import load_model
# import matplotlib.pyplot as plt

# # ================= PARAMETERS =================
# fs = 360           # ✅ Your signal is already 360 Hz
# WINDOW = 220

# RAW_FILE = "Pasted text(4) (1)-new.txt"

# # ================= LOAD MODEL =================
# def focal_loss(gamma=2., alpha=.25):
#     def loss(y_true, y_pred):
#         y_pred = tf.clip_by_value(y_pred, 1e-7, 1-1e-7)
#         cross_entropy = -y_true * tf.math.log(y_pred)
#         weight = alpha * tf.pow(1-y_pred, gamma)
#         return tf.reduce_sum(weight * cross_entropy, axis=1)
#     return loss

# model = load_model("final_ecg_arrhythmia_model.h5",
#                    custom_objects={"loss": focal_loss()})

# print("✅ Model Loaded")

# # ================= LOAD SIGNAL =================
# def load_raw_txt(filepath):
#     signal = []

#     with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
#         for line in f:
#             line = line.strip()

#             if line == "":
#                 continue

#             try:
#                 parts = line.replace(",", " ").split()
#                 for p in parts:
#                     signal.append(float(p))
#             except:
#                 continue

#     signal = np.array(signal, dtype=np.float32)

#     print(f"📂 Loaded samples: {len(signal)}")

#     return signal

# raw_signal = load_raw_txt(RAW_FILE)

# # ================= CLEAN ECG =================
# def clean_ecg(sig):

#     # remove extreme spikes
#     sig = np.clip(sig,
#                   np.percentile(sig, 2),
#                   np.percentile(sig, 98))

#     # remove DC offset
#     sig = sig - np.mean(sig)

#     # bandpass filter (0.5–30 Hz)
#     low = 0.5 / (fs/2)
#     high = 30 / (fs/2)
#     b, a = butter(3, [low, high], btype='band')
#     sig = filtfilt(b, a, sig)

#     # smoothing
#     kernel = np.ones(5) / 5
#     sig = np.convolve(sig, kernel, mode='same')

#     # normalize
#     sig = sig / (np.std(sig) + 1e-8)

#     return sig

# signal = clean_ecg(raw_signal)

# # ================= R-PEAK DETECTION =================
# signals, info = nk.ecg_peaks(signal, sampling_rate=fs, method="neurokit")
# r_peaks = info.get("ECG_R_Peaks", [])

# print(f"🔍 Detected R-peaks: {len(r_peaks)}")

# if len(r_peaks) == 0:
#     print("⚠️ No peaks detected")
#     exit()

# # remove too-close peaks (noise)
# clean_peaks = [r_peaks[0]]
# for p in r_peaks[1:]:
#     if (p - clean_peaks[-1]) > int(0.4 * fs):
#         clean_peaks.append(p)

# r_peaks = np.array(clean_peaks)

# if len(r_peaks) < 5:
#     print("⚠️ Poor signal quality")
#     exit()

# # ================= HEART RATE =================
# rr = np.diff(r_peaks) / fs
# hr = 60 / np.median(rr)
# rr_std = np.std(rr)

# # ================= SEGMENTATION =================
# beats = []
# beat_peaks = []

# for peak in r_peaks:
#     if peak - WINDOW >= 0 and peak + WINDOW < len(signal):

#         beat = signal[peak-WINDOW:peak+WINDOW]

#         # align R peak to center
#         max_idx = np.argmax(beat)
#         shift = WINDOW - max_idx
#         beat = np.roll(beat, shift)

#         # normalize beat
#         beat = (beat - np.mean(beat)) / (np.std(beat) + 1e-8)

#         beats.append(beat)
#         beat_peaks.append(peak)

# if len(beats) == 0:
#     print("⚠️ No valid beats extracted")
#     exit()

# beats = np.array(beats).reshape(-1, WINDOW*2, 1)

# print(f"💓 Extracted Beats: {len(beats)}")

# # ================= PREDICTION =================
# pred = model.predict(beats, verbose=0)
# pred_classes = np.argmax(pred, axis=1)
# confidences = np.max(pred, axis=1) * 100

# arr_count = np.sum(pred_classes == 1)
# normal_count = np.sum(pred_classes == 0)

# arr_percent = arr_count / len(pred_classes) * 100

# # better confidence
# if arr_count > 0:
#     confidence = np.mean(confidences[pred_classes == 1])
# else:
#     confidence = np.mean(confidences)

# # ================= FINAL DECISION =================
# if arr_percent >= 30 or rr_std > 0.09:
#     status = "⚠️ Arrhythmia Detected"
# else:
#     status = "✅ Normal (Stable Rhythm)"

# # ================= OUTPUT =================
# print("\n========== FINAL ECG ANALYSIS ==========")
# print(f"❤️ Heart Rate       : {hr:.2f} BPM")
# print(f"💓 Total Beats      : {len(beats)}")
# print(f"✅ Normal Beats     : {normal_count}")
# print(f"⚠️ Arrhythmia Beats: {arr_count}")
# print(f"📊 Arrhythmia %     : {arr_percent:.2f}%")
# print(f"📉 RR STD           : {rr_std:.3f}")
# print(f"🎯 Confidence       : {confidence:.2f}%")
# print(f"🫀 Status           : {status}")

# # ================= PLOT =================
# t = np.arange(len(signal)) / fs

# normal_peaks = np.array(beat_peaks)[pred_classes == 0]
# arr_peaks = np.array(beat_peaks)[pred_classes == 1]

# plt.figure(figsize=(12,4))
# plt.plot(t, signal, label="ECG")

# plt.scatter(normal_peaks/fs, signal[normal_peaks],
#             color='green', s=40, label="Normal")

# plt.scatter(arr_peaks/fs, signal[arr_peaks],
#             color='red', s=60, marker='x', label="Arrhythmia")

# plt.title(f"ECG Analysis | {status} | HR: {hr:.1f} BPM")
# plt.xlabel("Time (seconds)")
# plt.ylabel("Amplitude")
# plt.legend()
# plt.grid()

# plt.show()