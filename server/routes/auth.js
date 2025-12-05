const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Load environment variables (needed for JWT_SECRET)
require('dotenv').config(); 

// 1. User Registration Route: POST /auth/register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        // 1. Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 2. Insert user into the database
        const queryText = 
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username';
        const values = [username, passwordHash];
        
        const result = await db.query(queryText, values);
        const newUser = result.rows[0];

        // 3. Generate JWT token
        const token = jwt.sign(
            { id: newUser.id, username: newUser.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' } // Token expires in 1 day
        );

        // Send token and basic user info back
        res.status(201).json({ 
            token, 
            user: { id: newUser.id, username: newUser.username },
            message: 'User registered successfully.'
        });

    } catch (err) {
        // Handle duplicate username error (PostgreSQL error code 23505)
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username already taken.' });
        }
        console.error('Registration error:', err.message);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// 2. User Login Route: POST /auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        // 1. Find the user
        const userQuery = 'SELECT id, username, password_hash FROM users WHERE username = $1';
        const result = await db.query(userQuery, [username]);
        const user = result.rows[0];

        if (!user) {
            // User not found
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // 2. Compare the provided password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            // Passwords don't match
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // 3. Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );

        // Send token and basic user info back
        res.status(200).json({ 
            token, 
            user: { id: user.id, username: user.username },
            message: 'Login successful.'
        });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

module.exports = router;