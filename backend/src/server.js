import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from 'passport';
import 'dotenv/config';
import connectDB from './config/db.js';
import { ENV } from './config/env.js';
import configurePassport from './config/passport.js';
import { getAllBooks, getBookById } from './controllers/libraryController.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import examRoutes from './routes/examRoutes.js';
import forgotPasswordRoutes from './routes/forgotPasswordRoutes.js';
import booksRoutes from './routes/libraryRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import resetPasswordRoutes from './routes/resetPasswordRoutes.js';
import signUpRouter from './routes/signUpRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { initSocketServer } from './socket/index.js';

const __dirname = path.resolve();
const app = express();
const s3ImageOrigin =
  ENV.AWS_BUCKET_NAME && ENV.AWS_REGION
    ? `https://${ENV.AWS_BUCKET_NAME}.s3.${ENV.AWS_REGION}.amazonaws.com`
    : null;

const sessionCookieSettings = {
  secure: ENV.SESSION_COOKIE_SECURE,
  sameSite: ENV.SESSION_COOKIE_SECURE ? 'none' : 'lax',
};

const sessionMiddleware = session({
  secret: ENV.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: sessionCookieSettings,
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: [
          "'self'",
          'data:',
          ...(s3ImageOrigin ? [s3ImageOrigin] : []),
          'https://lh3.googleusercontent.com',
          'https://*.googleusercontent.com',
        ],
      },
    },
  }),
);
app.use(
  cors({
    origin: ENV.FRONTEND_URL || true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use('/api/auth', authRoutes);
app.use('/api/register', signUpRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/forgot-password', forgotPasswordRoutes);
app.use('/api/reset-password', resetPasswordRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/exams', examRoutes);
app.get('/api/books', getAllBooks);
app.get('/api/books/:bookId', getBookById);
app.use('/api/books', booksRoutes);

if (ENV.isProduction) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get(/^\/.*$/, (_req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

const start = async () => {
  await connectDB();

  await initSocketServer(server, sessionMiddleware);
  server.listen(ENV.PORT, () => {
    console.log(`Server listening on port ${ENV.PORT}`);
  });
};

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
