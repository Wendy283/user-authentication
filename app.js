const path = require('path');

const express = require('express');
const session = require('express-session');
const mongodbStore = require('connect-mongodb-session');
const MongoStore = require('connect-mongo');

const db = require('./data/database');
const demoRoutes = require('./routes/demo');

const MongoDBStore = mongodbStore(session);

const app = express();

// 1. Change your store setup to pass an error handler callback
const sessionStore = new MongoDBStore({
  uri: 'mongodb://127.0.0.1:27017',
  databaseName: 'auth-demo',
  collection: 'sessions'
});

// Catch internal store errors
sessionStore.on('error', function(error) {
  console.log('SESSION STORE ERROR:', error);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: 'super-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb://127.0.0.1:27017/auth-demo', // Direct connection string
    collectionName: 'sessions'
  }),
  cookie: {
    secure: false, // set to true if using HTTPS
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// ADDED: Global middleware to pass auth status to all EJS templates automatically
// Don't forget to import ObjectId if it's not already at the top of this file
// Don't forget to import ObjectId if it's not already at the top of this file
const { ObjectId } = require('mongodb'); 

app.use(async function (req, res, next) {
  const user = req.session.user;
  const isAuth = req.session.isAuthenticated;

  // 1. Always initialize defaults so EJS never throws an "undefined" error
  res.locals.isAuth = false;
  res.locals.isAdmin = false;

  // 2. If not logged in, move to the next middleware immediately
  if (!user || !isAuth) {
    return next();
  }
    
  try {
    // FIX: Wrapped user.id in new ObjectId() so MongoDB can match it properly
    const userDoc = await db.getDb().collection('users').findOne({ _id: new ObjectId(user.id) });
    
    if (userDoc) {
      res.locals.isAuth = isAuth;
      res.locals.isAdmin = !!userDoc.isAdmin; // Double bang !! ensures a clean boolean true/false
    } else {
      // Optional: If session exists but user was deleted from DB, clear session
      req.session.user = null;
      req.session.isAuthenticated = false;
    }
    
    next();
  } catch (error) {
    // 4. Always handle async errors in Express middleware to prevent hanging requests
    next(error);
  }
});
app.use(demoRoutes);

app.use(function(error, req, res, next) {
  console.error(error); // Log the actual error to your terminal so you can debug it!
  res.status(500).render('500');
});

db.connectToDatabase().then(function () {
  app.listen(3000, () => {
    console.log('Server is running on port 3000 and connected to DB!');
  });
});