const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const methodOverride = require('method-override');
const dotenv = require('dotenv');

// Chargement des variables d'environnement
dotenv.config();

// Définir le chemin du fichier users.json
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname);
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Initialisation de la base de données SQLite (commenté car on utilise PostgreSQL)
// const db = require('./config/database');
// db.initDatabase();

// Initialisation de la base de données PostgreSQL
const pg = require('./config/postgres');

// Tester la connexion PostgreSQL
pg.pool.connect()
  .then(() => console.log('Application connectée à PostgreSQL'))
  .catch(err => console.error('Erreur de connexion à PostgreSQL:', err));

// Importer les routes
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

app.set('trust proxy', 1);


// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
const flash = require('connect-flash');

// Ajoutez ceci après la configuration de session
app.use(flash());

// Exposer flash à EJS
app.use((req, res, next) => {
  res.locals.flash = req.flash();
  res.locals.session = req.session;
  next();
});

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

// Fonction pour initialiser la base de données utilisateur
function initUserDatabase(username) {
  try {
    // Vérifier si le fichier existe
    if (!fs.existsSync(USERS_FILE)) {
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
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
      console.log(`Fichier ${USERS_FILE} créé avec un utilisateur admin par défaut`);
    }
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    
    // Vérifier si l'utilisateur existe
    if (!users[username]) {
      console.warn(`Utilisateur ${username} non trouvé dans la base de données`);
      return false;
    }
    
    // Initialiser les données utilisateur si nécessaire
    if (!users[username].data) {
      users[username].data = {};
    }
    
    // Enregistrer les modifications
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'initialisation de la base de données utilisateur: ${error.message}`);
    return false;
  }
}

// Afficher le formulaire de connexion
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Gérer la soumission du formulaire de connexion
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Vérifier si le fichier users.json existe
    if (!fs.existsSync(USERS_FILE)) {
      // Si le fichier n'existe pas, créer un utilisateur par défaut
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
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
      console.log(`Fichier ${USERS_FILE} créé avec un utilisateur admin par défaut`);
    }
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    
    if (users[username] && users[username].password === password) {
      req.session.user = username;
      req.session.isAdmin = users[username].is_admin || false;
      return res.redirect('/dashboard');
    }
    res.render('login', { error: 'Identifiants incorrects' });
  } catch (error) {
    console.error(`Erreur lors de la connexion: ${error.message}`);
    res.render('login', { error: 'Une erreur est survenue. Veuillez réessayer.' });
  }
});

// Route de déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
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
  try {
    if (initUserDatabase(req.session.user)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      const user = users[req.session.user];
      res.render('index', { user });
    } else {
      req.session.destroy();
      res.redirect('/login');
    }
  } catch (error) {
    console.error(`Erreur sur la route /: ${error.message}`);
    res.status(500).render('error', { message: 'Une erreur est survenue' });
  }
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    if (initUserDatabase(req.session.user)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      const user = users[req.session.user];
      res.render('dashboard', { user });
    } else {
      req.session.destroy();
      res.redirect('/login');
    }
  } catch (error) {
    console.error(`Erreur sur la route /dashboard: ${error.message}`);
    res.status(500).render('error', { message: 'Une erreur est survenue' });
  }
});

// Admin page
app.get('/admin', (req, res) => {
  if (!req.session.isAdmin) return res.redirect('/dashboard');
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    res.render('admin', { users });
  } catch (error) {
    console.error(`Erreur sur la route /admin: ${error.message}`);
    res.status(500).render('error', { message: 'Une erreur est survenue' });
  }
});

// Espagnol
app.get('/espagnol', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  try {
    if (initUserDatabase(req.session.user)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      const user = users[req.session.user];

      if (!user.access.languages.includes('espagnol')) {
        return res.status(403).render('error', { message: 'Accès refusé' });
      }

      if (!user.data) user.data = {};
      if (!user.data.espagnol) user.data.espagnol = {};

      users[req.session.user] = user;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

      res.render('espagnol/index', { user });
    } else {
      req.session.destroy();
      res.redirect('/login');
    }
  } catch (error) {
    console.error(`Erreur sur la route /espagnol: ${error.message}`);
    res.status(500).render('error', { message: 'Une erreur est survenue' });
  }
});

// Gérer les erreurs 404
app.use((req, res) => {
  console.warn(`404 pour : ${req.originalUrl}`);
  res.status(404).render('error', { message: 'Page non trouvée' });
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
  try {
    // S'assurer que le fichier users.json existe au démarrage
    if (!fs.existsSync(USERS_FILE)) {
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
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
      console.log(`Fichier ${USERS_FILE} créé avec un utilisateur admin par défaut`);
    }
  } catch (error) {
    console.error(`Erreur lors de l'initialisation du fichier users.json: ${error.message}`);
  }
});

module.exports = app;