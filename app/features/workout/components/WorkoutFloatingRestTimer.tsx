import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  useAnimatedProps,
  withTiming,
  useSharedValue,
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import { SentryDataCollection, SentryAutoInstrumentation } from '../../../services/sentry';
import ExerciseRestPreferencesService from '../../../services/exerciseRestPreferencesService';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface WorkoutFloatingRestTimerProps {
  isVisible: boolean;
  restTimeSeconds: number;
  exerciseName: string;
  exerciseId?: string;
  userId?: string;
  onSkip: () => void;
  onEditTime: () => void;
  onTimerComplete: () => void;
}

const WINDOW_WIDTH = Dimensions.get('window').width;
const CIRCLE_SIZE = WINDOW_WIDTH * 0.45;
const STROKE_WIDTH = 6;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function WorkoutFloatingRestTimer({
  isVisible,
  restTimeSeconds,
  exerciseName,
  exerciseId,
  userId,
  onSkip,
  onEditTime,
  onTimerComplete,
}: WorkoutFloatingRestTimerProps) {
  const [seconds, setSeconds] = useState(restTimeSeconds);
  const [isActive, setIsActive] = useState(false);
  const [originalTime, setOriginalTime] = useState(restTimeSeconds);
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Use refs to avoid callback dependencies in timer interval
  const onTimerCompleteRef = useRef(onTimerComplete);
  const exerciseNameRef = useRef(exerciseName);
  const originalTimeRef = useRef(originalTime);

  // Keep refs up to date
  useEffect(() => {
    onTimerCompleteRef.current = onTimerComplete;
    exerciseNameRef.current = exerciseName;
    originalTimeRef.current = originalTime;
  }, [onTimerComplete, exerciseName, originalTime]);

  // Update timer when new rest time is provided
  useEffect(() => {
    if (isVisible && restTimeSeconds > 0) {
      /* console.log('🎬 Timer initialization:', {
        isVisible,
        restTimeSeconds,
        exerciseName,
        currentSeconds: seconds,
        currentIsActive: isActive,
      }); */

      setSeconds(restTimeSeconds);
      setOriginalTime(restTimeSeconds);
      setIsActive(true);
      progress.value = 0;

      // Animate timer appearance
      opacity.value = withTiming(1, { duration: 300 });

      SentryDataCollection.addBreadcrumb({
        message: 'Rest timer started',
        category: 'workout.rest_timer',
        level: 'info',
        data: {
          exercise_name: exerciseName,
          rest_time_seconds: restTimeSeconds,
          platform: Platform.OS,
        },
      });
    } else if (!isVisible) {
      /* console.log('🎬 Timer hiding:', { isVisible, exerciseName }); */
      setIsActive(false);
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible, restTimeSeconds, exerciseName]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value * CIRCLE_CIRCUMFERENCE,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      {
        scale: interpolate(opacity.value, [0, 1], [0.8, 1]),
      },
    ],
  }));

  // Progress animation effect - only depends on isActive and originalTime
  useEffect(() => {
    if (isActive && originalTime > 0) {
      // Start progress animation based on original time
      progress.value = withTiming(1, {
        duration: originalTime * 1000,
        easing: Easing.linear,
      });
    } else {
      cancelAnimation(progress);
    }

    return () => {
      cancelAnimation(progress);
    };
  }, [isActive, originalTime]);

  // Countdown timer effect - minimal dependencies to prevent restarts
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isActive && seconds > 0) {
      /* console.log('⏰ Timer interval starting:', { isActive, seconds, exerciseName }); */

      interval = setInterval(() => {
        setSeconds((prev) => {
          const newValue = prev - 1;
          /* console.log(`⏱️ Timer countdown: ${prev} → ${newValue} (${exerciseNameRef.current})`); */

          if (prev <= 1) {
            /* console.log('🔔 Timer completed, calling onTimerComplete'); */
            // Timer completed
            SentryAutoInstrumentation.trackUserInteraction(
              'rest_timer_completed',
              'timer_automatic',
              'workout_timer',
              {
                exercise_name: exerciseNameRef.current,
                original_time: originalTimeRef.current,
                platform: Platform.OS,
              },
            );

            setIsActive(false);
            // Use the ref to avoid dependency on the callback
            runOnJS(() => {
              onTimerCompleteRef.current();
            })();
            return 0;
          }
          return newValue;
        });
      }, 1000);
    } else {
      /* console.log('❌ Timer interval NOT starting:', { isActive, seconds, exerciseName }); */
    }

    return () => {
      if (interval) {
        try {
          clearInterval(interval);
        } catch (error) {
          SentryDataCollection.captureException(error as Error, {
            component: 'WorkoutFloatingRestTimer',
            action: 'interval_cleanup',
            platform: Platform.OS,
          });
        }
      }
    };
  }, [isActive]); // Only depend on isActive to prevent constant restarts

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const handleSkip = useCallback(() => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'skip_rest_timer',
        'skip_button',
        'workout_timer',
        {
          exercise_name: exerciseName,
          remaining_seconds: seconds,
          original_time: originalTime,
          completion_percentage: ((originalTime - seconds) / originalTime) * 100,
          platform: Platform.OS,
        },
      );

      setIsActive(false);
      cancelAnimation(progress);
      onSkip();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutFloatingRestTimer',
        action: 'skip_handler',
        platform: Platform.OS,
      });
      onSkip(); // Still execute skip even if tracking fails
    }
  }, [exerciseName, seconds, originalTime, onSkip, progress]);

  const handleEditTime = useCallback(() => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'edit_rest_time',
        'edit_button',
        'workout_timer',
        {
          exercise_name: exerciseName,
          current_time: seconds,
          original_time: originalTime,
          platform: Platform.OS,
        },
      );

      onEditTime();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'WorkoutFloatingRestTimer',
        action: 'edit_time_handler',
        platform: Platform.OS,
      });
      onEditTime(); // Still execute edit even if tracking fails
    }
  }, [exerciseName, seconds, originalTime, onEditTime]);

  const handleTimeAdjustment = useCallback(
    async (adjustment: number) => {
      setSeconds((prev) => {
        const newTime = Math.max(5, Math.min(600, prev + adjustment));
        /* console.log(
        `⏰ Timer adjustment: ${prev} → ${newTime} (${adjustment > 0 ? '+' : ''}${adjustment}s)`,
      ); */

        // Save the user's preference to the database when they adjust time
        if (exerciseId && userId && newTime !== prev) {
          // Use runOnJS to execute async operation safely from callback
          runOnJS(async () => {
            try {
              const success = await ExerciseRestPreferencesService.saveExerciseRestPreference(
                userId,
                exerciseId,
                newTime,
              );

              if (success) {
                SentryDataCollection.addBreadcrumb({
                  message: 'Rest time preference saved via timer adjustment',
                  category: 'workout.rest_timer',
                  level: 'info',
                  data: {
                    exercise_id: exerciseId,
                    exercise_name: exerciseName,
                    old_time: prev,
                    new_time: newTime,
                    adjustment: adjustment,
                    platform: Platform.OS,
                  },
                });
              }
            } catch (error) {
              SentryDataCollection.captureException(error as Error, {
                component: 'WorkoutFloatingRestTimer',
                action: 'save_rest_preference',
                exercise_id: exerciseId,
                user_id: userId,
                platform: Platform.OS,
              });
            }
          })();
        }

        return newTime;
      });
    },
    [exerciseId, userId, exerciseName],
  );

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/* Timer Section */}
        <View style={styles.timerSection}>
          {/* Central Timer Circle */}
          <Pressable onPress={handleSkip} style={styles.timerCircle}>
            <View style={styles.progressContainer}>
              <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                <Defs>
                  <LinearGradient id="restGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={COLORS.gradientStart} stopOpacity="1" />
                    <Stop offset="1" stopColor={COLORS.gradientEnd} stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Circle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  stroke={`${COLORS.primary}40`}
                  strokeWidth={STROKE_WIDTH}
                  fill={COLORS.surface}
                />
                <AnimatedCircle
                  cx={CIRCLE_SIZE / 2}
                  cy={CIRCLE_SIZE / 2}
                  r={RADIUS}
                  stroke="url(#restGrad)"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  fill="transparent"
                  transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                  strokeDasharray={`${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
                  animatedProps={animatedProps}
                />
              </Svg>
            </View>

            {/* Left Time Button - Inside Circle */}
            <Pressable style={styles.leftTimeButton} onPress={() => handleTimeAdjustment(-15)}>
              <Text style={styles.timeButtonText}>-15</Text>
            </Pressable>

            {/* Top Text Content Inside Circle */}
            <View style={styles.circleTextContainer}>
              <Text style={styles.tapToSkipText}>Tap to skip</Text>
              <Text style={styles.restText}>Rest: {formatTime(originalTime)}</Text>
            </View>

            {/* Centered Timer Text */}
            <View style={styles.timerTextContainer}>
              <Text style={styles.timerText}>{formatTime(seconds)}</Text>
            </View>

            {/* Right Time Button - Inside Circle */}
            <Pressable style={styles.rightTimeButton} onPress={() => handleTimeAdjustment(15)}>
              <Text style={styles.timeButtonText}>+15</Text>
            </Pressable>

            {/* Edit Button - Inside Circle */}
            <Pressable style={styles.editButton} onPress={handleEditTime}>
              <Text style={styles.editButtonIcon}>✏️</Text>
            </Pressable>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  container: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  circleTextContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'absolute',
    width: '100%',
    height: '100%',
    paddingTop: SPACING.lg,
  },
  tapToSkipText: {
    color: COLORS.placeholder,
    fontSize: FONT_SIZES.xs,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  restText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
  },
  timerTextContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  leftTimeButton: {
    position: 'absolute',
    left: SPACING.md,
    top: '50%',
    transform: [{ translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  rightTimeButton: {
    position: 'absolute',
    right: SPACING.md,
    top: '50%',
    transform: [{ translateY: -18 }],
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  timeButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  editButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  progressContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  timerText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.xxxl + 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  editButtonIcon: {
    fontSize: FONT_SIZES.sm,
  },
});
