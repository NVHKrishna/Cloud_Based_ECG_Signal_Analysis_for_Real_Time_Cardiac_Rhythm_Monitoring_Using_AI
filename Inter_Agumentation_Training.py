import numpy as np
import wfdb
import matplotlib.pyplot as plt

from scipy.signal import butter, filtfilt

from sklearn.metrics import confusion_matrix, classification_report
from sklearn.utils.class_weight import compute_class_weight
from sklearn.model_selection import train_test_split

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Dense, Dropout
from tensorflow.keras.layers import BatchNormalization, GlobalAveragePooling1D
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau


# ================= PARAMETERS =================
DATA_PATH = r"C:\Users\NVH Krishna\Desktop\Theme_Based\Ecg_Dataset\mitdbdir\\"

WINDOW = 220
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

    low = 0.5/(fs/2)
    high = 40/(fs/2)

    b,a = butter(2,[low,high],btype="band")

    return filtfilt(b,a,signal)


# ================= DATA AUGMENTATION =================
def augment_beat(beat):

    noise = np.random.normal(0,0.01,len(beat))
    beat = beat + noise

    scale = np.random.uniform(0.9,1.1)
    beat = beat * scale

    shift = np.roll(beat,np.random.randint(-10,10))

    return shift


# ================= FOCAL LOSS =================
def focal_loss(gamma=2., alpha=.25):

    def loss(y_true,y_pred):

        y_pred = tf.clip_by_value(y_pred,1e-7,1-1e-7)

        cross_entropy = -y_true*tf.math.log(y_pred)

        weight = alpha*tf.pow(1-y_pred,gamma)

        return tf.reduce_sum(weight*cross_entropy,axis=1)

    return loss


# ================= LOAD DATA =================
def load_records(record_list):

    X=[]
    y=[]

    for rec in record_list:

        print("Loading:",rec)

        record = wfdb.rdrecord(DATA_PATH+rec)
        ann = wfdb.rdann(DATA_PATH+rec,"atr")

        signal = record.p_signal[:,0]

        signal = bandpass_filter(signal)

        r_peaks = ann.sample
        labels = ann.symbol

        for i,peak in enumerate(r_peaks):

            if peak-WINDOW>=0 and peak+WINDOW<len(signal):

                beat = signal[peak-WINDOW:peak+WINDOW]

                beat = (beat-np.mean(beat))/(np.std(beat)+1e-8)

                X.append(beat)

                if labels[i]=='N':
                    y.append(0)

                else:
                    y.append(1)

                    # augment arrhythmia
                    for j in range(5):

                        aug = augment_beat(beat)

                        X.append(aug)
                        y.append(1)

    X=np.array(X).astype(np.float32)
    y=np.array(y)

    return X,y


# ================= LOAD DATA =================
X_train,y_train = load_records(train_records)
X_test,y_test = load_records(test_records)

print("Train shape:",X_train.shape)
print("Test shape:",X_test.shape)


# ================= RESHAPE =================
X_train = X_train.reshape(X_train.shape[0],WINDOW*2,1)
X_test = X_test.reshape(X_test.shape[0],WINDOW*2,1)


# ================= ONE HOT =================
y_train_cat = to_categorical(y_train,2)
y_test_cat = to_categorical(y_test,2)


# ================= VALIDATION SPLIT =================
X_train,X_val,y_train_cat,y_val_cat = train_test_split(

    X_train,
    y_train_cat,

    test_size=0.2,
    random_state=42,
    stratify=y_train

)


# ================= CLASS WEIGHTS =================
class_weights = compute_class_weight(

    class_weight="balanced",
    classes=np.unique(y_train),
    y=y_train

)

class_weights = dict(enumerate(class_weights))


# ================= CNN MODEL =================
model = Sequential([

    Conv1D(32,7,activation="relu",input_shape=(WINDOW*2,1)),
    BatchNormalization(),
    MaxPooling1D(2),

    Conv1D(64,5,activation="relu"),
    BatchNormalization(),
    MaxPooling1D(2),

    Conv1D(128,5,activation="relu"),
    BatchNormalization(),
    MaxPooling1D(2),

    Conv1D(256,3,activation="relu"),
    BatchNormalization(),
    MaxPooling1D(2),

    GlobalAveragePooling1D(),

    Dense(128,activation="relu"),
    Dropout(0.5),

    Dense(64,activation="relu"),
    Dropout(0.3),

    Dense(2,activation="softmax")

])


model.compile(

    optimizer="adam",
    loss=focal_loss(),
    metrics=["accuracy"]

)


model.summary()


# ================= CALLBACKS =================
early_stop = EarlyStopping(

    monitor="val_loss",
    patience=6,
    restore_best_weights=True

)

lr_reduce = ReduceLROnPlateau(

    monitor="val_loss",
    factor=0.5,
    patience=3,
    min_lr=1e-6

)


# ================= TRAIN =================
history = model.fit(

    X_train,
    y_train_cat,

    epochs=40,
    batch_size=32,

    validation_data=(X_val,y_val_cat),

    class_weight=class_weights,

    callbacks=[early_stop,lr_reduce]

)


# ================= TEST =================
loss,acc = model.evaluate(X_test,y_test_cat)

print("Test Accuracy:",acc)


# ================= CONFUSION MATRIX =================
y_pred = model.predict(X_test)

y_pred_classes = np.argmax(y_pred,axis=1)

print("\nConfusion Matrix")
print(confusion_matrix(y_test,y_pred_classes))

print("\nClassification Report")
print(classification_report(y_test,y_pred_classes))


# ================= SAVE MODEL =================
import os
model_save_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ML", "final_ecg_arrhythmia_model.h5")
model.save(model_save_path)
print("Model saved")


# ================= TRAINING GRAPH =================
plt.figure(figsize=(8,5))

plt.plot(history.history["accuracy"],label="Train Accuracy")
plt.plot(history.history["val_accuracy"],label="Validation Accuracy")

plt.xlabel("Epoch")
plt.ylabel("Accuracy")

plt.title("Training vs Validation Accuracy")

plt.legend()

plt.show()