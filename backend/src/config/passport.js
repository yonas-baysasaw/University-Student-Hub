import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { ENV } from './env.js';
import {
  findByIdentifier,
  findOrLinkGoogleUser,
  getUserById
} from '../services/userService.js';

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
    new LocalStrategy({ usernameField: 'identifier' }, async (identifier, password, done) => {
      try {
        const user = await findByIdentifier(identifier);
        if (!user) {
          return done(null, false, { message: 'User not found' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return done(null, false, { message: 'Invalid credentials' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.use(
    new GoogleStrategy(
      {
        clientID: ENV.GOOGLE_CLIENT_ID,
        clientSecret: ENV.GOOGLE_CLIENT_SECRET,
        callbackURL: ENV.GOOGLE_CALLBACK_URL
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          if (!profile.id) return done(new Error('Missing Google profile ID'));
          const user = await findOrLinkGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
};

export default configurePassport;
