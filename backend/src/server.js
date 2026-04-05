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
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import uploadRoutes  from './routes/uploadRoutes.js'
import fs from 'fs'

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
  })
);
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

function ensureUploadDirectoryExists() {
    if (!fs.existsSync('profile picture')) {
        fs.mkdirSync('profile picture')
    }
}


app.use('/api/auth', authRoutes);
app.use('/api/register', signUpRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/forgot-password', forgotPasswordRoutes);
app.use('/api/reset-password', resetPasswordRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/upload', uploadRoutes)

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

server.on('error', error => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${ENV.PORT} is already in use. Stop the process using that port or change PORT in backend/.env.`);
    process.exit(1);
  }

  console.error('Server error', error);
  process.exit(1);
});

const start = async () => {
  await connectDB();

  await initSocketServer(server, sessionMiddleware);
  ensureUploadDirectoryExists()
  server.listen(ENV.PORT, () => {

    console.log(`Server listening on port ${ENV.PORT}`);
  });
};

start().catch(error => {
  console.error('Failed to start server', error);
  process.exit(1);
});
