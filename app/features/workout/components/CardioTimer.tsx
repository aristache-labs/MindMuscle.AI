import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../constants/theme';

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

  // Get the original duration for "Last" display
  const getLastTime = (): string => {
    const originalSeconds = durationMinutes * 60;
    return formatTime(originalSeconds);
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
    <View style={[styles.setCard, isActive ? styles.activeSetCard : styles.inactiveSetCard]}>
      <View style={styles.setCardContent}>
        {/* 3-Column Layout with Dividers: Timer | Divider | Play/Pause | Divider | Done */}
        <View style={styles.threeColumnRow}>
          {/* Column 1: Timer Display */}
          <View style={styles.timerColumn}>
            <View style={styles.timerDisplayContainer}>
              <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.timerUnit}>min</Text>
            </View>
            <Text style={styles.lastTimeText}>(Last {getLastTime()})</Text>
          </View>

          {/* Divider 1 */}
          <View style={styles.divider} />

          {/* Column 2: Play/Pause Button */}
          <View style={styles.playColumn}>
            <TouchableOpacity
              style={[styles.playButtonSet, isRunning && styles.pauseButtonSet]}
              onPress={toggleTimer}
            >
              <Ionicons
                name={isRunning ? 'pause' : 'play'}
                size={20}
                color={COLORS.text}
                style={!isRunning && styles.playIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Divider 2 */}
          <View style={styles.divider} />

          {/* Column 3: Done Button */}
          <View style={styles.doneColumn}>
            <TouchableOpacity
              style={[styles.doneButton, hasStarted && styles.doneButtonActive]}
              onPress={handleDone}
              disabled={!hasStarted}
            >
              <Text style={[styles.doneText, hasStarted && styles.doneTextActive]}>Did it</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancel button for unused exercises */}
        {onCancel && !hasStarted && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  setCard: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.md,
    overflow: 'hidden',
    minHeight: 100,
  },
  activeSetCard: {
    backgroundColor: COLORS.primary,
  },
  inactiveSetCard: {
    backgroundColor: COLORS.surface,
  },
  setCardContent: {
    flexDirection: 'column',
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  threeColumnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  timerColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  playColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  doneColumn: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  suggestedLabel: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  timerDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.xs,
  },
  timerDisplay: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  timerUnit: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginLeft: 4,
    color: 'rgba(255, 255, 255, 0.52)',
    textAlign: 'center',
    alignSelf: 'center',
  },
  lastTimeText: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'center',
  },
  playButtonSet: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButtonSet: {
    backgroundColor: COLORS.warning,
  },
  playIcon: {
    marginLeft: 0, // Slight adjustment for visual centering of play icon
  },
  doneButton: {
    backgroundColor: 'rgba(108, 71, 255, 0.3)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.5)',
    minWidth: 60,
  },
  doneButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  doneText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  doneTextActive: {
    color: COLORS.text,
  },
  cancelButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignSelf: 'center',
  },
  cancelText: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: FONT_SIZES.sm,
  },
  divider: {
    width: 1,
    height: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: SPACING.sm,
  },
});

export default CardioTimer;
