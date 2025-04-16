import * as SQLite from 'expo-sqlite';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

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

  return SQLite.openDatabase(DB_NAME);
}

export async function initDatabase() {
  try {
    const db = await openDatabase();
    
    // Run migrations if needed
    db.transaction(tx => {
      // Create tables if they don't exist
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
      );

      // Add more migration checks and table creation here
    });

    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export async function closeDatabase() {
  const db = SQLite.openDatabase(DB_NAME);
  db.closeAsync();
} 