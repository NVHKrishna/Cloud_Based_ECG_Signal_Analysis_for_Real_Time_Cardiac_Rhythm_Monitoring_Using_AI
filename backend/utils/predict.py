"""
ECG Prediction Bridge — Node.js → Python → TensorFlow
Accepts raw ECG signal from Ubidots (or any source),
detects R-peaks, extracts 440-sample beat windows,
and runs inference using the trained .h5 model.
"""

import sys
import json
import numpy as np
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'final_ecg_arrhythmia_model.h5')
WINDOW = 220   # 220 samples on each side of R-peak → 440 total
FS = 360       # Assumed sampling rate (MIT-BIH standard)


def bandpass_filter(signal, fs=360):
    """0.5–40 Hz Butterworth bandpass filter — removes baseline wander and noise."""
    from scipy.signal import butter, filtfilt
    low = 0.5 / (fs / 2)
    high = 40.0 / (fs / 2)
    b, a = butter(2, [low, high], btype='band')
    return filtfilt(b, a, signal)


def detect_r_peaks(signal, fs=360):
    """
    Simple threshold-based R-peak detector.
    Works on normalized, filtered ECG signal.
    Returns list of sample indices where R-peaks occur.
    """
    # Normalize
    norm = (signal - np.mean(signal)) / (np.std(signal) + 1e-8)

    # Threshold at 0.5 std above mean (works well for clean ECG)
    threshold = 0.5
    min_distance = int(0.3 * fs)  # minimum 300ms between peaks (max ~200 BPM)

    peaks = []
    i = 1
    while i < len(norm) - 1:
        if norm[i] > threshold and norm[i] > norm[i - 1] and norm[i] > norm[i + 1]:
            # Ensure minimum distance from last peak
            if not peaks or (i - peaks[-1]) >= min_distance:
                peaks.append(i)
        i += 1

    return peaks


def extract_beats(signal, r_peaks, window=220):
    """Extract fixed-length beat windows centered on R-peaks."""
    beats = []
    valid_peaks = []
    for peak in r_peaks:
        if peak - window >= 0 and peak + window < len(signal):
            beat = signal[peak - window: peak + window]
            # Normalize each beat independently
            beat = (beat - np.mean(beat)) / (np.std(beat) + 1e-8)
            beats.append(beat)
            valid_peaks.append(peak)
    return np.array(beats, dtype=np.float32), valid_peaks


def focal_loss(gamma=2., alpha=.25):
    import tensorflow as tf
    def loss(y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1 - 1e-7)
        cross_entropy = -y_true * tf.math.log(y_pred)
        weight = alpha * tf.pow(1 - y_pred, gamma)
        return tf.reduce_sum(weight * cross_entropy, axis=1)
    return loss


def predict():
    try:
        import os
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"success": False, "error": "No input data"}))
            return

        data = json.loads(input_data)
        raw_signal = np.array(data['ecg'], dtype=np.float64)

        if len(raw_signal) < WINDOW * 2 + 10:
            # Signal too short — pad and use as single beat
            padded = np.pad(raw_signal, (0, max(0, WINDOW * 2 - len(raw_signal))), 'constant')
            padded = padded[:WINDOW * 2]
            padded = (padded - np.mean(padded)) / (np.std(padded) + 1e-8)
            beats = padded.reshape(1, WINDOW * 2, 1)
            beat_count = 1
        else:
            # Apply bandpass filter
            filtered = bandpass_filter(raw_signal, fs=FS)

            # Detect R-peaks
            r_peaks = detect_r_peaks(filtered, fs=FS)

            if len(r_peaks) == 0:
                # No peaks found — use center segment as fallback
                mid = len(filtered) // 2
                start = max(0, mid - WINDOW)
                end = start + WINDOW * 2
                beat = filtered[start:end]
                beat = (beat - np.mean(beat)) / (np.std(beat) + 1e-8)
                beats = beat.reshape(1, WINDOW * 2, 1)
                beat_count = 1
            else:
                # Extract aligned beat windows
                beats_arr, valid_peaks = extract_beats(filtered, r_peaks, WINDOW)
                if len(beats_arr) == 0:
                    print(json.dumps({"success": False, "error": "No valid beats extracted"}))
                    return
                beats = beats_arr.reshape(-1, WINDOW * 2, 1)
                beat_count = len(beats)

        # Load model
        from tensorflow.keras.models import load_model
        model = load_model(MODEL_PATH, custom_objects={"loss": focal_loss()}, compile=False)

        # Predict all beats
        preds = model.predict(beats, verbose=0)
        pred_classes = np.argmax(preds, axis=1)

        # Aggregate: majority vote
        normal_count = int(np.sum(pred_classes == 0))
        arrhy_count = int(np.sum(pred_classes == 1))
        arr_percent = (arrhy_count / beat_count) * 100

        # Final classification
        if arr_percent > 10:
            final_prediction = "Arrhythmia"
        else:
            final_prediction = "Normal"

        # Confidence: average max probability across all beats
        avg_confidence = float(np.mean(np.max(preds, axis=1))) * 100

        result = {
            "success": True,
            "prediction": final_prediction,
            "confidence": round(avg_confidence, 2),
            "beatsAnalyzed": beat_count,
            "normalBeats": normal_count,
            "arrhythmiaBeats": arrhy_count,
            "arrhythmiaPercent": round(arr_percent, 2)
        }
        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    predict()
