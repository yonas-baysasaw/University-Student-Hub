import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import {
  findByIdentifier,
  findOrLinkGoogleUser,
  getUserById,
} from '../services/userService.js';
import { ENV } from './env.js';

const configurePassport = () => {
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUserById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  passport.use(
    new LocalStrategy(
      { usernameField: 'identifier' },
      async (identifier, password, done) => {
        try {
          const user = await findByIdentifier(identifier);
          if (!user) {
            return done(null, false, { message: 'User not found' });
          }
          if (!user.password) {
            return done(null, false, { message: 'Invalid credentials' });
          }
          const match = await bcrypt.compare(password, user.password);
          if (!match) {
            return done(null, false, { message: 'Invalid credentials' });
          }
          if (user.role === 'admin') {
            return done(null, user);
          }
          if (user.email_verified === false) {
            return done(null, false, {
              message:
                'VERIFY_EMAIL: Please verify your email before signing in. You can resend the confirmation email from the sign-in page.',
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: ENV.GOOGLE_CLIENT_ID,
        clientSecret: ENV.GOOGLE_CLIENT_SECRET,
        callbackURL: ENV.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          if (!profile.id) return done(new Error('Missing Google profile ID'));
          const user = await findOrLinkGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
};

export default configurePassport;
