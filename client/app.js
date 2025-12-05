// --- API & State Configuration ---
const API_BASE_URL = 'http://localhost:5000'; // Make sure this matches your Express server port
const TOKEN_KEY = 'kanban_lite_token';
const THEME_KEY = 'kanban_lite_theme'; // New key for theme preference
let currentToken = localStorage.getItem(TOKEN_KEY);
let currentTheme = localStorage.getItem(THEME_KEY) || 'light'; // Default to light
let currentUserId = null;
let isRegisterMode = false;
let isEditMode = false; // Track if task modal is for editing or creating

// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const boardSection = document.getElementById('board-section');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authButton = document.getElementById('auth-button');
const toggleAuthButton = document.getElementById('toggle-auth');
const authMessage = document.getElementById('auth-message');
const authStatus = document.getElementById('auth-status');
const themeToggleBtn = document.getElementById('theme-toggle-btn'); 

const taskModal = document.getElementById('task-modal');
const newTaskForm = document.getElementById('new-task-form');
const addTaskBtn = document.getElementById('add-task-btn');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const apiUrlDisplay = document.getElementById('api-url-display');

// Elements for Task Modal Management
const editTaskIdInput = document.getElementById('edit-task-id');
const modalTitle = document.getElementById('modal-title');
const saveTaskBtn = document.getElementById('save-task-btn');

const columns = {
    todo: document.getElementById('todo-tasks'),
    doing: document.getElementById('doing-tasks'),
    done: document.getElementById('done-tasks'),
};

// --- Utility Functions ---

apiUrlDisplay.textContent = API_BASE_URL;

function showMessage(element, message, isError = true) {
    element.textContent = message;
    element.classList.remove('hidden');
    element.classList.toggle('text-red-500', isError);
    element.classList.toggle('text-green-500', !isError);
    setTimeout(() => {
        element.classList.add('hidden');
    }, 3000);
}

/**
 * Displays a temporary message above the Kanban columns.
 */
function showBoardMessage(message, isError = true) {
    const board = document.getElementById('board-section');
    let messageEl = document.getElementById('board-message');
    
    if (!messageEl) {
        messageEl = document.createElement('p');
        messageEl.id = 'board-message';
        // Tailwind classes for visibility and styling
        messageEl.className = 'text-center p-3 rounded-xl mb-6 font-semibold shadow-lg transition-colors duration-300 dark:text-gray-900';
        // Insert message element right after the h2 and button
        const h2 = board.querySelector('h2');
        if (h2 && h2.parentElement) {
            h2.parentElement.after(messageEl);
        } else {
            board.prepend(messageEl);
        }
    }
    
    // List of all possible background classes to clear before setting
    const classesToClear = [
        'bg-red-500', 'bg-green-500', 'text-white', 'dark:bg-red-400', 'dark:bg-green-400'
    ];
    
    messageEl.textContent = message;
    messageEl.classList.remove('hidden', ...classesToClear);

    // Use add/remove for multiple classes
    if (isError) {
        // Apply red/error styling
        messageEl.classList.add('bg-red-500', 'text-white', 'dark:bg-red-400');
    } else {
        // Apply green/success styling
        messageEl.classList.add('bg-green-500', 'text-white', 'dark:bg-green-400');
    }

    setTimeout(() => {
        // Clear message after 4 seconds
        messageEl.classList.add('hidden');
    }, 4000);
}


function toggleBoardView(showBoard) {
    if (showBoard) {
        authSection.classList.add('hidden');
        boardSection.classList.remove('hidden');
    } else {
        authSection.classList.remove('hidden');
        boardSection.classList.add('hidden');
    }
}

