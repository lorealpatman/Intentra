const express = require('express');
const User = require('../models/User');
const Connection = require('../models/Connection');
const auth = require('../middleware/auth');

const router = express.Router();

// Connect with another user by their unique code
router.post('/connect', auth, async (req, res) => {
  try {
    const { uniqueCode, connectionContext } = req.body;
    const currentUserId = req.userId;

    // Find user by unique code
    const targetUser = await User.findOne({
      uniqueCode: uniqueCode.toUpperCase(),
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found with that code' });
    }

    // Can't connect with yourself
    if (targetUser._id.equals(currentUserId)) {
      return res.status(400).json({ error: 'Cannot connect with yourself' });
    }

    // Check if connection already exists
    const [user1, user2] = [currentUserId, targetUser._id].sort();
    let connection = await Connection.findOne({
      user1Id: user1,
      user2Id: user2,
    });

    if (connection) {
      return res.status(400).json({ error: 'Connection already exists' });
    }

    // Create new connection
    connection = await Connection.create({
      user1Id: user1,
      user2Id: user2,
      connectionContext: connectionContext || null,
    });

    res.status(201).json({
      message: 'Connection created successfully',
      connection,
      connectedUser: targetUser.toJSON(),
    });
  } catch (error) {
    console.error('Connection error:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// Get all connections for current user
router.get('/my-connections', auth, async (req, res) => {
  try {
    const userId = req.userId;

    const connections = await Connection.find({
      $or: [{ user1Id: userId }, { user2Id: userId }],
      blockedBy: { $ne: userId },
    })
      .populate('user1Id', 'uniqueCode profilePicture bio')
      .populate('user2Id', 'uniqueCode profilePicture bio')
      .sort({ initiatedAt: -1 });

    // Format connections to show the "other" user
    const formattedConnections = connections.map((conn) => {
      const otherUser = conn.user1Id._id.equals(userId)
        ? conn.user2Id
        : conn.user1Id;
      return {
        connectionId: conn._id,
        otherUser,
        status: conn.status,
        messageCount: conn.messageCount,
        unlocked: conn.unlocked,
        shouldShowPrompt: conn.shouldShowPrompt(),
        initiatedAt: conn.initiatedAt,
      };
    });

    res.json({ connections: formattedConnections });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Confirm genuine connection
router.post('/confirm/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Verify user is part of this connection
    if (
      !connection.user1Id.equals(userId) &&
      !connection.user2Id.equals(userId)
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if prompt should be shown
    if (!connection.shouldShowPrompt()) {
      return res
        .status(400)
        .json({ error: 'Not eligible for confirmation yet' });
    }

    await connection.confirmConnection(userId);

    res.json({
      message: 'Connection confirmed',
      unlocked: connection.unlocked,
      connection,
    });
  } catch (error) {
    console.error('Confirm connection error:', error);
    res.status(500).json({ error: 'Failed to confirm connection' });
  }
});

// Decline connection confirmation (resets prompt timer)
router.post('/decline/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Verify user is part of this connection
    if (
      !connection.user1Id.equals(userId) &&
      !connection.user2Id.equals(userId)
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update last prompt date to trigger 48-hour wait
    connection.lastPromptDate = new Date();
    await connection.save();

    res.json({ message: 'Prompt will appear again in 48 hours' });
  } catch (error) {
    console.error('Decline connection error:', error);
    res.status(500).json({ error: 'Failed to decline connection' });
  }
});

// Block a connection
router.post('/block/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Add user to blockedBy array if not already there
    if (!connection.blockedBy.includes(userId)) {
      connection.blockedBy.push(userId);
      await connection.save();
    }

    res.json({ message: 'Connection blocked successfully' });
  } catch (error) {
    console.error('Block connection error:', error);
    res.status(500).json({ error: 'Failed to block connection' });
  }
});

module.exports = router;
