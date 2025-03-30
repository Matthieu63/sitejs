// server.js
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const dotenv = require('dotenv');
const { initVocabDb } = require('./models/Vocab');

// Charger les variables d'environnement
dotenv.config();

// Importer les routes
const vocabRoutes = require('./routes/vocabRoutes');
const pollyRoutes = require('./routes/pollyRoutes');
const storiesRoutes = require('./routes/storiesRoutes');
const dialoguesRoutes = require('./routes/dialoguesRoutes');

// Initialiser l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration de EJS comme moteur de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour traiter les requêtes JSON et les données de formulaire
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware pour les sessions et les messages flash
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(flash());

// Middleware pour rendre les messages flash disponibles dans toutes les vues
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

// Middleware pour les fichiers statiques
app.use('/static', express.static(path.join(__dirname, 'public', 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Simulation de l'authentification (à remplacer par votre propre système d'auth)
app.use((req, res, next) => {
  if (!req.session.user) {
    req.session.user = 1; // ID utilisateur simulé pour le développement
  }
  next();
});

// Enregistrement des routes
app.use('/espagnol', vocabRoutes);
app.use('/espagnol/api/polly', pollyRoutes);
app.use('/espagnol/stories', storiesRoutes);
app.use('/espagnol/dialogues', dialoguesRoutes);

// Route racine
app.get('/', (req, res) => {
  res.redirect('/espagnol');
});

// Middleware pour les erreurs 404
app.use((req, res, next) => {
  res.status(404).render('error', {
    message: 'Page non trouvée',
    error: { status: 404 }
  });
});

// Middleware pour les erreurs 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).render('error', {
    message: err.message || 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Initialiser la base de données
initVocabDb()
  .then(() => {
    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
      console.log(`L'application est accessible sur http://localhost:${PORT}/espagnol`);
    });
  })
  .catch(err => {
    console.error('Erreur lors de l\'initialisation de la base de données:', err);
    process.exit(1);
  });