import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, IconButton, Provider, Surface, Text, useTheme } from 'react-native-paper';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import ExerciseGraphModal from '../components/ExerciseGraphModal';
import ExerciseGraphs, { ExerciseData } from '../components/ExerciseGraphs';
import { GeneralHeader } from '../components/GeneralHeader';
import HowToMeasureModal from '../components/HowToMeasureModal';
import { AchievementsSection } from '../components/insights/AchievementsSection';
import { BeforeAfterPhotos } from '../components/insights/BeforeAfterPhotos';
import { StatsOverview } from '../components/insights/StatsOverview';
import { WorkoutCalendar } from '../components/insights/WorkoutCalendar';
import MeasurementModal from '../components/MeasurementModal';
import MeasurementsGraph from '../components/MeasurementsGraph';
import { COLORS, HEADER_HEIGHT, SPACING } from '../constants/theme';
import useImagePreloader from '../hooks/useImagePreloader';
import { Achievement, achievementService, UserAchievement } from '../services/achievements';
import exerciseService from '../services/exerciseService';
import firebaseProgressPhotoService, { ProgressPhoto } from '../services/firebaseProgressPhotos';
import { MeasurementCategory } from '../services/measurements';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import { useMeasurements } from '../store/MeasurementsContext';
import { markAsImportantImage } from '../utils/imagePreloader';
import { SentryAutoInstrumentation, SentryDataCollection, SentryLogger } from '../services/sentry';

interface DisplayProgressPhoto {
  id: string;
  url: string;
  date: string;
}

// Add proper TypeScript interfaces for exercise records
interface UserExerciseRecord {
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  created_at: string;
  user_workout_history:
    | {
        completed_at: string;
      }
    | Array<{
        completed_at: string;
      }>;
}

// Helper function to convert ProgressPhoto to DisplayProgressPhoto
const convertProgressPhotoToDisplayPhoto = (
  photo: ProgressPhoto | undefined,
): DisplayProgressPhoto | undefined => {
  if (!photo) return undefined;
  return {
    id: photo.id,
    url: photo.url,
    date: photo.date.toISOString(),
  };
};

// Helper functions for photo management
const requestCameraPermissions = async (): Promise<boolean> => {
  try {
    SentryDataCollection.addBreadcrumb({
      message: 'Requesting camera permissions',
      category: 'permission',
      level: 'info',
      data: { component: 'InsightsScreen', platform: Platform.OS },
    });

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      SentryLogger.warn('Camera permissions denied', { component: 'InsightsScreen', status });
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to make this work!',
      );
      return false;
    }

    return true;
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      component: 'InsightsScreen',
      action: 'camera_permissions_error',
    });
    return false;
  }
};

const deleteExistingPhoto = async (
  type: 'before' | 'after',
  beforePhoto: ProgressPhoto | undefined,
  afterPhoto: ProgressPhoto | undefined,
  userId: string,
  setBeforePhoto: React.Dispatch<React.SetStateAction<ProgressPhoto | undefined>>,
  setAfterPhoto: React.Dispatch<React.SetStateAction<ProgressPhoto | undefined>>,
): Promise<void> => {
  try {
    const photoToDelete = type === 'before' ? beforePhoto : afterPhoto;
    if (!photoToDelete?.id) return;

    SentryDataCollection.addBreadcrumb({
      message: `Deleting ${type} photo`,
      category: 'data.operation',
      data: { component: 'InsightsScreen', photo_type: type, photo_id: photoToDelete.id },
    });

    await firebaseProgressPhotoService.deletePhoto(userId, photoToDelete.id);

    if (type === 'before') {
      setBeforePhoto(undefined);
    } else {
      setAfterPhoto(undefined);
    }
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      component: 'InsightsScreen',
      action: 'delete_photo_error',
      photo_type: type,
    });
    throw error;
  }
};

