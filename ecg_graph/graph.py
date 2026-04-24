import serial
import numpy as np
import matplotlib.pyplot as plt

PORT = "COM11"
BAUD = 115200
fs = 360

ser = serial.Serial(PORT, BAUD, timeout=1)

plt.ion()
fig, ax = plt.subplots()

window_size = fs * 5
y = np.zeros(window_size)
x = np.arange(window_size) / fs

line, = ax.plot(x, y)

ax.set_title("Live ECG (Synchronized)")
ax.set_xlabel("Time (s)")
ax.set_ylabel("Amplitude")

counter = 0   # 🔥 for controlled printing

while True:
    try:
        while ser.in_waiting > 0:
            data = ser.readline().decode(errors='ignore').strip()

            if data.isdigit():
                value = int(data)

                # update buffer
                y[:-1] = y[1:]
                y[-1] = value

                # 🔥 PRINT SOME VALUES ONLY
                counter += 1
                if counter % 20 == 0:   # adjust this
                    print(value)

        # update graph
        line.set_ydata(y)

        min_val = np.min(y)
        max_val = np.max(y)
        margin = (max_val - min_val) * 0.2 + 50
        ax.set_ylim(min_val - margin, max_val + margin)

        plt.pause(0.001)

    except Exception as e:
        print("Error:", e)