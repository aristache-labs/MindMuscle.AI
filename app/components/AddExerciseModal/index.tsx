import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  GestureResponderEvent,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/theme';
import exerciseService, { Exercise, ExerciseCategory } from '../../services/exerciseService';
import ExerciseCard from '../ExerciseCard';
import OptimizedImage from '../OptimizedImage';
import { MuscleGroupRender } from './components/MuscleMarkers';
import { FALLBACK_IMAGE_OBJECT, muscleGroups } from './constants';
import { styles } from './styles';
import { AddExerciseModalProps, ExerciseConfiguration, SelectedExercise } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Step components
const Step1MuscleSelection = ({
  currentView,
  setCurrentView,
  onMuscleSelect,
  pulseAnim,
}: {
  currentView: 'front' | 'back';
  setCurrentView: (view: 'front' | 'back') => void;
  onMuscleSelect: (muscle: string) => void;
  pulseAnim: Animated.Value;
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const SWIPE_THRESHOLD = 50;

  const frontBodyModel = require('../../../assets/body-model_front.png');
  const backBodyModel = require('../../../assets/body-model_back.png');

  useEffect(() => {
    if (isImageLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isImageLoaded]);

  const handleViewChange = (newView: 'front' | 'back') => {
    if (isTransitioning || newView === currentView) return;

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
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    setTouchStart(event.nativeEvent.pageX);
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const swipeLength = event.nativeEvent.pageX - touchStart;

    if (Math.abs(swipeLength) > SWIPE_THRESHOLD) {
      // Any swipe (left or right) toggles between front and back views
      if (currentView === 'front') {
        handleViewChange('back');
      } else {
        handleViewChange('front');
      }
    }
  };

  const filteredMuscles = muscleGroups.filter((muscle) => muscle.view === currentView);

  return (
    <View style={styles.stepContainer}>
      <View
        style={styles.bodyModelContainer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View style={[styles.modelContainer, { opacity: fadeAnim }]}>
          <View style={styles.imagesContainer}>
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
                setIsImageLoaded(true);
              }}
            />
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
                setIsImageLoaded(true);
              }}
            />
          </View>

          {isImageLoaded &&
            filteredMuscles.map((muscle) => (
              <MuscleGroupRender
                key={muscle.id}
                muscle={muscle}
                pulseAnim={pulseAnim}
                onPress={onMuscleSelect}
              />
            ))}
        </Animated.View>
      </View>
    </View>
  );
};

