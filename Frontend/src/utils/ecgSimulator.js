/**
 * Realistic ECG signal simulator.
 * Generates P-QRS-T waveform segments with configurable heart rate.
 */

const TWO_PI = 2 * Math.PI

function gaussian(x, mu, sig, amp) {
  return amp * Math.exp(-Math.pow(x - mu, 2) / (2 * sig * sig))
}

/**
 * Generate one beat of ECG data (returns array of y-values)
 * @param {number} samples - number of samples per beat
 * @param {number} noise - noise amplitude (0-1)
 */
export function generateECGBeat(samples = 200, noise = 0.02) {
  const data = []
  for (let i = 0; i < samples; i++) {
    const x = i / samples

    // Baseline
    let y = 0

    // P wave
    y += gaussian(x, 0.15, 0.025, 0.15)
    // Q wave (negative)
    y += gaussian(x, 0.38, 0.008, -0.1)
    // R wave (sharp positive spike)
    y += gaussian(x, 0.42, 0.012, 1.2)
    // S wave (negative)
    y += gaussian(x, 0.46, 0.008, -0.15)
    // ST segment (slightly elevated)
    y += gaussian(x, 0.52, 0.03, 0.05)
    // T wave
    y += gaussian(x, 0.65, 0.04, 0.35)
    // U wave (small)
    y += gaussian(x, 0.78, 0.025, 0.04)

    // Add random noise
    y += (Math.random() - 0.5) * noise * 2

    // Peak detection for simulation
    const isPeak = (x > 0.418 && x < 0.422)

    data.push({
      value: parseFloat(y.toFixed(4)),
      isPeak: isPeak,
      timestamp: Date.now()
    })
  }
  return data
}

/**
 * Generate a continuous ECG buffer of N beats
 */
export function generateECGBuffer(beats = 3, bpm = 72, samplesPerBeat = 200, noise = 0.02) {
  const buffer = []
  for (let b = 0; b < beats; b++) {
    buffer.push(...generateECGBeat(samplesPerBeat, noise))
  }
  return buffer
}

/**
 * Compute simple metrics from a single beat
 */
export function computeMetrics(bpm = 72, status = 'Normal') {
  const variation = (Math.random() - 0.5) * 4
  const bpmActual = Math.round(bpm + variation)

  // PR interval: 120-200ms (normal)
  const pr = (120 + Math.random() * 80).toFixed(0)

  // QRS duration: 60-100ms (normal)
  const qrs = (60 + Math.random() * 40).toFixed(0)

  // QT interval: 350-450ms (normal)
  const qt = (350 + Math.random() * 100).toFixed(0)

  return { bpm: bpmActual, pr: parseInt(pr), qrs: parseInt(qrs), qt: parseInt(qt), status }
}

/**
 * Determine status from BPM
 */
export function getStatusFromBPM(bpm) {
  if (bpm < 50 || bpm > 110) return 'Critical'
  if (bpm < 60 || bpm > 100) return 'Warning'
  return 'Normal'
}
