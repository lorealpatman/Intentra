const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Update user profile (name, bio, profile picture)
router.put('/me', auth, async (req, res) => {
  try {
    const { firstName, bio, profilePicture } = req.body;

    // Validate inputs
    if (firstName && firstName.length > 30) {
      return res
        .status(400)
        .json({ error: 'First name must be 30 characters or less' });
    }

    if (bio && bio.length > 100) {
      return res
        .status(400)
        .json({ error: 'Bio must be 100 characters or less' });
    }

    // Update user
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (bio !== undefined) updateData.bio = bio;
    if (profilePicture !== undefined)
      updateData.profilePicture = profilePicture;

    const user = await User.findByIdAndUpdate(req.userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user by unique code (for viewing profile when scanning QR)
router.get('/code/:uniqueCode', auth, async (req, res) => {
  try {
    const { uniqueCode } = req.params;

    const user = await User.findOne({
      uniqueCode: uniqueCode.toUpperCase(),
    }).select('firstName profilePicture bio uniqueCode');

    if (!user) {
      return res.status(404).json({ error: 'User not found with that code' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user by code error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Delete account
router.delete('/me', auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res
        .status(400)
        .json({ error: 'Password required to delete account' });
    }

    // Verify password before deletion
    const user = await User.findById(req.userId);
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Delete user's connections and messages
    const Connection = require('../models/Connection');
    const Message = require('../models/Message');
    const DailyLimit = require('../models/DailyLimit');

    await Connection.deleteMany({
      $or: [{ user1Id: req.userId }, { user2Id: req.userId }],
    });

    await Message.deleteMany({
      $or: [{ senderId: req.userId }, { receiverId: req.userId }],
    });

    await DailyLimit.deleteMany({ userId: req.userId });

    // Delete user
    await User.findByIdAndDelete(req.userId);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
