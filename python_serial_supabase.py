import serial
import time
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
from supabase import create_client, Client
import threading

# ==========================================
# 1. SUPABASE CONFIGURATION
# ==========================================
SUPABASE_URL = "YOUR_SUPABASE_URL"
SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# 2. SERIAL PORT CONFIGURATION
# ==========================================
# Change this to match the COM port your ESP32 is using (e.g., COM3, /dev/ttyUSB0)
SERIAL_PORT = 'COM3'  
BAUD_RATE = 115200

# Try connecting to the ESP32
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
    print(f"✅ Connected to ESP32 on {SERIAL_PORT}")
except Exception as e:
    print(f"❌ Failed to connect to Serial on {SERIAL_PORT}: {e}")
    exit()

# Data stores for plotting
x_data = []
y_data = []

# Buffer for sending to Supabase
batch_data = []

# ==========================================
# 3. DATABASE THREAD
# ==========================================
def send_to_supabase():
    """Background thread to batch upload ECG data to Supabase"""
    global batch_data
    while True:
        if len(batch_data) >= 10:  # Send whenever we have 10 or more readings
            to_insert = batch_data[:20]  # Take up to 20 to insert
            batch_data = batch_data[20:] # Keep the rest
            try:
                # Ensure you have a 'ecg_data' table in Supabase with 'time' and 'value' float columns!
                supabase.table('ecg_data').insert(to_insert).execute()
                print(f"⬆️ Sent {len(to_insert)} records to DB.")
            except Exception as e:
                print(f"❌ DB Error: {e}")
        time.sleep(0.5)

# Start background DB upload thread
t = threading.Thread(target=send_to_supabase, daemon=True)
t.start()

# ==========================================
# 4. LIVE PLOTTING (matplotlib)
# ==========================================
plt.style.use('dark_background')
fig, ax = plt.subplots(figsize=(10, 5))
line, = ax.plot([], [], color='cyan', linewidth=1.5)

ax.set_title("Live ECG from ESP32", fontsize=16, color='cyan')
ax.set_xlabel("Time (s)", color='gray')
ax.set_ylabel("Sensor Value", color='gray')
ax.set_xlim(0, 100)
ax.set_ylim(0, 4095) # Fits ESP32 12-bit ADC

# Remove unnecessary borders
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

def update_plot(frame):
    global x_data, y_data, batch_data
    try:
        while ser.in_waiting > 0:
            line_bytes = ser.readline()
            
            try:
                # Assuming ESP32 sends text via: Serial.println(String(time) + "," + String(value))
                line_str = line_bytes.decode('utf-8').strip()
                
                # Support both PLOTTER_MODE=false (time,value) and PLOTTER_MODE=true (value)
                if ',' in line_str:
                    parts = line_str.split(',')
                    if len(parts) == 2:
                        t_val = float(parts[0]) / 1000.0 # MS to SECONDS
                        v_val = float(parts[1])
                    else:
                        continue
                else:
                    # Single value (PLOTTER_MODE = true)
                    # Auto-generate local PC timestamp
                    v_val = float(line_str)
                    if not hasattr(update_plot, "start_time"):
                        update_plot.start_time = time.time()
                    t_val = time.time() - update_plot.start_time
                
                x_data.append(t_val)
                y_data.append(v_val)

                # Queue for database upload
                batch_data.append({'time': t_val, 'value': v_val})

                # Keep the last 300 points visibly on screen
                if len(x_data) > 300:
                    x_data.pop(0)
                    y_data.pop(0)
                
                # Adjust graph view limits dynamically
                ax.set_xlim(x_data[0], x_data[-1])
                
                min_y = min(y_data)
                max_y = max(y_data)
                if max_y > min_y:
                    ax.set_ylim(min_y - 200, max_y + 200)
                
                line.set_data(x_data, y_data)
                        
            except ValueError:
                pass # Ignore malformed strings
    except Exception as e:
        pass
    return line,

# Animate graph with a tiny interval
ani = FuncAnimation(fig, update_plot, interval=20, blit=False)
plt.show()
