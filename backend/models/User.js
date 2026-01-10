import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Will be hashed (encrypted)
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },

  // Profile Fields
  bio: { type: String, default: "" },
  platforms: {
    codeforces: { type: String, default: "" }, // handle
    leetcode: { type: String, default: "" },   // username
    codechef: { type: String, default: "" },   // NEW: handle
    cses: { type: String, default: "" },       // (future use)
    github: { type: String, default: "" }
  },

  // Social Fields
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

export default mongoose.model("User", UserSchema);