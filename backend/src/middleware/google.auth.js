import session from 'express-session';
app.use(passport.initialize());
app.use(passport.session());



// Configure sessions for OAuth 2.0
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: ENV.NODE_ENV === 'production' }
}));