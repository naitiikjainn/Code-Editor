import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Will be hashed (encrypted)
  createdAt:{ type: Date, default: Date.now }
});

export default mongoose.model("User", UserSchema);