function updateAuthStatus(username) {
    // Note: Dark mode styles for text are handled by Tailwind classes in index.html
    authStatus.innerHTML = `
        <span class="text-indigo-600 dark:text-indigo-400">${username}</span> | 
        <button id="logout-btn" class="text-red-500 hover:text-red-700 transition dark:text-red-400 dark:hover:text-red-500">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

// --- Theme Management Functions ---

/**
 * Applies the specified theme preference to the HTML element and updates the button.
 * @param {string} theme 'light' or 'dark'
 */
function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
        html.classList.add('dark');
        themeToggleBtn.innerHTML = '☀️'; // Sun icon to suggest switching to light
        themeToggleBtn.setAttribute('aria-label', 'Switch to Light Theme');
    } else {
        html.classList.remove('dark');
        themeToggleBtn.innerHTML = '🌙'; // Moon icon to suggest switching to dark
        themeToggleBtn.setAttribute('aria-label', 'Switch to Dark Theme');
    }
    currentTheme = theme;
    localStorage.setItem(THEME_KEY, theme);
}

/**
 * Toggles the theme between light and dark.
 */
function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}


// --- API Handlers ---

/**
 * Generic fetch wrapper with auth header support.
 */
async function apiFetch(url, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${url}`, config);
        
        // Explicitly handle Unauthorized status for session expiry
        if (response.status === 401) {
            showMessage(authMessage, 'Session expired. Please log in again.', true);
            handleLogout(false);
            throw new Error('Unauthorized or Session Expired');
        }

        const contentType = response.headers.get("content-type");
        
        // Check for HTML response when expecting JSON
        if (!response.ok && contentType && contentType.includes("text/html")) {
            throw new Error(`Server Error: Expected JSON but received HTML. Status: ${response.status}. Check server console for route ${url}.`);
        }
        
        // Handle 204 No Content (e.g., successful DELETE)
        if (response.status === 204) {
            return {};
        }

        // Proceed to parse response as JSON
        const data = await response.json();

        if (!response.ok) {
            // If we received JSON but status is not ok (e.g., 404 JSON), throw the error message from the body
            const errorMessage = data.error || `API request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        return data;
        
    } catch (error) {
        // Log the error for console debugging
        console.error('API Error:', error.message);
        throw error;
    }
}

/**
 * Handle user login or registration.
 */
async function handleAuth(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
    const action = isRegisterMode ? 'Registration' : 'Login';

    try {
        authButton.disabled = true;
        authButton.textContent = `${action}ing...`;

        const data = await apiFetch(endpoint, 'POST', { username, password });

        currentToken = data.token;
        currentUserId = data.user.id;
        localStorage.setItem(TOKEN_KEY, currentToken);
        
        showMessage(authMessage, `${action} successful!`, false);
        updateAuthStatus(data.user.username);
        toggleBoardView(true);
        loadTasks();

    } catch (error) {
        showMessage(authMessage, error.message || `${action} failed.`, true);
        
    } finally {
        authButton.disabled = false;
        authButton.textContent = isRegisterMode ? 'Register' : 'Log In';
    }
}

/**
 * Log out the user.
 */
function handleLogout(clearToken = true) {
    if (clearToken) {
        localStorage.removeItem(TOKEN_KEY);
    }
    currentToken = null;
    currentUserId = null;
    authStatus.innerHTML = '';
    toggleBoardView(false);
    // Clear board content
    Object.values(columns).forEach(col => col.innerHTML = '');
}

// --- Task Management Functions ---

/**
 * Resets the task modal to its default 'Create New Task' state.
 */
function resetTaskModal() {
    isEditMode = false;
    editTaskIdInput.value = '';
    modalTitle.textContent = 'Create New Task';
    saveTaskBtn.textContent = 'Save Task';
    newTaskForm.reset();
}

/**
 * Creates and returns a task card DOM element.
 */
function createTaskCard(task) {
    const card = document.createElement('div');
    // Ensure dark mode styles are applied to card background and text using Tailwind's dark: prefix
    card.className = 'task-card bg-white dark:bg-gray-800 dark:text-gray-200 p-4 rounded-xl shadow-md border-t-4 transition-colors duration-300 ' +
        (task.priority === 'High' ? 'border-red-500' : task.priority === 'Medium' ? 'border-yellow-500' : 'border-blue-500');
    
    card.setAttribute('draggable', 'true');
    card.dataset.id = task.id;
    card.dataset.status = task.status;

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <h4 class="font-bold text-lg">${task.title}</h4>
            <div class="flex space-x-2">
                <!-- Edit Button -->
                <button class="edit-btn text-gray-400 hover:text-indigo-500 transition" data-task-id="${task.id}" title="Edit Task">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-5.042 10.424L4 16v-4l6.59-6.59 4 4z" />
                    </svg>
                </button>
                <button class="delete-btn text-gray-400 hover:text-red-500 transition" data-task-id="${task.id}" title="Delete Task">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 100 2v6a1 1 0 100-2V8z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${task.description || 'No description.'}</p>
        <div class="text-xs mt-2 flex justify-between items-center text-gray-500 dark:text-gray-500">
            <span>Priority: ${task.priority}</span>
            <span>Created: ${new Date(task.created_at).toLocaleDateString()}</span>
        </div>
    `;

    // Add edit event listener
    card.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent interfering with drag-and-drop
        openEditModal(task.id);
    });

    // Add delete event listener
    card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    // Add drag event listeners
    card.addEventListener('dragstart', handleDragStart);
    // *** FIX: Add the dragend listener here so the opacity resets ***
    card.addEventListener('dragend', handleDragEnd);
    
    return card;
}

