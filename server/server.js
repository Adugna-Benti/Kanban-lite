// Import necessary packages
const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const db = require('./db'); 

// Import Routers
const authRouter = require('./routes/auth');
const tasksRouter = require('./routes/tasks'); // <<< New: Import tasks router

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Basic Root Route (Test connection)
app.get('/', async (req, res) => {
  try {
    // Check database connection by running a simple query
    const result = await db.query('SELECT NOW()'); 
    res.send(`Kanban Lite Server is Running! DB Time: ${result.rows[0].now}`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(500).send('Database connection error.');
  }
});

// Authentication Routes
app.use('/auth', authRouter); 

// Task Routes (Protected)
app.use('/tasks', tasksRouter); // <<< New: Use the tasks router

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});