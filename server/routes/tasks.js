const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth'); 

// All routes defined here will automatically be prefixed with /tasks

// 1. GET /tasks - Retrieve all tasks for the logged-in user
router.get('/', auth, async (req, res) => {
    // req.userId is available from the auth middleware
    try {
        const queryText = 'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC';
        const result = await db.query(queryText, [req.userId]);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('GET tasks error:', err.message);
        res.status(500).json({ error: 'Server error retrieving tasks.' });
    }
});

// 2. GET /tasks/:id - Retrieve a single task by ID
router.get('/:id', auth, async (req, res) => {
    const taskId = req.params.id;

    try {
        const queryText = 'SELECT * FROM tasks WHERE id = $1 AND user_id = $2';
        const result = await db.query(queryText, [taskId, req.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Task with ID ${taskId} not found or unauthorized.` });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('GET single task error:', err.message);
        res.status(500).json({ error: 'Server error retrieving task details.' });
    }
});

// 3. POST /tasks - Create a new task
router.post('/', auth, async (req, res) => {
    const { title, description, priority, status } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Task title is required.' });
    }

    try {
        const queryText = 
            'INSERT INTO tasks (user_id, title, description, priority, status) VALUES ($1, $2, $3, $4, $5) RETURNING *';
        const values = [req.userId, title, description, priority, status || 'todo'];

        const result = await db.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('POST task error:', err.message);
        res.status(500).json({ error: 'Server error creating task.' });
    }
});

// 4. PUT /tasks/:id - Update an existing task (WITH DEBUGGING)
router.put('/:id', auth, async (req, res) => {
    const taskId = req.params.id;
    const { title, description, status, priority } = req.body;
    
    // ----------------------------------------------------------------------
    // *** NEW DEBUGGING LOG ***
    console.log(`[DEBUG] Received PUT request for Task ID: ${taskId} by User ID: ${req.userId}`);
    console.log('[DEBUG] Request Body Data:', req.body);
    // ----------------------------------------------------------------------

    // Safety check for user ID (should be set by the 'auth' middleware)
    if (!req.userId) {
        // This should not happen if auth middleware runs, but good practice
        return res.status(401).json({ error: 'Unauthorized: User ID missing from request context.' });
    }

    // Safety check for critical fields required for the update logic to function properly
    if (!title) {
        return res.status(400).json({ error: 'Task title cannot be empty during update.' });
    }

    try {
        const queryText = `
            UPDATE tasks 
            SET 
                title = COALESCE($1, title),         
                description = COALESCE($2, description), 
                status = COALESCE($3, status),       
                priority = COALESCE($4, priority)    
            WHERE id = $5 AND user_id = $6
            RETURNING *`;
            
        const values = [title, description, status, priority, taskId, req.userId];
        
        // ----------------------------------------------------------------------
        // *** NEW DEBUGGING LOG: Query and Values ***
        console.log('[DEBUG] SQL VALUES:', values);
        // ----------------------------------------------------------------------

        const result = await db.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found or unauthorized.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        // CRITICAL: Log the exact message returned by PostgreSQL
        console.error('*** FATAL PUT task error (PostgreSQL Message) ***:', err.message);
        res.status(500).json({ error: 'Server error updating task.' });
    }
});

// 5. PUT /tasks/:id/status - Update only the task status (used for drag and drop)
router.put('/:id/status', auth, async (req, res) => {
    const taskId = req.params.id;
    const { status } = req.body;

    if (!status || !['todo', 'doing', 'done'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status provided.' });
    }

    try {
        const queryText = 'UPDATE tasks SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *';
        const values = [status, taskId, req.userId];

        const result = await db.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found or unauthorized.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('PUT task status error:', err.message);
        res.status(500).json({ error: 'Server error updating task status.' });
    }
});


// 6. DELETE /tasks/:id - Remove a task
router.delete('/:id', auth, async (req, res) => {
    const taskId = req.params.id;

    try {
        const queryText = 'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id';
        const result = await db.query(queryText, [taskId, req.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found or unauthorized.' });
        }

        res.status(200).json({ message: 'Task deleted successfully.', id: taskId });
    } catch (err) {
        console.error('DELETE task error:', err.message);
        res.status(500).json({ error: 'Server error deleting task.' });
    }
});

module.exports = router;