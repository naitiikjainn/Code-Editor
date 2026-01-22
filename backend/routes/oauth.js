import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";

const router = express.Router();

// Helper: Generate Access Token (1 month expiry)
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "30d" } // 30 days = 1 month
  );
};

// Helper: Generate Refresh Token (long-lived)
const generateRefreshToken = async (user, req) => {
  const userAgent = req.headers["user-agent"] || "unknown";
  const ip = req.ip || req.connection?.remoteAddress || "unknown";
  const refreshToken = user.generateRefreshToken(userAgent, ip);
  await user.save();
  return refreshToken;
};

// Helper: Set secure cookie
const setTokenCookie = (res, name, token, maxAge) => {
  res.cookie(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge
  });
};

// ============================================
// GOOGLE OAUTH
// ============================================

// Step 1: Generate Google OAuth URL
router.get("/google/url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/oauth/google/callback`;

  if (!clientId) {
    return res.status(500).json({ error: "Google OAuth not configured" });
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  res.json({ url, state });
});

// Step 2: Google OAuth Callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (error) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_code`);
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/oauth/google/callback`,
        grant_type: "authorization_code"
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("Google token error:", tokens);
      return res.redirect(`${frontendUrl}/auth/callback?error=token_exchange_failed`);
    }

    // Get user info from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const googleUser = await userInfoResponse.json();

    if (!googleUser.email) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_email`);
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { email: googleUser.email },
        { authProvider: "google", providerId: googleUser.id }
      ]
    });

    if (!user) {
      // Create new user
      const username = await generateUniqueUsername(googleUser.name || googleUser.email.split("@")[0]);

      user = new User({
        username,
        email: googleUser.email,
        authProvider: "google",
        providerId: googleUser.id,
        avatar: googleUser.picture,
        lastLogin: new Date()
      });
      await user.save();
    } else if (user.authProvider === "local") {
      // Link Google to existing local account
      user.authProvider = "google";
      user.providerId = googleUser.id;
      user.avatar = user.avatar || googleUser.picture;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    // Redirect to frontend with tokens
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);

  } catch (err) {
    console.error("Google OAuth error:", err);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/callback?error=server_error`);
  }
});

// ============================================
// GITHUB OAUTH
// ============================================

// Step 1: Generate GitHub OAuth URL
router.get("/github/url", (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.BACKEND_URL || "http://localhost:5000"}/api/oauth/github/callback`;

  if (!clientId) {
    return res.status(500).json({ error: "GitHub OAuth not configured" });
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString("hex");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "user:email read:user",
    state
  });

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;

  res.json({ url, state });
});

// Step 2: GitHub OAuth Callback
router.get("/github/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (error) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_code`);
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/oauth/github/callback`
      })
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("GitHub token error:", tokens);
      return res.redirect(`${frontendUrl}/auth/callback?error=token_exchange_failed`);
    }

    // Get user info from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "User-Agent": "CodePlay-App"
      }
    });

    const githubUser = await userResponse.json();

    // Get primary email (might be private)
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "User-Agent": "CodePlay-App"
        }
      });
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email;
    }

    if (!email) {
      return res.redirect(`${frontendUrl}/auth/callback?error=no_email`);
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { email },
        { authProvider: "github", providerId: String(githubUser.id) }
      ]
    });

    if (!user) {
      // Create new user
      const username = await generateUniqueUsername(githubUser.login);

      user = new User({
        username,
        email,
        authProvider: "github",
        providerId: String(githubUser.id),
        avatar: githubUser.avatar_url,
        "platforms.github": githubUser.login,
        lastLogin: new Date()
      });
      await user.save();
    } else if (user.authProvider === "local") {
      // Link GitHub to existing local account
      user.authProvider = "github";
      user.providerId = String(githubUser.id);
      user.avatar = user.avatar || githubUser.avatar_url;
      if (!user.platforms.github) {
        user.platforms.github = githubUser.login;
      }
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    // Redirect to frontend with tokens
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}&refresh=${refreshToken}`);

  } catch (err) {
    console.error("GitHub OAuth error:", err);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/callback?error=server_error`);
  }
});

// ============================================
// TOKEN REFRESH
// ============================================

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    // Find user with this refresh token
    const user = await User.findOne({
      "refreshTokens.token": refreshToken
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Validate token
    if (!user.validateRefreshToken(refreshToken)) {
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Token rotation: remove old token and generate new one
    user.removeRefreshToken(refreshToken);
    const newRefreshToken = await generateRefreshToken(user, req);
    const accessToken = generateAccessToken(user);

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        authProvider: user.authProvider
      }
    });

  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// LOGOUT (Revoke Refresh Token)
// ============================================

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    // Support both token header formats
    let token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) token = req.header("x-auth-token");

    if (!token && !refreshToken) {
      return res.status(400).json({ error: "No token provided" });
    }

    // If we have access token, find user and remove refresh token
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user && refreshToken) {
          user.removeRefreshToken(refreshToken);
          await user.save();
        }
      } catch (e) {
        // Token might be expired, try with refresh token
      }
    }

    // If only refresh token provided
    if (refreshToken && !token) {
      const user = await User.findOne({ "refreshTokens.token": refreshToken });
      if (user) {
        user.removeRefreshToken(refreshToken);
        await user.save();
      }
    }

    res.json({ message: "Logged out successfully" });

  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// LOGOUT ALL DEVICES
// ============================================

router.post("/logout-all", async (req, res) => {
  try {
    // Support both token header formats
    let token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) token = req.header("x-auth-token");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear all refresh tokens
    user.refreshTokens = [];
    await user.save();

    res.json({ message: "Logged out from all devices" });

  } catch (err) {
    console.error("Logout all error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// GET ACTIVE SESSIONS
// ============================================

router.get("/sessions", async (req, res) => {
  try {
    // Support both token header formats
    let token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) token = req.header("x-auth-token");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clean expired tokens first
    user.cleanExpiredTokens();
    await user.save();

    // Return session info (without the actual tokens)
    const sessions = user.refreshTokens.map(t => ({
      id: t._id,
      userAgent: t.userAgent,
      ip: t.ip,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt
    }));

    res.json({ sessions });

  } catch (err) {
    console.error("Get sessions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// REVOKE SPECIFIC SESSION
// ============================================

router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    // Support both token header formats
    let token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) token = req.header("x-auth-token");
    const { sessionId } = req.params;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Remove specific session
    user.refreshTokens = user.refreshTokens.filter(
      t => t._id.toString() !== sessionId
    );
    await user.save();

    res.json({ message: "Session revoked" });

  } catch (err) {
    console.error("Revoke session error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function generateUniqueUsername(baseUsername) {
  // Clean the username
  let username = baseUsername
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .substring(0, 20);

  if (!username) username = "user";

  // Check if exists
  let exists = await User.findOne({ username });
  if (!exists) return username;

  // Add random suffix
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 10000);
    const newUsername = `${username}${suffix}`;
    exists = await User.findOne({ username: newUsername });
    if (!exists) return newUsername;
  }

  // Fallback to timestamp
  return `${username}_${Date.now()}`;
}

export default router;
