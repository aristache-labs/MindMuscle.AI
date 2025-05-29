import { useState, useCallback } from 'react';

export interface UseWorkoutWarmupProps {
  onWarmupCompleted?: () => void;
}

export const useWorkoutWarmup = ({ onWarmupCompleted }: UseWorkoutWarmupProps = {}) => {
  const [showWarmup, setShowWarmup] = useState(true);
  const [warmupCompleted, setWarmupCompleted] = useState(false);

  const handleWarmupComplete = useCallback(() => {
    setWarmupCompleted(true);
    setShowWarmup(false);

    if (onWarmupCompleted) {
      onWarmupCompleted();
    }
  }, [onWarmupCompleted]);

  const skipWarmup = useCallback(() => {
    handleWarmupComplete();
  }, [handleWarmupComplete]);

  const resetWarmup = useCallback(() => {
    setWarmupCompleted(false);
    setShowWarmup(true);
  }, []);

  return {
    showWarmup,
    setShowWarmup,
    warmupCompleted,
    setWarmupCompleted,
    handleWarmupComplete,
    skipWarmup,
    resetWarmup,
  };
};

export default useWorkoutWarmup;
