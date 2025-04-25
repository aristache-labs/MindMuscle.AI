import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions, Platform, StatusBar as RNStatusBar } from 'react-native';
import { Text, IconButton, Surface } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Stack, router } from 'expo-router';
import Animated, { 
  useAnimatedProps, 
  withTiming,
  useSharedValue,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';


const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface TimerProps {
  onClose?: () => void;
}

const TIMER_PRESETS = [20, 30, 45, 60, 90, 120];
const CIRCLE_SIZE = Dimensions.get('window').width * 0.55;
const STROKE_WIDTH = 5;
const ADJUST_BUTTON_SIZE = 56;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Timer({ onClose }: TimerProps) {
  const [seconds, setSeconds] = useState(30);
  const [isActive, setIsActive] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(30);
  const progress = useSharedValue(0);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value * CIRCLE_CIRCUMFERENCE,
  }));

  useEffect(() => {
    if (isActive) {
      progress.value = withTiming(1, {
        duration: seconds * 1000,
        easing: Easing.linear,
      });
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }

    return () => {
      cancelAnimation(progress);
    };
  }, [isActive, seconds]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setIsActive(false);
            return selectedPreset;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const adjustTime = (amount: number) => {
    if (!isActive) {
      setSeconds((prev) => Math.max(5, Math.min(3600, prev + amount)));
    }
  };

  const handlePress = () => {
    if (isActive) {
      setIsActive(false);
      setSeconds(selectedPreset);
    } else {
      setIsActive(true);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <IconButton
            icon="close"
            iconColor="white"
            size={24}
            onPress={onClose}
            style={styles.closeButton}
          />
          <View style={styles.headerTitleContainer}>
            <Text variant="headlineSmall" style={styles.headerTitle}>Timer</Text>
          </View>
          <Pressable style={styles.premiumButton} onPress={() => {}}>
            <IconButton
              icon="crown"
              iconColor="#f9e009"
              size={26}
              style={styles.premiumIcon}
            />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </Pressable>
        </View>
        <View style={styles.separator} />

        <View style={styles.timerContainer}>
          <View style={styles.adjustButtons}>
            <Surface style={styles.adjustButtonSurface}>
              <View style={styles.adjustButtonOverflow}>
                <Pressable
                  style={[
                    
                    styles.adjustButton,
                    isActive && styles.adjustButtonDisabled
                  ]}
                  onPress={() => !isActive && adjustTime(-5)}
                  disabled={isActive}
                >
                  <Text style={[
                    styles.adjustButtonText,
                    isActive && styles.adjustButtonTextDisabled
                  ]}>-5</Text>
                </Pressable>
              </View>
            </Surface>

            <Surface style={styles.adjustButtonSurface}>
              <View style={styles.adjustButtonOverflow}>
                <Pressable
                  style={[
                    styles.adjustButton,
                    isActive && styles.adjustButtonDisabled
                  ]}
                  onPress={() => !isActive && adjustTime(5)}
                  disabled={isActive}
                >
                  <Text style={[
                    styles.adjustButtonText,
                    isActive && styles.adjustButtonTextDisabled
                  ]}>+5</Text>
                </Pressable>
              </View>
            </Surface>
          </View>

          <Pressable
            onPress={handlePress}
            style={styles.timerCircle}
          >
            <Surface style={styles.timerSurface}>
              <View style={styles.surfaceOverflow}>
                <View style={styles.timerInner}>
                  <View style={styles.progressContainer}>
                    <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
                      <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                          <Stop offset="0" stopColor="#6c47ff" stopOpacity="1" />
                          <Stop offset="1" stopColor="#6c47ff" stopOpacity="1" />
                        </LinearGradient>
                      </Defs>
                      <Circle
                        cx={CIRCLE_SIZE / 2}
                        cy={CIRCLE_SIZE / 2}
                        r={RADIUS}
                        stroke="#2C2C2E"
                        strokeWidth={STROKE_WIDTH}
                        fill="transparent"
                      />
                      <AnimatedCircle
                        cx={CIRCLE_SIZE / 2}
                        cy={CIRCLE_SIZE / 2}
                        r={RADIUS}
                        stroke="url(#grad)"
                        strokeWidth={STROKE_WIDTH}
                        strokeLinecap="round"
                        fill="transparent"
                        transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
                        strokeDasharray={`${CIRCLE_CIRCUMFERENCE} ${CIRCLE_CIRCUMFERENCE}`}
                        animatedProps={animatedProps}
                      />
                    </Svg>
                  </View>
                  <Text variant="displayLarge" style={styles.timerText}>
                    {formatTime(seconds)}
                  </Text>
                  <Text variant="bodyLarge" style={styles.tapText}>
                    {isActive ? 'Tap to Reset' : 'Tap to Start'}
                  </Text>
                </View>
              </View>
            </Surface>
          </Pressable>
        </View>

        <View style={styles.presets}>
          {TIMER_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              style={[
                styles.presetButton,
                selectedPreset === preset && styles.presetButtonSelected,
                isActive && styles.presetButtonDisabled
              ]}
              onPress={() => {
                if (!isActive) {
                  setSelectedPreset(preset);
                  setSeconds(preset);
                }
              }}
              disabled={isActive}
            >
              <Text
                style={[
                  styles.presetText,
                  selectedPreset === preset && styles.presetTextSelected,
                  isActive && styles.presetTextDisabled
                ]}
              >
                {preset}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 12,
    position: 'relative',
    height: Platform.OS === 'android' ? 70 + (RNStatusBar.currentHeight || 24) : 120,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 47,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  headerTitleContainer: {
  },
  headerTitle: {
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    zIndex: 1,
    marginTop: 0,
    top: 10,
  },
  premiumButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingHorizontal: 8,
  },
  premiumIcon: {
    margin: 0,
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -8,
  },
  separator: {
    height: 0,
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  timerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  adjustButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: CIRCLE_SIZE + 140,
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -(CIRCLE_SIZE + 140) / 2 },
      { translateY: -28 }
    ],
  },
  timerCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerSurface: {
    width: '100%',
    height: '100%',
    borderRadius: CIRCLE_SIZE / 2,
    elevation: 4,
    backgroundColor: '#1C1C1E',
  },
  surfaceOverflow: {
    width: '100%',
    height: '100%',
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
  },
  timerInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CIRCLE_SIZE / 2,
  },
  progressContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: CIRCLE_SIZE / 2,
  },
  progressBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: STROKE_WIDTH,
    borderColor: COLORS.primary,
    opacity: 0.2,
  },
  timerText: {
    color: COLORS.text,
    fontSize: 42,
    fontWeight: 'bold',
  },
  tapText: {
    color: COLORS.primary,
    marginTop: 8,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
    gap: 10,
  },
  presetButton: {
    width: '30%',
    aspectRatio: 2,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    borderWidth: 0.2,
    borderColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  presetButtonSelected: {
    backgroundColor: COLORS.gradientEnd,
    shadowColor: COLORS.gradientEnd,
    
    shadowOffset: {
      width: 0,
      height: 0,
    },
    borderWidth: 1,
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  presetButtonDisabled: {
    opacity: 0.5,
  },
  presetText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 22,
  },
  presetTextSelected: {
    color: '#fff',
  },
  presetTextDisabled: {
    opacity: 0.5,
  },
  adjustButtonSurface: {
    borderRadius: 16,
    elevation: 2,
    backgroundColor: '#1f222a',
    width: ADJUST_BUTTON_SIZE,
    height: ADJUST_BUTTON_SIZE,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    borderWidth: 0.3,
    borderColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  adjustButtonOverflow: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 16,
  },
  adjustButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonDisabled: {
    opacity: 0.5,
  },
  adjustButtonText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '600',
  },
  adjustButtonTextDisabled: {
    opacity: 0.5,
  },
}); 