const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Chemin vers le fichier des utilisateurs
const USER_FILE = path.join(__dirname, '..', 'users.json');

// Fonction pour charger les utilisateurs
function loadUsers() {
  try {
    const data = fs.readFileSync(USER_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur lors du chargement des utilisateurs:', error);
    return {};
  }
}

// Fonction pour sauvegarder les utilisateurs
function saveUsers(users) {
  try {
    fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des utilisateurs:', error);
    return false;
  }
}

// Middleware pour vérifier si l'utilisateur est administrateur
function isAdmin(req, res, next) {
  if (!req.session.user || !req.session.isAdmin) {
    return res.status(403).json({ status: 'error', message: 'Accès non autorisé' });
  }
  next();
}

// Création d'un nouvel utilisateur
router.post('/users', isAdmin, (req, res) => {
  const { username, password, is_admin, access } = req.body;
  
  if (!username || !password || !access) {
    return res.status(400).json({ status: 'error', message: 'Données invalides' });
  }
  
  const users = loadUsers();
  
  // Vérifier si l'utilisateur existe déjà
  if (users[username]) {
    return res.status(400).json({ status: 'error', message: 'Cet utilisateur existe déjà' });
  }
  
  // Créer le nouvel utilisateur
  users[username] = {
    password: password,
    is_admin: is_admin || false,
    access: {
      languages: access.languages || [],
      modules: access.modules || []
    },
    data: {}
  };
  
  // Sauvegarder les modifications
  if (saveUsers(users)) {
    return res.json({ status: 'success', message: 'Utilisateur créé avec succès' });
  } else {
    return res.status(500).json({ status: 'error', message: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// Mise à jour d'un utilisateur existant
router.put('/users/:username', isAdmin, (req, res) => {
  const { username } = req.params;
  const { password, is_admin, access } = req.body;
  
  const users = loadUsers();
  
  // Vérifier si l'utilisateur existe
  if (!users[username]) {
    return res.status(404).json({ status: 'error', message: 'Utilisateur non trouvé' });
  }
  
  // Mettre à jour les informations de l'utilisateur
  if (password) {
    users[username].password = password;
  }
  
  if (is_admin !== undefined) {
    users[username].is_admin = is_admin;
  }
  
  if (access) {
    users[username].access = {
      languages: access.languages || users[username].access.languages,
      modules: access.modules || users[username].access.modules
    };
  }
  
  // Sauvegarder les modifications
  if (saveUsers(users)) {
    return res.json({ status: 'success', message: 'Utilisateur mis à jour avec succès' });
  } else {
    return res.status(500).json({ status: 'error', message: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

// Suppression d'un utilisateur
router.delete('/users/:username', isAdmin, (req, res) => {
  const { username } = req.params;
  
  // Ne pas permettre la suppression de l'admin principal
  if (username === 'admin') {
    return res.status(403).json({ status: 'error', message: 'Vous ne pouvez pas supprimer l\'utilisateur admin principal' });
  }
  
  const users = loadUsers();
  
  // Vérifier si l'utilisateur existe
  if (!users[username]) {
    return res.status(404).json({ status: 'error', message: 'Utilisateur non trouvé' });
  }
  
  // Supprimer l'utilisateur
  delete users[username];
  
  // Sauvegarder les modifications
  if (saveUsers(users)) {
    return res.json({ status: 'success', message: 'Utilisateur supprimé avec succès' });
  } else {
    return res.status(500).json({ status: 'error', message: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

// Récupération de tous les utilisateurs
router.get('/users', isAdmin, (req, res) => {
  const users = loadUsers();
  res.json({ status: 'success', users });
});

// Récupération d'un utilisateur spécifique
router.get('/users/:username', isAdmin, (req, res) => {
  const { username } = req.params;
  const users = loadUsers();
  
  if (!users[username]) {
    return res.status(404).json({ status: 'error', message: 'Utilisateur non trouvé' });
  }
  
  // Ne pas renvoyer le mot de passe
  const userData = { ...users[username] };
  delete userData.password;
  
  res.json({ status: 'success', user: userData });
});

module.exports = router;