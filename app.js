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
// dbInit.initAllDatabases() supprimé — on initialise par utilisateur
const adminRoutes = require('./routes/adminRoutes');
const vocabRoutes = require('./routes/vocabRoutes');
const dialoguesRoutes = require('./routes/dialoguesRoutes');
const storiesRoutes = require('./routes/storiesRoutes');
const pollyRoutes = require('./routes/pollyRoutes');

// Initialiser l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du moteur de vue EJS (équivalent à Jinja2)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour analyser les requêtes
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(methodOverride('_method'));

// Configurer les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de la session
app.use(session({
  secret: process.env.SESSION_SECRET || 'changez_cette_valeur_en_prod',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Middleware pour rendre les variables de session disponibles dans les vues
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Enregistrer les routes

app.use('/admin', adminRoutes);
app.use('/espagnol', vocabRoutes);
app.use('/espagnol/dialogues', dialoguesRoutes);
app.use('/espagnol/stories', storiesRoutes);
app.use('/espagnol/api/polly', pollyRoutes);

// Route principale
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  initUserDatabase(req.session.user);
  
  // Charger les utilisateurs depuis le JSON
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users[req.session.user];
  
  res.render('index', { user });
});

// Route pour le dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  initUserDatabase(req.session.user);
  
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users[req.session.user];
  
  res.render('dashboard', { user });
});

// Route admin
app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/dashboard');
  }
  
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  
  res.render('admin', { users });
});

// Route pour l'espagnol
app.get('/espagnol', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  initUserDatabase(req.session.user);
  
  const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  const user = users[req.session.user];
  
  if (!user.access.languages.includes('espagnol')) {
    return res.status(403).send('Accès refusé');
  }
  
  // Initialiser la clé 'data' si elle n'existe pas encore
  if (!user.data) {
    user.data = {};
  }
  if (!user.data.espagnol) {
    user.data.espagnol = {};
  }
  
  // Sauvegarder les modifications
  users[req.session.user] = user;
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  
  res.render('espagnol/index', { user });
});

// Gérer les erreurs 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page non trouvée' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  
  // Créer le fichier utilisateurs par défaut s'il n'existe pas
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