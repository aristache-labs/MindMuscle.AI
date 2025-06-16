import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SentryDataCollection } from './sentry/dataCollection';
import { SentryLogger } from './sentry/logger';

// Platform-specific SQLite import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SQLite: any = null;

// Only import SQLite on native platforms
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SQLite = require('expo-sqlite');
}

const DB_NAME = 'mindmuscle.db';
const DB_DIRECTORY = FileSystem.documentDirectory + 'SQLite/';

export const initDatabase = async () => {
  const initStartTime = Date.now();

  // Set initial context for database initialization
  SentryDataCollection.setContext('database_init', {
    platform: Platform.OS,
    db_name: DB_NAME,
    db_directory: DB_DIRECTORY,
    timestamp: new Date().toISOString(),
    status: 'starting',
  });

  SentryDataCollection.addBreadcrumb({
    message: 'Database initialization started',
    category: 'database.init',
    level: 'info',
    data: {
      platform: Platform.OS,
      db_name: DB_NAME,
      sqlite_available: !!SQLite,
    },
  });

  // Skip database initialization on web
  if (Platform.OS === 'web') {
    const message = 'Database initialization skipped on web platform';
    console.log(message);

    SentryDataCollection.addBreadcrumb({
      message,
      category: 'database.init',
      level: 'info',
      data: {
        platform: Platform.OS,
        reason: 'web_platform_not_supported',
      },
    });

    SentryDataCollection.setContext('database_init', {
      platform: Platform.OS,
      status: 'skipped',
      reason: 'web_platform',
      duration: Date.now() - initStartTime,
    });

    return Promise.resolve();
  }

  if (!SQLite) {
    const error = new Error('SQLite not available on this platform');

    SentryDataCollection.captureException(error, {
      operation: 'database_init',
      platform: Platform.OS,
      sqlite_available: false,
    });

    SentryDataCollection.setContext('database_init', {
      platform: Platform.OS,
      status: 'failed',
      error: 'sqlite_not_available',
      duration: Date.now() - initStartTime,
    });

    throw error;
  }

  try {
    // Check and create directory if needed
    const directoryCheckStartTime = Date.now();
    const directoryInfo = await FileSystem.getInfoAsync(DB_DIRECTORY);

    SentryDataCollection.addBreadcrumb({
      message: 'Checking database directory',
      category: 'database.filesystem',
      level: 'debug',
      data: {
        directory: DB_DIRECTORY,
        exists: directoryInfo.exists,
      },
    });

    if (!directoryInfo.exists) {
      SentryDataCollection.addBreadcrumb({
        message: 'Creating database directory',
        category: 'database.filesystem',
        level: 'info',
        data: {
          directory: DB_DIRECTORY,
        },
      });

      await FileSystem.makeDirectoryAsync(DB_DIRECTORY);

      SentryDataCollection.addBreadcrumb({
        message: 'Database directory created successfully',
        category: 'database.filesystem',
        level: 'info',
        data: {
          directory: DB_DIRECTORY,
          duration: Date.now() - directoryCheckStartTime,
        },
      });
    }

    // Check if database exists
    const dbCheckStartTime = Date.now();
    const dbExists = (await FileSystem.getInfoAsync(DB_DIRECTORY + DB_NAME)).exists;

    SentryDataCollection.addBreadcrumb({
      message: 'Database existence check completed',
      category: 'database.filesystem',
      level: 'debug',
      data: {
        db_path: DB_DIRECTORY + DB_NAME,
        exists: dbExists,
        check_duration: Date.now() - dbCheckStartTime,
      },
    });

    if (!dbExists) {
      const message = 'Database does not exist, will create with schema';
      console.log(message);

      SentryDataCollection.addBreadcrumb({
        message,
        category: 'database.init',
        level: 'info',
        data: {
          db_path: DB_DIRECTORY + DB_NAME,
          action: 'create_new_database',
        },
      });
    }

    // Open database connection
    const dbOpenStartTime = Date.now();
    const db = await SQLite.openDatabaseAsync(DB_DIRECTORY + DB_NAME);
    const dbOpenDuration = Date.now() - dbOpenStartTime;

    SentryDataCollection.addBreadcrumb({
      message: 'Database connection opened',
      category: 'database.connection',
      level: 'info',
      data: {
        db_path: DB_DIRECTORY + DB_NAME,
        open_duration: dbOpenDuration,
      },
    });

    // Track database connection performance
    SentryLogger.database.query('connection', 'open', {
      duration: dbOpenDuration,
      db_name: DB_NAME,
    });

    return new Promise<void>((resolve, reject) => {
      const schemaStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'Starting database schema creation',
        category: 'database.schema',
        level: 'info',
        data: {
          tables_to_create: ['exercises', 'workouts', 'workout_progress'],
        },
      });

      // Execute each SQL statement separately with detailed tracking
      const createExercisesTable = () => {
        const tableStartTime = Date.now();

        return db
          .execAsync(
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
          .then(() => {
            const tableDuration = Date.now() - tableStartTime;

            SentryDataCollection.addBreadcrumb({
              message: 'Exercises table created successfully',
              category: 'database.schema',
              level: 'info',
              data: {
                table: 'exercises',
                duration: tableDuration,
                columns: 11,
              },
            });

            SentryLogger.database.query('exercises', 'create_table', {
              duration: tableDuration,
              columns: 11,
            });
          })
          .catch((error: Error) => {
            SentryLogger.database.error('exercises', 'create_table', error.message, {
              duration: Date.now() - tableStartTime,
              sql_error: error,
            });
            throw error;
          });
      };

      const createWorkoutsTable = () => {
        const tableStartTime = Date.now();

        return db
          .execAsync(
            `CREATE TABLE IF NOT EXISTS workouts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT,
          difficulty TEXT,
          duration INTEGER,
          exercises TEXT,
          created_at TEXT,
          updated_at TEXT
        );`,
          )
          .then(() => {
            const tableDuration = Date.now() - tableStartTime;

            SentryDataCollection.addBreadcrumb({
              message: 'Workouts table created successfully',
              category: 'database.schema',
              level: 'info',
              data: {
                table: 'workouts',
                duration: tableDuration,
                columns: 9,
              },
            });

            SentryLogger.database.query('workouts', 'create_table', {
              duration: tableDuration,
              columns: 9,
            });
          })
          .catch((error: Error) => {
            SentryLogger.database.error('workouts', 'create_table', error.message, {
              duration: Date.now() - tableStartTime,
              sql_error: error,
            });
            throw error;
          });
      };

      const createWorkoutProgressTable = () => {
        const tableStartTime = Date.now();

        return db
          .execAsync(
            `CREATE TABLE IF NOT EXISTS workout_progress (
          id TEXT PRIMARY KEY,
          workout_id TEXT,
          user_id TEXT,
          start_time TEXT,
          end_time TEXT,
          status TEXT,
          completed_exercises TEXT,
          FOREIGN KEY (workout_id) REFERENCES workouts (id)
        );`,
          )
          .then(() => {
            const tableDuration = Date.now() - tableStartTime;

            SentryDataCollection.addBreadcrumb({
              message: 'Workout progress table created successfully',
              category: 'database.schema',
              level: 'info',
              data: {
                table: 'workout_progress',
                duration: tableDuration,
                columns: 7,
                foreign_keys: 1,
              },
            });

            SentryLogger.database.query('workout_progress', 'create_table', {
              duration: tableDuration,
              columns: 7,
              foreign_keys: 1,
            });
          })
          .catch((error: Error) => {
            SentryLogger.database.error('workout_progress', 'create_table', error.message, {
              duration: Date.now() - tableStartTime,
              sql_error: error,
            });
            throw error;
          });
      };

      // Execute table creation sequentially with comprehensive tracking
      createExercisesTable()
        .then(createWorkoutsTable)
        .then(createWorkoutProgressTable)
        .then(() => {
          const totalInitDuration = Date.now() - initStartTime;
          const schemaDuration = Date.now() - schemaStartTime;

          SentryDataCollection.addBreadcrumb({
            message: 'Database initialization completed successfully',
            category: 'database.init',
            level: 'info',
            data: {
              total_duration: totalInitDuration,
              schema_duration: schemaDuration,
              tables_created: 3,
              db_existed: dbExists,
            },
          });

          SentryDataCollection.setContext('database_init', {
            platform: Platform.OS,
            db_name: DB_NAME,
            status: 'completed',
            total_duration: totalInitDuration,
            schema_duration: schemaDuration,
            tables_created: 3,
            db_existed: dbExists,
            timestamp: new Date().toISOString(),
          });

          // Track overall initialization performance
          SentryLogger.database.query('database', 'initialize', {
            total_duration: totalInitDuration,
            schema_duration: schemaDuration,
            tables_created: 3,
            success: true,
          });

          resolve();
        })
        .catch((error: Error) => {
          const totalInitDuration = Date.now() - initStartTime;

          SentryDataCollection.captureException(error, {
            operation: 'database_schema_creation',
            platform: Platform.OS,
            db_name: DB_NAME,
            duration: totalInitDuration,
            failed_at: 'schema_creation',
          });

          SentryDataCollection.setContext('database_init', {
            platform: Platform.OS,
            db_name: DB_NAME,
            status: 'failed',
            error: error.message,
            duration: totalInitDuration,
            failed_at: 'schema_creation',
            timestamp: new Date().toISOString(),
          });

          SentryLogger.database.error('database', 'initialize', error.message, {
            total_duration: totalInitDuration,
            failed_at: 'schema_creation',
            sql_error: error,
          });

          reject(error);
        });
    });
  } catch (error) {
    const totalInitDuration = Date.now() - initStartTime;

    SentryDataCollection.captureException(error as Error, {
      operation: 'database_initialization',
      platform: Platform.OS,
      db_name: DB_NAME,
      duration: totalInitDuration,
      failed_at: 'filesystem_or_connection',
    });

    SentryDataCollection.setContext('database_init', {
      platform: Platform.OS,
      db_name: DB_NAME,
      status: 'failed',
      error: (error as Error).message,
      duration: totalInitDuration,
      failed_at: 'filesystem_or_connection',
      timestamp: new Date().toISOString(),
    });

    SentryLogger.database.error('database', 'initialize', (error as Error).message, {
      total_duration: totalInitDuration,
      failed_at: 'filesystem_or_connection',
      error: error,
    });

    throw error;
  }
};

