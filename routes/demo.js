const express = require('express');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const db = require('../data/database');

const router = express.Router();

// Custom Middleware: Prevents browsers from caching sensitive form pages
function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

router.get('/', function (req, res) {
  res.render('welcome');
});

router.get('/signup', noCache, function (req, res) {
  if (req.session.isAuthenticated) {
    return res.redirect('/profile');
  }

  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      message: '',
      email: '',
      confirmedEmail: '',
      password: ''
    };
  }

  req.session.inputData = null;

  res.render('signup', {
    inputData: sessionInputData
  });
});

router.get('/login', noCache, function (req, res) {
  if (req.session.isAuthenticated) {
    return res.redirect('/profile');
  }

  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      message: '',
      email: '',
      password: ''
    };
  }

  req.session.inputData = null;

  res.render('login', {
    inputData: sessionInputData
  });
});

router.post('/signup', async function (req, res) {
  const enteredEmail = req.body.email;
  const enteredConfirmedEmail = req.body['confirm-email'];
  const enteredPassword = req.body.password;

  if (
    !enteredEmail ||
    !enteredConfirmedEmail ||
    !enteredPassword ||
    enteredPassword.trim().length < 6 ||
    enteredEmail !== enteredConfirmedEmail ||
    !enteredEmail.includes('@')
  ) {
    req.session.inputData = {
      hasError: true,
      message: 'Invalid input. Please check your data.',
      email: enteredEmail,
      confirmedEmail: enteredConfirmedEmail,
      password: enteredPassword
    };

    return req.session.save(function () {
      res.redirect('/signup');
    });
  }

  const existingUser = await db
    .getDb()
    .collection('users')
    .findOne({ email: enteredEmail });

  if (existingUser) {
    req.session.inputData = {
      hasError: true,
      message: 'User already exists.',
      email: enteredEmail,
      confirmedEmail: enteredConfirmedEmail,
      password: enteredPassword
    };

    return req.session.save(function () {
      res.redirect('/signup');
    });
  }

  const hashedPassword = await bcrypt.hash(enteredPassword, 12);

  await db.getDb().collection('users').insertOne({
    email: enteredEmail,
    password: hashedPassword,
    isAdmin: false
  });

  res.redirect('/login');
});

router.post('/login', async function (req, res) {
  const enteredEmail = req.body.email;
  const enteredPassword = req.body.password;

  const existingUser = await db
    .getDb()
    .collection('users')
    .findOne({ email: enteredEmail });

  if (!existingUser) {
    req.session.inputData = {
      hasError: true,
      message: 'Could not log you in. Please check your credentials.',
      email: enteredEmail,
      password: enteredPassword
    };

    return req.session.save(function () {
      res.redirect('/login');
    });
  }

  const passwordsAreEqual = await bcrypt.compare(
    enteredPassword,
    existingUser.password
  );

  if (!passwordsAreEqual) {
    req.session.inputData = {
      hasError: true,
      message: 'Could not log you in. Please check your credentials.',
      email: enteredEmail,
      password: enteredPassword
    };

    return req.session.save(function () {
      res.redirect('/login');
    });
  }

  // Clear historical form input data completely on successful authentication
  req.session.inputData = null;

  req.session.user = {
    id: existingUser._id.toString(),
    email: existingUser.email
  };
  req.session.isAuthenticated = true;

  req.session.save(function (err) {
    if (err) {
      console.error(err);
      return res.redirect('/login');
    }
    res.redirect('/profile');
  });
});

router.get('/profile', function (req, res) {
  if (!req.session.isAuthenticated) {
    return res.status(401).render('401');
  }

  res.render('profile', {
    user: req.session.user
  });
});

router.get('/admin', async function (req, res) {
  if (!req.session.isAuthenticated) {
    return res.status(401).render('401');
  }

  const user = await db.getDb().collection('users').findOne({
    _id: new ObjectId(req.session.user.id)
  });

  if (!user || !user.isAdmin) {
    return res.status(403).render('403');
  }

  res.render('admin', {
    user: req.session.user
  });
});

router.post('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
});

module.exports = router;