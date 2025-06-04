import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StatusBar,
  ViewStyle,
  GestureResponderEvent,
  Animated,
  ScrollView,
  Image,
} from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, BORDER_RADIUS, HEADER_HEIGHT } from '../constants/theme';
import Timer from '../components/timer';
import { GeneralHeader } from '../components/GeneralHeader';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  addBreadcrumb,
  captureError,
  capturePerformanceError,
} from '../services/sentry/simpleErrorHandler';
import { setTag, SentryReactProfiler } from '../services/sentry';

interface MuscleGroup {
  id: number;
  name: string;
  dotPosition: {
    top: string;
    left?: string;
    right?: string;
  };
  textPosition: {
    top: string;
    left?: string;
    right?: string;
  };
  view: 'front' | 'back';
  heartPosition?: {
    top: string;
    left?: string;
    right?: string;
  };
}

const muscleGroups: MuscleGroup[] = [
  // Front view muscles
  {
    id: 1,
    name: 'Shoulders',
    dotPosition: { top: '27%', left: '30%' },
    textPosition: { top: '25%', left: '1%' },
    view: 'front',
  },
  {
    id: 17,
    name: 'Cardio',
    dotPosition: { top: '20%', right: '25%' },
    textPosition: { top: '18%', right: '1%' },
    view: 'front',
    heartPosition: { top: '20%', right: '25%' },
  },
  {
    id: 2,
    name: 'Chest',
    dotPosition: { top: '32%', left: '40%' },
    textPosition: { top: '30%', left: '1%' },
    view: 'front',
  },
  {
    id: 3,
    name: 'Biceps',
    dotPosition: { top: '35%', right: '31%' },
    textPosition: { top: '33%', right: '1%' },
    view: 'front',
  },
  {
    id: 4,
    name: 'Forearms',
    dotPosition: { top: '42%', left: '22%' },
    textPosition: { top: '40%', left: '1%' },
    view: 'front',
  },
  {
    id: 5,
    name: 'Abs',
    dotPosition: { top: '41%', right: '47%' },
    textPosition: { top: '39%', right: '1%' },
    view: 'front',
  },
  {
    id: 6,
    name: 'Obliques',
    dotPosition: { top: '48%', left: '34%' },
    textPosition: { top: '46%', left: '1%' },
    view: 'front',
  },
  {
    id: 7,
    name: 'Quads',
    dotPosition: { top: '58%', left: '39%' },
    textPosition: { top: '56%', left: '1%' },
    view: 'front',
  },
  {
    id: 8,
    name: 'Adductors',
    dotPosition: { top: '60%', right: '47%' },
    textPosition: { top: '58%', right: '1%' },
    view: 'front',
  },
  // Back view muscles
  {
    id: 9,
    name: 'Traps',
    dotPosition: { top: '24%', left: '44%' },
    textPosition: { top: '22%', left: '1%' },
    view: 'back',
  },
  {
    id: 10,
    name: 'Triceps',
    dotPosition: { top: '34%', left: '25%' },
    textPosition: { top: '32%', left: '1%' },
    view: 'back',
  },
  {
    id: 11,
    name: 'Abductors',
    dotPosition: { top: '44%', left: '35%' },
    textPosition: { top: '42%', left: '1%' },
    view: 'back',
  },
  {
    id: 12,
    name: 'Lats',
    dotPosition: { top: '31%', right: '39%' },
    textPosition: { top: '29%', right: '1%' },
    view: 'back',
  },
  {
    id: 13,
    name: 'Lower back',
    dotPosition: { top: '42%', right: '44%' },
    textPosition: { top: '40%', right: '1%' },
    view: 'back',
  },
  {
    id: 14,
    name: 'Glutes',
    dotPosition: { top: '50%', right: '45%' },
    textPosition: { top: '48%', right: '1%' },
    view: 'back',
  },
  {
    id: 15,
    name: 'Hamstrings',
    dotPosition: { top: '58%', left: '36%' },
    textPosition: { top: '56%', left: '1%' },
    view: 'back',
  },
  {
    id: 16,
    name: 'Calves',
    dotPosition: { top: '70%', left: '34%' },
    textPosition: { top: '68%', left: '1%' },
    view: 'back',
  },
];

// Helper functions for muscle position calculations
const getPositionValue = (position: { left?: string; right?: string }, defaultValue = '0') => {
  if (position.right) {
    return 100 - parseFloat(position.right);
  }
  return parseFloat(position.left || defaultValue);
};