export const getDatabase = () => {
  const operationStartTime = Date.now();

  SentryDataCollection.addBreadcrumb({
    message: 'Getting database connection',
    category: 'database.connection',
    level: 'debug',
    data: {
      platform: Platform.OS,
      db_name: DB_NAME,
    },
  });

  if (Platform.OS === 'web') {
    const message = 'Database not available on web platform';
    console.warn(message);

    SentryDataCollection.addBreadcrumb({
      message,
      category: 'database.connection',
      level: 'warning',
      data: {
        platform: Platform.OS,
        reason: 'web_platform_not_supported',
        duration: Date.now() - operationStartTime,
      },
    });

    return null;
  }

  if (!SQLite) {
    const error = new Error('SQLite not available on this platform');

    SentryDataCollection.captureException(error, {
      operation: 'get_database',
      platform: Platform.OS,
      sqlite_available: false,
      duration: Date.now() - operationStartTime,
    });

    throw error;
  }

  try {
    const db = SQLite.openDatabaseAsync(DB_DIRECTORY + DB_NAME);
    const operationDuration = Date.now() - operationStartTime;

    SentryDataCollection.addBreadcrumb({
      message: 'Database connection retrieved successfully',
      category: 'database.connection',
      level: 'debug',
      data: {
        db_path: DB_DIRECTORY + DB_NAME,
        duration: operationDuration,
      },
    });

    SentryLogger.database.query('connection', 'get', {
      duration: operationDuration,
      db_name: DB_NAME,
    });

    return db;
  } catch (error) {
    const operationDuration = Date.now() - operationStartTime;

    SentryDataCollection.captureException(error as Error, {
      operation: 'get_database',
      platform: Platform.OS,
      db_name: DB_NAME,
      duration: operationDuration,
    });

    SentryLogger.database.error('connection', 'get', (error as Error).message, {
      duration: operationDuration,
      db_name: DB_NAME,
      error: error,
    });

    throw error;
  }
};

