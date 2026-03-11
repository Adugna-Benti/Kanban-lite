# Kanban Lite

A lightweight Kanban task board with user authentication. Drag-and-drop tasks across **To Do**, **In Progress**, and **Done** columns. Built with a vanilla JS + Tailwind frontend and an Express + PostgreSQL backend.

## Features

- **Auth**: Register / login with JWT; tasks are scoped per user
- **Tasks**: Create, edit, delete; set title, description, priority (Low/Medium/High), status
- **Board**: Three columns (To Do, In Progress, Done); move tasks by changing status
- **UI**: Responsive layout, dark/light theme toggle (Tailwind)

## Tech Stack

| Layer   | Stack |
|--------|--------|
| Frontend | HTML, vanilla JS, Tailwind CSS (CDN) |
| Backend  | Node.js, Express 5 |
| Auth     | JWT, bcrypt |
| Database | PostgreSQL (pg driver) |

## Project Structure

```
Kanban-lite-main/
├── client/           # Static frontend
│   ├── index.html
│   ├── app.js
│   └── style.css
├── server/           # Express API
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   │   ├── auth.js   # POST /auth/register, /auth/login
│   │   └── tasks.js  # CRUD /tasks (JWT-protected)
│   └── middleware/
│       └── auth.js   # JWT verification
└── README.md
```

## Setup

### 1. PostgreSQL

Create a database and run the following SQL (adjust if you already have `users`/`tasks`):

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'Medium',
  status VARCHAR(50) DEFAULT 'todo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Server

```bash
cd server
npm install
```

Create `server/.env`:

**Local (individual vars):**

```env
PORT=5000
JWT_SECRET=your-secret-key-min-32-chars
PG_HOST=localhost
PG_DATABASE=kanban_lite
PG_USER=postgres
PG_PASSWORD=your-password
PG_PORT=5432
```

**Production (e.g. Render):** set `DATABASE_URL`; the app uses it with SSL when present.

Run:

```bash
npm run dev
```

Server runs at `http://localhost:5000` (or your `PORT`).

### 3. Client

Point the client at your API. In `client/app.js`, set:

```js
const API_BASE_URL = 'http://localhost:5000';  // or your deployed server URL
```

Open `client/index.html` in a browser (or serve the `client` folder with any static server).

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/auth/register` | No  | Register; returns `token`, `user` |
| POST   | `/auth/login`    | No  | Login; returns `token`, `user` |
| GET    | `/tasks`         | JWT | List current user's tasks |
| GET    | `/tasks/:id`     | JWT | Get one task |
| POST   | `/tasks`         | JWT | Create task |
| PUT    | `/tasks/:id`     | JWT | Update task |
| DELETE | `/tasks/:id`     | JWT | Delete task |

Send JWT in header: `Authorization: Bearer <token>`.
