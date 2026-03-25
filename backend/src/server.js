import http from 'http';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import 'dotenv/config';
import connectDB from './config/db.js';
import { ENV } from './config/env.js';
import configurePassport from './config/passport.js';
import authRoutes from './routes/authRoutes.js';
import signUpRouter from './routes/signUpRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import forgotPasswordRoutes from './routes/forgotPasswordRoutes.js';
import resetPasswordRoutes from './routes/resetPasswordRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import { initSocketServer } from './socket/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.resolve();
const app = express();

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

app.use(helmet());
app.use(
  cors({
    origin: ENV.FRONTEND_URL || true,
    credentials: true,
  })
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

if (ENV.isProduction) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get(/^\/.*$/, (req, res) => {
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

start().catch(error => {
  console.error('Failed to start server', error);
  process.exit(1);
});