export async function closeDatabase() {
  const operationStartTime = Date.now();

  SentryDataCollection.addBreadcrumb({
    message: 'Closing database connection',
    category: 'database.connection',
    level: 'debug',
    data: {
      platform: Platform.OS,
      db_name: DB_NAME,
    },
  });

  if (Platform.OS === 'web' || !SQLite) {
    const reason = Platform.OS === 'web' ? 'web_platform' : 'sqlite_not_available';

    SentryDataCollection.addBreadcrumb({
      message: 'Database close skipped',
      category: 'database.connection',
      level: 'debug',
      data: {
        platform: Platform.OS,
        reason,
        duration: Date.now() - operationStartTime,
      },
    });

    return;
  }

  try {
    const db = await SQLite.openDatabaseAsync(DB_DIRECTORY + DB_NAME);
    await db.closeAsync();
    const operationDuration = Date.now() - operationStartTime;

    SentryDataCollection.addBreadcrumb({
      message: 'Database connection closed successfully',
      category: 'database.connection',
      level: 'info',
      data: {
        db_path: DB_DIRECTORY + DB_NAME,
        duration: operationDuration,
      },
    });

    SentryLogger.database.query('connection', 'close', {
      duration: operationDuration,
      db_name: DB_NAME,
    });
  } catch (error) {
    const operationDuration = Date.now() - operationStartTime;

    SentryDataCollection.captureException(error as Error, {
      operation: 'close_database',
      platform: Platform.OS,
      db_name: DB_NAME,
      duration: operationDuration,
    });

    SentryLogger.database.error('connection', 'close', (error as Error).message, {
      duration: operationDuration,
      db_name: DB_NAME,
      error: error,
    });

    throw error;
  }
}

