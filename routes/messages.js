const express = require('express');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const DailyLimit = require('../models/DailyLimit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendPushNotification } = require('../utils/notifications');

const router = express.Router();

// Send a message
router.post('/send', auth, async (req, res) => {
  try {
    const { receiverId, content, connectionId } = req.body;
    const senderId = req.userId;

    // Validate content length
    if (!content || content.length > 300) {
      return res
        .status(400)
        .json({ error: 'Message must be between 1-300 characters' });
    }

    // Find connection
    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Verify user is part of this connection
    if (
      !connection.user1Id.equals(senderId) &&
      !connection.user2Id.equals(senderId)
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if connection is blocked
    if (connection.blockedBy.length > 0) {
      return res
        .status(403)
        .json({ error: 'Cannot send message to blocked connection' });
    }

    // Check daily message limit (unless unlocked)
    const canSend = await DailyLimit.canSendMessage(
      senderId,
      connectionId,
      connection,
    );
    if (!canSend) {
      const remaining = await DailyLimit.getRemainingMessages(
        senderId,
        connectionId,
        connection,
      );
      return res.status(429).json({
        error: 'Daily message limit reached',
        remaining,
        resetsAt: new Date().setHours(24, 0, 0, 0),
      });
    }

    // Create message
    const message = await Message.create({
      senderId,
      receiverId,
      connectionId,
      content,
    });

    // Update daily limit
    if (!connection.unlocked) {
      await DailyLimit.incrementMessageCount(senderId, connectionId);
    }

    // Update connection message count
    await connection.incrementMessageCount();

    // Get remaining messages for today
    const remaining = await DailyLimit.getRemainingMessages(
      senderId,
      connectionId,
      connection,
    );

    // Send push notification to receiver
    const receiver = await User.findById(receiverId);
    if (receiver && receiver.fcmToken) {
      const sender = await User.findById(senderId);
      await sendPushNotification(
        receiver.fcmToken,
        'New Message',
        `${sender.uniqueCode}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      );
    }

    res.status(201).json({
      message: message.toJSON(),
      remaining,
      shouldShowPrompt: connection.shouldShowPrompt(),
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for a connection
router.get('/connection/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;
    const { limit = 50, before } = req.query;

    // Verify user is part of this connection
    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (
      !connection.user1Id.equals(userId) &&
      !connection.user2Id.equals(userId)
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Build query
    const query = { connectionId };
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('senderId', 'uniqueCode profilePicture')
      .populate('receiverId', 'uniqueCode profilePicture');

    // Mark messages as read
    await Message.updateMany(
      { connectionId, receiverId: userId, read: false },
      { read: true },
    );

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get unread message count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.userId;

    const count = await Message.countDocuments({
      receiverId: userId,
      read: false,
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Get remaining messages for a connection today
router.get('/remaining/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.userId;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const remaining = await DailyLimit.getRemainingMessages(
      userId,
      connectionId,
      connection,
    );

    res.json({
      remaining,
      unlocked: connection.unlocked,
      resetsAt: new Date().setHours(24, 0, 0, 0),
    });
  } catch (error) {
    console.error('Get remaining messages error:', error);
    res.status(500).json({ error: 'Failed to fetch remaining messages' });
  }
});

module.exports = router;
