import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";

const router = express.Router();

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

    // Check if user (email OR username) already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ error: "Email already exists." });
      if (existingUser.username === username) return res.status(400).json({ error: "Username already exists." });
    }

    // Encrypt the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save to Database
    const newUser = new User({ username, email, password: hashedPassword });
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
    const { identifier, password } = req.body; // identifier can be email or username

    // Find User by Email OR Username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });

    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    // Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // Create Token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "default_secret_key",
      { expiresIn: "7d" } // Longer session
    );

    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// 3. GET CURRENT USER (Protected)
router.get("/me", async (req, res) => {
  const token = req.header("x-auth-token");
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret_key");
    const user = await User.findById(decoded.id).select("-password"); // Exclude password
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: "Token is not valid" });
  }
});

// 4. FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Security: Don't reveal if user exists or not, but for UX we might say "If email exists..."
      // For this project, we'll return an error to be helpful
      return res.status(400).json({ error: "User with this email does not exist" });
    }

    // Generate simple token (in prod use crypto)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    user.resetPasswordToken = resetToken;
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
      from: '"CodePlay" <no-reply@codeplay.ai>',
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
      console.log(`[EMAIL SENT] To: ${email} | Link: ${resetLink}`);
      res.json({ message: "Reset link sent to your email!" });
    } catch (emailErr) {
      console.error("Email send failed (likely missing credentials):", emailErr);
      console.log("--- DEV MODE RESET LINK ---");
      console.log(resetLink);
      console.log("---------------------------");

      // Fallback for dev mode: Return link so user can still test
      res.json({
        message: "Email config missing. Check backend console for link.",
        devLink: resetLink,
        token: resetToken
      });
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
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 chars" });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Password updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;