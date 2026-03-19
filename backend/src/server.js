import express from 'express';
import passport from 'passport';
import 'dotenv/config';
import session from 'express-session';
import mongoose from 'mongoose';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';

import User from './models/User.js';
import connectDB from './config/db.js';

import authRouter from './routes/authRoutes.js';
import signUpRouter from './routes/signUpRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import forgotPasswordRoutes from './routes/forgotPasswordRoutes.js';
import resetPasswordRoutes from './routes/resetPasswordRoutes.js';
import { ENV } from './config/env.js';
import path from "path";



const __dirname = path.resolve();
const app = express();
app.use(express.json());

connectDB();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

/* ===== Passport Serialize / Deserialize ===== */
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

/* ===== Google Strategy ===== */
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: ENV.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    if (!profile.id) return done(new Error("Google profile ID missing"));
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        provider: 'google',
        profile
      });
      console.log("New Google user created");
    }
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

/* ===== Local Strategy ===== */
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username });
    if (!user) return done(null, false, { message: "User not found" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return done(null, false, { message: "Wrong password" });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

/* ===== Routes ===== */
app.use('/api/auth', authRouter);
app.use('/api/register', signUpRouter);
app.use('/api/profile', profileRoutes);
app.use('/api/forgot-password', forgotPasswordRoutes);
app.use('/api/reset-password', resetPasswordRoutes);

app.get('/api/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "Success" });
});
// make our app ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("/{*any}", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

const startServer = async () => {
  await connectDB();
  app.listen(ENV.PORT, () => {
    console.log("Server is up and running");
  });
};

startServer();