const calculateClickableZoneWidth = (muscle: MuscleGroup) => {
  const textPos = getPositionValue(muscle.textPosition);
  const dotPos = getPositionValue(muscle.dotPosition);
  return Math.abs(textPos - dotPos) + 5;
};

const calculateClickableZoneLeft = (muscle: MuscleGroup) => {
  if (muscle.textPosition.right) {
    return (
      100 -
      Math.max(parseFloat(muscle.textPosition.right), parseFloat(muscle.dotPosition.right || '0'))
    );
  }
  return Math.min(
    parseFloat(muscle.dotPosition.left || '100'),
    parseFloat(muscle.textPosition.left || '100'),
  );
};

const calculateDottedLineWidth = (muscle: MuscleGroup) => {
  const textPos = getPositionValue(muscle.textPosition);
  const dotPos = getPositionValue(muscle.dotPosition);
  return Math.abs(textPos - dotPos);
};

const calculateDottedLineLeft = (muscle: MuscleGroup) => {
  return calculateClickableZoneLeft(muscle);
};

// Component for rendering muscle marker
interface MuscleMarkerProps {
  muscle: MuscleGroup;
  pulseAnim: Animated.Value;
  onPress: (muscleName: string) => void;
}

const MuscleMarker = ({ muscle, pulseAnim, onPress }: MuscleMarkerProps) => {
  const isCardio = muscle.name === 'Cardio';
  const markerStyle = isCardio ? muscle.heartPosition : muscle.dotPosition;

  return (
    <TouchableOpacity
      style={[
        styles.muscleMarker,
        isCardio
          ? {
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: -12,
            }
          : {},
        markerStyle as ViewStyle,
      ]}
      onPress={() => onPress(muscle.name)}
    >
      {isCardio ? (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <MaterialCommunityIcons
            name="heart-pulse"
            size={28}
            color={COLORS.primary}
            style={{ marginTop: -1 }}
          />
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            styles.markerDot,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}
    </TouchableOpacity>
  );
};

// Component for muscle text
interface MuscleTextProps {
  muscle: MuscleGroup;
  onPress: (muscleName: string) => void;
}

const MuscleText = ({ muscle, onPress }: MuscleTextProps) => (
  <TouchableOpacity
    style={[
      styles.textContainer,
      muscle.textPosition as ViewStyle,
      muscle.textPosition.right ? styles.textRight : styles.textLeft,
    ]}
    onPress={() => onPress(muscle.name)}
  >
    <Text style={styles.markerText}>{muscle.name}</Text>
  </TouchableOpacity>
);

// Component for clickable zone
interface ClickableZoneProps {
  muscle: MuscleGroup;
  onPress: (muscleName: string) => void;
}

const ClickableZone = ({ muscle, onPress }: ClickableZoneProps) => (
  <TouchableOpacity
    style={[
      styles.clickableZone,
      {
        position: 'absolute',
        width: `${calculateClickableZoneWidth(muscle)}%`,
        height: '10%',
        left: `${calculateClickableZoneLeft(muscle)}%`,
        top: `${parseFloat(muscle.dotPosition.top) - 5}%`,
        zIndex: 5,
      } as ViewStyle,
    ]}
    onPress={() => onPress(muscle.name)}
  />
);

// Component for dotted line
interface DottedLineProps {
  muscle: MuscleGroup;
}

const DottedLine = ({ muscle }: DottedLineProps) => (
  <View
    style={[
      styles.dottedLine,
      {
        width: `${calculateDottedLineWidth(muscle)}%`,
        left: `${calculateDottedLineLeft(muscle)}%`,
        top: `${parseFloat(muscle.dotPosition.top) + 0.5}%`,
      } as ViewStyle,
    ]}
  />
);

// Main muscle group component
interface MuscleGroupRenderProps {
  muscle: MuscleGroup;
  pulseAnim: Animated.Value;
  onPress: (muscleName: string) => void;
}

const MuscleGroupRender = ({ muscle, pulseAnim, onPress }: MuscleGroupRenderProps) => (
  <React.Fragment key={muscle.id}>
    <ClickableZone muscle={muscle} onPress={onPress} />
    <MuscleMarker muscle={muscle} pulseAnim={pulseAnim} onPress={onPress} />
    <MuscleText muscle={muscle} onPress={onPress} />
    <DottedLine muscle={muscle} />
  </React.Fragment>
);

export default function ExercisesScreen() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [pulseAnim] = useState(new Animated.Value(1));

  // Track screen initialization
  useEffect(() => {
    const startTime = Date.now();

    addBreadcrumb('Exercises screen initialized', 'navigation', {
      initialView: currentView,
      timestamp: new Date().toISOString(),
    });

    setTag('current_screen', 'exercises');
    setTag('muscle_diagram_view', currentView);
    SentryReactProfiler.trackComponentLifecycle('ExercisesScreen', 'mount');

    return () => {
      const mountTime = Date.now() - startTime;
      addBreadcrumb('Exercises screen unmounted', 'navigation', {
        screenMountTime: mountTime,
        finalView: currentView,
      });

      SentryReactProfiler.trackComponentLifecycle('ExercisesScreen', 'unmount');
    };
  }, []);

  // Track view changes
  useEffect(() => {
    addBreadcrumb(`Muscle diagram view changed: ${currentView}`, 'user_interaction', {
      view: currentView,
      timestamp: new Date().toISOString(),
    });

    setTag('muscle_diagram_view', currentView);
  }, [currentView]);

  // Start pulse animation on mount
  useEffect(() => {
    const startPulseAnimation = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };

    startPulseAnimation();
  }, [pulseAnim]);

  const handleViewChange = (newView: 'front' | 'back') => {
    const startTime = Date.now();

    addBreadcrumb(`View change requested: ${currentView} -> ${newView}`, 'user_interaction', {
      fromView: currentView,
      toView: newView,
    });

    try {
      setCurrentView(newView);

      const changeTime = Date.now() - startTime;
      if (changeTime > 100) {
        capturePerformanceError('Slow view change', 'view_change_time', changeTime);
      }

      addBreadcrumb(`View change completed: ${newView}`, 'ui', {
        newView,
        changeTime,
      });
    } catch (error) {
      captureError(error as Error, {
        category: 'ui_error',
        screen: 'exercises',
        component: 'ViewChanger',
        fromView: currentView,
        toView: newView,
      });
    }
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    addBreadcrumb('Touch interaction started on muscle diagram', 'user_interaction', {
      view: currentView,
      touchX: event.nativeEvent.pageX,
      touchY: event.nativeEvent.pageY,
    });
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    addBreadcrumb('Touch interaction ended on muscle diagram', 'user_interaction', {
      view: currentView,
      touchX: event.nativeEvent.pageX,
      touchY: event.nativeEvent.pageY,
    });
  };

  const navigateToExercisesList = (muscleGroupName: string) => {
    const startTime = Date.now();

    addBreadcrumb(`Navigating to exercises list: ${muscleGroupName}`, 'navigation', {
      muscleGroup: muscleGroupName,
      currentView,
    });

    try {
      router.push({
        pathname: '/exercises-single-group',
        params: { muscleGroup: muscleGroupName },
      });

      const navigationTime = Date.now() - startTime;
      addBreadcrumb(`Navigation to muscle group completed: ${muscleGroupName}`, 'performance', {
        navigationTime,
        muscleGroup: muscleGroupName,
      });

      if (navigationTime > 300) {
        capturePerformanceError('Slow muscle group navigation', 'navigation_time', navigationTime);
      }

      setTag('last_selected_muscle', muscleGroupName);
    } catch (error) {
      captureError(error as Error, {
        category: 'navigation_error',
        screen: 'exercises',
        component: 'MuscleGroupNavigation',
        muscleGroup: muscleGroupName,
      });
    }
  };

  const navigateToAllExercises = () => {
    const startTime = Date.now();

    addBreadcrumb('Navigating to all exercises', 'navigation', {
      currentView,
    });

    try {
      router.push({
        pathname: '/exercises-list',
        params: { muscleGroup: 'all' },
      });

      const navigationTime = Date.now() - startTime;
      addBreadcrumb('Navigation to all exercises completed', 'performance', {
        navigationTime,
      });

      if (navigationTime > 300) {
        capturePerformanceError('Slow all exercises navigation', 'navigation_time', navigationTime);
      }
    } catch (error) {
      captureError(error as Error, {
        category: 'navigation_error',
        screen: 'exercises',
        component: 'AllExercisesNavigation',
      });
    }
  };

  // Enhanced muscle group press handler
  const handleMuscleGroupPress = (muscleName: string) => {
    const startTime = Date.now();

    addBreadcrumb(`Muscle group pressed: ${muscleName}`, 'user_interaction', {
      muscleName,
      currentView,
      timestamp: new Date().toISOString(),
    });

    try {
      if (muscleName === 'Cardio') {
        navigateToExercisesList('Cardio');
      } else {
        navigateToExercisesList(muscleName);
      }

      const interactionTime = Date.now() - startTime;
      if (interactionTime > 200) {
        capturePerformanceError(
          'Slow muscle group interaction',
          'interaction_time',
          interactionTime,
        );
      }
    } catch (error) {
      captureError(error as Error, {
        category: 'ui_error',
        screen: 'exercises',
        component: 'MuscleGroupPress',
        muscleName,
      });
    }
  };

  // Enhanced scroll end handler
  const handleScrollEnd = ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number } } }) => {
    addBreadcrumb('Scroll ended on exercises screen', 'user_interaction', {
      scrollY: nativeEvent.contentOffset.y,
      currentView,
    });
  };

  // Filter muscle groups by current view
  const visibleMuscleGroups = muscleGroups.filter((muscle) => muscle.view === currentView);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <GeneralHeader title="Exercises" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {/* Timer Component */}
          <View style={styles.timerWrapper}>
            <Timer />
          </View>

          {/* View Toggle Buttons */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, currentView === 'front' && styles.activeToggle]}
              onPress={() => handleViewChange('front')}
            >
              <Text style={[styles.toggleText, currentView === 'front' && styles.activeToggleText]}>
                FRONT
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, currentView === 'back' && styles.activeToggle]}
              onPress={() => handleViewChange('back')}
            >
              <Text style={[styles.toggleText, currentView === 'back' && styles.activeToggleText]}>
                BACK
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body Model Container */}
          <View style={styles.bodyModelContainer}>
            <View style={styles.bodyModelWrapper}>
              <View
                style={styles.bodyModel}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Body Image */}
                <Image
                  source={
                    currentView === 'front'
                      ? require('../../assets/body-model_front.png')
                      : require('../../assets/body-model_back.png')
                  }
                  style={styles.bodyImage}
                  resizeMode="contain"
                />

                {/* Muscle Group Markers */}
                {visibleMuscleGroups.map((muscle) => (
                  <MuscleGroupRender
                    key={muscle.id}
                    muscle={muscle}
                    pulseAnim={pulseAnim}
                    onPress={handleMuscleGroupPress}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* All Exercises Button */}
          <View style={styles.allExercisesContainer}>
            <TouchableOpacity style={styles.allExercisesButton} onPress={navigateToAllExercises}>
              <MaterialCommunityIcons name="dumbbell" size={24} color={COLORS.primary} />
              <Text style={styles.allExercisesText}>View All Exercises</Text>
              <MaterialIcons name="arrow-forward-ios" size={16} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bodyModelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 35,
    position: 'relative',
    paddingTop: 50, // Add space for the search button
    minHeight: '100%',
  },
  modelContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imagesContainer: {
    width: '100%',
    height: '90%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bodyModel: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  muscleMarker: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  textContainer: {
    position: 'absolute',
    maxWidth: '30%',
  },
  textLeft: {
    alignItems: 'flex-start',
  },
  textRight: {
    alignItems: 'flex-end',
  },
  markerText: {
    color: 'white',
    fontSize: 14,
    backgroundColor: 'rgba(108, 71, 255, 0.27)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dottedLine: {
    position: 'absolute',
    borderStyle: 'dotted',
    borderWidth: 1,
    borderColor: '#6c47ff',
  },
  viewIndicator: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(224, 15, 15, 0.3)',
  },
  activeDot: {
    backgroundColor: 'white',
  },
  timerIcon: {
    position: 'absolute',
    right: 20,
    bottom: '10%',
    backgroundColor: '#2A2F35',
    borderRadius: 40,
    width: 56,
    height: 56,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#181a20',
  },
  premiumButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  premiumIcon: {
    margin: 0,
    marginTop: 0,
    marginLeft: 0,
  },
  premiumIconColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -10,
  },
  clickableZone: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 4,
  },
  searchButton: {
    position: 'absolute',
    top: HEADER_HEIGHT + 50,
    left: 20,
    zIndex: 10,
  },
  searchSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: '#2A2F35',
    elevation: 3,
    width: 46,
    height: 46,
  },
  scrollIndicator: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  timerWrapper: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  toggleContainer: {
    position: 'absolute',
    top: HEADER_HEIGHT + 50,
    left: 20,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleButton: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  activeToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  toggleText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeToggleText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bodyModelWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  allExercisesContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  allExercisesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  allExercisesText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
