require('dotenv').config();

const chalk = require('chalk');
console.log(chalk.bgBlack.white('Starting app...'));

console.log(chalk.bgYellow.black('Loading packages...'));
var createError = require('http-errors');
var express = require('express');
const session = require('express-session');
var path = require('path');
const favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const mongoose = require('mongoose');
const passport = require('passport');
const uuid = require('uuid');
const TwitterStrategy = require('passport-twitter').Strategy;
const User = require('./models/user.js'); // Mongoose 'User' model

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

console.log(chalk.bgYellow.black('Loading settings...'));
var port = process.env.PORT || 8080;
var app = express();
app.locals.title = 'Build a Nightlife Coordination App';

console.log(chalk.bgBlue.white('Checking for environment setup...'));
if (typeof process.env.YELP_CONSUMER_KEY === 'undefined') {
  console.log('No environment setup. Loading environment from config...');
  require('./config/config.js');
  console.log('Checking again for environment...');
  if (typeof process.env.APP_ENV !== 'undefined') {
    app.set('env', process.env.APP_ENV);
  }
  if (typeof process.env.YELP_CONSUMER_KEY === 'undefined') {
    console.log(chalk.bgRed.black('No environment found. Exiting...'));
    process.exit();
  }
}

console.log(chalk.bgGreen.black('Environment found.'));
console.log(`Checking for ${chalk.bgRed.white('Yelp API')} settings...`);
if (
  typeof process.env.YELP_CONSUMER_KEY !== 'string' ||
  typeof process.env.YELP_CONSUMER_SECRET !== 'string' ||
  typeof process.env.YELP_TOKEN !== 'string' ||
  typeof process.env.YELP_TOKEN_SECRET !== 'string'
) {
  console.log(chalk.bgRed.black('Required Yelp settings missing. Exiting...'));
  process.exit();
} else {
  console.log(chalk.bgGreen.black('All Yelp settings defined.'));
}

console.log(`Checking for ${chalk.bgBlue.white('Twitter API')} settings...`);
if (
  typeof process.env.TWITTER_CONSUMER_KEY !== 'string' ||
  typeof process.env.TWITTER_CONSUMER_SECRET !== 'string' ||
  typeof process.env.CALLBACK_URI !== 'string'
) {
  console.log(chalk.bgRed.black('Required Twitter settings missing. Exiting...'));
  process.exit();
} else {
  console.log(chalk.bgGreen.black('All Twitter settings defined.'));
}

console.log(`Initializing ${chalk.bgGreen.white('Passport')}...`);
TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY;
TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET;
CALLBACK_URI = process.env.CALLBACK_URI;

app.use(session({
  genid: req => {
    return uuid.v4(); // 'uuid' module
  },
  resave: true,
  saveUninitialized: true,
  secret: 'tacos'
}));

app.use(passport.initialize());
app.use(passport.session()); // Passport piggybacks off the Express session (above)

// Passport serialization and deserialization -- (move to another file, once working, and add lookup/insertion from Mongo)
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new TwitterStrategy({
  consumerKey: TWITTER_CONSUMER_KEY,
  consumerSecret: TWITTER_CONSUMER_SECRET,
  callbackURL: CALLBACK_URI,
  passReqToCallback: true // Allows stuff like username to be in the req
}, (req, token, tokenSecret, profile, callback) => {
  process.nextTick(() => { //Asynchronous
    // Find or Create
    console.log(chalk.bgBlack.yellow('Searching for user ID ') + profile.id);
    User.findOne({
      provider: 'twitter',
      id: profile.id
    }, (err, user) => {
      console.log(chalk.bgBlack.yellow('User callback'));
      if (err) {
        console.log(chalk.bgBlack.red(`Error: ${err}`));
        callback(err);
      }
      if (user) { // We found the user
        console.log(chalk.bgBlack.green('User found'));
        return callback(null, user);
      } else { // User does not exist
        console.log(chalk.bgWhite.black('User does not exist, yet'));
        var newUser = new User({
          provider: 'twitter',
          id: profile.id,
          token: token,
          username: profile.username
        });
        // Since newUser is a Mongoose schema from User, it has its own save method
        newUser.save((err, newUser, numAffected) => {
          if (err) {
            console.error(err);
          }
          console.log(`Num affected: ${numAffected}`);
          return callback(null, newUser);
        });
      }
    });
  });
}));

// The Yelp settings must be defined BEFORE requiring the routes, as the routes use those settings.
console.log(chalk.bgYellow.black('Loading routes...'));

// view engine setup
console.log(chalk.bgYellow.black('Loading view engine and views...'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

console.log(chalk.bgYellow.black('Loading middleware...'));
app.use(favicon(path.join(__dirname, 'public/images', 'favicon.ico')));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// development error handler
// will print stacktrace
console.log(chalk.bgBlue.white(`Environment setting is ${app.get('env')}.`));
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log(chalk.bgYellow.black('Connecting to MongoDB...'));
mongoose.connect(process.env.MONGO_URI);
global.db = mongoose.connection;

global.db.on('error', error => {
  console.error('Mongoose connection error: ');
  console.dir(error);
});

global.db.once('open', () => {
  console.log(chalk.bgGreen.black('Connected to MongoDB.'));
  app.listen(port, () => {
    console.log(chalk.bgGreen.black(`Listening on port ${port}.`));
  });
});

module.exports = app;
