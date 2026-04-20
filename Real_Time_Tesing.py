# import numpy as np
# import time
# from scipy.signal import butter, filtfilt
# import neurokit2 as nk
# import tensorflow as tf
# from tensorflow.keras.models import load_model

# # ================= PARAMETERS =================
# fs = 360
# WINDOW = 220
# BUFFER_SIZE = 10000

# # ================= FOCAL LOSS =================
# def focal_loss(gamma=2., alpha=.25):
#     def loss(y_true, y_pred):
#         y_pred = tf.clip_by_value(y_pred, 1e-7, 1-1e-7)
#         cross_entropy = -y_true * tf.math.log(y_pred)
#         weight = alpha * tf.pow(1-y_pred, gamma)
#         return tf.reduce_sum(weight * cross_entropy, axis=1)
#     return loss

# # ================= LOAD MODEL =================
# model = load_model(
#     "final_ecg_arrhythmia_model.h5",
#     custom_objects={"loss": focal_loss()}
# )
# print("✅ Model Loaded")

# # ================= FILTER =================
# def bandpass_filter(signal):
#     low = 0.5 / (fs/2)
#     high = 40 / (fs/2)
#     b, a = butter(2, [low, high], btype="band")
#     return filtfilt(b, a, signal)

# # ================= LOAD RAW ECG =================
# # 👉 Replace with your file
# signal = np.loadtxt("raw_ecg.txt")

# print("📊 Total Samples:", len(signal))

# # ================= REAL-TIME SIMULATION =================
# buffer = []

# for i in range(len(signal)):

#     # simulate live streaming
#     buffer.append(signal[i])

#     if len(buffer) > BUFFER_SIZE:
#         buffer = buffer[-BUFFER_SIZE:]

#     # process every ~1.5 sec
#     if i % 500 == 0 and len(buffer) > 2000:

#         try:
#             sig = np.array(buffer)

#             # ===== FILTER =====
#             sig = bandpass_filter(sig)

#             # ===== NORMALIZE =====
#             sig = (sig - np.mean(sig)) / (np.std(sig) + 1e-8)

#             # ===== R-PEAK DETECTION =====
#             signals, info = nk.ecg_process(sig, sampling_rate=fs)
#             r_peaks = info["ECG_R_Peaks"]

#             # ===== SEGMENTATION =====
#             beats = []
#             for peak in r_peaks:
#                 if peak-WINDOW >= 0 and peak+WINDOW < len(sig):
#                     beat = sig[peak-WINDOW : peak+WINDOW]
#                     beats.append(beat)

#             if len(beats) == 0:
#                 continue

#             beats = np.array(beats).reshape(-1, WINDOW*2, 1)

#             # ===== PREDICTION =====
#             pred = model.predict(beats, verbose=0)
#             pred_classes = np.argmax(pred, axis=1)

#             # ===== HEART RATE =====
#             if len(r_peaks) > 1:
#                 rr = np.diff(r_peaks) / fs
#                 hr = 60 / np.median(rr)
#             else:
#                 hr = 0

#             # ===== ARRHYTHMIA % =====
#             arr_percent = np.sum(pred_classes == 1) / len(pred_classes) * 100

#             # ===== FINAL STATUS =====
#             status = "⚠️ Arrhythmia Detected" if arr_percent > 10 else "✅ Normal"

#             # ===== CONFIDENCE (NEW 🔥) =====
#             confidence = np.max(pred) * 100

#             # ===== OUTPUT =====
#             print("\n-----------------------------")
#             print(f"⏱ Samples Processed: {i}")
#             print(f"❤️ Heart Rate: {hr:.2f} BPM")
#             print(f"📊 Arrhythmia %: {arr_percent:.2f}%")
#             print(f"🎯 Confidence: {confidence:.2f}%")
#             print(f"🫀 Status: {status}")
#             print("-----------------------------")

#         except Exception as e:
#             print("Error:", e)

#     # simulate real-time speed
#     time.sleep(1/fs)



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