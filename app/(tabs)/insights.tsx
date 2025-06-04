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
import * as Sentry from '@sentry/react-native';
import { captureAPIError, SentryReactProfiler } from '../services/sentry';

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
    Sentry.addBreadcrumb({
      message: 'Requesting Camera Permissions',
      category: 'api.request',
      level: 'info',
      data: {
        permission: 'camera_roll',
        timestamp: new Date().toISOString(),
      },
    });

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Sentry.addBreadcrumb({
        message: 'Camera Permission Denied',
        category: 'api.error',
        level: 'warning',
        data: {
          status,
          permissionType: 'media_library',
        },
      });

      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to make this work!',
      );
      return false;
    }

    Sentry.addBreadcrumb({
      message: 'Camera Permission Granted',
      category: 'api.success',
      level: 'info',
      data: {
        status,
        permissionType: 'media_library',
      },
    });

    return true;
  } catch (error) {
    captureAPIError(error as Error, 'requestCameraPermissions', 'insights-permissions');

    Sentry.addBreadcrumb({
      message: 'Camera Permission Request Failed',
      category: 'api.error',
      level: 'error',
      data: {
        error: (error as Error).message,
      },
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
    const hasExistingPhoto =
      (type === 'before' && beforePhoto?.id) || (type === 'after' && afterPhoto?.id);

    if (!hasExistingPhoto) return;

    const photoToDelete = type === 'before' ? beforePhoto : afterPhoto;

    if (photoToDelete?.id) {
      Sentry.addBreadcrumb({
        message: `Deleting Existing ${type} Photo`,
        category: 'database.operation',
        level: 'info',
        data: {
          photoType: type,
          photoId: photoToDelete.id,
          userId,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(`Deleting existing ${type} photo with ID: ${photoToDelete.id}`);
      await firebaseProgressPhotoService.deletePhoto(userId, photoToDelete.id);

      if (type === 'before') {
        setBeforePhoto(undefined);
      } else {
        setAfterPhoto(undefined);
      }

      Sentry.addBreadcrumb({
        message: `${type} Photo Deleted Successfully`,
        category: 'database.success',
        level: 'info',
        data: {
          photoType: type,
          photoId: photoToDelete.id,
        },
      });
    }
  } catch (error) {
    captureAPIError(error as Error, 'deleteExistingPhoto', 'insights-photos');

    Sentry.addBreadcrumb({
      message: `Failed to Delete ${type} Photo`,
      category: 'database.error',
      level: 'error',
      data: {
        error: (error as Error).message,
        photoType: type,
        userId,
      },
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
    Sentry.addBreadcrumb({
      message: `Starting Image Picker for ${type} Photo`,
      category: 'user.interaction',
      level: 'info',
      data: {
        photoType: type,
        userId,
        timestamp: new Date().toISOString(),
      },
    });

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      Sentry.addBreadcrumb({
        message: `Image Picker Cancelled for ${type} Photo`,
        category: 'user.interaction',
        level: 'info',
        data: {
          photoType: type,
          cancelled: result.canceled,
          assetsLength: result.assets?.length || 0,
        },
      });
      return;
    }

    const selectedImageUri = result.assets[0].uri;

    Sentry.addBreadcrumb({
      message: `Uploading ${type} Photo`,
      category: 'api.request',
      level: 'info',
      data: {
        photoType: type,
        imageUriLength: selectedImageUri.length,
        hasImage: !!selectedImageUri,
        imageQuality: 0.8,
      },
    });

    console.log(`Uploading new ${type} photo from URI: ${selectedImageUri.substring(0, 50)}...`);

    const photo = await firebaseProgressPhotoService.uploadPhoto(
      userId,
      type,
      selectedImageUri,
      new Date(),
    );

    console.log(`Successfully uploaded ${type} photo with ID: ${photo.id}`);

    if (type === 'before') {
      setBeforePhoto(photo);
    } else {
      setAfterPhoto(photo);
    }

    Sentry.addBreadcrumb({
      message: `${type} Photo Uploaded Successfully`,
      category: 'api.success',
      level: 'info',
      data: {
        photoType: type,
        photoId: photo.id,
        uploadedAt: photo.date.toISOString(),
      },
    });
  } catch (error) {
    captureAPIError(error as Error, 'pickAndUploadImage', 'insights-photos');

    Sentry.addBreadcrumb({
      message: `Failed to Upload ${type} Photo`,
      category: 'api.error',
      level: 'error',
      data: {
        error: (error as Error).message,
        photoType: type,
        userId,
      },
    });

    throw error;
  }
};

const InsightsScreenComponent = () => {
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

  // Track screen initialization
  useEffect(() => {
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: 'Insights Screen Initialized',
      category: 'navigation',
      level: 'info',
      data: {
        userId: user?.id || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });

    Sentry.setTag('current_screen', 'insights');
    Sentry.setTag('user_id', user?.id || 'unknown');
    SentryReactProfiler.trackComponentLifecycle('InsightsScreen', 'mount');

    return () => {
      const mountTime = Date.now() - startTime;

      Sentry.addBreadcrumb({
        message: 'Insights Screen Unmounted',
        category: 'navigation',
        level: 'info',
        data: {
          screenMountTime: mountTime,
          userId: user?.id || 'unknown',
        },
      });

      SentryReactProfiler.trackComponentLifecycle('InsightsScreen', 'unmount', mountTime);
    };
  }, [user?.id]);

  // Enhanced achievements loading with Sentry tracking
  const loadAchievements = async () => {
    const startTime = Date.now();

    Sentry.addBreadcrumb({
      message: 'Loading achievements data',
      category: 'api.request',
      level: 'info',
      data: {
        userId: user?.id || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });

    try {
      setAchievementsLoading(true);

      const [completed, random] = await Promise.all([
        achievementService.getUserAchievements(user?.id || ''),
        achievementService.getRandomAchievements(user?.id || '', 5),
      ]);

      setCompletedAchievements(completed);
      setRandomAchievements(random);

      const loadTime = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Achievements loaded successfully',
        category: 'api.success',
        level: 'info',
        data: {
          completedCount: completed.length,
          randomCount: random.length,
          loadTime,
        },
      });

      if (loadTime > 2000) {
        SentryReactProfiler.trackRenderPerformance('achievements_load_time', loadTime);
      }
    } catch (error) {
      captureAPIError(error as Error, 'loadAchievements', 'insights-achievements');

      Sentry.addBreadcrumb({
        message: 'Achievements loading failed',
        category: 'api.error',
        level: 'error',
        data: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          loadTime: Date.now() - startTime,
          userId: user?.id || 'unknown',
        },
      });

      console.error('Error loading achievements:', error);
    } finally {
      setAchievementsLoading(false);
    }
  };

  // Enhanced photo loading with Sentry tracking
  const loadSavedPhotos = async () => {
    const startTime = Date.now();

    if (!user?.id) {
      Sentry.addBreadcrumb({
        message: 'Photo loading skipped - no user ID',
        category: 'ui.error',
        level: 'warning',
        data: {
          hasUser: !!user,
        },
      });
      return;
    }

    Sentry.addBreadcrumb({
      message: 'Loading progress photos',
      category: 'api.request',
      level: 'info',
      data: {
        userId: user.id,
        timestamp: new Date().toISOString(),
      },
    });

    try {
      const allPhotos = await firebaseProgressPhotoService.getAllPhotos(user.id);

      const beforePhotos = allPhotos.filter((photo) => photo.type === 'before');
      const afterPhotos = allPhotos.filter((photo) => photo.type === 'after');

      const beforePhotoData = beforePhotos.length > 0 ? beforePhotos[0] : undefined;
      const afterPhotoData = afterPhotos.length > 0 ? afterPhotos[0] : undefined;

      setBeforePhoto(beforePhotoData);
      setAfterPhoto(afterPhotoData);

      const loadTime = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Progress photos loaded successfully',
        category: 'api.success',
        level: 'info',
        data: {
          hasBeforePhoto: !!beforePhotoData,
          hasAfterPhoto: !!afterPhotoData,
          loadTime,
        },
      });

      if (loadTime > 1500) {
        SentryReactProfiler.trackRenderPerformance('photo_load_time', loadTime);
      }
    } catch (error) {
      captureAPIError(error as Error, 'loadSavedPhotos', 'insights-photos');

      Sentry.addBreadcrumb({
        message: 'Photo loading failed',
        category: 'api.error',
        level: 'error',
        data: {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          loadTime: Date.now() - startTime,
          userId: user.id,
        },
      });

      console.error('Error loading saved photos:', error);
    }
  };

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
    if (user?.id) {
      loadSavedPhotos();
      loadAchievements();
      loadExerciseData();
    }
  }, [user?.id]);

  const loadExerciseData = async () => {
    if (!user?.id) return;

    try {
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
        console.error('Error loading exercise data:', error);
        setExercises([]);
        return;
      }

      if (!exerciseRecords || exerciseRecords.length === 0) {
        setExercises([]);
        return;
      }

      // Get exercise details for the exercise IDs
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
      console.error('Error loading exercise data:', error);
      setExercises([]);
    }
  };

  const cleanupAndPickImage = async (type: 'before' | 'after') => {
    if (!user?.id) {
      Alert.alert('Sign In Required', 'Please sign in to add progress photos');
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
        console.error('Error deleting existing photo:', error);
        // Continue with uploading a new photo even if deletion failed
      }

      // Pick and upload new image
      try {
        await pickAndUploadImage(type, user.id, setBeforePhoto, setAfterPhoto);
      } catch (error) {
        console.error('Error uploading photo:', error);
        Alert.alert('Upload Failed', 'Failed to upload photo. Please try again.');
      }
    } catch (pickError) {
      console.error('Error picking image:', pickError);
      Alert.alert('Selection Failed', 'Failed to select photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoPress = (type: 'before' | 'after') => {
    cleanupAndPickImage(type);
  };

  const handleMonthChange = (date: { timestamp: number }) => {
    setCalendarDate(new Date(date.timestamp));
  };

  const handleTodayPress = () => {
    const today = new Date();
    setCalendarDate(today);
    setKey((prev) => prev + 1);
  };

  const handleAchievementPress = (achievement: UserAchievement) => {
    setSelectedAchievement(achievement.achievement || null);
  };

  const handleMeasurementPress = async (category: MeasurementCategory) => {
    setSelectedMeasurement(category);
  };

  const handleSaveMeasurement = async (value: number) => {
    if (!user?.id || !selectedMeasurement) return;

    try {
      await addMeasurement(
        selectedMeasurement,
        value,
        selectedMeasurement === 'WEIGHT' ? 'kg' : 'cm',
      );
      setSelectedMeasurement(null);
    } catch (error) {
      console.error('Error saving measurement:', error);
    }
  };

  // No need to use useImagePreloader as all images are already preloaded during splash screen

  const handleAddExercise = () => {
    setSelectedExercise(undefined);
    setShowExerciseModal(true);
  };

  const handleExercisePress = (exerciseId: string) => {
    const exercise = exercises.find((e) => e.id === exerciseId);
    if (exercise) {
      setSelectedExercise(exercise);
      setShowExerciseModal(true);
    }
  };

  const handleSaveExercise = (exerciseData: Partial<ExerciseData>) => {
    if (exerciseData.id) {
      // Update existing exercise
      setExercises((prev) =>
        prev.map((e) => (e.id === exerciseData.id ? { ...e, ...exerciseData } : e)),
      );
    } else {
      // Add new exercise
      const newExercise: ExerciseData = {
        id: Date.now().toString(),
        name: exerciseData.name!,
        data: exerciseData.data!,
        unit: exerciseData.unit,
      };
      setExercises((prev) => [...prev, newExercise]);
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  };

  const handleSetGoal = (exerciseId: string) => {
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
};

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

// Export the component wrapped with Sentry profiler
export default SentryReactProfiler.withProfiler(
  InsightsScreenComponent as React.ComponentType<unknown>,
  'InsightsScreen',
) as React.ComponentType;
