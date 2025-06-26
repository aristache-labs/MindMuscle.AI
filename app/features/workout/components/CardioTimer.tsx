import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../../constants/theme';

interface CardioTimerProps {
  durationMinutes: number;
  onComplete: () => void;
  onCancel?: () => void;
  onDurationChange?: (newDurationMinutes: number) => void;
  isActive?: boolean;
}

const CardioTimer = React.memo(function CardioTimer({
  durationMinutes,
  onComplete,
  onCancel,
  onDurationChange,
  isActive = false,
}: CardioTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(durationMinutes.toString());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const textInputRef = useRef<TextInput>(null);

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

  // Handle timer display tap for editing
  const handleTimerTap = () => {
    if (!hasStarted && !isRunning) {
      setIsEditing(true);
      setEditValue(Math.floor(timeRemaining / 60).toString());
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  // Handle text input changes (numbers only)
  const handleTextChange = (text: string) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');
    setEditValue(numericText);
  };

  // Save the edited duration
  const saveEditedDuration = () => {
    const newMinutes = parseInt(editValue);
    if (!isNaN(newMinutes) && newMinutes > 0 && newMinutes <= 120) {
      const newSeconds = newMinutes * 60;
      setTimeRemaining(newSeconds);
      if (onDurationChange) {
        onDurationChange(newMinutes);
      }
    } else {
      // Reset to current value if invalid
      setEditValue(Math.floor(timeRemaining / 60).toString());
    }
    setIsEditing(false);
  };

  // Handle edit completion
  const handleEditComplete = () => {
    saveEditedDuration();
  };

  // Handle input blur (touch outside)
  const handleBlur = () => {
    saveEditedDuration();
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
        <View style={styles.activeSetCardContainer}>
          <View style={styles.tableLayout}>
            {/* Left Column: Timer Display */}
            <View style={styles.leftColumn}>
              <View style={styles.timerCell}>
                {isEditing ? (
                  <View style={styles.editContainer}>
                    <View style={styles.editInputContainer}>
                      <TextInput
                        ref={textInputRef}
                        style={styles.editInput}
                        value={editValue}
                        onChangeText={handleTextChange}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={handleEditComplete}
                        onBlur={handleBlur}
                        maxLength={3}
                        selectTextOnFocus
                        autoFocus
                        placeholder="15"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      />
                      <Text style={styles.editUnit}>min</Text>
                    </View>
                    <Text style={styles.editHint}>Enter duration (1-120 min)</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleTimerTap}
                    disabled={hasStarted || isRunning}
                    style={styles.timerTouchable}
                  >
                    <View style={styles.timerDisplayContainer}>
                      <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>
                      <Text style={styles.timerUnit}>min</Text>
                    </View>
                    <Text style={styles.lastTimeText}>(Last {getLastTime()})</Text>
                    {!hasStarted && !isRunning && (
                      <Text style={styles.tapToEditText}>Tap to edit</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Divider 1 */}
            <View style={styles.divider} />

            {/* Middle Column: Play/Pause Button */}
            <View style={styles.middleColumn}>
              <TouchableOpacity
                style={[styles.playButtonSet, isRunning && styles.pauseButtonSet]}
                onPress={toggleTimer}
                disabled={isEditing}
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

            {/* Right Column: Done Button */}
            <View style={styles.rightColumn}>
              <TouchableOpacity
                style={[styles.doneButton, hasStarted && styles.doneButtonActive]}
                onPress={handleDone}
                disabled={!hasStarted || isEditing}
              >
                <Text style={[styles.doneText, hasStarted && styles.doneTextActive]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Cancel button for unused exercises */}
        {onCancel && !hasStarted && !isEditing && (
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
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  activeSetCardContainer: {
    flex: 1,
    minHeight: 90,
  },
  tableLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 90,
  },
  leftColumn: {
    flex: 1.8,
    paddingRight: SPACING.xs,
  },
  middleColumn: {
    flex: 0.6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  rightColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: SPACING.xs,
  },
  timerCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
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
  tapToEditText: {
    color: COLORS.text,
    fontSize: 10,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  editContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.xs,
  },
  editInput: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editUnit: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginLeft: 4,
    color: 'rgba(255, 255, 255, 0.52)',
    textAlign: 'center',
    alignSelf: 'center',
  },
  editHint: {
    color: COLORS.text,
    fontSize: 10,
    opacity: 0.7,
    textAlign: 'center',
  },
  playButtonSet: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minWidth: 65,
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
    width: 0.5,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    marginHorizontal: SPACING.xs,
  },
});

export default CardioTimer;
