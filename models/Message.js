const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  connectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connection',
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 300,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

// Index for efficient message queries
messageSchema.index({ connectionId: 1, timestamp: -1 });
messageSchema.index({ receiverId: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
