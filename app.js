const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const methodOverride = require('method-override');
const dotenv = require('dotenv');

// Chargement des variables d'environnement
dotenv.config();

// Initialisation de la base de données
const db = require('./config/database');
db.initDatabase();

// Importer les routes
const dbInit = require('./database/dbInit');
const pollyInit = require('./database/pollyInit');
const adminRoutes = require('./routes/adminRoutes');
const vocabRoutes = require('./routes/vocabRoutes');
const dialoguesRoutes = require('./routes/dialoguesRoutes');
const storiesRoutes = require('./routes/storiesRoutes');
const pollyRoutes = require('./routes/pollyRoutes');

// Initialiser l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du moteur de vue EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'changez_cette_valeur_en_prod',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Exposer session à EJS
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Afficher le formulaire de connexion
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});


// Gérer la soumission du formulaire de connexion
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  if (users[username] && users[username].password === password) {
    req.session.user = username;
    req.session.isAdmin = users[username].is_admin || false;
    return res.redirect('/dashboard');
  }
  res.render('login', { error: 'Identifiants incorrects' });
});

// Juste après les middlewares et avant les définitions de routes

// Exposer session à EJS
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Fonction pour initialiser la base de données utilisateur
function initUserDatabase(username) {
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  
  // Vérifier si l'utilisateur existe
  if (!users[username]) {
    return false;
  }
  
  // Initialiser les données utilisateur si nécessaire
  if (!users[username].data) {
    users[username].data = {};
  }
  
  // Enregistrer les modifications
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  return true;
}

// Afficher le formulaire de connexion
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});


// Enregistrer les routes personnalisées
app.use('/admin', adminRoutes);
app.use('/espagnol', vocabRoutes);
app.use('/espagnol/dialogues', dialoguesRoutes);
app.use('/espagnol/stories', storiesRoutes);
app.use('/espagnol/api/polly', pollyRoutes);

// Route principale
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  initUserDatabase(req.session.user);
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users[req.session.user];
  res.render('index', { user });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  initUserDatabase(req.session.user);
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users[req.session.user];
  res.render('dashboard', { user });
});

// Admin page
app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/dashboard');
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  res.render('admin', { users });
});

// Espagnol
app.get('/espagnol', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  initUserDatabase(req.session.user);
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users[req.session.user];

  if (!user.access.languages.includes('espagnol')) {
    return res.status(403).send('Accès refusé');
  }

  if (!user.data) user.data = {};
  if (!user.data.espagnol) user.data.espagnol = {};

  users[req.session.user] = user;
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));

  res.render('espagnol/index', { user });
});

// Gérer les erreurs 404
app.use((req, res) => {
  console.warn(`404 pour : ${req.originalUrl}`);
  res.status(404).render('error', { message: 'Page non trouvée' });
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  if (!fs.existsSync('users.json')) {
    const defaultUsers = {
      "admin": {
        "password": "admin123",
        "is_admin": true,
        "access": {
          "languages": ["français", "espagnol"],
          "modules": ["christ", "culture", "recettes"]
        },
        "data": {}
      }
    };
    fs.writeFileSync('users.json', JSON.stringify(defaultUsers, null, 2));
    console.log('Fichier users.json créé avec un utilisateur admin par défaut');
  }
});

module.exports = app;