const pickAndUploadImage = async (
  type: 'before' | 'after',
  userId: string,
  setBeforePhoto: React.Dispatch<React.SetStateAction<ProgressPhoto | undefined>>,
  setAfterPhoto: React.Dispatch<React.SetStateAction<ProgressPhoto | undefined>>,
): Promise<void> => {
  try {
    SentryDataCollection.addBreadcrumb({
      message: `Launching image picker for ${type} photo`,
      category: 'ui.interaction',
      data: { component: 'InsightsScreen', photo_type: type },
    });

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      SentryDataCollection.addBreadcrumb({
        message: `Image picker canceled`,
        category: 'ui.interaction',
        data: { component: 'InsightsScreen', photo_type: type },
      });
      return;
    }

    const photo = await firebaseProgressPhotoService.uploadPhoto(
      userId,
      type,
      result.assets[0].uri,
      new Date(),
    );

    SentryDataCollection.addBreadcrumb({
      message: `Photo uploaded successfully`,
      category: 'data.operation',
      data: { component: 'InsightsScreen', photo_type: type, photo_id: photo.id },
    });

    if (type === 'before') {
      setBeforePhoto(photo);
    } else {
      setAfterPhoto(photo);
    }
  } catch (error) {
    SentryDataCollection.captureException(error as Error, {
      component: 'InsightsScreen',
      action: 'pick_upload_image_error',
      photo_type: type,
    });
    throw error;
  }
};

