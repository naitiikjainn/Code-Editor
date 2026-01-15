import express from 'express';
import { AccessToken } from 'livekit-server-sdk';

const router = express.Router();

// @route   POST /api/livekit/token
// @desc    Generate LiveKit access token for voice chat
// @access  Public (but can be restricted with auth)
router.post('/token', async (req, res) => {
    try {
        const { roomName, participantName } = req.body;
        
        if (!roomName || !participantName) {
            return res.status(400).json({ error: 'roomName and participantName are required' });
        }
        
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        
        if (!apiKey || !apiSecret) {
            console.error('[LiveKit] API key or secret not configured');
            return res.status(500).json({ error: 'Voice chat not configured on server' });
        }
        
        // Create access token
        const at = new AccessToken(apiKey, apiSecret, {
            identity: participantName,
            name: participantName,
            ttl: '6h' // Token valid for 6 hours
        });
        
        // Grant permissions
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true
        });
        
        const token = await at.toJwt();
        
        console.log(`[LiveKit] Token generated for ${participantName} in room ${roomName}`);
        
        res.json({ token });
        
    } catch (error) {
        console.error('[LiveKit] Token generation error:', error);
        res.status(500).json({ error: 'Failed to generate voice token' });
    }
});

export default router;
