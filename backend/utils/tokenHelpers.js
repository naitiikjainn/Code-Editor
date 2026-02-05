import jwt from "jsonwebtoken";

/**
 * Generate a JWT access token (30-day expiry)
 * @param {Object} user - Mongoose user document
 * @returns {string} JWT token
 */
export const generateAccessToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
    );
};

/**
 * Generate a refresh token and save it to the user document
 * @param {Object} user - Mongoose user document
 * @param {Object} req - Express request object (for user-agent and IP)
 * @returns {string} Refresh token string
 */
export const generateRefreshToken = async (user, req) => {
    const userAgent = req.headers["user-agent"] || "unknown";
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const refreshToken = user.generateRefreshToken(userAgent, ip);
    await user.save();
    return refreshToken;
};
