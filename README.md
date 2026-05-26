# University Student Hub

A full-stack university collaboration platform that enables students to communicate in real time, share academic resources, upload and download books, participate in classroom discussions, and work together on projects through an interactive online environment.

## Features

- Secure authentication system with traditional email/password login and Google OAuth integration
- Classroom creation and enrollment functionality with integrated real-time group chat support
- Instant messaging system powered by Socket.IO featuring typing indicators, online presence tracking, and read receipts
- Digital library module with advanced search functionality for shared books and academic resources
- Cloud-based book and document upload system using AWS S3 storage services
- Automatic generation of PDF cover thumbnails by extracting the first page during file upload
- Personalized student profile pages displaying activity statistics, uploaded resources, and shared books
- Secure password recovery and reset functionality through email verification

## Tech Stack

- Frontend: React, Vite, React Router, Tailwind CSS
- Backend: Node.js, Express, Passport, Socket.IO
- Database: MongoDB + Mongoose
- Storage: AWS S3
- Email: Nodemailer (Gmail SMTP)

## Project Structure

```text
University-Student-Hub/
├── frontend/   # React client
├── backend/    # Express API + Socket server
└── README.md
```
A full-stack web application for university students to collaborate, communicate, and share resources in real-time.

## Overview

University Student Hub is a collaborative platform that enables students to:
- Create and join classroom groups
- Chat in real-time with group members
- Share announcements and resources
- Access a shared library of books and materials
- Collaborate with students in an interactive online environment
- Support academic discussions and resource management

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
- **Administrator console** (`/admin`, `ADMIN_EMAILS`): Moderation UI for instructors/students (read-only locks) and library deletion; administrators bypass platform write restrictions when applied

## Prerequisites

- Node.js 20+
- npm
- MongoDB connection string
- Google OAuth credentials (optional but recommended)
- Gmail app password (for password reset emails)

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_session_secret
MONGODB_URL=mongodb://127.0.0.1:27017/university-student-hub

# Must match where users load the SPA. Production must be your real HTTPS origin or links in signup/reset emails fail.
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# Gmail + App Password (2-Step Verification on). EMAIL_FROM improves the display name in inboxes.
EMAIL_USER=university.students.hub.et1@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM="University Student Hub <university.students.hub.et1@gmail.com>"

AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_s3_bucket_name
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Optional: comma-separated existing-user emails promoted to role admin on each server start (no auto-demotion)
# ADMIN_EMAILS=admin@university.edu

# Legacy (deprecated): if ADMIN_EMAILS is empty, STAFF_EMAILS is still read once with a startup warning
# STAFF_EMAILS=legacy@university.edu
```

Optional (supported by code):

- `MONGODB_URI` (alternative to `MONGODB_URL`)
- `VITE_API_TARGET` in `frontend/.env` for Vite API proxy target
- `ADMIN_EMAILS` — comma-separated user emails (lowercase) promoted to `role: admin` on each server start (users are not demoted when removed from this list)
- `STAFF_EMAILS` — deprecated alias used only when `ADMIN_EMAILS` is unset
- `ADMIN_REGISTRATION_SECRET` — invite key for `/admin/signup` when an administrator already exists

One-time DB migration if you previously used role `staff` (before removing it from the schema):

```bash
node backend/scripts/migrate-staff-to-admin.mjs
```

(Run from the repository root; requires `MONGODB_URL` / `MONGODB_URI` in env.)

Alternatively:

```bash
npm run migrate-staff-to-admin --prefix backend
```

## Installation

From project root:

```bash
npm install --prefix backend
npm install --prefix frontend
```

## Running Locally

1. Start backend:

```bash
npm run dev --prefix backend
```

2. Start frontend (new terminal):

```bash
npm run dev --prefix frontend
```

3. Open:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

## Build & Production

From root:

```bash
npm run build
npm start
```

This builds the frontend and starts the backend server, which also serves `frontend/dist` in production mode.

## Main API Routes

- Auth: `/api/auth`
  - `POST /login`
  - `GET /logout`
  - `GET /google`
  - `GET /google/callback`
- Register: `/api/register`
  - `POST /`
- Profile: `/api/profile`
  - `GET /`
  - `GET /activity`
  - `PUT /`
  - `DELETE /`
- Password reset:
  - `POST /api/forgot-password`
  - `POST /api/reset-password/:token`
- Chats: `/api/chats`
  - `POST /`
  - `POST /join`
  - `GET /`
  - `GET/POST /:chatId/messages`
- Presence:
  - `GET /api/presence/online`
- Upload:
  - `POST /api/upload/profile`
  - `POST /api/upload/file`
- Books:
  - `GET /api/books`
  - `GET /api/books/:bookId`
  - `POST /api/books`
  - `PATCH /api/books/:bookId`
  - `DELETE /api/books/:bookId`

## Frontend Routes

- `/` About/Landing (or Home for logged-in users)
- `/login`, `/signup`
- `/password/reset`, `/reset-password/:token`
- `/classroom`
- `/classroom/:chatId`
- `/classroom/:chatId/announcements`
- `/classroom/:chatId/resources`
- `/library`
- `/library/:bookId` (book detail page)
- `/profile`

## Notes

- The upload middleware currently accepts `application/*` files for books.
- PDF cover thumbnails are generated on upload when PDF rendering dependencies are available.
- If cover generation fails, upload still succeeds and the app shows a fallback “No cover”.
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
ush - 2026
