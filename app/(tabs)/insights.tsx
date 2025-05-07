import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Pressable, Image, Modal, ActivityIndicator, Platform, Animated, Easing } from 'react-native';
import { Text, Surface, Chip, useTheme, IconButton, Button, Provider } from 'react-native-paper';
import { useProgress } from '../store/ProgressContext';
import { Calendar } from 'react-native-calendars';
import { format, addMonths } from 'date-fns';
import { COLORS, SPACING, HEADER_HEIGHT } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../store/AuthContext';
import { achievementService, Achievement, UserAchievement } from '../services/achievements';
import measurementService, { MeasurementCategory} from '../services/measurements';
import MeasurementModal from '../components/MeasurementModal';
import MeasurementsGraph from '../components/MeasurementsGraph';
import HowToMeasureModal from '../components/HowToMeasureModal';
import ExerciseGraphs, { ExerciseData } from '../components/ExerciseGraphs';
import ExerciseGraphModal from '../components/ExerciseGraphModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurements } from '../store/MeasurementsContext';
import { GeneralHeader } from '../components/GeneralHeader';
import firebaseProgressPhotoService, { ProgressPhoto } from '../services/firebaseProgressPhotos';
import OptimizedImage from '../components/OptimizedImage';
import useImagePreloader from '../hooks/useImagePreloader';
import { markAsImportantImage, ImagePriority } from '../utils/imagePreloader';

const TIME_FILTERS = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' },
];

const SAMPLE_EXERCISES: ExerciseData[] = [
  {
    id: '1',
    name: 'Dumbbell Bench Press',
    unit: 'kg',
    data: [
      { date: '08.02', value: 8 },
      { date: '02.11', value: 15 },
      { date: '27.07', value: 28 },
      { date: '21.04', value: 36 },
    ]
  },
  {
    id: '2',
    name: 'Seated Dumbbell Overhead Press',
    unit: 'kg',
    data: [
      { date: '07.02', value: 8 },
      { date: '02.11', value: 16 },
      { date: '27.07', value: 24 },
      { date: '21.04', value: 26 },
    ]
  }
];

