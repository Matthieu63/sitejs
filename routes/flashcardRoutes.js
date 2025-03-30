const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('espagnol/flashcard'); // Vue à créer
});

module.exports = router;
