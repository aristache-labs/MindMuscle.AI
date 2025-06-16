import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sentry from '@sentry/react-native';

// Import shared loading messages
import { LOADING_MESSAGES } from '../constants/loadingMessages';

interface InitialLoadingScreenProps {
  onFinish?: () => void;
  duration?: number;
  message?: string;
  showProgress?: boolean;
  progressValue?: number;
}

// This is the custom loading screen that should appear after the native splash screen
export default function InitialLoadingScreen({
  onFinish,
  duration = 30000,
  message,
  showProgress = true,
  progressValue,
}: InitialLoadingScreenProps) {
  // Track component lifecycle
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'InitialLoadingScreen component mounted',
      category: 'component.lifecycle',
      level: 'info',
      data: {
        duration,
        hasMessage: !!message,
        showProgress,
        hasProgressValue: progressValue !== undefined,
        hasOnFinish: !!onFinish,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'InitialLoadingScreen component unmounted',
        category: 'component.lifecycle',
        level: 'info',
      });
    };
  }, []);

  // Disable excessive logging
  // console.log('InitialLoadingScreen rendered with message:', message);
  const outerSpinValue = useRef(new Animated.Value(0)).current;
  const innerSpinValue = useRef(new Animated.Value(0)).current;
  const dumbbellSpinValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const textScaleValue = useRef(new Animated.Value(1)).current;
  const textOpacityValue = useRef(new Animated.Value(1)).current;
  const [loadingMessage, setLoadingMessage] = useState(message || LOADING_MESSAGES.DEFAULT_WORKOUT);
  const [progress, setProgress] = useState(progressValue || 0);
  const [prevMessage, setPrevMessage] = useState('');

  // Update progress when progressValue changes
  useEffect(() => {
    if (progressValue !== undefined) {
      setProgress(progressValue);

      // Track progress updates
      Sentry.addBreadcrumb({
        message: 'InitialLoadingScreen progress updated',
        category: 'ui.progress',
        level: 'debug',
        data: {
          progressValue,
          isComplete: progressValue >= 1,
        },
      });
    }
  }, [progressValue]);

  // Update message when message prop changes
  useEffect(() => {
    if (message && message !== prevMessage) {
      // Track message changes
      Sentry.addBreadcrumb({
        message: 'InitialLoadingScreen message updated',
        category: 'ui.update',
        level: 'info',
        data: {
          previousMessage: prevMessage,
          newMessage: message,
          isFirstMessage: !prevMessage,
        },
      });

      // Only animate text if this is not the first message
      if (prevMessage) {
        animateText();
      }
      setLoadingMessage(message);
      setPrevMessage(message);
    }
  }, [message, prevMessage]);

  const animateText = () => {
    try {
      textScaleValue.setValue(0.8);
      textOpacityValue.setValue(0);

      Animated.parallel([
        Animated.spring(textScaleValue, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacityValue, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'InitialLoadingScreen',
          action: 'animate_text',
        },
      });
    }
  };

  useEffect(() => {
    try {
      // Fade in animation
      Animated.timing(fadeValue, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start((finished) => {
        if (finished) {
          Sentry.addBreadcrumb({
            message: 'InitialLoadingScreen fade-in animation completed',
            category: 'ui.animation',
            level: 'debug',
          });
        }
      });

      // Start spinning animations
      const startSpinning = () => {
        // Reset values to 0 without animation
        outerSpinValue.setValue(0);
        innerSpinValue.setValue(0);
        dumbbellSpinValue.setValue(0);

        Sentry.addBreadcrumb({
          message: 'InitialLoadingScreen spinning animations started',
          category: 'ui.animation',
          level: 'debug',
        });

        // Create parallel animations
        Animated.parallel([
          // Outer circle
          Animated.loop(
            Animated.timing(outerSpinValue, {
              toValue: 1,
              duration: 3000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            { iterations: -1 },
          ),
          // Inner circle
          Animated.loop(
            Animated.timing(innerSpinValue, {
              toValue: 1,
              duration: 2000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            { iterations: -1 },
          ),
          // Dumbbell
          Animated.loop(
            Animated.timing(dumbbellSpinValue, {
              toValue: 1,
              duration: 4000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            { iterations: -1 },
          ),
        ]).start();
      };

      startSpinning();

      if (showProgress && progressValue === undefined) {
        // Progress update - only if not externally controlled
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            const newProgress = prev + 1 / (duration / 1000);
            const finalProgress = newProgress > 1 ? 1 : newProgress;

            // Track progress milestones
            if (finalProgress >= 0.25 && prev < 0.25) {
              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen 25% progress milestone',
                category: 'ui.milestone',
                level: 'info',
              });
            } else if (finalProgress >= 0.5 && prev < 0.5) {
              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen 50% progress milestone',
                category: 'ui.milestone',
                level: 'info',
              });
            } else if (finalProgress >= 0.75 && prev < 0.75) {
              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen 75% progress milestone',
                category: 'ui.milestone',
                level: 'info',
              });
            } else if (finalProgress >= 1 && prev < 1) {
              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen 100% progress milestone',
                category: 'ui.milestone',
                level: 'info',
              });
            }

            return finalProgress;
          });
        }, 1000);

        // Message rotation with animation - only if no message prop is provided
        const messageInterval = setInterval(() => {
          if (!message) {
            setLoadingMessage((prev: string) => {
              const currentIndex = LOADING_MESSAGES.ROTATION.indexOf(prev);
              const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.ROTATION.length;
              // If current message not found in rotation, start from beginning
              const nextMessage =
                currentIndex === -1
                  ? LOADING_MESSAGES.ROTATION[0]
                  : LOADING_MESSAGES.ROTATION[nextIndex];

              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen message rotated',
                category: 'ui.update',
                level: 'debug',
                data: {
                  previousMessage: prev,
                  newMessage: nextMessage,
                  rotationIndex: nextIndex,
                },
              });

              animateText();
              return nextMessage;
            });
          }
        }, 3000);

        // Navigation timeout
        const navigationTimeout = setTimeout(() => {
          Sentry.addBreadcrumb({
            message: 'InitialLoadingScreen duration timeout reached',
            category: 'ui.timeout',
            level: 'info',
            data: { duration },
          });

          // Fade out animation before navigation
          Animated.timing(fadeValue, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            if (onFinish) {
              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen onFinish callback called',
                category: 'ui.callback',
                level: 'info',
              });
              onFinish();
            }
          });
        }, duration - 500);

        return () => {
          clearInterval(progressInterval);
          clearInterval(messageInterval);
          clearTimeout(navigationTimeout);
        };
      } else if (progressValue !== undefined && progressValue >= 1 && onFinish) {
        // If external progress is complete, trigger onFinish
        const finishTimeout = setTimeout(() => {
          Sentry.addBreadcrumb({
            message: 'InitialLoadingScreen external progress completed',
            category: 'ui.completion',
            level: 'info',
            data: { progressValue },
          });

          Animated.timing(fadeValue, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            if (onFinish) {
              Sentry.addBreadcrumb({
                message: 'InitialLoadingScreen onFinish callback called (external progress)',
                category: 'ui.callback',
                level: 'info',
              });
              onFinish();
            }
          });
        }, 1000); // Wait a bit longer to show 100% completion

        return () => clearTimeout(finishTimeout);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'InitialLoadingScreen',
          action: 'setup_animations',
        },
        extra: {
          duration,
          showProgress,
          progressValue,
          hasOnFinish: !!onFinish,
        },
      });
    }
  }, [duration, message, onFinish, showProgress, progressValue]);

  const outerSpin = outerSpinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerSpin = innerSpinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const dumbbellSpin = dumbbellSpinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#1a1a1a', '#6c47ff', '#1a1a1a']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { opacity: fadeValue }]}>
        <View style={styles.loaderContainer}>
          {/* Outer spinning circle */}
          <Animated.View
            style={[
              styles.spinningCircle,
              styles.outerCircle,
              { transform: [{ rotate: outerSpin }] },
            ]}
          >
            <View style={[styles.circleAccent, styles.outerAccent]} />
          </Animated.View>

          {/* Inner spinning circle */}
          <Animated.View
            style={[
              styles.spinningCircle,
              styles.innerCircle,
              { transform: [{ rotate: innerSpin }] },
            ]}
          >
            <View style={[styles.circleAccent, styles.innerAccent]} />
          </Animated.View>

          {/* Center dumbbell */}
          <Animated.View style={[styles.iconContainer, { transform: [{ rotate: dumbbellSpin }] }]}>
            <MaterialCommunityIcons name="dumbbell" size={40} color="#ffffff" />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              transform: [{ scale: textScaleValue }],
              opacity: textOpacityValue,
            },
          ]}
        >
          <Text variant="headlineMedium" style={styles.text}>
            {loadingMessage}
          </Text>
          <LinearGradient
            colors={['transparent', 'rgba(108, 71, 255, 0.1)', 'transparent']}
            style={styles.textGlow}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>

        {showProgress && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress} color="#00FF62" style={styles.progressBar} />
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  loaderContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  spinningCircle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  outerCircle: {
    width: 100,
    height: 100,
    borderTopColor: '#00FF62',
  },
  innerCircle: {
    width: 80,
    height: 80,
    borderTopColor: '#ff4757',
  },
  circleAccent: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: -6,
  },
  outerAccent: {
    backgroundColor: '#6c47ff',
  },
  innerAccent: {
    backgroundColor: '#ff4757',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
  },
  textGlow: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  progressContainer: {
    width: '80%',
    marginTop: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressText: {
    color: '#ffffff',
    marginTop: 8,
    fontSize: 12,
  },
});
