import mongoose from "mongoose";
import crypto from "crypto";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for OAuth users (will be hashed if set)

  // OAuth Provider Info
  authProvider: {
    type: String,
    enum: ["local", "google", "github"],
    default: "local"
  },
  providerId: { type: String }, // Google/GitHub user ID
  avatar: { type: String }, // Profile picture URL from OAuth

  // Password Reset
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },

  // Refresh Token (for secure token rotation)
  refreshTokens: [{
    token: { type: String },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ip: { type: String }
  }],

  // Security
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastLogin: { type: Date },

  createdAt: { type: Date, default: Date.now },

  // Profile Fields
  bio: { type: String, default: "" },
  platforms: {
    codeforces: { type: String, default: "" },
    leetcode: { type: String, default: "" },
    codechef: { type: String, default: "" },
    cses: { type: String, default: "" },
    github: { type: String, default: "" }
  },

  // Social Fields
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // OAuth linked accounts (populated when user logs in via Google/GitHub)
  oauth: {
    googleId: { type: String, sparse: true },
    githubId: { type: String, sparse: true }
  }
});

// Virtual to check if account is locked
UserSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to generate secure refresh token
UserSchema.methods.generateRefreshToken = function (userAgent, ip) {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days


  // Limit to 5 active sessions
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift(); // Remove oldest
  }

  this.refreshTokens.push({ token, expiresAt, userAgent, ip });
  return token;
};

// Method to validate refresh token
UserSchema.methods.validateRefreshToken = function (token) {
  const tokenDoc = this.refreshTokens.find(t => t.token === token);
  if (!tokenDoc) return false;
  if (tokenDoc.expiresAt < Date.now()) {
    // Remove expired token
    this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
    return false;
  }
  return true;
};

// Method to remove refresh token (logout)
UserSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
};

// Method to handle failed login
UserSchema.methods.incLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { failedLoginAttempts: 1 } };

  // Lock account after 5 failed attempts for 15 minutes
  if (this.failedLoginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
  }

  return this.updateOne(updates);
};

// Clean up expired refresh tokens
UserSchema.methods.cleanExpiredTokens = function () {
  this.refreshTokens = this.refreshTokens.filter(t => t.expiresAt > Date.now());
};

// Indexes for faster lookups (email and username already have unique index from schema definition)
UserSchema.index({ authProvider: 1, providerId: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ "platforms.codeforces": 1 }, { sparse: true });
UserSchema.index({ "platforms.leetcode": 1 }, { sparse: true });
UserSchema.index({ friends: 1 });
UserSchema.index({ lockUntil: 1 }, { sparse: true }); // For querying locked accounts (NO TTL - expireAfterSeconds was deleting entire user docs!)
// OAuth lookup indexes (used in oauth.js callbacks)
UserSchema.index({ "oauth.googleId": 1 }, { sparse: true });
UserSchema.index({ "oauth.githubId": 1 }, { sparse: true });

export default mongoose.model("User", UserSchema);