const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load JWT_SECRET

/**
 * Middleware to check for a valid JWT token in the Authorization header.
 * If valid, it attaches the user's ID to the request object (req.userId).
 */
const auth = (req, res, next) => {
    // 1. Get the token from the header
    // Header format is typically: Authorization: Bearer <token>
    const authHeader = req.header('Authorization');
    
    // Check if the header exists and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided or token format is incorrect.' });
    }

    // Extract the token (remove 'Bearer ')
    const token = authHeader.replace('Bearer ', '');

    try {
        // 2. Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. Attach the user ID to the request object
        req.userId = decoded.id; 
        
        // Proceed to the next middleware or route handler
        next();
    } catch (ex) {
        // If verification fails (e.g., token is expired or invalid secret)
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

module.exports = auth;