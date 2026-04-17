# University Student Hub

A full-stack web app for university students to collaborate in real time, share books/resources, and manage classroom discussions.

## Features

- Authentication with local login and Google OAuth
- Classroom creation and joining with chat support
- Real-time messaging with Socket.IO (typing/read receipts/presence)
- Library with searchable shared books
- Book upload to AWS S3
- Automatic PDF first-page cover thumbnail generation on upload
- Profile page with activity stats and shared books
- Password reset via email

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

## Prerequisites

- Node.js 20+
- npm
- MongoDB connection string
- AWS S3 bucket + credentials
- Google OAuth credentials (optional but recommended)
- Gmail app password (for password reset emails)

## Environment Variables

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_session_secret
MONGODB_URL=mongodb://127.0.0.1:27017/university-student-hub

FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_s3_bucket_name
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

Optional (supported by code):

- `MONGODB_URI` (alternative to `MONGODB_URL`)
- `VITE_API_TARGET` in `frontend/.env` for Vite API proxy target

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