/**
 * Fetches task data and prepares the modal for editing.
 */
async function openEditModal(taskId) {
    try {
        const task = await apiFetch(`/tasks/${taskId}`);
        
        isEditMode = true;
        // Ensure ID is a string for the input value
        editTaskIdInput.value = String(task.id);
        modalTitle.textContent = 'Edit Task';
        saveTaskBtn.textContent = 'Update Task';
        
        document.getElementById('new-task-title').value = task.title;
        document.getElementById('new-task-description').value = task.description;
        document.getElementById('new-task-priority').value = task.priority;
        document.getElementById('new-task-status').value = task.status;
        
        taskModal.classList.remove('hidden');

    } catch (error) {
        // If the token was bad, apiFetch already logged the user out.
        if (error.message !== 'Unauthorized or Session Expired') {
            console.error('Failed to load task for editing:', error);
            showBoardMessage(`Failed to retrieve task details: ${error.message}`, true);
        }
    }
}

/**
 * Handles the form submission, acting as either create or update.
 */
async function handleTaskFormSubmit(event) {
    event.preventDefault();
    
    if (isEditMode) {
        await updateExistingTask();
    } else {
        await createNewTask();
    }
}


/**
 * Sends a PUT request to update an existing task.
 */
async function updateExistingTask() {
    const taskId = editTaskIdInput.value;
    const title = document.getElementById('new-task-title').value;
    const description = document.getElementById('new-task-description').value;
    const priority = document.getElementById('new-task-priority').value;
    const status = document.getElementById('new-task-status').value;

    if (!title || !taskId) {
        showBoardMessage('Error: Task ID or Title missing. Cannot update.', true);
        return;
    }
    
    const updateData = { title, description, priority, status };

    try {
        await apiFetch(`/tasks/${taskId}`, 'PUT', updateData);
        taskModal.classList.add('hidden');
        resetTaskModal();
        loadTasks(); // Reload board to reflect changes
    } catch (error) {
        // Only log/show error if not an auth error
        if (error.message !== 'Unauthorized or Session Expired') {
            console.error('Error updating task: ' + (error.message || 'Check console.'));
            showBoardMessage(`Failed to update task: ${error.message}`, true);
        }
    }
}

/**
 * Sends a POST request to create a new task.
 */
async function createNewTask() {
    const title = document.getElementById('new-task-title').value;
    const description = document.getElementById('new-task-description').value;
    const priority = document.getElementById('new-task-priority').value;
    const status = document.getElementById('new-task-status').value;

    if (!title) return;

    const newTaskData = { title, description, priority, status };

    try {
        await apiFetch('/tasks', 'POST', newTaskData);
        taskModal.classList.add('hidden');
        resetTaskModal();
        loadTasks(); 
    } catch (error) {
        // Only log if not an auth error
        if (error.message !== 'Unauthorized or Session Expired') {
            console.error('Error creating task: ' + (error.message || 'Check console.'));
            showBoardMessage(`Failed to create task: ${error.message}`, true);
        }
    }
}

/**
 * Fetches all tasks and renders them to the board.
 */
async function loadTasks() {
    // Clear existing tasks
    Object.values(columns).forEach(col => col.innerHTML = '');

    try {
        const tasks = await apiFetch('/tasks');

        if (tasks.length === 0) {
            // Show a helpful message if no tasks exist
            Object.values(columns).forEach(col => 
                col.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 mt-4">No tasks yet. Click "Add New Task" to start!</p>'
            );
        } else {
            tasks.forEach(task => {
                const card = createTaskCard(task);
                // Append card to the correct column based on its status
                columns[task.status].appendChild(card);
            });
        }

    } catch (error) {
        console.error('Failed to load tasks:', error);
        // Auth error handled by apiFetch, otherwise silently fail or show generic error
    }
}

/**
 * Deletes a task via API.
 */
