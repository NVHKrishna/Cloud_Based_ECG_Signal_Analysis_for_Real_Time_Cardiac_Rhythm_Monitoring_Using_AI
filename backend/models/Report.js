const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  record: String,
  totalBeats: Number,
  normalBeats: Number,
  arrhythmiaBeats: Number,
  arrhythmiaPercent: Number,
  accuracy: Number,
  finalResult: String,
  avgHeartRate: Number,
  robustHeartRate: Number,
  avgRRms: Number,
  hrWindows: [mongoose.Schema.Types.Mixed],
  rrIntervals: [Number],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Report', reportSchema);
