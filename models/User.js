const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    maxlength: 30,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  uniqueCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6,
    index: true,
  },
  profilePicture: {
    type: String,
    default: null,
  },
  bio: {
    type: String,
    maxlength: 100,
    default: '',
  },
  fcmToken: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
});

// Generate unique 6-character code
userSchema.statics.generateUniqueCode = async function () {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Check if code already exists
    const existingUser = await this.findOne({ uniqueCode: code });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return code;
};

// Method to update last active timestamp
userSchema.methods.updateLastActive = function () {
  this.lastActive = new Date();
  return this.save();
};

// Don't return sensitive data
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);
