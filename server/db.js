// db.js

const { Pool } = require('pg');
require('dotenv').config();

// Create a new Pool instance
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

// Optional: Log a message when a client connects for testing
pool.on('connect', () => {
  console.log('Successfully connected to the PostgreSQL database!');
});

// Export the pool to be used in controllers/routes
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool // Exporting the pool object itself for complex operations
};