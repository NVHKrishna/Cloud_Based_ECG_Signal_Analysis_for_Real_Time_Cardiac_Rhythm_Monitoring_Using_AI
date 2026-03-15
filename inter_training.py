import numpy as np
import wfdb
import matplotlib.pyplot as plt
import os

from scipy.signal import butter, filtfilt

from sklearn.metrics import confusion_matrix, classification_report
from sklearn.utils.class_weight import compute_class_weight

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense, Dropout
from tensorflow.keras.utils import to_categorical


# ================= PARAMETERS =================
DATA_PATH = r"C:\Users\NVH Krishna\Desktop\Theme_Based\Ecg_Dataset\mitdbdir\\"
WINDOW = 180
fs = 360


# ================= INTER PATIENT SPLIT =================
train_records = [
'101','106','108','109','112','114','115','116','118','119',
'122','124','201','203','205','207','208','209','215','220','223','230'
]

test_records = [
'100','103','105','111','113','117','121','123','200','202',
'210','212','213','214','219','221','222','228','231','232','233','234'
]


# ================= BANDPASS FILTER =================
def bandpass_filter(signal):

    low = 0.5 / (fs/2)
    high = 40 / (fs/2)

    b,a = butter(2,[low,high],btype="band")

    return filtfilt(b,a,signal)


# ================= FUNCTION TO LOAD DATA =================
def load_records(record_list):

    X = []
    y = []

    for rec in record_list:

        print("Loading record:",rec)

        record = wfdb.rdrecord(DATA_PATH + rec)
        annotation = wfdb.rdann(DATA_PATH + rec,"atr")

        signal = record.p_signal[:,0]

        signal = bandpass_filter(signal)

        r_peaks = annotation.sample
        labels = annotation.symbol


        for i,peak in enumerate(r_peaks):

            if peak-WINDOW >=0 and peak+WINDOW < len(signal):

                beat = signal[peak-WINDOW:peak+WINDOW]

                beat = (beat-np.mean(beat))/(np.std(beat)+1e-8)

                X.append(beat)

                if labels[i]=='N':
                    y.append(0)
                else:
                    y.append(1)

    X = np.array(X).astype(np.float32)
    y = np.array(y)

    return X,y


# ================= LOAD TRAINING DATA =================
X_train,y_train = load_records(train_records)

# ================= LOAD TEST DATA =================
X_test,y_test = load_records(test_records)


print("\nTraining shape:",X_train.shape)
print("Testing shape:",X_test.shape)


# ================= RESHAPE =================
X_train = X_train.reshape(X_train.shape[0],360,1)
X_test = X_test.reshape(X_test.shape[0],360,1)

y_train_cat = to_categorical(y_train,2)
y_test_cat = to_categorical(y_test,2)


# ================= CLASS WEIGHTS =================
class_weights = compute_class_weight(

    class_weight="balanced",
    classes=np.unique(y_train),
    y=y_train

)

class_weights = dict(enumerate(class_weights))

print("Class weights:",class_weights)


# ================= CNN MODEL =================
model = Sequential([

    Conv1D(32,5,activation="relu",input_shape=(360,1)),
    MaxPooling1D(2),

    Conv1D(64,5,activation="relu"),
    MaxPooling1D(2),

    Conv1D(128,3,activation="relu"),
    MaxPooling1D(2),

    Flatten(),

    Dense(64,activation="relu"),

    Dropout(0.5),

    Dense(2,activation="softmax")

])


model.compile(

    optimizer="adam",
    loss="categorical_crossentropy",
    metrics=["accuracy"]

)

model.summary()


# ================= TRAIN =================
history = model.fit(

    X_train,
    y_train_cat,

    epochs=15,
    batch_size=32,

    validation_data=(X_test,y_test_cat),

    class_weight=class_weights

)


# ================= EVALUATE =================
loss,acc = model.evaluate(X_test,y_test_cat)

print("\nTest Accuracy:",acc)


# ================= CONFUSION MATRIX =================
y_pred = model.predict(X_test)

y_pred_classes = np.argmax(y_pred,axis=1)

print("\nConfusion Matrix\n",
      confusion_matrix(y_test,y_pred_classes))

print("\nClassification Report\n",
      classification_report(y_test,y_pred_classes))


# ================= SAVE MODEL =================
model.save("inter_ecg_model.h5")

print("\nModel saved as new_ecg_model.h5")


# ================= TRAINING GRAPH =================
plt.plot(history.history["accuracy"],label="Train Accuracy")
plt.plot(history.history["val_accuracy"],label="Validation Accuracy")

plt.title("Training Accuracy")
plt.legend()
plt.show()