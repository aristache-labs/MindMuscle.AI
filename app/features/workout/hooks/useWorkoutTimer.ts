import { useState, useRef, useCallback } from 'react';

export interface UseWorkoutTimerReturn {
  // Timer state
  workoutDuration: number;
  workoutTimerActive: boolean;
  restTimer: number;
  restTimerActive: boolean;
  workoutStartTime: Date | null;

  // Timer controls
  startWorkoutTimer: () => void;
  stopWorkoutTimer: () => void;
  startRestTimer: (seconds: number) => void;
  clearAllTimers: () => void;
  setWorkoutStartTime: (date: Date | null) => void;
  setWorkoutDuration: (duration: number) => void;

  // Formatters
  formatTime: (seconds: number) => string;
  formatRestTime: (seconds: number) => string;
}

export const useWorkoutTimer = (): UseWorkoutTimerReturn => {
  // Timer state
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [workoutTimerActive, setWorkoutTimerActive] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState<Date | null>(null);

  // Timer interval references
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const workoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Centralized timer management functions
  const startWorkoutTimer = useCallback(() => {
    // Clear any existing workout timer
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }

    // Start new workout timer
    setWorkoutTimerActive(true);
    workoutTimerRef.current = setInterval(() => {
      setWorkoutDuration((prev) => prev + 1);
    }, 1000) as unknown as NodeJS.Timeout;
  }, []);

  const stopWorkoutTimer = useCallback(() => {
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
    setWorkoutTimerActive(false);
  }, []);

  const clearAllTimers = useCallback(() => {
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startRestTimer = useCallback((seconds: number) => {
    setRestTimer(seconds);
    setRestTimerActive(true);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          setRestTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000) as unknown as NodeJS.Timeout;
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatRestTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    // Timer state
    workoutDuration,
    workoutTimerActive,
    restTimer,
    restTimerActive,
    workoutStartTime,

    // Timer controls
    startWorkoutTimer,
    stopWorkoutTimer,
    startRestTimer,
    clearAllTimers,
    setWorkoutStartTime,
    setWorkoutDuration,

    // Formatters
    formatTime,
    formatRestTime,
  };
};
export default function disablewarn() {
  return null;
}
