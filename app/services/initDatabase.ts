import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useState, useEffect } from 'react';

// Platform-specific SQLite import
let SQLite: any = null;

// Only import SQLite on native platforms
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

const DB_NAME = 'mindmuscle.db';
const DB_DIRECTORY = FileSystem.documentDirectory + 'SQLite/';

export const initDatabase = async () => {
  // Skip database initialization on web
  if (Platform.OS === 'web') {
    console.log('Database initialization skipped on web platform');
    return Promise.resolve();
  }

  if (!SQLite) {
    throw new Error('SQLite not available on this platform');
  }

  if (!(await FileSystem.getInfoAsync(DB_DIRECTORY)).exists) {
    await FileSystem.makeDirectoryAsync(DB_DIRECTORY);
  }

  // Check if database exists
  const dbExists = (await FileSystem.getInfoAsync(DB_DIRECTORY + DB_NAME)).exists;

  if (!dbExists) {
    // If database doesn't exist, we'll create it with the schema below
    console.log('Database does not exist, will create with schema');
  }

  const db = await SQLite.openDatabaseAsync(DB_DIRECTORY + DB_NAME);

  return new Promise<void>((resolve, reject) => {
    // Execute each SQL statement separately
    db.execAsync(
      `CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      difficulty TEXT,
      muscle_groups TEXT,
      equipment TEXT,
      instructions TEXT,
      video_url TEXT,
      thumbnail_url TEXT,
      is_custom INTEGER DEFAULT 0,
      created_by TEXT
    );`,
    )
      .then(() =>
        db.execAsync(`CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      difficulty TEXT,
      duration INTEGER,
      exercises TEXT,
      created_at TEXT,
      updated_at TEXT
    );`),
      )
      .then(() =>
        db.execAsync(`CREATE TABLE IF NOT EXISTS workout_progress (
      id TEXT PRIMARY KEY,
      workout_id TEXT,
      user_id TEXT,
      start_time TEXT,
      end_time TEXT,
      status TEXT,
      completed_exercises TEXT,
      FOREIGN KEY (workout_id) REFERENCES workouts (id)
    );`),
      )
      .then(resolve)
      .catch(reject);
  });
};

export const getDatabase = () => {
  if (Platform.OS === 'web') {
    console.warn('Database not available on web platform');
    return null;
  }
  
  if (!SQLite) {
    throw new Error('SQLite not available on this platform');
  }
  
  return SQLite.openDatabaseAsync(DB_DIRECTORY + DB_NAME);
};

export async function closeDatabase() {
  if (Platform.OS === 'web' || !SQLite) {
    return;
  }
  
  const db = await SQLite.openDatabaseAsync(DB_DIRECTORY + DB_NAME);
  await db.closeAsync();
}

export const useDatabase = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initDatabase();
        setIsInitialized(true);
      } catch (err) {
        setError(err as Error);
      }
    };
    initialize();
  }, []);

  return {
    isInitialized,
    error,
    getDatabase,
    closeDatabase,
  };
};

export default useDatabase;
