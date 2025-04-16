import { useEffect, useState } from 'react';
import { db } from '../services/database';
import { initDatabase } from '../services/initDatabase';

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        await initDatabase();
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize database'));
      }
    }

    initialize();
  }, []);

  return {
    db,
    isReady,
    error,
  };
} 