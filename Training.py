import numpy as np
import wfdb
import matplotlib.pyplot as plt
import os

from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, classification_report

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense
from tensorflow.keras.utils import to_categorical


# ================= PARAMETERS =================
DATA_PATH = r"C:\Users\NVH Krishna\Desktop\Theme_Based\Ecg_Dataset\mitdbdir\\"
WINDOW = 180   # samples before & after R-peak


# ================= GET ALL RECORD NAMES =================
# automatically detect records like 100, 101, 102...
RECORDS = sorted(list(set(f.split('.')[0] for f in os.listdir(DATA_PATH) if f.endswith('.dat'))))

print("Records found:", RECORDS)


# ================= LOAD DATA =================
X = []
y = []

for rec in RECORDS:
    print(f"Loading record {rec}...")

    record = wfdb.rdrecord(DATA_PATH + rec)
    annotation = wfdb.rdann(DATA_PATH + rec, "atr")

    signal = record.p_signal[:, 0]
    r_peaks = annotation.sample
    labels = annotation.symbol

    # ---------- heartbeat segmentation ----------
    for i, peak in enumerate(r_peaks):

        if peak - WINDOW >= 0 and peak + WINDOW < len(signal):

            beat = signal[peak - WINDOW : peak + WINDOW]
            X.append(beat)

            # label mapping
            if labels[i] == 'N':
                y.append(0)   # Normal
            else:
                y.append(1)   # Arrhythmia


X = np.array(X)
y = np.array(y)

print("\nDataset shape:", X.shape)
print("Normal beats:", np.sum(y == 0))
print("Arrhythmia beats:", np.sum(y == 1))


# ================= PREPARE DATA =================
X = X.reshape(X.shape[0], X.shape[1], 1)
y = to_categorical(y, 2)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)


# ================= BUILD 1D-CNN MODEL =================
model = Sequential([
    Conv1D(16, 5, activation="relu", input_shape=(X.shape[1], 1)),
    MaxPooling1D(2),

    Conv1D(32, 5, activation="relu"),
    MaxPooling1D(2),

    Flatten(),
    Dense(32, activation="relu"),
    Dense(2, activation="softmax")
])

model.compile(optimizer="adam",
              loss="categorical_crossentropy",
              metrics=["accuracy"])

model.summary()


# ================= TRAIN MODEL =================
history = model.fit(
    X_train, y_train,
    epochs=10,
    batch_size=32,
    validation_data=(X_test, y_test)
)


# ================= EVALUATE MODEL =================
loss, acc = model.evaluate(X_test, y_test)
print("\nTest Accuracy:", acc)


# ================= CONFUSION MATRIX =================
y_pred = model.predict(X_test)
y_pred_classes = np.argmax(y_pred, axis=1)
y_true = np.argmax(y_test, axis=1)

print("\nConfusion Matrix:\n", confusion_matrix(y_true, y_pred_classes))
print("\nClassification Report:\n", classification_report(y_true, y_pred_classes))


# ================= SAVE MODEL =================
model.save("ecg_model.h5")
print("\nModel saved as ecg_model.h5")


# ================= OPTIONAL: PLOT TRAINING =================
plt.plot(history.history['accuracy'], label="Train Accuracy")
plt.plot(history.history['val_accuracy'], label="Val Accuracy")
plt.title("Training Accuracy")
plt.legend()
plt.show()
