"""
ECG Report Generator — mirrors updated New_Testing.py logic.
Includes: beat prediction, accuracy, RR intervals, heart rate, final result.
Outputs JSON for the backend /api/ecg/report endpoint.
"""

import sys
import json
import numpy as np
import os

DATA_PATH = r"C:\Users\NVH Krishna\Desktop\Theme_Based\Ecg_Dataset\mitdbdir\\"
WINDOW = 220
fs = 360

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'final_ecg_arrhythmia_model.h5')


def focal_loss(gamma=2., alpha=.25):
    import tensorflow as tf
    def loss(y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1 - 1e-7)
        cross_entropy = -y_true * tf.math.log(y_pred)
        weight = alpha * tf.pow(1 - y_pred, gamma)
        return tf.reduce_sum(weight * cross_entropy, axis=1)
    return loss


def bandpass_filter(signal):
    from scipy.signal import butter, filtfilt
    low = 0.5 / (fs / 2)
    high = 40 / (fs / 2)
    b, a = butter(2, [low, high], btype="band")
    return filtfilt(b, a, signal)


def run_report(record_id="108"):
    try:
        import wfdb
        from tensorflow.keras.models import load_model
        from sklearn.metrics import accuracy_score

        # Load record and annotations
        record = wfdb.rdrecord(DATA_PATH + record_id)
        annotation = wfdb.rdann(DATA_PATH + record_id, "atr")

        signal = record.p_signal[:, 0]
        r_peaks = annotation.sample
        labels = annotation.symbol

        # Filter signal
        signal = bandpass_filter(signal)

        # Segment beats
        beats = []
        true_labels = []
        valid_r_peaks = []

        for i, peak in enumerate(r_peaks):
            if peak - WINDOW >= 0 and peak + WINDOW < len(signal):
                beat = signal[peak - WINDOW: peak + WINDOW]
                beat = (beat - np.mean(beat)) / (np.std(beat) + 1e-8)
                beats.append(beat)
                true_labels.append(0 if labels[i] == 'N' else 1)
                valid_r_peaks.append(peak)

        beats = np.array(beats, dtype=np.float32).reshape(-1, WINDOW * 2, 1)
        true_labels = np.array(true_labels)
        valid_r_peaks = np.array(valid_r_peaks)

        # ── Heart Rate every 10 beats + RR intervals ──
        rr_intervals = []
        hr_windows = []
        rr_display = []  # individual RR values for dashboard display

        for i in range(1, len(valid_r_peaks)):
            rr = (valid_r_peaks[i] - valid_r_peaks[i - 1]) / fs
            # Clean RR intervals (0.3s to 2.0s) as per Test.py
            if rr < 0.3 or rr > 2.0:
                continue
            rr_intervals.append(rr)
            rr_display.append(round(float(rr * 1000), 1))  # in ms

            # HR window every 10 beats
            if len(rr_intervals) % 10 == 0:
                last_10_rr = rr_intervals[-10:]
                robust_hr = 60 / np.median(last_10_rr)
                mean_hr = 60 / np.mean(last_10_rr)
                hr_windows.append({
                    "beatRange": f"{len(rr_intervals)-9}–{len(rr_intervals)}",
                    "robustHR": round(float(robust_hr), 2),
                    "meanHR": round(float(mean_hr), 2),
                    "avgRRms": round(float(np.mean(last_10_rr) * 1000), 1)
                })

        # Final overall heart rate (Robust) as per Test.py
        if rr_intervals:
            avg_rr_ms = round(float(np.mean(rr_intervals) * 1000), 1)
            avg_hr = round(float(60 / np.mean(rr_intervals)), 2)     # overall mean
            robust_hr_overall = round(float(60 / np.median(rr_intervals)), 2) # overall robust
        else:
            avg_rr_ms = 0
            avg_hr = 0
            robust_hr_overall = 0

        # Load model
        model = load_model(MODEL_PATH, custom_objects={"loss": focal_loss()}, compile=False)

        # Predict
        pred = model.predict(beats, verbose=0)
        pred_classes = np.argmax(pred, axis=1)

        # Metrics
        accuracy = accuracy_score(true_labels, pred_classes)
        total = len(pred_classes)
        normal_beats = int(np.sum(pred_classes == 0))
        arrhythmia_beats = int(np.sum(pred_classes == 1))
        arr_percent = (arrhythmia_beats / total) * 100
        # Determine final result based on arrhythmia percent and median RR
        median_rr = np.median(rr_intervals) if rr_intervals else 0.0
        if arr_percent > 10:
            final_result = "Arrhythmia Detected"
        elif 0.6 <= median_rr <= 1.0:
            final_result = "Normal"
        else:
            final_result = "Abnormal Heart Rate"

        # Sample predictions (first 20)
        sample_preds = []
        for i in range(min(20, len(pred_classes))):
            sample_preds.append({
                "beat": i + 1,
                "predicted": "Normal" if pred_classes[i] == 0 else "Arrhythmia",
                "actual": "Normal" if true_labels[i] == 0 else "Arrhythmia",
                "confidence": round(float(np.max(pred[i])) * 100, 2)
            })

        # Prepare result
        result = {
            "success": True,
            "record": record_id,
            "totalBeats": total,
            "normalBeats": normal_beats,
            "arrhythmiaBeats": arrhythmia_beats,
            "arrhythmiaPercent": round(arr_percent, 2),
            "accuracy": round(accuracy * 100, 2),
            "finalResult": final_result,
            "avgHeartRate": avg_hr,
            "robustHeartRate": robust_hr_overall,
            "avgRRms": avg_rr_ms,
            "hrWindows": hr_windows,
            "rrIntervals": rr_display[:2000],
            "samplePredictions": sample_preds
        }



        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    record_id = sys.argv[1] if len(sys.argv) > 1 else "108"
    run_report(record_id)
