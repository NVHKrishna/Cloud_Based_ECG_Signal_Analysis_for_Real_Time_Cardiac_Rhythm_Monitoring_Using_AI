const express = require('express')
const router = express.Router()
const axios = require('axios')
const { spawn } = require('child_process')
const path = require('path')
const ECG = require('../models/ECG')
const Report = require('../models/Report')
const { generateECGSamples, computeMetrics, processRawECG } = require('../utils/ecgEngine')
const authMiddleware = require('../utils/authMiddleware')


// ── GET /api/ecg/process-ecg ──
router.get('/process-ecg', authMiddleware, async (req, res) => {
  try {
    const { UBIDOTS_TOKEN, UBIDOTS_DEVICE_LABEL, UBIDOTS_VARIABLE_LABEL } = process.env;
    let rawValues = [];

    if (UBIDOTS_TOKEN && UBIDOTS_TOKEN !== 'your_ubidots_token_here') {
      try {
        const url = `https://industrial.api.ubidots.com/api/v1.6/devices/${UBIDOTS_DEVICE_LABEL}/${UBIDOTS_VARIABLE_LABEL}/values/?page_size=440`;
        const response = await axios.get(url, { headers: { 'X-Auth-Token': UBIDOTS_TOKEN } });
        rawValues = response.data.results.map(v => v.value);
      } catch (err) {
        console.warn('⚠️ Ubidots fetch failed, falling back to dataset:', err.message);
      }
    }

    if (rawValues.length === 0) {
      const samples = generateECGSamples(440);
      rawValues = samples.map(s => s.value);
    }

    const processedData = await processRawECG(rawValues);
    const newECG = new ECG({
      ecg: processedData.ecg,
      prediction: processedData.prediction,
      confidence: processedData.confidence,
      heartRate: processedData.heartRate,
      timestamp: processedData.timestamp,
      userId: req.user.id
    });
    await newECG.save();
    
    // Notify clients via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('ecg:prediction', newECG);
    }

    res.json({ success: true, message: 'ECG processed and stored', data: newECG });
  } catch (error) {
    console.error('❌ Error processing ECG:', error);
    res.status(500).json({ error: 'Failed to process ECG' });
  }
});

// ── GET /api/ecg/latest ──
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const latest = await ECG.findOne({ userId: req.user.id }).sort({ timestamp: -1 });
    if (!latest) return res.status(404).json({ error: 'No data found' });
    res.json(latest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest data' });
  }
});

// ── GET /api/ecg/data ──
router.get('/data', authMiddleware, (req, res) => {
  const bpm = 72;
  const metrics = computeMetrics(bpm);
  const samples = generateECGSamples(50);
  res.json({ ...metrics, samples, deviceId: 'ECG-007', lead: 'II', sampleRate: 250, timestamp: new Date().toISOString() });
});

// ── GET /api/ecg/history ──
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const data = await ECG.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(100);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ── GET /api/ecg/latest-report ──
router.get('/latest-report', authMiddleware, async (req, res) => {
  try {
    const latest = await Report.findOne({ userId: req.user.id }).sort({ timestamp: -1 });
    if (!latest) return res.status(404).json({ error: 'No report found' });
    res.json(latest);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest report' });
  }
});

// ── POST /api/ecg/upload-and-run ──
router.post('/upload-and-run', authMiddleware, async (req, res) => {
  const fs = require('fs')
  try {
    const files = req.body.files
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' })

    const uploadId = 'upload_' + Date.now()
    const uploadDir = path.join(__dirname, '../../uploads', uploadId)
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

    let recordName = ''
    files.forEach(f => {
      const ext = path.extname(f.name)
      if (ext === '.hea') recordName = path.basename(f.name, ext)
      const buffer = Buffer.from(f.content, 'base64')
      fs.writeFileSync(path.join(uploadDir, f.name), buffer)
    })

    if (!recordName && files.length > 0) {
      recordName = path.basename(files[0].name, path.extname(files[0].name))
    }

    // Trailing separator required by wfdb
    const dataPath = uploadDir.endsWith(path.sep) ? uploadDir : uploadDir + path.sep

    const scriptPath = path.join(__dirname, '../../ML/New_Testing.py')
    let output = ''
    let errorOutput = ''

    console.log(`[Upload&Run] record=${recordName}  dataPath=${dataPath}  user=${req.user.id}`)

    const py = spawn('python', [scriptPath, recordName, dataPath, req.user.id], {
      cwd: path.join(__dirname, '../../'),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    })
    py.stdout.on('data', d => { output += d.toString(); console.log('[py]', d.toString().trim()) })
    py.stderr.on('data', d => { errorOutput += d.toString(); console.error('[py-err]', d.toString().trim()) })

    py.on('close', async (code) => {
      console.log(`[Upload&Run] Python exited with code ${code}`)
      if (code !== 0) {
        console.error('[Upload&Run] Python error:\n', errorOutput)
        return res.status(500).json({ success: false, error: 'Report script failed', details: errorOutput.slice(-800) })
      }
      try {
        const latest = await Report.findOne({ userId: req.user.id }).sort({ timestamp: -1 })
        const io = req.app.get('io')
        if (io && latest) io.emit('ecg:report', latest)
        res.json({ success: true, report: latest })
      } catch (e) {
        res.status(500).json({ success: false, error: 'Finished but failed to fetch report' })
      }
    })

  } catch (error) {
    console.error('❌ Error in upload-and-run:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// ── GET /api/ecg/report ──
// Runs full New_Testing.py style batch report.
router.get('/report', authMiddleware, async (req, res) => {
  const record = req.query.record || '108';
  const scriptPath = path.join(__dirname, '../utils/run_report.py');
  let output = '';
  let errorOutput = '';

  const py = spawn('python', [scriptPath, record]);
  py.stdout.on('data', d => output += d.toString());
  py.stderr.on('data', d => errorOutput += d.toString());

  py.on('close', async (code) => {
    if (code !== 0) {
      console.error('[Report] Python error:', errorOutput);
      return res.status(500).json({ success: false, error: 'Report script failed' });
    }
    try {
      const result = JSON.parse(output);
      
      // Overwrite previous reports for this user
      await Report.deleteMany({ userId: req.user.id });
      
      // Save new report to database
      const newReport = new Report({ ...result, userId: req.user.id });
      await newReport.save();

      // Notify clients
      const io = req.app.get('io');
      if (io) {
        io.emit('ecg:report', newReport);
      }

      res.json(result);
    } catch (e) {
      console.error('[Report] Parse error:', e);
      res.status(500).json({ success: false, error: 'Failed to parse report output' });
    }
  });
});

module.exports = router
