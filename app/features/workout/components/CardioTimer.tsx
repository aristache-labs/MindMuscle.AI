import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

interface CardioTimerProps {
  durationMinutes: number;
  onComplete: () => void;
  onCancel?: () => void;
  isActive?: boolean;
}

const CardioTimer = React.memo(function CardioTimer({
  durationMinutes,
  onComplete,
  onCancel,
  isActive = false,
}: CardioTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep the callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start/pause timer
  const toggleTimer = () => {
    if (!hasStarted) {
      setHasStarted(true);
    }
    setIsRunning((prev) => !prev);
  };

  // Complete the set early
  const handleDone = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    onCompleteRef.current();
  };

  // Handle timer countdown
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setIsRunning(false);
            onCompleteRef.current();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Reset timer when duration changes
  useEffect(() => {
    setTimeRemaining(durationMinutes * 60);
    setIsRunning(false);
    setHasStarted(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [durationMinutes]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <View style={styles.timerSection}>
        <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>
        <Text style={styles.timerUnit}>min</Text>
      </View>

      <View style={styles.controlsSection}>
        <TouchableOpacity
          style={[styles.playButton, isRunning && styles.pauseButton]}
          onPress={toggleTimer}
        >
          <Ionicons name={isRunning ? 'pause' : 'play'} size={24} color={COLORS.text} />
        </TouchableOpacity>

        {hasStarted && (
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>

      {onCancel && !hasStarted && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeContainer: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  timerSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.lg,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  timerUnit: {
    fontSize: 18,
    color: COLORS.placeholder,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  controlsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  playButton: {
    backgroundColor: '#4CAF50',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 80,
    alignItems: 'center',
  },
  doneText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    color: COLORS.placeholder,
    fontSize: 14,
  },
});

export default CardioTimer;
