# University Student Hub

A full-stack web application for university students to collaborate, communicate, and share resources in real-time.

## Overview

University Student Hub is a collaborative platform that enables students to:
- Create and join classroom groups
- Chat in real-time with group members
- Share announcements and resources
- Access a shared library of books and materials

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | React 19, React Router, Tailwind CSS, DaisyUI |
| Backend | Node.js, Express 5 |
| Database | MongoDB, Mongoose ODM |
| Real-time | Socket.io |
| Auth | Passport.js (Local + Google OAuth) |
| Storage | AWS S3 |
| Build | Vite |

## Features

- **Authentication**: Email/password registration and login
- **Classrooms**: Create groups, invite members via code
- **Real-time Chat**: Instant messaging within classrooms
- **Announcements**: Post updates visible to all group members
- **File Sharing**: Upload and share resources (images, documents)
- **Presence**: See who's online in real-time
- **Library**: Manage and access shared books/materials

## Prerequisites

- Node.js 20+
- Docker (for MongoDB)
- npm or yarn

## Quick Start

### 1. Start MongoDB

```bash
docker run -d -p 27017:27017 --name universityhub-mongo \
  -v mongo-data:/data/db mongo:9
```

### 2. Environment Variables

Copy the example environment file and configure:

```bash
cp backend/.env.example backend/.env
```

Edit `.env` and fill in the required values.

### 3. Install Dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 4. Run the Application

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Access the app at **http://localhost:5173**

## Project Structure

```
university-student-hub/
├── backend/
│   └── src/
│       ├── config/         # Configuration (DB, env, passport)
│       ├── controllers/  # Request handlers
│       ├── middlewares/   # Express middleware
│       ├── models/       # Mongoose schemas
│       ├── routes/       # API routes
│       ├── services/     # Business logic
│       ├── socket/      # Socket.io handlers
│       └── server.js    # Entry point
├── frontend/
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── contexts/    # React context providers
│       ├── pages/       # Route pages
│       └── App.jsx      # Main app component
└── package.json         # Root scripts
```

## API Endpoints

| Route | Description |
|-------|-------------|
| `POST /api/auth/login` | Login with credentials |
| `POST /api/auth/logout` | Logout |
| `POST /api/register` | Register new user |
| `POST /api/chats` | Create new classroom |
| `GET /api/chats` | List user's classrooms |
| `POST /api/chats/:id/join` | Join classroom via code |
| `GET /api/chats/:id/messages` | Get chat messages |
| `POST /api/upload` | Upload file to S3 |
| `GET /api/books` | List library books |

## Real-time Events

Socket.io events for chat functionality:
- `joinChat` / `leaveChat` - Join/leave rooms
- `sendMessage` - Send messages
- `typing` / `stopTyping` - Typing indicators
- `markAsRead` - Mark messages as read
- `onlineUsers` / `userOnline` / `userOffline` - Presence

## Deployment

The app is configured for Heroku deployment:

```bash
# Create Heroku app
heroku create university-student-hub

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URL=mongodb+srv://...
heroku config:set SESSION_SECRET=...

# Push to deploy
git push heroku main
```

The `package.json` root script runs the Heroku postbuild hook to build the frontend.

## License

ISC