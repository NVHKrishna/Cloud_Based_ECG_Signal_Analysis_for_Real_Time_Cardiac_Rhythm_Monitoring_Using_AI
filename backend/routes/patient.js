const express = require('express')
const router = express.Router()
const authMiddleware = require('../utils/authMiddleware')
const User = require('../models/User')

// GET /api/patient — returns current logged-in user as patient
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({
      id: 'PT-' + String(user._id).slice(-5).toUpperCase(),
      name: user.name,
      age: user.age || '--',
      gender: user.gender || '--',
      email: user.email,
      ward: 'Cardiology CCU',
      bed: 'B-04',
      deviceId: 'ESP32-ECG-001',
      admittedOn: new Date(user.createdAt).toISOString().split('T')[0],
      diagnosis: 'Pending ECG Analysis',
      bloodType: '--',
      physician: 'AI-Assisted Monitoring',
    })
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch patient info' })
  }
})

// GET /api/patient/:id
router.get('/:id', authMiddleware, (req, res) => {
  const patient = PATIENTS.find(p => p.id === req.params.id)
  if (!patient) return res.status(404).json({ message: 'Patient not found' })
  res.json(patient)
})

// GET /api/patient (list all)
router.get('/all', authMiddleware, (req, res) => {
  res.json(PATIENTS)
})

module.exports = router
