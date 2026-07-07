const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const db = require('../data/database');

const router = express.Router();

router.get('/', function (req, res) {
  res.render('welcome');
});

router.get('/signup', function (req, res) {
  res.render('signup');
});

router.get('/login', function (req, res) {
  res.render('login');
});

router.post('/signup', async function (req, res) {
  const userData = req.body;
  const enteredEmail = userData.email;
  const enteredConfirmedEmail = userData['confirm-email'];
  const enteredPassword = userData.password;

  // FIX: Added .length to the password validation
  if (
    !enteredEmail ||
    !enteredConfirmedEmail ||
    !enteredPassword ||
    enteredPassword.trim().length < 6 ||
    enteredEmail !== enteredConfirmedEmail ||
    !enteredEmail.includes('@')
  ) {
     console.log('Incorrect input data');
     return res.redirect('/signup');
  }

  const existingUser = await db 
     .getDb()
     .collection('users')
     .findOne({ email: enteredEmail });

     if(existingUser) {
      console.log('User exists already');
      return res.redirect('/signup');
     }

  const hashedPassword = await bcrypt.hash(enteredPassword, 12);

  const user = {
    email: enteredEmail,
    password: hashedPassword
  };

  await db.getDb().collection('users').insertOne(user);

  res.redirect('/login');
});

router.post('/login', async function (req, res) {
  const userData = req.body;
  const enteredEmail = userData.email;
  const enteredPassword = userData.password;

  const existingUser = await db
    .getDb()
    .collection('users')
    .findOne({ email: enteredEmail });

  if(!existingUser) {
    console.log('Could not log in - user not found');
    return res.redirect('/login');
  }
  
  // FIX: Fixed the typo 'passwordsAreEqaul' -> 'passwordsAreEqual'
  const passwordsAreEqual = await bcrypt.compare(
    enteredPassword,
    existingUser.password
  );

  if (!passwordsAreEqual) {
    console.log('Could not log in - wrong password');
    return res.redirect('/login');
  }

  req.session.user = { id: existingUser._id, email: existingUser.email };
  req.session.isAuthenticated = true;

  console.log('=== BEFORE REDIRECT ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session Data:', req.session);

  return req.session.save(function (err) {
    if (err) {
      console.log('Session save error:', err);
      return res.redirect('/login');
    }
    res.redirect('/admin');
  });
});

router.get('/admin', function (req, res) {
  console.log('=== INSIDE ADMIN ROUTE ===');
  console.log('Session ID incoming:', req.sessionID);
  console.log('Session Data incoming:', req.session);

  if (!req.session.isAuthenticated) {
    console.log('Authentication failed - Redirecting to 401');
    return res.status(401).render('401');
  }
  res.render('admin');
});
// FIX: Implemented the logout functionality
router.post('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.log('Error logging out:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;