const mongoose = require('mongoose');

async function debugDB() {
  try {
    await mongoose.connect('mongodb://localhost:27017/ecg_db');
    console.log('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({ name: String, email: String }));
    const Report = mongoose.model('Report', new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, record: String, timestamp: Date }));

    const users = await User.find().sort({ _id: -1 });
    console.log('\n--- USERS (Newest First) ---');
    users.forEach(u => console.log(`${u._id} | ${u.name} | ${u.email}`));

    const reports = await Report.find().sort({ timestamp: -1 }).limit(10);
    console.log('\n--- LATEST 10 REPORTS ---');
    reports.forEach(r => console.log(`${r.timestamp.toISOString()} | ID: ${r._id} | UserID: ${r.userId || 'NULL'} | Record: ${r.record}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugDB();
