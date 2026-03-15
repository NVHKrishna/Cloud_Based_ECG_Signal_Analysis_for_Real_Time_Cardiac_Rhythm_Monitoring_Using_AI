import wfdb
import numpy as np

record = wfdb.rdrecord("100")
annotation = wfdb.rdann("100", "atr")

signal = record.p_signal[:, 0]     # ECG waveform
r_peaks = annotation.sample         # R-peak indices
labels = annotation.symbol          # Beat types
