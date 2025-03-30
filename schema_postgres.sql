-- USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- WORDS
CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    word VARCHAR(255),
    translation VARCHAR(255),
    tags TEXT[],
    context TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- TAGS
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- DIALOGUE FILES
CREATE TABLE IF NOT EXISTS dialogues_files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- DIALOGUES
CREATE TABLE IF NOT EXISTS dialogues (
    id SERIAL PRIMARY KEY,
    file_id INTEGER REFERENCES dialogues_files(id),
    titre VARCHAR(255),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- LIGNES
CREATE TABLE IF NOT EXISTS lignes (
    id SERIAL PRIMARY KEY,
    dialogue_id INTEGER REFERENCES dialogues(id),
    personne VARCHAR(10),
    texte TEXT,
    ordre INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- STORIES
CREATE TABLE IF NOT EXISTS stories (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255),
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- STORIES - DIALOGUES
CREATE TABLE IF NOT EXISTS stories_dialogues (
    story_id INTEGER REFERENCES stories(id),
    dialogue_id INTEGER REFERENCES dialogues(id),
    PRIMARY KEY (story_id, dialogue_id)
);

-- USER PROGRESS
CREATE TABLE IF NOT EXISTS user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    word_id INTEGER REFERENCES words(id),
    progress INTEGER,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- USER PREFERENCES
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    language_preference VARCHAR(50),
    voice_preference VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_words_user_id ON words(user_id);
CREATE INDEX IF NOT EXISTS idx_words_tags ON words USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_dialogues_files_user_id ON dialogues_files(user_id);
CREATE INDEX IF NOT EXISTS idx_dialogues_file_id ON dialogues(file_id);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_dialogues_story_id ON stories_dialogues(story_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- FUNCTION (trigger to update modified_at)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_progress_updated_at'
  ) THEN
    CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_preferences_updated_at'
  ) THEN
    CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_words_updated_at'
  ) THEN
    CREATE TRIGGER update_words_updated_at
    BEFORE UPDATE ON words
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  END IF;
END;
$$;
