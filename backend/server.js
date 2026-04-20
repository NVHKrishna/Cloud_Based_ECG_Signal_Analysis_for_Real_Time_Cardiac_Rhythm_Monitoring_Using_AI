require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const mongoose = require('mongoose')
const axios = require('axios')
const { Server } = require('socket.io')

const authRoutes = require('./routes/auth')
const ecgRoutes = require('./routes/ecg')
const patientRoutes = require('./routes/patient')
const ECG = require('./models/ECG')
const Report = require('./models/Report')
const { generateECGSamples, computeMetrics, processRawECG } = require('./utils/ecgEngine')

const app = express()
const server = http.createServer(app)

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ecg_db')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err))

// ── Socket.io for real-time ECG streaming ──
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
app.set('io', io)

// ── Middleware ──
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://localhost:5175'],
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ── Routes ──
app.use('/api/auth', authRoutes)
app.use('/api/ecg', ecgRoutes)
app.use('/api/patient', patientRoutes)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString(), service: 'CardioAI ECG Backend' })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Socket.io: Real-time ECG stream ──

io.on('connection', socket => {
  console.log(`[Socket.io] Client connected: ${socket.id}`)

  let bpm = 72
  let streamInterval = null

  const startStream = () => {
    if (streamInterval) clearInterval(streamInterval)

    streamInterval = setInterval(() => {
      const samples = generateECGSamples(20, bpm)
      const metrics = computeMetrics(bpm)
      socket.emit('ecg:samples', { samples, metrics, ts: Date.now() })
    }, 40) // ~25 fps
  }

  socket.on('ecg:start', (opts = {}) => {
    bpm = opts.bpm || 72
    console.log(`[Socket.io] Stream started for ${socket.id}, BPM=${bpm}`)
    startStream()
  })

  socket.on('ecg:stop', () => {
    clearInterval(streamInterval)
    console.log(`[Socket.io] Stream stopped for ${socket.id}`)
  })

  socket.on('ecg:set_bpm', ({ bpm: newBpm }) => {
    bpm = newBpm
    clearInterval(streamInterval)
    startStream()
  })

  socket.on('disconnect', () => {
    clearInterval(streamInterval)
    console.log(`[Socket.io] Client disconnected: ${socket.id}`)
  })
})

// ── Background ECG Processing ──

async function runPeriodicProcessing() {
  try {
    const { UBIDOTS_TOKEN, UBIDOTS_DEVICE_LABEL, UBIDOTS_VARIABLE_LABEL } = process.env;
    let rawValues = [];

    if (UBIDOTS_TOKEN && UBIDOTS_TOKEN !== 'your_ubidots_token_here') {
      try {
        const url = `https://industrial.api.ubidots.com/api/v1.6/devices/${UBIDOTS_DEVICE_LABEL}/${UBIDOTS_VARIABLE_LABEL}/values/?page_size=440`;
        const response = await axios.get(url, { headers: { 'X-Auth-Token': UBIDOTS_TOKEN } });
        rawValues = response.data.results.map(v => v.value);
      } catch (err) { /* silent fallback */ }
    }

    if (rawValues.length === 0) {
      const simulatedSamples = generateECGSamples(440, 72 + Math.random() * 10);
      rawValues = simulatedSamples.map(s => s.value);
    }

    const processedData = await processRawECG(rawValues);
    const newECG = new ECG({
      ecg: processedData.ecg,
      prediction: processedData.prediction,
      confidence: processedData.confidence,
      heartRate: processedData.heartRate,
      timestamp: processedData.timestamp
    });
    await newECG.save();
    
    // Notify clients via Socket.io
    io.emit('ecg:prediction', newECG);

    console.log(`[Background] Processed ECG: ${processedData.prediction} (${processedData.heartRate} BPM)`);
  } catch (err) {
    console.error('[Background] Error processing ECG:', err.message);
  }
}

// Start periodic processing every 2 seconds
// setInterval(runPeriodicProcessing, 2000);

// ── Start server ──
const PORT = process.env.PORT || 5005
server.listen(PORT, () => {
  console.log(`\n🫀  CardioAI ECG Backend running on http://localhost:${PORT}`)
  console.log(`   REST API : http://localhost:${PORT}/api`)
  console.log(`   Socket.io: ws://localhost:${PORT}\n`)
})
