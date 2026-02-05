import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHelpers.js";

const router = express.Router();

// Simple in-memory rate limiter (use Redis in production)
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

const checkRateLimit = (identifier) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) return { allowed: true };

  // Clean old attempts
  const recentAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recentAttempts.length >= MAX_ATTEMPTS) {
    const oldestAttempt = Math.min(...recentAttempts);
    const retryAfter = Math.ceil((oldestAttempt + RATE_LIMIT_WINDOW - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
};

const recordAttempt = (identifier) => {
  const attempts = loginAttempts.get(identifier) || [];
  attempts.push(Date.now());
  loginAttempts.set(identifier, attempts.slice(-MAX_ATTEMPTS));
};

// Periodic cleanup for in-memory rate limiter (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of loginAttempts.entries()) {
    const recent = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      loginAttempts.delete(key);
    } else {
      loginAttempts.set(key, recent);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

// 1. REGISTER USER
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Please enter all fields." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    // Password strength check (must have letter + number, balanced security)
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: "Password must contain at least one letter and one number." });
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: "Username must be 3-20 characters, alphanumeric and underscores only." });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // Check if user (email OR username) already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ error: "Email already exists." });
      if (existingUser.username === username) return res.status(400).json({ error: "Username already exists." });
    }

    // Encrypt the password with stronger salt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save to Database
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      authProvider: "local"
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// 2. LOGIN USER
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: "Please enter all fields." });
    }

    // Rate limiting check
    const rateLimit = checkRateLimit(identifier);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Too many login attempts. Try again in ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter
      });
    }

    // Find User by Email OR Username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) {
      recordAttempt(identifier);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockRemaining = Math.ceil((user.lockUntil - Date.now()) / 1000 / 60);
      return res.status(423).json({
        error: `Account locked. Try again in ${lockRemaining} minutes.`
      });
    }

    // Check if user has password (OAuth users might not)
    if (!user.password) {
      const provider = user.authProvider !== "local"
        ? user.authProvider
        : (user.oauth?.googleId ? "google" : user.oauth?.githubId ? "github" : "oauth");
      return res.status(400).json({
        error: `This account uses ${provider} login. Please use that instead.`
      });
    }

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      recordAttempt(identifier);
      await user.incLoginAttempts();
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockUntil = undefined;
    }
    user.lastLogin = new Date();

    // Create tokens
    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET not set!");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    res.json({
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// 3. GET CURRENT USER (Protected)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -refreshTokens -resetPasswordToken -resetPasswordExpires");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return consistent format with 'id' field (matching login response)
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      authProvider: user.authProvider,
      platforms: user.platforms // Include CF handle and other platform info
    });
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    res.status(400).json({ error: "Token is not valid" });
  }
});

// 4. SET USERNAME (OAuth users who are missing one)
router.post("/username", authMiddleware, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: "Username must be 3-20 characters, alphanumeric and underscores only." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isValidUsername = (value) => /^[a-zA-Z0-9_]{3,20}$/.test((value || "").trim());

    // If the user already has the requested username, treat it as success
    if (user.username && user.username.trim() === username.trim()) {
      return res.json({
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider,
        platforms: user.platforms
      });
    }

    // Only block if existing username is valid (local users or already finalized)
    if (user.username && isValidUsername(user.username)) {
      return res.status(400).json({ error: "Username already set." });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).json({ error: "Username already exists." });
    }

    user.username = username;
    await user.save();

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      authProvider: user.authProvider,
      platforms: user.platforms
    });
  } catch (err) {
    console.error("Set username error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 4. FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Rate limit forgot password requests
    const rateLimit = checkRateLimit(`forgot:${email}`);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "Too many reset requests. Please try again later."
      });
    }
    recordAttempt(`forgot:${email}`);

    const user = await User.findOne({ email });

    if (!user) {
      // Security: Don't reveal if user exists
      return res.json({ message: "If an account with that email exists, a reset link has been sent." });
    }

    // Check if user is OAuth-only
    if (user.authProvider !== "local" && !user.password) {
      return res.json({
        message: `This account uses ${user.authProvider} login. Please use that to sign in.`
      });
    }

    // Generate cryptographically secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // --- EMAIL SENDING LOGIC ---
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: '"CodePlay" <no-reply@codeplay.com>',
      to: email,
      subject: "Password Reset Request",
      html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Reset Your Password</h2>
                <p>You requested a password reset. Click the link below to reset it:</p>
                <a href="${resetLink}" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p style="margin-top: 20px;">Or copy this link: <br/> ${resetLink}</p>
                <p>This link expires in 1 hour.</p>
            </div>
        `
    };

    // Attempt to send (swallow error in dev if creds missing)
    try {
      await transporter.sendMail(mailOptions);
      console.log(`[EMAIL SENT] To: ${email}`);
      res.json({ message: "Reset link sent to your email!" });
    } catch (emailErr) {
      console.error("Email send failed (likely missing credentials):", emailErr.message);
      // In production, don't expose the token - just say email failed
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: "Failed to send email. Please try again later." });
      } else {
        // Dev mode only - log link to console (never expose in response in prod)
        console.log("--- DEV MODE RESET LINK ---");
        console.log(resetLink);
        console.log("---------------------------");
        res.json({
          message: "Email config missing. Check backend console for link (dev only)."
        });
      }
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 5. RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Hash the incoming token to compare with stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    // Password strength check (must have letter + number, same as registration)
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        error: "Password must contain at least one letter and one number."
      });
    }

    // Hash new password with stronger salt
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear reset token and invalidate all sessions for security
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = []; // Force re-login on all devices
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    res.json({ message: "Password updated successfully. Please log in again." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;