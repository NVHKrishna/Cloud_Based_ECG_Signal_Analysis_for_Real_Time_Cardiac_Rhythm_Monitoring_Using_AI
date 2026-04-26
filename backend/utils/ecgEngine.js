/**
 * ECG Signal Engine — Node.js simulation
 * Generates realistic P-QRS-T waveform samples.
 */

function gaussian(x, mu, sig, amp) {
  return amp * Math.exp(-Math.pow(x - mu, 2) / (2 * sig * sig))
}

const fs = require('fs');
const path = require('path');

let datasetSamples = [];
let currentIndex = 0;

try {
  const jsonPath = path.join(__dirname, 'mitdb_220.json');
  if (fs.existsSync(jsonPath)) {
    datasetSamples = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`[ECG Engine] Loaded ${datasetSamples.length} samples from MIT-BIH record 220.`);
  }
} catch (e) {
  console.error("[ECG Engine] Failed to load mitdb_108.json:", e);
}

/**
 * Fetch N samples from the loaded MITDB dataset.
 * Streams sequentially mimicking a real-time monitor.
 */
function generateECGSamples(count = 440) {
  const samples = [];

  if (datasetSamples.length > 0) {
    for (let i = 0; i < count; i++) {
      // Scale MITDB data (~ -2.0 to 2.0 mV usually) slightly down to standard form
      const rawVal = datasetSamples[currentIndex];
      samples.push({
        value: parseFloat((rawVal * 0.5).toFixed(4)),
        isPeak: false, 
        timestamp: Date.now()
      });
      currentIndex = (currentIndex + 1) % datasetSamples.length;
    }
  } else {
    // Failsafe noise burst
    for (let i = 0; i < count; i++) {
      samples.push({
        value: (Math.random() - 0.5) * 0.1,
        isPeak: false,
        timestamp: Date.now()
      });
    }
  }
  return samples;
}

/**
 * Compute ECG metrics with slight random variation per call.
 */
function computeMetrics(bpm = 72) {
  const variation = (Math.random() - 0.5) * 6
  const currentBpm = Math.round(bpm + variation);
  
  // Simulated ML classification logic
  let classification = "Normal Sinus Rhythm";
  let confidence = 0.96 + Math.random() * 0.03;
  
  if (currentBpm < 60) {
     classification = "Sinus Bradycardia";
     confidence = 0.94 + Math.random() * 0.04;
  } else if (currentBpm > 100) {
     classification = "Sinus Tachycardia";
     confidence = 0.92 + Math.random() * 0.06;
  } else if (Math.random() > 0.97) {
     // Occasional anomaly simulation
     classification = "Atrial Fibrillation";
     confidence = 0.88 + Math.random() * 0.08;
  }

  return {
    bpm: currentBpm,
    pr:  Math.round(120 + Math.random() * 80),
    qrs: Math.round(60  + Math.random() * 40),
    qt:  Math.round(350 + Math.random() * 100),
    classification,
    confidence: parseFloat((confidence * 100).toFixed(1)),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Normalizes an array of values to [0, 1] range.
 */
function normalize(data) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  if (max === min) return data.map(() => 0.5);
  return data.map(v => (v - min) / (max - min));
}

/**
 * Detects R-peaks and calculates RR intervals.
 * Uses 360Hz sampling rate matching MIT-BIH standard.
 */
function calculateRRIntervals(data) {
  const FS = 360; // MIT-BIH sampling rate
  const threshold = 0.7;
  const minPeakDistance = Math.round(0.25 * FS); // min 250ms between peaks (max 240 BPM)
  const peaks = [];

  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > threshold && data[i] > data[i - 1] && data[i] > data[i + 1]) {
      // Enforce minimum distance from last peak
      if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minPeakDistance) {
        peaks.push(i);
      }
    }
  }

  const intervals = [];
  for (let i = 1; i < peaks.length; i++) {
    const rrMs = (peaks[i] - peaks[i - 1]) * (1000 / FS); // convert samples to ms
    // Only keep physiologically valid RR intervals (300ms–2000ms = 30–200 BPM)
    if (rrMs >= 300 && rrMs <= 2000) {
      intervals.push(rrMs);
    }
  }

  return intervals;
}

const { spawn } = require('child_process');

/**
 * Real ML prediction using Python bridge and .h5 model.
 */
function runMLPrediction(ecgValues) {
  return new Promise((resolve, reject) => {
    const pythonPath = 'python3'; // or 'python3'
    const scriptPath = path.join(__dirname, 'predict.py');
    
    const py = spawn(pythonPath, [scriptPath]);
    
    let output = '';
    let errorOutput = '';

    py.stdin.write(JSON.stringify({ ecg: ecgValues }));
    py.stdin.end();

    py.stdout.on('data', (data) => {
      output += data.toString();
    });

    py.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    py.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}. Error: ${errorOutput}`);
        return resolve({ prediction: 'Normal', confidence: 50.0 }); // Fallback
      }
      try {
        const result = JSON.parse(output);
        if (result.success) {
          resolve({ prediction: result.prediction, confidence: result.confidence });
        } else {
          console.error(`Prediction error: ${result.error}`);
          resolve({ prediction: 'Normal', confidence: 50.0 });
        }
      } catch (e) {
        console.error(`Failed to parse Python output: ${output}`);
        resolve({ prediction: 'Normal', confidence: 50.0 });
      }
    });
  });
}

/**
 * Main processing function
 */
async function processRawECG(rawValues) {
  const normalized = normalize(rawValues);
  const rrIntervals = calculateRRIntervals(normalized);
  
  // Estimate heart rate from valid RR intervals
  let heartRate = 72; // Safe default
  if (rrIntervals.length > 0) {
    // Use median for robustness against outliers
    const sorted = [...rrIntervals].sort((a, b) => a - b);
    const medianRR = sorted[Math.floor(sorted.length / 2)];
    heartRate = Math.round(60000 / medianRR);
    // Clamp to physiologically valid range
    heartRate = Math.max(30, Math.min(220, heartRate));
  }

  // Call the real ML model
  const { prediction, confidence } = await runMLPrediction(normalized);

  return {
    ecg: rawValues,
    normalized,
    heartRate,
    prediction,
    confidence,
    timestamp: new Date()
  };
}

module.exports = { generateECGSamples, computeMetrics, processRawECG }
