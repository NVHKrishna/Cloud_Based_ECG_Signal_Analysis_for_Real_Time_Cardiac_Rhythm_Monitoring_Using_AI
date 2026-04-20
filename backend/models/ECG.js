const mongoose = require('mongoose');

const ecgSchema = new mongoose.Schema({
  ecg: [Number],
  prediction: {
    type: String,
    enum: ['Normal', 'Arrhythmia'],
    default: 'Normal'
  },
  confidence: Number,
  heartRate: Number,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ECG', ecgSchema);
