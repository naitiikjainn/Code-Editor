import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
    // Get token from header - support both formats for compatibility
    // 1. "Authorization: Bearer xxx" (standard, used by Workspace.jsx)
    // 2. "x-auth-token: xxx" (legacy, used by AuthContext)
    let token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        token = req.header("x-auth-token");
    }

    // Check if not token
    if (!token) {
        return res.status(401).json({ error: "No token, authorization denied" });
    }

    // Verify token
    try {
        if (!process.env.JWT_SECRET) {
            console.error("CRITICAL: JWT_SECRET not set!");
            return res.status(500).json({ error: "Server configuration error" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Corrected: decoded is the payload, usually { id: ... } 
        // Note: auth.js signs { id: user._id, username: ... }
        // but auth.js:68 returns user: { id: ... }
        // Let's ensure req.user.id is accessible.
        // Auth logic usually expects req.user = decoded or req.user = decoded.user
        // In auth.js: jwt.sign({ id: user._id ... }) -> decoded has .id
        // profile.js: await User.findById(req.user.id) -> checks req.user.id
        // So req.user = decoded is correct.
        next();
    } catch (err) {
        res.status(401).json({ error: "Token is not valid" });
    }
}
