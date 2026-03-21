import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import path from 'path';
import 'dotenv/config';
import connectDB from './config/db.js';
import { ENV } from './config/env.js';
import configurePassport from './config/passport.js';
import authRouter from './routes/authRoutes.js';
import signUpRouter from './routes/signUpRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import forgotPasswordRoutes from './routes/forgotPasswordRoutes.js';
import resetPasswordRoutes from './routes/resetPasswordRoutes.js';
import { logout } from './controllers/authcontroller.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.resolve();
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (ENV.FRONTEND_URL) {
  app.use(cors({ origin: ENV.FRONTEND_URL, credentials: true }));
}

if (ENV.isProduction) {
  app.set('trust proxy', 1);
}

const sessionCookieSettings = {
  secure: ENV.SESSION_COOKIE_SECURE,
  sameSite: ENV.SESSION_COOKIE_SECURE ? 'none' : 'lax'
};

app.use(
  session({
    secret: ENV.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: sessionCookieSettings
  })
);

configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRouter);
app.use('/api/register', signUpRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/forgot-password', forgotPasswordRoutes);
app.use('/api/reset-password', resetPasswordRoutes);

app.get('/api/logout', logout);

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

if (ENV.isProduction) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get(/^\/.*$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log(`Server listening on port ${ENV.PORT}`);
  });
};

startServer();
