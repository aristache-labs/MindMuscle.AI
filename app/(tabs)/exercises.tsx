import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StatusBar,
  ViewStyle,
  GestureResponderEvent,
  Animated,
  Modal,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { Text, IconButton, Surface } from 'react-native-paper';
import { COLORS, BORDER_RADIUS, HEADER_HEIGHT } from '../constants/theme';
import Timer from '../components/timer';
import { GeneralHeader } from '../components/GeneralHeader';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SentryDataCollection, SentryLogger, SentryAutoInstrumentation } from '../services/sentry';

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
      onPress={() => {
        try {
          SentryDataCollection.addBreadcrumb({
            message: `Muscle marker clicked: ${muscle.name}`,
            category: 'user-interaction',
            level: 'info',
            data: {
              component: 'MuscleMarker',
              action: 'marker_click',
              muscle_name: muscle.name,
              muscle_id: muscle.id,
              muscle_view: muscle.view,
              is_cardio: isCardio,
              platform: Platform.OS,
            },
          });

          onPress(muscle.name);
        } catch (error) {
          SentryDataCollection.captureException(error as Error, {
            component: 'MuscleMarker',
            action: 'marker_click_error',
            muscle_name: muscle.name,
            platform: Platform.OS,
          });
          onPress(muscle.name);
        }
      }}
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
    onPress={() => {
      try {
        SentryDataCollection.addBreadcrumb({
          message: `Muscle text clicked: ${muscle.name}`,
          category: 'user-interaction',
          level: 'info',
          data: {
            component: 'MuscleText',
            action: 'text_click',
            muscle_name: muscle.name,
            muscle_id: muscle.id,
            muscle_view: muscle.view,
            platform: Platform.OS,
          },
        });

        onPress(muscle.name);
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'MuscleText',
          action: 'text_click_error',
          muscle_name: muscle.name,
          platform: Platform.OS,
        });
        onPress(muscle.name);
      }
    }}
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
    onPress={() => {
      try {
        SentryDataCollection.addBreadcrumb({
          message: `Muscle clickable zone pressed: ${muscle.name}`,
          category: 'user-interaction',
          level: 'info',
          data: {
            component: 'ClickableZone',
            action: 'zone_click',
            muscle_name: muscle.name,
            muscle_id: muscle.id,
            muscle_view: muscle.view,
            zone_width: calculateClickableZoneWidth(muscle),
            zone_left: calculateClickableZoneLeft(muscle),
            platform: Platform.OS,
          },
        });

        onPress(muscle.name);
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'ClickableZone',
          action: 'zone_click_error',
          muscle_name: muscle.name,
          platform: Platform.OS,
        });
        onPress(muscle.name);
      }
    }}
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
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [touchStart, setTouchStart] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const SWIPE_THRESHOLD = 50;
  const router = useRouter();

  // Track component mount/unmount
  useEffect(() => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'ExercisesScreen mounted',
        category: 'ui-lifecycle',
        level: 'info',
        data: {
          component: 'ExercisesScreen',
          action: 'component_mount',
          initial_view: currentView,
          platform: Platform.OS,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ExercisesScreen',
        action: 'mount_tracking',
        platform: Platform.OS,
      });
    }

    return () => {
      try {
        SentryDataCollection.addBreadcrumb({
          message: 'ExercisesScreen unmounted',
          category: 'ui-lifecycle',
          level: 'info',
          data: {
            component: 'ExercisesScreen',
            action: 'component_unmount',
            final_view: currentView,
            platform: Platform.OS,
          },
        });
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'ExercisesScreen',
          action: 'unmount_tracking',
          platform: Platform.OS,
        });
      }
    };
  }, [currentView]);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Directly reference body model images without preloading via hook
  const frontBodyModel = require('../../assets/body-model_front.png');
  const backBodyModel = require('../../assets/body-model_back.png');

  useEffect(() => {
    if (isImageLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Start the pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [isImageLoaded]);

  const handleViewChange = (newView: 'front' | 'back') => {
    try {
      if (isTransitioning || newView === currentView) {
        SentryDataCollection.addBreadcrumb({
          message: 'View change blocked',
          category: 'user-interaction',
          level: 'info',
          data: {
            component: 'ExercisesScreen',
            action: 'view_change_blocked',
            current_view: currentView,
            requested_view: newView,
            is_transitioning: isTransitioning,
            platform: Platform.OS,
          },
        });
        return;
      }

      // Track view change
      SentryAutoInstrumentation.trackUserInteraction(
        'change_body_view',
        'view_toggle',
        'exercises_screen',
        {
          from_view: currentView,
          to_view: newView,
          platform: Platform.OS,
        },
      );

      SentryDataCollection.addBreadcrumb({
        message: `Body view changed from ${currentView} to ${newView}`,
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'ExercisesScreen',
          action: 'view_change',
          from_view: currentView,
          to_view: newView,
          platform: Platform.OS,
        },
      });

      setIsTransitioning(true);
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentView(newView);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start(() => {
          setIsTransitioning(false);
        });
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ExercisesScreen',
        action: 'view_change_error',
        current_view: currentView,
        requested_view: newView,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ExercisesScreen view change', {
        error: error as Error,
        component: 'ExercisesScreen',
        current_view: currentView,
        requested_view: newView,
      });

      // Still try to change view if tracking fails
      try {
        if (!isTransitioning && newView !== currentView) {
          setIsTransitioning(true);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start(() => {
            setCurrentView(newView);
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }).start(() => {
              setIsTransitioning(false);
            });
          });
        }
      } catch (fallbackError) {
        SentryDataCollection.captureException(fallbackError as Error, {
          component: 'ExercisesScreen',
          action: 'view_change_fallback_error',
          platform: Platform.OS,
        });
      }
    }
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    try {
      setTouchStart(event.nativeEvent.pageX);

      SentryDataCollection.addBreadcrumb({
        message: 'Touch gesture started on body model',
        category: 'user-interaction',
        level: 'debug',
        data: {
          component: 'ExercisesScreen',
          action: 'touch_start',
          touch_x: event.nativeEvent.pageX,
          current_view: currentView,
          platform: Platform.OS,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ExercisesScreen',
        action: 'touch_start_error',
        platform: Platform.OS,
      });
    }
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    try {
      const swipeLength = event.nativeEvent.pageX - touchStart;
      const swipeDirection = swipeLength > 0 ? 'right' : 'left';
      const isSwipe = Math.abs(swipeLength) > SWIPE_THRESHOLD;

      // Track touch gesture completion
      SentryDataCollection.addBreadcrumb({
        message: `Touch gesture ended: ${isSwipe ? 'swipe' : 'tap'} ${swipeDirection}`,
        category: 'user-interaction',
        level: 'debug',
        data: {
          component: 'ExercisesScreen',
          action: 'touch_end',
          touch_x: event.nativeEvent.pageX,
          swipe_length: swipeLength,
          swipe_direction: swipeDirection,
          is_swipe: isSwipe,
          threshold: SWIPE_THRESHOLD,
          current_view: currentView,
          platform: Platform.OS,
        },
      });

      if (isSwipe) {
        // Track swipe gesture
        SentryAutoInstrumentation.trackUserInteraction(
          'swipe_gesture',
          'swipe',
          'exercises_screen',
          {
            direction: swipeDirection,
            swipe_length: swipeLength,
            current_view: currentView,
            threshold: SWIPE_THRESHOLD,
            platform: Platform.OS,
          },
        );

        // Continuous horizontal scrolling - cycle between views
        if (swipeDirection === 'left') {
          // Swipe left: front -> back -> front -> back...
          const nextView = currentView === 'front' ? 'back' : 'front';
          handleViewChange(nextView);
        } else if (swipeDirection === 'right') {
          // Swipe right: back -> front -> back -> front...
          const nextView = currentView === 'back' ? 'front' : 'back';
          handleViewChange(nextView);
        }
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ExercisesScreen',
        action: 'touch_end_error',
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ExercisesScreen touch handler', {
        error: error as Error,
        component: 'ExercisesScreen',
      });
    }
  };

  const navigateToExercisesList = (muscleGroupName: string) => {
    try {
      // Track muscle group selection
      SentryAutoInstrumentation.trackUserInteraction(
        'select_muscle_group',
        'muscle_group_click',
        'exercises_screen',
        {
          muscle_group: muscleGroupName,
          current_view: currentView,
          platform: Platform.OS,
        },
      );

      SentryDataCollection.addBreadcrumb({
        message: `User selected muscle group: ${muscleGroupName}`,
        category: 'navigation',
        level: 'info',
        data: {
          component: 'ExercisesScreen',
          action: 'navigate_to_muscle_group',
          muscle_group: muscleGroupName,
          current_view: currentView,
          platform: Platform.OS,
        },
      });

      // Update to use the new dedicated page for single muscle groups
      const categoryId = muscleGroupName;

      router.push({
        pathname: '/(tabs)/exercises-single-group',
        params: { categoryId, fromScreen: 'exercises' },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ExercisesScreen',
        action: 'navigate_to_muscle_group_error',
        muscle_group: muscleGroupName,
        platform: Platform.OS,
      });

      SentryLogger.error('Error navigating to muscle group exercises', {
        error: error as Error,
        component: 'ExercisesScreen',
        muscle_group: muscleGroupName,
      });
    }
  };

  const navigateToAllExercises = () => {
    try {
      // Track navigation to all exercises
      SentryAutoInstrumentation.trackUserInteraction(
        'navigate_to_all_exercises',
        'search_button',
        'exercises_screen',
        {
          current_view: currentView,
          platform: Platform.OS,
        },
      );

      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to all exercises list',
        category: 'navigation',
        level: 'info',
        data: {
          component: 'ExercisesScreen',
          action: 'navigate_to_all_exercises',
          current_view: currentView,
          platform: Platform.OS,
        },
      });

      router.push({
        pathname: '/(tabs)/exercises-list',
        params: {
          showAllCategories: 'true',
          openSearch: 'true',
          fromScreen: 'exercises',
          resetSearch: 'true',
          groupByMuscle: 'true',
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ExercisesScreen',
        action: 'navigate_to_all_exercises_error',
        platform: Platform.OS,
      });

      SentryLogger.error('Error navigating to all exercises', {
        error: error as Error,
        component: 'ExercisesScreen',
      });
    }
  };

  const filteredMuscles = muscleGroups.filter((muscle) => muscle.view === currentView);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <GeneralHeader
          title="Exercises"
          icon={<MaterialIcons name="fitness-center" size={24} color={COLORS.text} />}
          rightElement={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable style={styles.premiumButton} onPress={() => {}}>
                <View style={styles.premiumIconColumn}>
                  <IconButton
                    icon="crown"
                    iconColor="#f9e009"
                    size={26}
                    style={styles.premiumIcon}
                  />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              </Pressable>
            </View>
          }
        />

        {/* Search Icon */}
        <TouchableOpacity style={styles.searchButton} onPress={navigateToAllExercises}>
          <Surface style={styles.searchSurface}>
            <MaterialIcons name="search" size={24} color={COLORS.text} />
          </Surface>
        </TouchableOpacity>

        {/* Timer Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showTimer}
          onRequestClose={() => {
            try {
              SentryAutoInstrumentation.trackUserInteraction(
                'close_timer_modal',
                'modal_close',
                'exercises_screen',
                {
                  current_view: currentView,
                  platform: Platform.OS,
                },
              );

              SentryDataCollection.addBreadcrumb({
                message: 'Timer modal closed via system back button',
                category: 'user-interaction',
                level: 'info',
                data: {
                  component: 'ExercisesScreen',
                  action: 'timer_modal_system_close',
                  current_view: currentView,
                  platform: Platform.OS,
                },
              });

              setShowTimer(false);
            } catch (error) {
              SentryDataCollection.captureException(error as Error, {
                component: 'ExercisesScreen',
                action: 'timer_modal_close_error',
                platform: Platform.OS,
              });
              setShowTimer(false);
            }
          }}
        >
          <View style={styles.modalContainer}>
            <Timer
              onClose={() => {
                try {
                  SentryAutoInstrumentation.trackUserInteraction(
                    'close_timer_modal',
                    'timer_close_button',
                    'exercises_screen',
                    {
                      current_view: currentView,
                      platform: Platform.OS,
                    },
                  );

                  SentryDataCollection.addBreadcrumb({
                    message: 'Timer modal closed via close button',
                    category: 'user-interaction',
                    level: 'info',
                    data: {
                      component: 'ExercisesScreen',
                      action: 'timer_modal_close_button',
                      current_view: currentView,
                      platform: Platform.OS,
                    },
                  });

                  setShowTimer(false);
                } catch (error) {
                  SentryDataCollection.captureException(error as Error, {
                    component: 'ExercisesScreen',
                    action: 'timer_close_button_error',
                    platform: Platform.OS,
                  });
                  setShowTimer(false);
                }
              }}
            />
          </View>
        </Modal>

        {/* Body Model Container */}
        <View
          style={[styles.bodyModelContainer, { paddingTop: HEADER_HEIGHT }]}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Animated.View style={[styles.modelContainer, { opacity: fadeAnim }]}>
            <View style={styles.imagesContainer}>
              {/* Front body model */}
              <Image
                source={frontBodyModel}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  opacity: currentView === 'front' ? 1 : 0,
                  resizeMode: 'contain',
                }}
                onLoad={() => {
                  try {
                    setIsImageLoaded(true);

                    SentryDataCollection.addBreadcrumb({
                      message: 'Front body model image loaded',
                      category: 'ui-lifecycle',
                      level: 'info',
                      data: {
                        component: 'ExercisesScreen',
                        action: 'front_image_loaded',
                        current_view: currentView,
                        platform: Platform.OS,
                      },
                    });
                  } catch (error) {
                    SentryDataCollection.captureException(error as Error, {
                      component: 'ExercisesScreen',
                      action: 'front_image_load_tracking_error',
                      platform: Platform.OS,
                    });
                    setIsImageLoaded(true);
                  }
                }}
              />

              {/* Back body model */}
              <Image
                source={backBodyModel}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  opacity: currentView === 'back' ? 1 : 0,
                  resizeMode: 'contain',
                }}
                onLoad={() => {
                  try {
                    setIsImageLoaded(true);

                    SentryDataCollection.addBreadcrumb({
                      message: 'Back body model image loaded',
                      category: 'ui-lifecycle',
                      level: 'info',
                      data: {
                        component: 'ExercisesScreen',
                        action: 'back_image_loaded',
                        current_view: currentView,
                        platform: Platform.OS,
                      },
                    });
                  } catch (error) {
                    SentryDataCollection.captureException(error as Error, {
                      component: 'ExercisesScreen',
                      action: 'back_image_load_tracking_error',
                      platform: Platform.OS,
                    });
                    setIsImageLoaded(true);
                  }
                }}
              />
            </View>

            {/* Timer Icon */}
            <IconButton
              icon="timer-outline"
              iconColor="white"
              size={38}
              style={styles.timerIcon}
              onPress={() => {
                try {
                  SentryAutoInstrumentation.trackUserInteraction(
                    'open_timer_modal',
                    'timer_button',
                    'exercises_screen',
                    {
                      current_view: currentView,
                      platform: Platform.OS,
                    },
                  );

                  SentryDataCollection.addBreadcrumb({
                    message: 'Timer modal opened from exercises screen',
                    category: 'user-interaction',
                    level: 'info',
                    data: {
                      component: 'ExercisesScreen',
                      action: 'timer_modal_open',
                      current_view: currentView,
                      platform: Platform.OS,
                    },
                  });

                  setShowTimer(true);
                } catch (error) {
                  SentryDataCollection.captureException(error as Error, {
                    component: 'ExercisesScreen',
                    action: 'timer_modal_open_error',
                    platform: Platform.OS,
                  });
                  setShowTimer(true);
                }
              }}
            />

            {/* Muscle Group Markers */}
            {isImageLoaded &&
              filteredMuscles.map((muscle) => (
                <MuscleGroupRender
                  key={muscle.id}
                  muscle={muscle}
                  pulseAnim={pulseAnim}
                  onPress={navigateToExercisesList}
                />
              ))}
          </Animated.View>
        </View>
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
    position: 'relative',
    paddingTop: 50, // Add space for the search button
    paddingBottom: 40, // Add space at the bottom to raise content
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
});
