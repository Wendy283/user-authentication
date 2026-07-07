const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { ObjectId } = require('mongodb');

const db = require('../data/database');

const router = express.Router();

router.get('/', function (req, res) {
  res.render('welcome');
});

router.get('/signup', function (req, res) {
  let sessionInputData = req.session.inputData;

  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      email: '',
      confirmedEmail: '',
      password: ''
    };
  }

  req.session.inputData = null;

  res.render('signup', { inputData: sessionInputData });
});

router.get('/login', function (req, res) {
  res.render('login');
});

router.post('/signup', async function (req, res) {
  const userData = req.body;

  const enteredEmail = userData.email;
  const enteredConfirmedEmail = userData['confirm-email'];
  const enteredPassword = userData.password;

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
    console.log('User not found');
    return res.redirect('/login');
  }

  const passwordsAreEqual = await bcrypt.compare(
    enteredPassword,
    existingUser.password
  );

  if (!passwordsAreEqual) {
    console.log('Wrong password');
    return res.redirect('/login');
  }

  req.session.user = {
    id: existingUser._id.toString(),
    email: existingUser.email
  };

  req.session.isAuthenticated = true;

  req.session.save(function (err) {
    if (err) {
      console.log(err);
      return res.redirect('/login');
    }

    res.redirect('/profile');
  });
});

router.get('/profile', function (req, res) {
  if (!req.session.isAuthenticated) {
    return res.status(401).render('401');
  }

  res.render('profile');
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

  res.render('admin');
});

router.post('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.log(err);
    }

    res.redirect('/');
  });
});

module.exports = router;