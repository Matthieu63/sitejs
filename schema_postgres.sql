-- Schéma pour la base de données PostgreSQL
-- Ce schéma unifie toutes les tables pour les modules Vocab, Stories et Dialogues

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table pour le vocabulaire
CREATE TABLE IF NOT EXISTS words (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word VARCHAR(255) NOT NULL,
  synthese TEXT,
  youglish TEXT,
  note INTEGER DEFAULT 0,
  tags TEXT,
  image TEXT,
  exemples TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(user_id, word)
);

-- Table pour les tags
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Table pour les fichiers de dialogues
CREATE TABLE IF NOT EXISTS dialogues_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  upload_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_type VARCHAR(50),  -- 'pdf', 'youtube', etc.
  source_url TEXT,          -- URL source si applicable
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les dialogues individuels
CREATE TABLE IF NOT EXISTS dialogues (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES dialogues_files(id) ON DELETE CASCADE,
  dialogue_number INTEGER NOT NULL,
  personne_a TEXT NOT NULL,
  personne_b TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les histoires
CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  rating INTEGER DEFAULT 0,
  tags TEXT,
  theme TEXT,
  creation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  words_used TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table pour les dialogues des histoires
CREATE TABLE IF NOT EXISTS stories_dialogues (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  dialogue_number INTEGER NOT NULL,
  personne_a TEXT NOT NULL,
  personne_b TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table pour la progression des utilisateurs
CREATE TABLE IF NOT EXISTS user_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,  -- 'espagnol', 'francais', etc.
  activity VARCHAR(50) NOT NULL, -- 'vocabulaire', 'dialogues', 'histoires', etc.
  progress INTEGER DEFAULT 0,
  last_activity TIMESTAMP,
  stats JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, module, activity)
);

-- Table pour les préférences des utilisateurs
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(50) NOT NULL,
  preference_key VARCHAR(100) NOT NULL,
  preference_value TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, module, preference_key)
);

-- Indices pour améliorer les performances
CREATE INDEX idx_words_user_id ON words(user_id);
CREATE INDEX idx_words_tags ON words USING gin(to_tsvector('simple', tags));
CREATE INDEX idx_dialogues_files_user_id ON dialogues_files(user_id);
CREATE INDEX idx_dialogues_file_id ON dialogues(file_id);
CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_dialogues_story_id ON stories_dialogues(story_id);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Fonction pour mettre à jour les timestamps automatiquement
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$ language 'plpgsql';

-- Triggers pour mettre à jour les timestamps automatiquement
CREATE TRIGGER update_words_modtime
BEFORE UPDATE ON words
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_user_progress_modtime
BEFORE UPDATE ON user_progress
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_user_preferences_modtime
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();