export default function InsightsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { 
    measurements, 
    measurementHistory,
    loading: measurementsLoading,
    addMeasurement,
    deleteMeasurement,
    refreshMeasurements
  } = useMeasurements();
  const insets = useSafeAreaInsets();
  const { metrics, loading: progressLoading } = useProgress();
  const [selectedFilter, setSelectedFilter] = useState('1w');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [key, setKey] = useState(0);
  const [beforePhoto, setBeforePhoto] = useState<ProgressPhoto | undefined>();
  const [afterPhoto, setAfterPhoto] = useState<ProgressPhoto | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState({ before: false, after: false });
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [completedAchievements, setCompletedAchievements] = useState<UserAchievement[]>([]);
  const [randomAchievements, setRandomAchievements] = useState<Achievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementCategory | null>(null);
  const [showHowToMeasure, setShowHowToMeasure] = useState(false);
  const [exercises, setExercises] = useState<ExerciseData[]>(SAMPLE_EXERCISES);
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
  const { loaded: photosLoaded } = useImagePreloader(progressPhotosToPreload, {
    priority: 'high',
    debugLabel: 'InsightsProgressPhotos',
    skipIfCached: true
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
    }
  }, [user?.id]);

  const loadAchievements = async () => {
    if (!user?.id) return;
    
    try {
      setAchievementsLoading(true);
      const completed = await achievementService.getUserCompletedAchievements(user.id);
      setCompletedAchievements(completed.slice(0, 3));
      
      // Calculate how many random achievements we need
      const completedCount = completed.length;
      const randomCount = Math.max(0, 3 - completedCount);
      
      if (randomCount > 0) {
        const random = await achievementService.getRandomAchievements(user.id, randomCount);
        setRandomAchievements(random);
      } else {
        setRandomAchievements([]);
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setAchievementsLoading(false);
    }
  };

  const loadSavedPhotos = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      const latestPhotos = await firebaseProgressPhotoService.getLatestPhotos(user.id);
      
      // Only update state if the URLs have changed to avoid unnecessary re-renders
      if (latestPhotos.before?.url !== beforePhoto?.url) {
        setBeforePhoto(latestPhotos.before);
      }
      
      if (latestPhotos.after?.url !== afterPhoto?.url) {
        setAfterPhoto(latestPhotos.after);
      }
      
      // Preload the photos immediately when we get them
      if (latestPhotos.before?.url) {
        markAsImportantImage(latestPhotos.before.url);
      }
      if (latestPhotos.after?.url) {
        markAsImportantImage(latestPhotos.after.url);
      }
    } catch (error) {
      console.error('Error loading saved photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupAndPickImage = async (type: 'before' | 'after') => {
    if (!user?.id) {
      alert('Please sign in to add progress photos');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    // Delete existing photo if it exists
    try {
      if ((type === 'before' && beforePhoto?.id) || (type === 'after' && afterPhoto?.id)) {
        setIsLoading(true);
        const photoToDelete = type === 'before' ? beforePhoto : afterPhoto;
        
        if (photoToDelete?.id) {
          console.log(`Deleting existing ${type} photo with ID: ${photoToDelete.id}`);
          await firebaseProgressPhotoService.deletePhoto(user.id, photoToDelete.id);
          
          // Clear the state for the deleted photo type
          if (type === 'before') {
            setBeforePhoto(undefined);
          } else {
            setAfterPhoto(undefined);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting existing photo:', error);
      // Continue with uploading a new photo even if deletion failed
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        try {
          setIsLoading(true);
          console.log(`Uploading new ${type} photo from URI: ${result.assets[0].uri.substring(0, 50)}...`);
          
          const photo = await firebaseProgressPhotoService.uploadPhoto(
            user.id,
            type,
            result.assets[0].uri,
            new Date()
          );
          
          console.log(`Successfully uploaded ${type} photo with ID: ${photo.id}`);
          
          if (type === 'before') {
            setBeforePhoto(photo);
          } else {
            setAfterPhoto(photo);
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
          alert('Failed to upload photo. Please try again.');
        }
      }
    } catch (pickError) {
      console.error('Error picking image:', pickError);
      alert('Failed to select photo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoPress = (type: 'before' | 'after') => {
    cleanupAndPickImage(type);
  };

  // Mark dates that have workouts
  const markedDates = {
    '2025-04-01': { marked: true, dotColor: theme.colors.primary },
    '2025-04-02': { marked: true, dotColor: theme.colors.primary },
    '2025-04-04': { marked: true, dotColor: theme.colors.primary },
  };

  if (progressLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading insights...</Text>
      </View>
    );
  }

  const handleMonthChange = (date: { timestamp: number }) => {
    setCalendarDate(new Date(date.timestamp));
  };

  const handleTodayPress = () => {
    const today = new Date();
    setCalendarDate(today);
    setKey(prev => prev + 1);
  };

  const today = new Date();
  const minDate = format(today, 'yyyy-MM-dd');
  const maxDate = format(addMonths(today, 12), 'yyyy-MM-dd');

  const handleAchievementPress = (achievement: UserAchievement) => {
    setSelectedAchievement(achievement.achievement || null);
  };

  const handleMeasurementPress = async (category: MeasurementCategory) => {
    setSelectedMeasurement(category);
  };

  const handleSaveMeasurement = async (value: number) => {
    if (!user?.id || !selectedMeasurement) return;

    try {
      await addMeasurement(selectedMeasurement, value, selectedMeasurement === 'WEIGHT' ? 'kg' : 'cm');
      setSelectedMeasurement(null);
    } catch (error) {
      console.error('Error saving measurement:', error);
    }
  };

  // No need to use useImagePreloader as all images are already preloaded during splash screen
  const imagesPreloaded = true; // All images are already preloaded

  const handleAddExercise = () => {
    setSelectedExercise(undefined);
    setShowExerciseModal(true);
  };

  const handleExercisePress = (exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (exercise) {
      setSelectedExercise(exercise);
      setShowExerciseModal(true);
    }
  };

  const handleSaveExercise = (exerciseData: Partial<ExerciseData>) => {
    if (exerciseData.id) {
      // Update existing exercise
      setExercises(prev => prev.map(e => 
        e.id === exerciseData.id 
          ? { ...e, ...exerciseData } 
          : e
      ));
    } else {
      // Add new exercise
      const newExercise: ExerciseData = {
        id: Date.now().toString(),
        name: exerciseData.name!,
        data: exerciseData.data!,
        unit: exerciseData.unit,
      };
      setExercises(prev => [...prev, newExercise]);
    }
  };

  const handleDeleteExercise = (exerciseId: string) => {
    setExercises(prev => prev.filter(e => e.id !== exerciseId));
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
              paddingBottom: 100
            }}
          >
            {/* Time Period Filter and Stats Overview */}
            <Surface style={styles.combinedStatsContainer} elevation={2}>
              {/* Time Filters */}
              <View style={styles.filterContainer}>
                {TIME_FILTERS.map((filter) => (
                  <Chip
                    key={filter.value}
                    selected={selectedFilter === filter.value}
                    onPress={() => setSelectedFilter(filter.value)}
                    style={[
                      styles.filterChip,
                      selectedFilter === filter.value && { backgroundColor: theme.colors.primary }
                    ]}
                    textStyle={[
                      styles.filterChipText,
                      selectedFilter === filter.value && { color: '#fff' }
                    ]}
                  >
                    {filter.label}
                  </Chip>
                ))}
              </View>

              <View style={styles.statsDivider} />

              {/* Stats Overview */}
              <View style={styles.statsOverview}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>12</Text>
                  <Text style={styles.statLabel}>Number of{'\n'}Workouts</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>11</Text>
                  <Text style={styles.statLabel}>Hours at{'\n'}the Gym</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>32.9K</Text>
                  <Text style={styles.statLabel}>Total Weight{'\n'}Lifted (kg)</Text>
                </View>
              </View>
            </Surface>

            {/* Calendar */}
            <Surface style={styles.calendarContainer} elevation={2}>
              <View style={styles.calendarHeader}>
                <View style={{ flex: 1 }}>
                  <Pressable 
                    onPress={handleTodayPress}
                    style={({ pressed }) => [
                      styles.todayButtonContainer,
                      pressed && styles.todayButtonPressed
                    ]}
                  >
                    <Text style={styles.todayButton}>Today</Text>
                  </Pressable>
                </View>
                <Text style={[styles.sectionTitle, {flex: 1, paddingRight: '20%',}]}>YOUR WORKOUTS</Text>
                <View style={{ flex: 1 }} />
              </View>
              <Calendar
                markingType="custom"
                key={key}
                current={format(calendarDate, 'yyyy-MM-dd')}
                minDate={minDate}
                maxDate={maxDate}
                onMonthChange={handleMonthChange}
                markedDates={{
                  ...markedDates,
                  [format(new Date(), 'yyyy-MM-dd')]: {
                    customStyles: {
                      container: {
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      text: {
                        fontSize: 20,
                        fontWeight: '700',
                        color: COLORS.primary,
                      }
                    }
                  }
                }}
                enableSwipeMonths={true}
                hideExtraDays={true}
                onDayPress={(day: { dateString: string }) => {
                }}
                theme={{
                  backgroundColor: 'transparent',
                  calendarBackground: 'transparent',
                  textSectionTitleColor: COLORS.onSurface,
                  selectedDayBackgroundColor: COLORS.primary,
                  selectedDayTextColor: '#fff',
                  todayTextColor: COLORS.primary,
                  dayTextColor: COLORS.onSurface,
                  textDisabledColor: COLORS.disabled,
                  dotColor: COLORS.primary,
                  monthTextColor: COLORS.onSurface,
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 14,
                  todayTextFontFamily: 'System',
                  todayFontWeight: '400',
                  todayTextFontSize: 24,
                  arrowColor: COLORS.primary,
                }}
              />
            </Surface>

            {/* Before and After Section */}
            <Surface style={styles.beforeAfterContainer} elevation={2}>
              <Text style={styles.sectionTitle}>BEFORE AND AFTER</Text>
              <View style={styles.photoComparisonContainer}>
                {/* Before Photo */}
                <View style={styles.photoColumn}>
                  <Pressable 
                    onPress={() => handlePhotoPress('before')} 
                    style={styles.photoFrame}
                  >
                    {beforePhoto && beforePhoto.url ? (
                      <OptimizedImage
                        source={{ uri: beforePhoto.url }}
                        style={styles.photo}
                        resizeMode="cover"
                        priority="high"
                        cachePolicy="immutable"
                        isImportant={true}
                        showLoader={true}
                        loaderColor={theme.colors.primary}
                        fallback={require('../../assets/placeholder.jpg')}
                        onError={() => {
                          console.log('Before photo error loading');
                          setImageLoadError(prev => ({ ...prev, before: true }));
                        }}
                      />
                    ) : (
                      <View style={[styles.addPhotoButton, isLoading && styles.disabled]}>
                        <IconButton 
                          icon="camera-plus" 
                          size={32} 
                          iconColor={theme.colors.primary} 
                        />
                        <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                          Add Photo
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  <Text style={styles.photoLabel}>BEFORE</Text>
                  {beforePhoto && beforePhoto.date && (
                    <Text style={styles.photoDate}>
                      {format(new Date(beforePhoto.date), 'MMMM, yyyy')}
                    </Text>
                  )}
                </View>

                {/* Arrow Icon */}
                <View style={styles.arrowContainer}>
                  <View style={styles.purpleDot}>
                    <IconButton 
                      icon="arrow-right" 
                      iconColor="#fff"
                      size={20}
                    />
                  </View>
                </View>

                {/* After Photo */}
                <View style={styles.photoColumn}>
                  <Pressable 
                    onPress={() => handlePhotoPress('after')} 
                    style={styles.photoFrame}
                  >
                    {afterPhoto && afterPhoto.url ? (
                      <OptimizedImage
                        source={{ uri: afterPhoto.url }}
                        style={styles.photo}
                        resizeMode="cover"
                        priority="high"
                        cachePolicy="immutable"
                        isImportant={true}
                        showLoader={true}
                        loaderColor={theme.colors.primary}
                        fallback={require('../../assets/placeholder.jpg')}
                        onError={() => {
                          console.log('After photo error loading');
                          setImageLoadError(prev => ({ ...prev, after: true }));
                        }}
                      />
                    ) : (
                      <View style={[styles.addPhotoButton, isLoading && styles.disabled]}>
                        <IconButton 
                          icon="camera-plus" 
                          size={32} 
                          iconColor={theme.colors.primary} 
                        />
                        <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                          Add Photo
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  <Text style={styles.photoLabel}>AFTER</Text>
                  {afterPhoto && afterPhoto.date && (
                    <Text style={styles.photoDate}>
                      {format(new Date(afterPhoto.date), 'MMMM, yyyy')}
                    </Text>
                  )}
                </View>
              </View>
            </Surface>

            {/* Achievements Section */}
            <Surface style={styles.achievementsContainer} elevation={2}>
              <View style={styles.sectionHeader}>
                <View style={styles.headerSide} />
                <View style={styles.titleContainer}>
                  <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
                </View>
                <View style={styles.headerSide}>
                  <Button
                    mode="text"
                    textColor="#6B4EFF"
                    style={styles.moreButton}
                    labelStyle={styles.moreButtonLabel}
                    onPress={() => router.push('/achievements')}
                  >
                    More
                  </Button>
                </View>
              </View>
              <View style={styles.achievementsGrid}>
                {achievementsLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : completedAchievements.length > 0 || randomAchievements.length > 0 ? (
                  <>
                    {completedAchievements.map((userAchievement) => (
                      <Pressable
                        key={userAchievement.id}
                        style={styles.achievementCard}
                        onPress={() => handleAchievementPress(userAchievement)}
                      >
                        <View style={styles.achievementContent}>
                          <View style={styles.achievementIconContainer}>
                            <IconButton
                              icon={userAchievement.achievement?.icon || 'trophy'}
                              size={24}
                              iconColor="#f9e009"
                            />
                          </View>
                          <Text style={styles.achievementLabel}>
                            {userAchievement.achievement?.title}
                          </Text>
                          {userAchievement.completed_at && (
                            <Text style={styles.achievementDate}>
                              {format(new Date(userAchievement.completed_at), 'MMM dd, yyyy')}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    ))}
                    {randomAchievements.map((achievement) => (
                      <Pressable
                        key={achievement.id}
                        style={[styles.achievementCard, styles.achievementLocked]}
                        onPress={() => setSelectedAchievement(achievement)}
                      >
                        <View style={styles.achievementContent}>
                          <View style={[styles.achievementIconContainer, styles.achievementIconLocked]}>
                            <IconButton
                              icon={achievement.icon || 'trophy'}
                              size={24}
                              iconColor="#666"
                            />
                          </View>
                          <Text style={[styles.achievementLabel, styles.achievementTextLocked]}>
                            {achievement.title}
                          </Text>
                          <Text style={[styles.achievementDate, styles.achievementTextLocked]}>
                            Not completed yet
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </>
                ) : (
                  <Text style={styles.noAchievementsText}>No achievements completed yet</Text>
                )}
              </View>
            </Surface>

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
              <Pressable 
                style={styles.modalOverlay}
                onPress={() => setSelectedAchievement(null)}
              >
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
                        <View style={[styles.achievementIconLarge, { backgroundColor: selectedAchievement.icon_background_color }]}>
                          <IconButton
                            icon={selectedAchievement.icon}
                            size={40}
                            iconColor="#000"
                          />
                        </View>
                        <Text style={styles.achievementTitle}>{selectedAchievement.title}</Text>
                        <Text style={styles.achievementDescription}>{selectedAchievement.description}</Text>
                        {selectedAchievement.total_progress && (
                          <Text style={styles.achievementProgress}>
                            Progress: {completedAchievements.find(a => a.achievement?.id === selectedAchievement.id)?.current_progress || 0}/{selectedAchievement.total_progress}
                          </Text>
                        )}
                        {completedAchievements.find(a => a.achievement?.id === selectedAchievement.id)?.completed_at && (
                          <Text style={styles.achievementDate}>
                            Completed on {format(new Date(completedAchievements.find(a => a.achievement?.id === selectedAchievement.id)?.completed_at!), 'MMM dd, yyyy')}
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

const getMeasurementIcon = (category: MeasurementCategory): string => {
  switch (category) {
    case 'WEIGHT':
      return 'weight';
    case 'BICEPS':
      return 'arm-flex';
    case 'ABS':
      return 'human-male';
    case 'WAIST':
      return 'human-male';
    case 'CHEST':
      return 'human-male';
    case 'SHLDRS':
      return 'human-male';
    case 'THIGH':
      return 'human-male';
    case 'CALF':
      return 'human-male';
    default:
      return 'ruler';
  }
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
    aspectRatio: 3/4,
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