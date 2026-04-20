const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cardionet_secret_2026';
const ACTIVE_USER_FILE = path.join(__dirname, '../../current_user.txt');

const writeActiveUser = (userId) => {
  try { fs.writeFileSync(ACTIVE_USER_FILE, String(userId)); } catch(e) {}
}
const clearActiveUser = () => {
  try { fs.writeFileSync(ACTIVE_USER_FILE, ''); } catch(e) {}
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, age, gender } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = new User({ email, password, name, age, gender, provider: 'local' });
    await user.save();
    
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({
      success: true,
      token,
      name: user.name,
      email: user.email,
      role: user.role,
      id: user._id,
      message: 'Registration successful',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    writeActiveUser(user._id)
    return res.json({
      success: true,
      token,
      name: user.name,
      email: user.email,
      role: user.role,
      id: user._id,
      message: 'Login successful',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// POST /api/auth/oauth
// Simple mock for Google/Github OAuth saving to MongoDB
router.post('/oauth', async (req, res) => {
  try {
    const { email, name, provider, providerId } = req.body;
    if (!email || !provider) {
      return res.status(400).json({ message: 'Email and provider are required' });
    }
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name: name || email.split('@')[0], provider, providerId });
      await user.save();
    }
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return res.json({
      success: true,
      token,
      name: user.name,
      email: user.email,
      role: user.role,
      id: user._id,
      message: `${provider} Login successful`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during oauth' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearActiveUser()
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me (verify token)
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// PUT /api/auth/profile — update age and gender
const authMiddleware = require('../utils/authMiddleware');
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { age, gender } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { age: Number(age), gender } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true, age: user.age, gender: user.gender });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

module.exports = router;
