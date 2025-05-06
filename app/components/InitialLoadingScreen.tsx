import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface InitialLoadingScreenProps {
  onFinish?: () => void;
  duration?: number;
  message?: string;
  showProgress?: boolean;
  progressValue?: number;
}

export default function InitialLoadingScreen({
  onFinish,
  duration = 30000,
  message,
  showProgress = true,
  progressValue,
}: InitialLoadingScreenProps) {
  const outerSpinValue = useRef(new Animated.Value(0)).current;
  const innerSpinValue = useRef(new Animated.Value(0)).current;
  const dumbbellSpinValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const textScaleValue = useRef(new Animated.Value(1)).current;
  const textOpacityValue = useRef(new Animated.Value(1)).current;
  const [loadingMessage, setLoadingMessage] = useState(message || 'Preparing your workout...');
  const [progress, setProgress] = useState(progressValue || 0);

  const messages = [
    'Loading exercises...',
    'Just a moment...',
    'AI is working...',
    'Calculating your gains...',
    'Getting pumped up...',
    'Almost there...',
    'Hold on tight...',
    'Finalizing...',
  ];

  // Update progress when progressValue changes
  useEffect(() => {
    if (progressValue !== undefined) {
      setProgress(progressValue);
    }
  }, [progressValue]);

  const animateText = () => {
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
  };

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Start spinning animations
    const startSpinning = () => {
      // Reset values to 0 without animation
      outerSpinValue.setValue(0);
      innerSpinValue.setValue(0);
      dumbbellSpinValue.setValue(0);

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
          { iterations: -1 }
        ),
        // Inner circle
        Animated.loop(
          Animated.timing(innerSpinValue, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          { iterations: -1 }
        ),
        // Dumbbell
        Animated.loop(
          Animated.timing(dumbbellSpinValue, {
            toValue: 1,
            duration: 4000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          { iterations: -1 }
        ),
      ]).start();
    };

    startSpinning();

    if (showProgress && progressValue === undefined) {
      // Progress update - only if not externally controlled
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 1 / (duration / 1000);
          return newProgress > 1 ? 1 : newProgress;
        });
      }, 1000);

      // Message rotation with animation
      const messageInterval = setInterval(() => {
        if (!message) {
          setLoadingMessage((prev) => {
            const currentIndex = messages.indexOf(prev);
            const nextMessage = messages[(currentIndex + 1) % messages.length];
            animateText();
            return nextMessage;
          });
        }
      }, 3000);

      // Navigation timeout
      const navigationTimeout = setTimeout(() => {
        // Fade out animation before navigation
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          if (onFinish) onFinish();
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
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          if (onFinish) onFinish();
        });
      }, 500);
      
      return () => clearTimeout(finishTimeout);
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
          <Animated.View style={[styles.spinningCircle, styles.outerCircle, { transform: [{ rotate: outerSpin }] }]}>
            <View style={[styles.circleAccent, styles.outerAccent]} />
          </Animated.View>

          {/* Inner spinning circle */}
          <Animated.View style={[styles.spinningCircle, styles.innerCircle, { transform: [{ rotate: innerSpin }] }]}>
            <View style={[styles.circleAccent, styles.innerAccent]} />
          </Animated.View>

          {/* Center dumbbell */}
          <Animated.View style={[styles.iconContainer, { transform: [{ rotate: dumbbellSpin }] }]}>
            <MaterialCommunityIcons
              name="dumbbell"
              size={40}
              color="#ffffff"
            />
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
          <Text
            variant="headlineMedium"
            style={styles.text}
          >
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
            <ProgressBar 
              progress={progress}
              color="#00FF62"
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>
              {Math.round(progress * 100)}%
            </Text>
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