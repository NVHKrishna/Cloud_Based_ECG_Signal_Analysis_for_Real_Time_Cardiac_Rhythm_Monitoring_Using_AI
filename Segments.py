window = 180  # samples before/after R-peak (360 Hz → 1 beat)

X = []
y = []

for i, peak in enumerate(r_peaks):
    if peak - window >= 0 and peak + window < len(signal):

        beat = signal[peak - window : peak + window]
        X.append(beat)

        # Label mapping
        if labels[i] == 'N':
            y.append(0)      # Normal
        else:
            y.append(1)      # Arrhythmia

X = np.array(X)
y = np.array(y)

print("Dataset shape:", X.shape)
