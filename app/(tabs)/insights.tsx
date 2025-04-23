import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Pressable, Image, Modal, ActivityIndicator } from 'react-native';
import { Text, Surface, Chip, useTheme, Divider, IconButton, Button, Provider } from 'react-native-paper';
import { useProgress } from '../store/ProgressContext';
import { Calendar } from 'react-native-calendars';
import { format, addMonths, subMonths } from 'date-fns';
import { COLORS } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { progressPhotoService, ProgressPhoto } from '../services/progressPhotos';
import { useAuth } from '../store/AuthContext';
import { achievementService, Achievement, UserAchievement } from '../services/achievements';
import measurementService, { 
  Measurement, 
  MeasurementCategory, 
  MEASUREMENT_CATEGORIES 
} from '../services/measurements';
import MeasurementModal from '../components/MeasurementModal';
import MeasurementsGraph from '../components/MeasurementsGraph';
import HowToMeasureModal from '../components/HowToMeasureModal';
import OptimizedImage from '../components/OptimizedImage';
import { useImagePreloader } from '../hooks/useImagePreloader';
import ExerciseGraphs, { ExerciseData } from '../components/ExerciseGraphs';
import ExerciseGraphModal from '../components/ExerciseGraphModal';

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
  const [measurements, setMeasurements] = useState<Record<MeasurementCategory, Measurement | null>>({} as Record<MeasurementCategory, Measurement | null>);
  const [selectedMeasurement, setSelectedMeasurement] = useState<MeasurementCategory | null>(null);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [measurementHistory, setMeasurementHistory] = useState<Measurement[]>([]);
  const [showHowToMeasure, setShowHowToMeasure] = useState(false);
  const [exercises, setExercises] = useState<ExerciseData[]>(SAMPLE_EXERCISES);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseData | undefined>();
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // Load saved photos, achievements, and measurements on component mount
  useEffect(() => {
    if (user?.id) {
      loadSavedPhotos();
      loadAchievements();
      loadMeasurements();
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
      const latestPhotos = await progressPhotoService.getLatestPhotos(user.id);
      setBeforePhoto(latestPhotos.before);
      setAfterPhoto(latestPhotos.after);
    } catch (error) {
      console.error('Error loading saved photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeasurements = async () => {
    if (!user?.id) return;
    
    try {
      setMeasurementsLoading(true);
      const latestMeasurements = await measurementService.getLatestMeasurements(user.id);
      setMeasurements(latestMeasurements);
    } catch (error) {
      console.error('Error loading measurements:', error);
    } finally {
      setMeasurementsLoading(false);
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
      if ((type === 'before' && beforePhoto) || (type === 'after' && afterPhoto)) {
        const photoToDelete = type === 'before' ? beforePhoto : afterPhoto;
        if (photoToDelete) {
          await progressPhotoService.deletePhoto(user.id, photoToDelete.id);
        }
      }
    } catch (error) {
      console.error('Error deleting existing photo:', error);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        setIsLoading(true);
        const photo = await progressPhotoService.uploadPhoto(
          user.id,
          type,
          result.assets[0].uri,
          new Date()
        );
        
        if (type === 'before') {
          setBeforePhoto(photo);
        } else {
          setAfterPhoto(photo);
        }
      } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Failed to upload photo. Please try again.');
      } finally {
        setIsLoading(false);
      }
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
    if (!user?.id) return;
    
    try {
      const history = await measurementService.getMeasurementHistory(user.id, category);
      setMeasurementHistory(history);
      setSelectedMeasurement(category);
    } catch (error) {
      console.error('Error loading measurement history:', error);
      setMeasurementHistory([]);
      setSelectedMeasurement(category);
    }
  };

  const handleSaveMeasurement = async (value: number) => {
    if (!user?.id || !selectedMeasurement) return;

    try {
      await measurementService.addMeasurement(
        user.id,
        selectedMeasurement,
        value,
        selectedMeasurement === 'WEIGHT' ? 'kg' : 'cm'
      );
      await loadMeasurements();
      setSelectedMeasurement(null);
    } catch (error) {
      console.error('Error saving measurement:', error);
    }
  };

  const handleMeasurementsChange = async () => {
    if (user?.id) {
      await loadMeasurements();
    }
  };

  // Preload images when they're available
  const imagesToPreload = [
    beforePhoto?.photo_url,
    afterPhoto?.photo_url
  ].filter(Boolean) as string[];
  
  const { loaded: imagesPreloaded } = useImagePreloader(imagesToPreload);

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
        
        {/* Custom Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="chart-bar"
              size={24}
              style={styles.headerIcon}
              iconColor="white"
            />
            <Text variant="headlineSmall" style={[styles.headerTitle, { color: '#fff' }]}>Progress</Text>
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
        <Divider style={styles.divider} />

        <ScrollView contentContainerStyle={styles.contentContainer}>
          {/* Time Period Filter */}
          <Surface style={styles.filterContainer} elevation={2}>
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
          </Surface>

          {/* Stats Overview */}
          <Surface style={styles.statsContainer} elevation={2}>
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
          </Surface>

          {/* Calendar */}
          <Surface style={styles.calendarContainer} elevation={2}>
            <View style={styles.calendarHeader}>
              <View style={styles.headerLeft}>
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
              <Text style={[styles.sectionTitle, { flex: 1, textAlign: 'center' }]}>YOUR WORKOUTS</Text>
              <View style={styles.headerRight} />
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
                      color: theme.colors.primary,
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
                textSectionTitleColor: theme.colors.onSurface,
                selectedDayBackgroundColor: theme.colors.primary,
                selectedDayTextColor: '#fff',
                todayTextColor: theme.colors.primary,
                dayTextColor: theme.colors.onSurface,
                textDisabledColor: theme.colors.onSurfaceDisabled,
                dotColor: theme.colors.primary,
                monthTextColor: theme.colors.onSurface,
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
                todayTextFontFamily: 'System',
                todayFontWeight: '400',
                todayTextFontSize: 24,
                arrowColor: theme.colors.primary,
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
                  {beforePhoto ? (
                    <OptimizedImage 
                      source={beforePhoto.photo_url}
                      style={styles.photoFrame}
                      imageStyle={styles.photo}
                      onError={() => {
                        console.error('Error loading before photo:', beforePhoto.photo_url);
                        setImageLoadError(prev => ({ ...prev, before: true }));
                      }}
                    />
                  ) : (
                    <View style={[styles.addPhotoButton, isLoading && styles.disabled]}>
                      <IconButton icon="camera-plus" size={32} iconColor={theme.colors.primary} />
                      <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                        Add Photo
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.photoLabel}>BEFORE</Text>
                {beforePhoto && (
                  <Text style={styles.photoDate}>
                    {format(new Date(beforePhoto.taken_at), 'MMMM, yyyy')}
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
                  {afterPhoto ? (
                    <OptimizedImage 
                      source={afterPhoto.photo_url}
                      style={styles.photoFrame}
                      imageStyle={styles.photo}
                      onError={() => {
                        console.error('Error loading after photo:', afterPhoto.photo_url);
                        setImageLoadError(prev => ({ ...prev, after: true }));
                      }}
                    />
                  ) : (
                    <View style={[styles.addPhotoButton, isLoading && styles.disabled]}>
                      <IconButton icon="camera-plus" size={32} iconColor={theme.colors.primary} />
                      <Text style={[styles.addPhotoText, { color: theme.colors.primary }]}>
                        Add Photo
                      </Text>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.photoLabel}>AFTER</Text>
                {afterPhoto && (
                  <Text style={styles.photoDate}>
                    {format(new Date(afterPhoto.taken_at), 'MMMM, yyyy')}
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
                  onPress={() => setShowHowToMeasure(true)}
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

        {/* Measurement Modal */}
        <MeasurementModal
          visible={selectedMeasurement !== null}
          category={selectedMeasurement || 'WEIGHT'}
          lastValue={measurements[selectedMeasurement || 'WEIGHT']?.value}
          measurements={measurementHistory}
          onClose={() => setSelectedMeasurement(null)}
          onSave={handleSaveMeasurement}
          userId={user?.id || ''}
          onMeasurementsChange={handleMeasurementsChange}
        />

        <HowToMeasureModal
          visible={showHowToMeasure}
          onClose={() => setShowHowToMeasure(false)}
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
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: COLORS.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    margin: 0,
    marginRight: 10,
    backgroundColor: '#6B4EFF',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  premiumButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingBottom: 8,
    paddingHorizontal: 8,
    marginRight: -4,
  },
  premiumIcon: {
    margin: 0,
    marginTop: 8,
    marginLeft: -4,
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -8,
  },
  divider: {
    backgroundColor: '#333',
    height: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
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
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
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
    backgroundColor: '#1E1E1E',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  beforeAfterContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
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
    color: '#fff',
    marginTop: 8,
  },
  photoDate: {
    fontSize: 10,
    color: '#fff',
    marginTop: 2,
  },
  photoFrame: {
    width: '100%',
    aspectRatio: 3/4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2A2A2A',
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  addPhotoButton: {
    width: '100%',
    aspectRatio: 3/4,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 78, 255, 0.1)',
    borderWidth: 2,
    borderColor: '#6B4EFF',
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
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: {
    width: 50,
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
    color: '#6B4EFF',
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
    backgroundColor: '#6B4EFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
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
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  achievementDescription: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 16,
  },
  achievementDate: {
    fontSize: 10,
    color: '#fff',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
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
    backgroundColor: '#f9e009',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  shareButton: {
    backgroundColor: '#FFE600',
    borderRadius: 25,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  shareButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  noAchievementsText: {
    color: '#666',
    textAlign: 'center',
    width: '100%',
    marginTop: 16,
  },
  achievementProgress: {
    fontSize: 14,
    color: '#f9e009',
    marginBottom: 8,
  },
  achievementLocked: {
    opacity: 0.7,
  },
  achievementIconLocked: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
  },
  achievementTextLocked: {
    color: '#666',
  },
  measurementsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    paddingVertical: 16,
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
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#fff',
    marginBottom: 4,
  },
  measurementLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  infoIcon: {
    margin: 0,
    marginLeft: 0,
    marginBottom: 10,
  },
}); 