export default function InsightsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const {
    measurements,
    measurementHistory,
    loading: measurementsLoading,
    addMeasurement,
    refreshMeasurements,
  } = useMeasurements();

  const [selectedFilter, setSelectedFilter] = useState('1w');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [key, setKey] = useState(0);
  const [beforePhoto, setBeforePhoto] = useState<ProgressPhoto | undefined>();
  const [afterPhoto, setAfterPhoto] = useState<ProgressPhoto | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [completedAchievements, setCompletedAchievements] = useState<UserAchievement[]>([]);
  const [randomAchievements, setRandomAchievements] = useState<Achievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementCategory | null>(null);
  const [showHowToMeasure, setShowHowToMeasure] = useState(false);
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseData | undefined>();
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // Animation state for background scale and modal slide
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Preload progress photos when they're available
  const progressPhotosToPreload = React.useMemo(() => {
    const urls: string[] = [];
    if (beforePhoto?.url) urls.push(beforePhoto.url);
    if (afterPhoto?.url) urls.push(afterPhoto.url);
    return urls;
  }, [beforePhoto?.url, afterPhoto?.url]);

  // Use the image preloader hook to preload progress photos
  useImagePreloader(progressPhotosToPreload, {
    priority: 'high',
    debugLabel: 'InsightsProgressPhotos',
    skipIfCached: true,
  });

  // Mark progress photos as important to keep them in memory
  useEffect(() => {
    if (beforePhoto?.url) {
      markAsImportantImage(beforePhoto.url);
    }
    if (afterPhoto?.url) {
      markAsImportantImage(afterPhoto.url);
    }
  }, [beforePhoto?.url, afterPhoto?.url]);

  // Animated modal open/close handlers
  const openHowToMeasure = () => {
    // Track modal open interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'open_how_to_measure_modal',
      'button_press',
      'insights_screen',
      {
        component: 'InsightsScreen',
        action: 'open_how_to_measure',
        user_id: user?.id,
        platform: Platform.OS,
      },
    );

    SentryDataCollection.addBreadcrumb({
      message: 'Opening how to measure modal',
      category: 'ui.interaction',
      level: 'info',
      data: {
        component: 'InsightsScreen',
        action: 'open_how_to_measure_modal',
        user_id: user?.id,
        platform: Platform.OS,
      },
    });

    setShowHowToMeasure(true);
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  };

  const closeHowToMeasure = () => {
    // Track modal close interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'close_how_to_measure_modal',
      'button_press',
      'insights_screen',
      {
        component: 'InsightsScreen',
        action: 'close_how_to_measure',
        user_id: user?.id,
        platform: Platform.OS,
      },
    );

    SentryDataCollection.addBreadcrumb({
      message: 'Closing how to measure modal',
      category: 'ui.interaction',
      level: 'info',
      data: {
        component: 'InsightsScreen',
        action: 'close_how_to_measure_modal',
        user_id: user?.id,
        platform: Platform.OS,
      },
    });

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
      Animated.timing(modalAnim, {
        toValue: Dimensions.get('window').height,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => setShowHowToMeasure(false));
  };

  // Load saved photos, achievements, and measurements on component mount
  useEffect(() => {
    // Track screen mount
    SentryDataCollection.addBreadcrumb({
      message: 'InsightsScreen mounted',
      category: 'lifecycle',
      level: 'info',
      data: {
        component: 'InsightsScreen',
        action: 'screen_mount',
        user_id: user?.id,
        has_user: !!user?.id,
        platform: Platform.OS,
      },
    });

    if (user?.id) {
      // Track data loading start
      SentryDataCollection.addBreadcrumb({
        message: 'Starting initial data load for InsightsScreen',
        category: 'data.load',
        level: 'info',
        data: {
          component: 'InsightsScreen',
          action: 'initial_data_load_start',
          user_id: user.id,
          platform: Platform.OS,
        },
      });

      loadSavedPhotos();
      loadAchievements();
      loadExerciseData();
    } else {
      // Track no user scenario
      SentryDataCollection.addBreadcrumb({
        message: 'InsightsScreen mounted without user',
        category: 'lifecycle',
        level: 'warning',
        data: {
          component: 'InsightsScreen',
          action: 'mount_no_user',
          platform: Platform.OS,
        },
      });
    }
  }, [user?.id]);

  const loadAchievements = async () => {
    if (!user?.id) {
      SentryLogger.warn('No user ID for achievements loading', { component: 'InsightsScreen' });
      return;
    }

    try {
      setAchievementsLoading(true);
      const completed = await achievementService.getUserCompletedAchievements(user.id);
      setCompletedAchievements(completed.slice(0, 3));

      const randomCount = Math.max(0, 3 - completed.length);
      if (randomCount > 0) {
        const random = await achievementService.getRandomAchievements(user.id, randomCount);
        setRandomAchievements(random);
      } else {
        setRandomAchievements([]);
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsScreen',
        action: 'load_achievements_error',
      });
      SentryLogger.error('Error loading achievements', {
        error: error as Error,
        component: 'InsightsScreen',
      });
    } finally {
      setAchievementsLoading(false);
    }
  };

  const loadSavedPhotos = async () => {
    if (!user?.id) {
      SentryLogger.warn('No user ID for photo loading', { component: 'InsightsScreen' });
      return;
    }

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Loading progress photos',
        category: 'data.load',
        data: { component: 'InsightsScreen', user_id: user.id },
      });

      setIsLoading(true);
      const latestPhotos = await firebaseProgressPhotoService.getLatestPhotos(user.id);

      // Update state only if URLs have changed
      if (latestPhotos.before?.url !== beforePhoto?.url) {
        setBeforePhoto(latestPhotos.before);
      }
      if (latestPhotos.after?.url !== afterPhoto?.url) {
        setAfterPhoto(latestPhotos.after);
      }

      // Preload photos
      if (latestPhotos.before?.url) markAsImportantImage(latestPhotos.before.url);
      if (latestPhotos.after?.url) markAsImportantImage(latestPhotos.after.url);

      SentryDataCollection.addBreadcrumb({
        message: 'Photos loaded successfully',
        category: 'data.load',
        data: {
          component: 'InsightsScreen',
          has_before: !!latestPhotos.before,
          has_after: !!latestPhotos.after,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsScreen',
        action: 'load_photos_error',
      });
      SentryLogger.error('Error loading photos', {
        error: error as Error,
        component: 'InsightsScreen',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadExerciseData = async () => {
    if (!user?.id) {
      SentryLogger.warn('Attempted to load exercise data without user ID', {
        component: 'InsightsScreen',
        action: 'load_exercise_data_no_user',
      });
      return;
    }

    try {
      // Track exercise data loading start
      SentryDataCollection.addBreadcrumb({
        message: 'Loading exercise data for InsightsScreen',
        category: 'data.load',
        level: 'info',
        data: {
          component: 'InsightsScreen',
          action: 'load_exercise_data_start',
          user_id: user.id,
          platform: Platform.OS,
        },
      });

      // Get user's exercise records from the database with exercise details
      const { data: exerciseRecords, error } = await supabase
        .from('user_exercise_records')
        .select(
          `
          exercise_id,
          weight,
          reps,
          created_at,
          user_workout_history!inner(
            completed_at
          )
        `,
        )
        .eq('user_workout_history.user_id', user.id)
        .eq('completed', true)
        .not('weight', 'is', null)
        .neq('weight', 0)
        .order('user_workout_history(completed_at)', { ascending: true });

      if (error) {
        SentryDataCollection.captureException(
          new Error('Supabase query error for exercise records'),
          {
            component: 'InsightsScreen',
            supabase_error: error,
          },
        );
        setExercises([]);
        return;
      }

      if (!exerciseRecords || exerciseRecords.length === 0) {
        setExercises([]);
        return;
      }

      // Get exercise details
      const exercises = await exerciseService.getAllExercises();
      const exerciseMap = new Map(exercises.map((ex) => [ex.id, ex.name]));

      // Group records by exercise and transform data
      const exerciseDataMap = new Map<string, ExerciseData>();

      exerciseRecords.forEach((record: UserExerciseRecord) => {
        const exerciseId = record.exercise_id;
        const exerciseName = exerciseMap.get(exerciseId) || 'Unknown Exercise';

        if (!exerciseDataMap.has(exerciseId)) {
          exerciseDataMap.set(exerciseId, {
            id: exerciseId,
            name: exerciseName,
            unit: 'kg',
            data: [],
          });
        }

        const exerciseData = exerciseDataMap.get(exerciseId)!;
        const workoutHistory = Array.isArray(record.user_workout_history)
          ? record.user_workout_history[0]
          : record.user_workout_history;

        exerciseData.data.push({
          date: format(new Date(workoutHistory.completed_at), 'dd.MM'),
          value: record.weight || 0,
        });
      });

      // Convert map to array and limit to most recent exercises
      const exerciseDataArray = Array.from(exerciseDataMap.values())
        .filter((ex) => ex.data.length > 0)
        .slice(0, 10); // Limit to 10 exercises for performance

      setExercises(exerciseDataArray);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsScreen',
        action: 'load_exercise_data_error',
      });
      setExercises([]);
    }
  };

  const cleanupAndPickImage = async (type: 'before' | 'after') => {
    if (!user?.id) {
      SentryLogger.warn('Photo access without user ID', { component: 'InsightsScreen' });
      Alert.alert('Authentication Required', 'Please sign in to add progress photos');
      return;
    }

    const hasPermissions = await requestCameraPermissions();
    if (!hasPermissions) return;

    try {
      setIsLoading(true);

      // Delete existing photo if it exists
      try {
        await deleteExistingPhoto(
          type,
          beforePhoto,
          afterPhoto,
          user.id,
          setBeforePhoto,
          setAfterPhoto,
        );
      } catch (error) {
        // Continue with uploading a new photo even if deletion failed
        SentryLogger.warn('Photo deletion failed, continuing', { error: error as Error });
      }

      // Pick and upload new image
      try {
        await pickAndUploadImage(type, user.id, setBeforePhoto, setAfterPhoto);
      } catch (error) {
        SentryLogger.error('Photo upload failed', { error: error as Error });
        Alert.alert('Upload Failed', 'Failed to upload photo. Please try again.');
      }
    } catch (pickError) {
      SentryDataCollection.captureException(pickError as Error, {
        component: 'InsightsScreen',
        action: 'photo_workflow_error',
      });
      Alert.alert('Selection Failed', 'Failed to select photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoPress = (type: 'before' | 'after') => {
    SentryAutoInstrumentation.trackUserInteraction(
      'progress_photo_press',
      'button_press',
      'insights_screen',
      {
        photo_type: type,
      },
    );
    cleanupAndPickImage(type);
  };

  const handleMonthChange = (date: { timestamp: number }) => {
    // Track month change interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'calendar_month_change',
      'calendar_navigation',
      'insights_screen',
      {
        component: 'InsightsScreen',
        action: 'month_change',
        new_date: new Date(date.timestamp).toISOString(),
        user_id: user?.id,
        platform: Platform.OS,
      },
    );

    SentryDataCollection.addBreadcrumb({
      message: 'Calendar month changed',
      category: 'ui.interaction',
      level: 'info',
      data: {
        component: 'InsightsScreen',
        action: 'calendar_month_change',
        new_date: new Date(date.timestamp).toISOString(),
        user_id: user?.id,
        platform: Platform.OS,
      },
    });

    setCalendarDate(new Date(date.timestamp));
  };

  const handleTodayPress = () => {
    SentryAutoInstrumentation.trackUserInteraction(
      'calendar_today_press',
      'button_press',
      'insights_screen',
    );
    const today = new Date();
    setCalendarDate(today);
    setKey((prev) => prev + 1);
  };

  const handleAchievementPress = (achievement: UserAchievement) => {
    SentryAutoInstrumentation.trackUserInteraction(
      'achievement_press',
      'button_press',
      'insights_screen',
      {
        achievement_id: achievement.achievement?.id,
      },
    );
    setSelectedAchievement(achievement.achievement || null);
  };

  const handleMeasurementPress = async (category: MeasurementCategory) => {
    SentryAutoInstrumentation.trackUserInteraction(
      'measurement_press',
      'button_press',
      'insights_screen',
      {
        measurement_category: category,
      },
    );
    setSelectedMeasurement(category);
  };

  const handleSaveMeasurement = async (value: number) => {
    if (!user?.id || !selectedMeasurement) {
      SentryLogger.warn('Invalid measurement save attempt', { component: 'InsightsScreen' });
      return;
    }

    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'save_measurement',
        'form_submit',
        'insights_screen',
        {
          measurement_category: selectedMeasurement,
          measurement_value: value,
        },
      );

      await addMeasurement(
        selectedMeasurement,
        value,
        selectedMeasurement === 'WEIGHT' ? 'kg' : 'cm',
      );
      setSelectedMeasurement(null);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsScreen',
        action: 'save_measurement_error',
      });
      SentryLogger.error('Error saving measurement', {
        error: error as Error,
        component: 'InsightsScreen',
      });
    }
  };

  // Note: All images are already preloaded during splash screen

  const handleAddExercise = () => {
    // Track add exercise interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'add_exercise_press',
      'button_press',
      'insights_screen',
      {
        component: 'InsightsScreen',
        action: 'add_exercise',
        user_id: user?.id,
        platform: Platform.OS,
      },
    );

    SentryDataCollection.addBreadcrumb({
      message: 'Add exercise button pressed',
      category: 'ui.interaction',
      level: 'info',
      data: {
        component: 'InsightsScreen',
        action: 'add_exercise_press',
        user_id: user?.id,
        platform: Platform.OS,
      },
    });

    setSelectedExercise(undefined);
    setShowExerciseModal(true);
  };

  const handleExercisePress = (exerciseId: string) => {
    // Track exercise press interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'exercise_press',
      'button_press',
      'insights_screen',
      {
        component: 'InsightsScreen',
        action: 'exercise_press',
        exercise_id: exerciseId,
        user_id: user?.id,
        platform: Platform.OS,
      },
    );

    const exercise = exercises.find((e) => e.id === exerciseId);

    SentryDataCollection.addBreadcrumb({
      message: 'Exercise pressed for editing',
      category: 'ui.interaction',
      level: 'info',
      data: {
        component: 'InsightsScreen',
        action: 'exercise_press',
        exercise_id: exerciseId,
        exercise_name: exercise?.name,
        exercise_found: !!exercise,
        user_id: user?.id,
        platform: Platform.OS,
      },
    });

    if (exercise) {
      setSelectedExercise(exercise);
      setShowExerciseModal(true);
    } else {
      SentryLogger.warn('Exercise not found when pressed', {
        component: 'InsightsScreen',
        exercise_id: exerciseId,
        available_exercises: exercises.length,
        user_id: user?.id,
      });
    }
  };

  const handleSaveExercise = (exerciseData: Partial<ExerciseData>) => {
    try {
      const isUpdate = !!exerciseData.id;

      SentryAutoInstrumentation.trackUserInteraction(
        isUpdate ? 'update_exercise' : 'add_exercise',
        'form_submit',
        'insights_screen',
        { exercise_id: exerciseData.id, exercise_name: exerciseData.name },
      );

      if (exerciseData.id) {
        setExercises((prev) =>
          prev.map((e) => (e.id === exerciseData.id ? { ...e, ...exerciseData } : e)),
        );
      } else {
        const newExercise: ExerciseData = {
          id: Date.now().toString(),
          name: exerciseData.name!,
          data: exerciseData.data!,
          unit: exerciseData.unit,
        };
        setExercises((prev) => [...prev, newExercise]);
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsScreen',
        action: 'save_exercise_error',
      });
      SentryLogger.error('Error saving exercise', {
        error: error as Error,
        component: 'InsightsScreen',
      });
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'delete_exercise',
        'button_press',
        'insights_screen',
        {
          exercise_id: exerciseId,
        },
      );
      setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'InsightsScreen',
        action: 'delete_exercise_error',
      });
      SentryLogger.error('Error deleting exercise', {
        error: error as Error,
        component: 'InsightsScreen',
      });
    }
  };

  const handleSetGoal = (exerciseId: string) => {
    SentryAutoInstrumentation.trackUserInteraction(
      'set_exercise_goal',
      'button_press',
      'insights_screen',
      {
        exercise_id: exerciseId,
      },
    );
    // TODO: Implement goal setting functionality
    console.log('Set goal for exercise:', exerciseId);
  };

  return (
    <Provider>
      <View style={styles.container}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />

        <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
          <GeneralHeader
            title="Insights"
            icon={<MaterialCommunityIcons name="chart-box" size={24} color={COLORS.text} />}
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
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingTop: HEADER_HEIGHT + SPACING.xxl,
              paddingBottom: 100,
            }}
          >
            {/* Time Period Filter and Stats Overview */}
            <StatsOverview selectedFilter={selectedFilter} onFilterChange={setSelectedFilter} />

            {/* Calendar */}
            <WorkoutCalendar
              calendarDate={calendarDate}
              calendarKey={key}
              onMonthChange={handleMonthChange}
              onTodayPress={handleTodayPress}
            />

            {/* Before and After Section */}
            <BeforeAfterPhotos
              beforePhoto={convertProgressPhotoToDisplayPhoto(beforePhoto)}
              afterPhoto={convertProgressPhotoToDisplayPhoto(afterPhoto)}
              isLoading={isLoading}
              onPhotoPress={handlePhotoPress}
              onImageError={() => {}}
            />

            {/* Achievements Section */}
            <AchievementsSection
              achievementsLoading={achievementsLoading}
              completedAchievements={completedAchievements}
              randomAchievements={randomAchievements}
              onAchievementPress={handleAchievementPress}
              onRandomAchievementPress={(achievement) => setSelectedAchievement(achievement)}
            />

            {/* Measurements Section */}
            <Surface style={styles.measurementsContainer} elevation={2}>
              <View style={styles.sectionHeader}>
                <View style={styles.headerSide} />
                <View style={styles.titleContainer}>
                  <Text style={styles.sectionTitle}>MEASUREMENTS</Text>
                  <IconButton
                    icon="information"
                    iconColor="#fff"
                    size={20}
                    onPress={openHowToMeasure}
                    style={styles.infoIcon}
                  />
                </View>
                <View style={styles.headerSide} />
              </View>

              {measurementsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <MeasurementsGraph
                  measurements={measurements}
                  onMeasurementPress={handleMeasurementPress}
                />
              )}
            </Surface>

            {/* Exercise Graphs Section */}
            <ExerciseGraphs
              exercises={exercises}
              onAddExercise={handleAddExercise}
              onExercisePress={handleExercisePress}
              onSetGoal={handleSetGoal}
              onDeleteExercise={handleDeleteExercise}
            />

            {/* Achievement Modal */}
            <Modal
              visible={!!selectedAchievement}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setSelectedAchievement(null)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setSelectedAchievement(null)}>
                <View style={styles.modalContainer}>
                  <Pressable style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <IconButton
                        icon="close"
                        iconColor="#fff"
                        size={24}
                        style={styles.closeButton}
                        onPress={() => setSelectedAchievement(null)}
                      />
                    </View>

                    {selectedAchievement && (
                      <View style={styles.achievementDetail}>
                        <View
                          style={[
                            styles.achievementIconLarge,
                            { backgroundColor: selectedAchievement.icon_background_color },
                          ]}
                        >
                          <IconButton icon={selectedAchievement.icon} size={40} iconColor="#000" />
                        </View>
                        <Text style={styles.achievementTitle}>{selectedAchievement.title}</Text>
                        <Text style={styles.achievementDescription}>
                          {selectedAchievement.description}
                        </Text>
                        {selectedAchievement.total_progress && (
                          <Text style={styles.achievementProgress}>
                            Progress:{' '}
                            {completedAchievements.find(
                              (a) => a.achievement?.id === selectedAchievement.id,
                            )?.current_progress || 0}
                            /{selectedAchievement.total_progress}
                          </Text>
                        )}
                        {completedAchievements.find(
                          (a) => a.achievement?.id === selectedAchievement.id,
                        )?.completed_at && (
                          <Text style={styles.achievementDate}>
                            Completed on{' '}
                            {(() => {
                              const completedAchievement = completedAchievements.find(
                                (a) => a.achievement?.id === selectedAchievement.id,
                              );
                              return completedAchievement?.completed_at
                                ? format(
                                    new Date(completedAchievement.completed_at),
                                    'MMM dd, yyyy',
                                  )
                                : '';
                            })()}
                          </Text>
                        )}
                        <Button
                          mode="contained"
                          style={styles.shareButton}
                          labelStyle={styles.shareButtonLabel}
                          onPress={() => {}}
                        >
                          Share
                        </Button>
                      </View>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          </ScrollView>
        </Animated.View>

        {/* Measurement Modal */}
        <MeasurementModal
          visible={selectedMeasurement !== null}
          category={selectedMeasurement || 'WEIGHT'}
          lastValue={measurements[selectedMeasurement || 'WEIGHT']?.value}
          measurements={selectedMeasurement ? measurementHistory[selectedMeasurement] : []}
          onClose={() => setSelectedMeasurement(null)}
          onSave={handleSaveMeasurement}
          userId={user?.id || ''}
          onMeasurementsChange={refreshMeasurements}
        />

        <HowToMeasureModal
          visible={showHowToMeasure}
          onClose={closeHowToMeasure}
          modalAnim={modalAnim}
        />

        {/* Exercise Graph Modal */}
        <ExerciseGraphModal
          visible={showExerciseModal}
          onClose={() => setShowExerciseModal(false)}
          onSave={handleSaveExercise}
          exercise={selectedExercise}
        />
      </View>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  combinedStatsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  statsOverview: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: 'transparent',
    borderRadius: 20,
    minWidth: 50,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 8,
  },
  calendarContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  beforeAfterContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  photoComparisonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    position: 'relative',
  },
  photoColumn: {
    width: '45%',
    alignItems: 'center',
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
  },
  photoDate: {
    fontSize: 10,
    color: COLORS.text,
    marginTop: 2,
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  addPhotoButton: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: 'rgba(107, 78, 255, 0.1)',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  dateText: {
    color: COLORS.text,
    fontSize: 12,
    textAlign: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  todayButtonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  todayButtonPressed: {
    backgroundColor: 'rgba(107, 78, 255, 0.1)',
  },
  todayButton: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  disabled: {
    opacity: 0.5,
  },
  arrowContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  purpleDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  achievementsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
  },
  achievementCard: {
    width: '31%',
    aspectRatio: 0.85,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  achievementContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  achievementIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 224, 9, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  achievementDescription: {
    fontSize: 16,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 16,
  },
  achievementDate: {
    fontSize: 10,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerSide: {
    width: 60,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  moreButton: {
    marginRight: -8,
  },
  moreButtonLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxWidth: 340,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    marginTop: -12,
    marginRight: -12,
  },
  closeButton: {
    margin: 0,
  },
  achievementDetail: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  achievementIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  shareButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  shareButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  noAchievementsText: {
    color: COLORS.text,
    textAlign: 'center',
    width: '100%',
    marginTop: 16,
  },
  achievementProgress: {
    fontSize: 14,
    color: COLORS.warning,
    marginBottom: 8,
  },
  achievementLocked: {
    opacity: 0.7,
    backgroundColor: COLORS.background,
  },
  achievementIconLocked: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
  },
  achievementTextLocked: {
    color: COLORS.text,
  },
  measurementsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  measurementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  measurementCard: {
    width: '23%',
    aspectRatio: 0.85,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  measurementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 224, 9, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  measurementLabel: {
    fontSize: 10,
    color: COLORS.text,
    textAlign: 'center',
  },
  infoIcon: {
    margin: 0,
    marginLeft: 0,
    marginBottom: 10,
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
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -10,
  },
  premiumIconColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
});
