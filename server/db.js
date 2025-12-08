const { Pool } = require('pg');

// --- CRITICAL FIX: Use DATABASE_URL for Render, fall back to PG_* for local ---

// 1. Check for the single, complete DATABASE_URL provided by cloud environments (Render)
const connectionString = process.env.DATABASE_URL;

let pool;

if (connectionString) {
    // If DATABASE_URL is found, use it directly (Render deployment)
    pool = new Pool({
        connectionString: connectionString,
        // When deployed, we MUST instruct PostgreSQL to use SSL/TLS
        ssl: {
            rejectUnauthorized: false 
        }
    });
    
    // Log configuration status
    console.log("Database Mode: Production (Using DATABASE_URL)");

} else {
    // 2. If DATABASE_URL is NOT found, fall back to individual PG_* variables (Local development)
    
    // Ensure all required local variables are available (loaded via dotenv in index.js)
    if (!process.env.PG_HOST || !process.env.PG_DATABASE || !process.env.PG_USER || !process.env.PG_PASSWORD) {
        console.error("Local database connection variables (PG_HOST, PG_USER, etc.) are missing. Check your .env file.");
    }
    
    pool = new Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: process.env.PG_PORT || 5432, // Default port
    });

    // Log configuration status
    console.log("Database Mode: Local (Using individual PG_* variables)");
}

module.exports = {
    // Expose a standard query function
    query: (text, params) => pool.query(text, params),
    
    // Expose the connection function for the startup check in index.js
    connect: () => pool.connect(),
};