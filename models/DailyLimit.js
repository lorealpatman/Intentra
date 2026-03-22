const mongoose = require('mongoose');

const dailyLimitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  connectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connection',
    required: true,
  },
  date: {
    type: String,
    required: true, // Format: YYYY-MM-DD
  },
  messagesSent: {
    type: Number,
    default: 0,
    max: 5,
  },
});

// Compound index for efficient daily limit checks
dailyLimitSchema.index(
  { userId: 1, connectionId: 1, date: 1 },
  { unique: true },
);

// Static method to check and update daily limit
dailyLimitSchema.statics.canSendMessage = async function (
  userId,
  connectionId,
  connection,
) {
  // If connection is unlocked, no limits apply
  if (connection.unlocked) return true;

  const today = new Date().toISOString().split('T')[0];

  let dailyLimit = await this.findOne({
    userId,
    connectionId,
    date: today,
  });

  if (!dailyLimit) {
    // Create new daily limit record
    dailyLimit = await this.create({
      userId,
      connectionId,
      date: today,
      messagesSent: 0,
    });
  }

  return dailyLimit.messagesSent < 5;
};

// Static method to increment message count
dailyLimitSchema.statics.incrementMessageCount = async function (
  userId,
  connectionId,
) {
  const today = new Date().toISOString().split('T')[0];

  const result = await this.findOneAndUpdate(
    { userId, connectionId, date: today },
    { $inc: { messagesSent: 1 } },
    { upsert: true, new: true },
  );

  return result;
};

// Static method to get remaining messages for today
dailyLimitSchema.statics.getRemainingMessages = async function (
  userId,
  connectionId,
  connection,
) {
  if (connection.unlocked) return Infinity;

  const today = new Date().toISOString().split('T')[0];

  const dailyLimit = await this.findOne({
    userId,
    connectionId,
    date: today,
  });

  const sent = dailyLimit ? dailyLimit.messagesSent : 0;
  return Math.max(0, 5 - sent);
};

module.exports = mongoose.model('DailyLimit', dailyLimitSchema);
