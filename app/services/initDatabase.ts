import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { useState, useEffect } from 'react';

const DB_NAME = 'mindmuscle.db';

async function openDatabase() {
  if (!(await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'SQLite')).exists) {
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + 'SQLite');
  }
  
  // Check if database exists
  const dbExists = (await FileSystem.getInfoAsync(
    FileSystem.documentDirectory + `SQLite/${DB_NAME}`
  )).exists;

  if (!dbExists) {
    // If database doesn't exist, copy it from assets
    try {
      const asset = Asset.fromModule(require('../../assets/mindmuscle.db'));
      await asset.downloadAsync();
      
      if (asset.localUri) {
        await FileSystem.copyAsync({
          from: asset.localUri,
          to: FileSystem.documentDirectory + `SQLite/${DB_NAME}`,
        });
      }
    } catch (error) {
      console.error('Error copying database:', error);
    }
  }

  return SQLite.openDatabaseSync(DB_NAME);
}

export const initDatabase = async () => {
  const db = SQLite.openDatabaseSync(DB_NAME);

  return new Promise<void>((resolve, reject) => {
    // Execute each SQL statement separately
    db.execAsync(`CREATE TABLE IF NOT EXISTS exercises (
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
    );`)
    .then(() => db.execAsync(`CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      difficulty TEXT,
      duration INTEGER,
      exercises TEXT,
      created_at TEXT,
      updated_at TEXT
    );`))
    .then(() => db.execAsync(`CREATE TABLE IF NOT EXISTS workout_progress (
      id TEXT PRIMARY KEY,
      workout_id TEXT,
      user_id TEXT,
      start_time TEXT,
      end_time TEXT,
      status TEXT,
      completed_exercises TEXT,
      FOREIGN KEY (workout_id) REFERENCES workouts (id)
    );`))
    .then(resolve)
    .catch(reject);
  });
};

export const getDatabase = () => {
  return SQLite.openDatabaseSync(DB_NAME);
};

export async function closeDatabase() {
  const db = SQLite.openDatabaseSync(DB_NAME);
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