export const useDatabase = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const hookStartTime = Date.now();

      SentryDataCollection.addBreadcrumb({
        message: 'useDatabase hook initialization started',
        category: 'database.hook',
        level: 'debug',
        data: {
          hook: 'useDatabase',
          timestamp: new Date().toISOString(),
        },
      });

      SentryDataCollection.setContext('database_hook', {
        hook: 'useDatabase',
        status: 'initializing',
        timestamp: new Date().toISOString(),
      });

      try {
        await initDatabase();
        const hookDuration = Date.now() - hookStartTime;

        SentryDataCollection.addBreadcrumb({
          message: 'useDatabase hook initialization completed successfully',
          category: 'database.hook',
          level: 'info',
          data: {
            hook: 'useDatabase',
            duration: hookDuration,
            success: true,
          },
        });

        SentryDataCollection.setContext('database_hook', {
          hook: 'useDatabase',
          status: 'ready',
          duration: hookDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.query('hook', 'initialize', {
          hook: 'useDatabase',
          duration: hookDuration,
          success: true,
        });

        setIsInitialized(true);
      } catch (err) {
        const hookDuration = Date.now() - hookStartTime;
        const error = err as Error;

        SentryDataCollection.captureException(error, {
          operation: 'database_hook_initialization',
          hook: 'useDatabase',
          duration: hookDuration,
        });

        SentryDataCollection.setContext('database_hook', {
          hook: 'useDatabase',
          status: 'failed',
          error: error.message,
          duration: hookDuration,
          timestamp: new Date().toISOString(),
        });

        SentryLogger.database.error('hook', 'initialize', error.message, {
          hook: 'useDatabase',
          duration: hookDuration,
          error: error,
        });

        setError(error);
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