async function deleteTask(taskId) {
    // In a production environment, use a custom modal instead of confirm
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    try {
        // The API returns 204 No Content, which is handled by apiFetch
        await apiFetch(`/tasks/${taskId}`, 'DELETE'); 
        // Remove the element from the DOM
        document.querySelector(`[data-id="${taskId}"]`).remove();
    } catch (error) {
        // Only log if not an auth error
        if (error.message !== 'Unauthorized or Session Expired') {
            console.error('Error deleting task: ' + (error.message || 'Check console.'));
            showBoardMessage(`Failed to delete task: ${error.message}`, true);
        }
    }
}

/**
 * Updates a task status via API (used by drag-and-drop).
 * This function is now simplified as we only update status during drag/drop.
 */
async function updateTaskStatus(taskId, newStatus) {
    try {
        const updateData = { status: newStatus };
        
        const updatedTask = await apiFetch(`/tasks/${taskId}/status`, 'PUT', updateData);
        
        // Update the local data-status attribute
        document.querySelector(`[data-id="${taskId}"]`).dataset.status = updatedTask.status;

    } catch (error) {
        // Only log if not an auth error
        if (error.message !== 'Unauthorized or Session Expired') {
            console.error('Error updating task status. Drag-and-drop failed. Reverting board state.', error);
            showBoardMessage(`Drag-and-drop failed: ${error.message}. Reloading tasks.`, true);
            // On failure, reload tasks to revert the visual change
            loadTasks(); 
        }
    }
}

// --- Drag and Drop Handlers ---

let draggedElement = null;

function handleDragStart(event) {
    // Store the task card being dragged
    draggedElement = event.target; 
    // Store the ID in dataTransfer for the drop handler
    event.dataTransfer.setData('text/plain', event.target.dataset.id);
    // Apply dragging style immediately
    setTimeout(() => event.target.classList.add('dragging'), 0); 
}

function handleDragEnd(event) {
    // Clean up style after drag finishes (regardless of drop success)
    event.target.classList.remove('dragging');
}

function handleDragOver(event) {
    event.preventDefault(); // Crucial: allows an element to be dropped
    const columnContent = event.currentTarget;
    columnContent.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

async function handleDrop(event) {
    event.preventDefault();
    const columnContent = event.currentTarget;
    columnContent.classList.remove('drag-over');

    const taskId = event.dataTransfer.getData('text/plain');
    const newStatus = columnContent.dataset.status;

    if (draggedElement && draggedElement.dataset.status !== newStatus) {
        // 1. Visually move the element to the new column
        columnContent.appendChild(draggedElement);
        
        // 2. Update the status in the database
        await updateTaskStatus(taskId, newStatus);
    }
    // Clean up the dragged element reference
    draggedElement = null;
}

// --- Initialization and Event Listeners ---

function init() {
    // Apply theme preference from localStorage immediately
    applyTheme(currentTheme); 
    
    // Set up all event listeners
    authForm.addEventListener('submit', handleAuth);
    toggleAuthButton.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        authTitle.textContent = isRegisterMode ? 'Register' : 'Login';
        authButton.textContent = isRegisterMode ? 'Register' : 'Log In';
        toggleAuthButton.textContent = isRegisterMode ? 'Already have an account? Login' : 'Need an account? Register';
        authMessage.classList.add('hidden'); // Clear message on toggle
    });
    
    // Theme Toggle listener
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Task Modal handlers
    addTaskBtn.addEventListener('click', () => {
        resetTaskModal(); // Ensure it's in creation mode
        taskModal.classList.remove('hidden');
    });
    cancelTaskBtn.addEventListener('click', () => {
        taskModal.classList.add('hidden');
        resetTaskModal();
    });
    // Use the new handler for both create and update
    newTaskForm.addEventListener('submit', handleTaskFormSubmit);

    // Add drag and drop listeners to columns
    Object.values(columns).forEach(col => {
        col.addEventListener('dragover', handleDragOver);
        col.addEventListener('dragleave', handleDragLeave);
        col.addEventListener('drop', handleDrop);
    });

    // Check if user is already logged in on page load
    if (currentToken) {
        // Minimal decoding to get username for display
        try {
            // JWT payload is the middle part, base64 decoded
            const payload = JSON.parse(atob(currentToken.split('.')[1]));
            currentUserId = payload.id;
            updateAuthStatus(payload.username);
            toggleBoardView(true);
            loadTasks();
        } catch (e) {
            console.error("Invalid token in localStorage, forcing logout.", e);
            handleLogout(true);
        }
    } else {
        toggleBoardView(false);
    }
}

// Wait for the DOM to be fully loaded before running init()
window.onload = init;