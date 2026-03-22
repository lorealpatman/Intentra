const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { firstName, email, password } = req.body;

    // Validate input
    if (!firstName || !email || !password) {
      return res
        .status(400)
        .json({ error: 'First name, email and password are required' });
    }

    if (firstName.length > 30) {
      return res
        .status(400)
        .json({ error: 'First name must be 30 characters or less' });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate unique code
    const uniqueCode = await User.generateUniqueCode();

    // Create user
    const user = new User({
      firstName,
      email,
      passwordHash,
      uniqueCode,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' },
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last active
    await user.updateLastActive();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' },
    );

    res.json({
      message: 'Login successful',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update FCM token for push notifications
router.post('/update-fcm-token', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { fcmToken },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'FCM token updated successfully' });
  } catch (error) {
    console.error('FCM token update error:', error);
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
});

module.exports = router;