const Step2ExerciseSelection = ({
  selectedMuscleGroup,
  selectedExercises,
  onExerciseToggle,
  onBack,
  onNext,
}: {
  selectedMuscleGroup: string;
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onBack: () => void;
  onNext: () => void;
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadExercises = async () => {
      try {
        setLoading(true);
        let categoryKey = selectedMuscleGroup;
        if (selectedMuscleGroup === 'Lower back') {
          categoryKey = 'Lower_back';
        }
        const exerciseData = await exerciseService.getExercisesByCategory(
          categoryKey as ExerciseCategory,
        );
        setExercises(exerciseData);
      } catch (error) {
        console.error('Error loading exercises:', error);
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [selectedMuscleGroup]);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [exercises, searchQuery]);

  return (
    <View style={styles.stepContainer}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={COLORS.placeholder} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={COLORS.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {Array.from({ length: Math.ceil(filteredExercises.length / 2) }).map((_, rowIndex) => {
              const startIdx = rowIndex * 2;
              const rowItems = filteredExercises.slice(startIdx, startIdx + 2);

              return (
                <View key={`row-${rowIndex}`} style={styles.exerciseRow}>
                  {rowItems.map((exercise) => (
                    <View key={exercise.id} style={styles.exerciseCardWrapper}>
                      <ExerciseCard
                        id={exercise.id}
                        name={exercise.name}
                        image={
                          exercise.image_url ? { uri: exercise.image_url } : FALLBACK_IMAGE_OBJECT
                        }
                        isFavorite={false}
                        onPress={() => onExerciseToggle(exercise.id)}
                        onToggleFavorite={() => {}}
                        useOptimizedImage={true}
                      />
                      {selectedExercises.has(exercise.id) && (
                        <View style={styles.selectedOverlay}>
                          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                        </View>
                      )}
                    </View>
                  ))}
                  {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, selectedExercises.size === 0 && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={selectedExercises.size === 0}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const StepFavorites = ({
  selectedExercises,
  onExerciseToggle,
  onBack,
  onNext,
  selectedMuscleGroup,
}: {
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onBack: () => void;
  onNext: () => void;
  selectedMuscleGroup?: string;
}) => {
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadFavoriteExercises = async () => {
      try {
        setLoading(true);
        // Use the actual favorite exercises service
        const allFavorites = await exerciseService.getFavoriteExercises();

        // Filter by muscle group if one is selected
        let filteredFavorites = allFavorites;
        if (selectedMuscleGroup) {
          let categoryKey = selectedMuscleGroup;
          if (selectedMuscleGroup === 'Lower back') {
            categoryKey = 'Lower_back';
          }
          filteredFavorites = allFavorites.filter(
            (exercise) => exercise.muscle_group === categoryKey,
          );
        }

        setFavoriteExercises(filteredFavorites);
      } catch (error) {
        console.error('Error loading favorite exercises:', error);
        setFavoriteExercises([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavoriteExercises();
  }, [selectedMuscleGroup]);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return favoriteExercises;
    return favoriteExercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [favoriteExercises, searchQuery]);

  const getEmptyStateText = () => {
    if (selectedMuscleGroup) {
      return `No favorite ${selectedMuscleGroup.toLowerCase()} exercises found`;
    }
    return 'No favorite exercises found';
  };

  const getEmptyStateSubtext = () => {
    if (selectedMuscleGroup) {
      return `Mark ${selectedMuscleGroup.toLowerCase()} exercises as favorites to see them here`;
    }
    return 'Mark exercises as favorites to see them here';
  };

  return (
    <View style={styles.stepContainer}>
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={COLORS.placeholder} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            selectedMuscleGroup
              ? `Search ${selectedMuscleGroup.toLowerCase()} favorites...`
              : 'Search favorite exercises...'
          }
          placeholderTextColor={COLORS.placeholder}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading favorite exercises...</Text>
        </View>
      ) : filteredExercises.length === 0 ? (
        <View style={styles.emptyFavoritesContainer}>
          <Ionicons name="star-outline" size={64} color={COLORS.placeholder} />
          <Text style={styles.emptyFavoritesTitle}>{getEmptyStateText()}</Text>
          <Text style={styles.emptyFavoritesText}>{getEmptyStateSubtext()}</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {Array.from({ length: Math.ceil(filteredExercises.length / 2) }).map((_, rowIndex) => {
              const startIdx = rowIndex * 2;
              const rowItems = filteredExercises.slice(startIdx, startIdx + 2);

              return (
                <View key={`row-${rowIndex}`} style={styles.exerciseRow}>
                  {rowItems.map((exercise) => (
                    <View key={exercise.id} style={styles.exerciseCardWrapper}>
                      <ExerciseCard
                        id={exercise.id}
                        name={exercise.name}
                        image={
                          exercise.image_url ? { uri: exercise.image_url } : FALLBACK_IMAGE_OBJECT
                        }
                        isFavorite={true}
                        onPress={() => onExerciseToggle(exercise.id)}
                        onToggleFavorite={() => {}}
                        useOptimizedImage={true}
                      />
                      {selectedExercises.has(exercise.id) && (
                        <View style={styles.selectedOverlay}>
                          <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                        </View>
                      )}
                    </View>
                  ))}
                  {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View style={styles.stepActions}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, selectedExercises.size === 0 && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={selectedExercises.size === 0}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const Step3Configuration = ({
  selectedExercises,
  _exercises,
  onConfigurationChange,
  onBack,
  onAddAll,
}: {
  selectedExercises: SelectedExercise[];
  _exercises: Exercise[];
  onConfigurationChange: (
    exerciseId: string,
    field: 'sets' | 'reps_range',
    value: string | number,
  ) => void;
  onBack: () => void;
  onAddAll: () => void;
}) => {
  return (
    <View style={styles.stepContainer}>
      <ScrollView style={styles.configurationList} showsVerticalScrollIndicator={false}>
        {selectedExercises.map((exercise) => (
          <View key={exercise.id} style={styles.configurationItem}>
            <View style={styles.exerciseImageContainer}>
              <OptimizedImage
                source={
                  exercise.image_url
                    ? { uri: exercise.image_url }
                    : require('../../../assets/exercises/placeholder.jpg')
                }
                style={styles.exerciseImage}
                fallback={require('../../../assets/exercises/placeholder.jpg')}
                resizeMode="cover"
                cachePolicy="immutable"
                showLoader={false}
                priority="normal"
                debugLabel={`ConfigurationExercise-${exercise.name}`}
              />
            </View>

            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>

              <View style={styles.configurationControls}>
                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>sets</Text>
                  <View style={styles.numberControl}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() =>
                        onConfigurationChange(exercise.id, 'sets', Math.max(1, exercise.sets - 1))
                      }
                    >
                      <Ionicons name="remove" size={16} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.controlValue}>{exercise.sets}</Text>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => onConfigurationChange(exercise.id, 'sets', exercise.sets + 1)}
                    >
                      <Ionicons name="add" size={16} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.controlGroup}>
                  <Text style={styles.controlLabel}>reps</Text>
                  <View style={styles.numberControl}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => {
                        const currentReps = exercise.reps_range.includes('-')
                          ? exercise.reps_range
                          : parseInt(exercise.reps_range) || 8;
                        const newReps =
                          typeof currentReps === 'number' ? Math.max(1, currentReps - 1) : '8-10';
                        onConfigurationChange(exercise.id, 'reps_range', newReps.toString());
                      }}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.controlValue}>{exercise.reps_range}</Text>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => {
                        const currentReps = exercise.reps_range.includes('-')
                          ? exercise.reps_range
                          : parseInt(exercise.reps_range) || 8;
                        const newReps = typeof currentReps === 'number' ? currentReps + 1 : '8-10';
                        onConfigurationChange(exercise.id, 'reps_range', newReps.toString());
                      }}
                    >
                      <Ionicons name="add" size={16} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.menuButton}>
              <Ionicons name="ellipsis-vertical" size={16} color={COLORS.placeholder} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.summaryFooter}>
        <Text style={styles.summaryText}>Selected Exercises: {selectedExercises.length}</Text>

        <View style={styles.stepActions}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addAllButton} onPress={onAddAll}>
            <Text style={styles.addAllButtonText}>Add All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function AddExerciseModal({
  visible,
  onClose,
  onAddExercises,
}: AddExerciseModalProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Animations
  const modalAnimation = useSharedValue(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      modalAnimation.value = withSpring(1, { damping: 20, stiffness: 300 });

      // Start pulse animation
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
    } else {
      modalAnimation.value = withTiming(0, { duration: 300 });
      setCurrentStep(1);
      setSelectedMuscleGroup('');
      setSelectedExerciseIds(new Set());
      setSelectedExercises([]);
      setCurrentView('front');
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            modalAnimation.value,
            [0, 1],
            [SCREEN_HEIGHT * 0.5, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(modalAnimation.value, [0, 1], [0.95, 1], Extrapolation.CLAMP),
        },
      ],
      opacity: modalAnimation.value,
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    return {
      opacity: modalAnimation.value * 0.6,
    };
  });

  const handleMuscleSelect = useCallback(async (muscleName: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics might not be available
    }

    setSelectedMuscleGroup(muscleName);
    setCurrentStep(2);
  }, []);

  const handleExerciseToggle = useCallback((exerciseId: string) => {
    setSelectedExerciseIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(exerciseId)) {
        newSet.delete(exerciseId);
      } else {
        newSet.add(exerciseId);
      }
      return newSet;
    });
  }, []);

  const handleStep2Next = useCallback(async () => {
    try {
      setCurrentStep(3);

      // Load full exercise data for selected exercises
      let categoryKey = selectedMuscleGroup;
      if (selectedMuscleGroup === 'Lower back') {
        categoryKey = 'Lower_back';
      }

      const exerciseData = await exerciseService.getExercisesByCategory(
        categoryKey as ExerciseCategory,
      );

      const selected = exerciseData
        .filter((ex) => selectedExerciseIds.has(ex.id))
        .map((ex) => ({
          ...ex,
          sets: 3, // Default sets
          reps_range: '8-10', // Default reps
        }));

      setSelectedExercises(selected);
      setExercises(exerciseData);
    } catch (error) {
      console.error('Error loading exercise data:', error);
    }
  }, [selectedMuscleGroup, selectedExerciseIds]);

  const handleConfigurationChange = useCallback(
    (exerciseId: string, field: 'sets' | 'reps_range', value: string | number) => {
      setSelectedExercises((prev) =>
        prev.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex)),
      );
    },
    [],
  );

  const handleAddAll = useCallback(() => {
    const exerciseConfigurations: ExerciseConfiguration[] = selectedExercises.map((exercise) => ({
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.sets,
      reps_range: exercise.reps_range,
      image_url: exercise.image_url,
      muscle_group: exercise.muscle_group || selectedMuscleGroup,
      primary_muscles: exercise.primary_muscles,
      requires_weight: exercise.requires_weight,
    }));

    console.log('AddExerciseModal: Adding exercises:', exerciseConfigurations);
    onAddExercises(exerciseConfigurations);
    onClose();
  }, [selectedExercises, selectedMuscleGroup, onAddExercises, onClose]);

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      setCurrentStep(1);
      setSelectedExerciseIds(new Set());
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setSelectedExercises([]);
    }
  }, [currentStep]);

  const handleClose = useCallback(() => {
    console.log('AddExerciseModal: Close button pressed');
    onClose();
  }, [onClose]);

  const getStepTitle = () => {
    if (showFavorites && currentStep === 2) {
      return 'Favorite Exercises';
    }

    switch (currentStep) {
      case 1:
        return 'Select Muscle Group';
      case 2:
        return `${selectedMuscleGroup} Exercises`;
      case 3:
        return 'Configure Exercises';
      default:
        return 'Add Exercises';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <TouchableOpacity style={styles.backdrop} onPress={handleClose} activeOpacity={1} />
          </Animated.View>

          <Animated.View style={[styles.modalContainer, modalStyle]}>
            <View style={styles.container}>
              {/* Adding glowing corners */}
              <View style={styles.topGlowLeft} />
              <View style={styles.topGlowRight} />
              {/* Header */}
              <View style={[styles.header, { paddingTop: Math.max(insets.top - 50, 5) }]}>
                <View style={styles.headerLeft}>
                  <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>{getStepTitle()}</Text>
                  <View style={styles.stepIndicator}>
                    {[1, 2, 3].map((step) => (
                      <View
                        key={step}
                        style={[styles.stepDot, currentStep >= step && styles.stepDotActive]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {
                        // Haptics might not be available
                      }

                      if (showFavorites) {
                        // If currently showing favorites, turn it off and navigate appropriately
                        setShowFavorites(false);

                        // If we have a selected muscle group, go back to step 2 (exercise selection)
                        // Otherwise, go back to step 1 (muscle selection)
                        if (selectedMuscleGroup && currentStep === 2) {
                          // Stay on step 2 but show regular exercises for the selected muscle group
                          setCurrentStep(2);
                        } else {
                          // Go back to step 1 (muscle selection)
                          setCurrentStep(1);
                          setSelectedMuscleGroup('');
                          setSelectedExerciseIds(new Set());
                        }
                      } else {
                        // If not showing favorites, turn it on and go to step 2
                        setShowFavorites(true);
                        if (currentStep === 1) {
                          setCurrentStep(2);
                        }
                      }
                    }}
                  >
                    <Ionicons
                      name={showFavorites ? 'star' : 'star-outline'}
                      size={24}
                      color={showFavorites ? '#FFD700' : COLORS.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Content */}
              <View style={styles.content}>
                {currentStep === 1 && (
                  <Step1MuscleSelection
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    onMuscleSelect={handleMuscleSelect}
                    pulseAnim={pulseAnim}
                  />
                )}

                {currentStep === 2 && !showFavorites && (
                  <Step2ExerciseSelection
                    selectedMuscleGroup={selectedMuscleGroup}
                    selectedExercises={selectedExerciseIds}
                    onExerciseToggle={handleExerciseToggle}
                    onBack={handleBack}
                    onNext={handleStep2Next}
                  />
                )}

                {currentStep === 2 && showFavorites && (
                  <StepFavorites
                    selectedExercises={selectedExerciseIds}
                    onExerciseToggle={handleExerciseToggle}
                    onBack={() => {
                      setShowFavorites(false);
                      // If we have a selected muscle group, stay on step 2 but show regular exercises
                      // Otherwise, go back to step 1
                      if (!selectedMuscleGroup) {
                        setCurrentStep(1);
                        setSelectedExerciseIds(new Set());
                      }
                    }}
                    onNext={handleStep2Next}
                    selectedMuscleGroup={selectedMuscleGroup}
                  />
                )}

                {currentStep === 3 && (
                  <Step3Configuration
                    selectedExercises={selectedExercises}
                    _exercises={exercises}
                    onConfigurationChange={handleConfigurationChange}
                    onBack={handleBack}
                    onAddAll={handleAddAll}
                  />
                )}
              </View>
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
