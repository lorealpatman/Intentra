const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  user1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  user2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  connectionContext: {
    type: String,
    maxlength: 100,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'unlimited'],
    default: 'active',
  },
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
  messageCount: {
    type: Number,
    default: 0,
  },
  firstMessageDate: {
    type: Date,
    default: null,
  },
  lastPromptDate: {
    type: Date,
    default: null,
  },
  unlocked: {
    type: Boolean,
    default: false,
  },
  user1ConfirmedConnection: {
    type: Boolean,
    default: false,
  },
  user2ConfirmedConnection: {
    type: Boolean,
    default: false,
  },
  blockedBy: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
});

// Compound index to prevent duplicate connections
connectionSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

// Method to check if connection should show unlock prompt
connectionSchema.methods.shouldShowPrompt = function () {
  if (this.unlocked) return false;

  const daysSinceFirstMessage = this.firstMessageDate
    ? (Date.now() - this.firstMessageDate.getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  const hasEnoughMessages = this.messageCount >= 40;
  const hasEnoughDays = daysSinceFirstMessage >= 5;

  // Check if 48 hours passed since last prompt (if rejected)
  if (this.lastPromptDate) {
    const hoursSinceLastPrompt =
      (Date.now() - this.lastPromptDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastPrompt < 48) return false;
  }

  return hasEnoughMessages && hasEnoughDays;
};

// Method to increment message count
connectionSchema.methods.incrementMessageCount = async function () {
  if (!this.firstMessageDate) {
    this.firstMessageDate = new Date();
  }
  this.messageCount += 1;
  return this.save();
};

// Method to handle connection confirmation
connectionSchema.methods.confirmConnection = async function (userId) {
  this.lastPromptDate = new Date();

  if (userId.equals(this.user1Id)) {
    this.user1ConfirmedConnection = true;
  } else if (userId.equals(this.user2Id)) {
    this.user2ConfirmedConnection = true;
  }

  // If both confirmed, unlock unlimited messaging
  if (this.user1ConfirmedConnection && this.user2ConfirmedConnection) {
    this.unlocked = true;
    this.status = 'unlimited';
  }

  return this.save();
};

// Static method to find or create connection
connectionSchema.statics.findOrCreateConnection = async function (
  userId1,
  userId2,
) {
  // Ensure consistent ordering (smaller ObjectId first)
  const [user1, user2] = [userId1, userId2].sort();

  let connection = await this.findOne({
    user1Id: user1,
    user2Id: user2,
  });

  if (!connection) {
    connection = await this.create({
      user1Id: user1,
      user2Id: user2,
    });
  }

  return connection;
};

module.exports = mongoose.model('Connection', connectionSchema);
