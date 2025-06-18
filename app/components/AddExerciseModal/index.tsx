/* eslint-disable max-lines */
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  GestureResponderEvent,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import DraggableConfigurationItem from './components/DraggableConfigurationItem';
import { MuscleGroupRender } from './components/MuscleMarkers';
import { FALLBACK_IMAGE_OBJECT, muscleGroups } from './constants';
import { styles } from './styles';
import { AddExerciseModalProps, ExerciseConfiguration, SelectedExercise } from './types';
import { captureUIError, captureAPIError, SentryReactProfiler } from '../../services/sentry';
import * as Sentry from '@sentry/react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_HEIGHT = 100;

// Map of alternative names for muscle groups to support better search
const MUSCLE_GROUP_ALIASES: Record<string, string[]> = {
  Chest: ['pecs', 'pectorals', 'chest muscles'],
  Biceps: ['bis', 'guns', 'arms'],
  Triceps: ['tris', 'back of arms'],
  Abs: ['abdominals', 'six pack', 'core', 'stomach', 'midsection'],
  Shoulders: ['delts', 'deltoids'],
  Lats: ['latissimus dorsi', 'wings', 'back'],
  Quads: ['quadriceps', 'front thighs'],
  Hamstrings: ['hammies', 'back thighs'],
  Glutes: ['gluteus maximus', 'butt', 'buttocks'],
  Calves: ['calf muscles', 'lower legs'],
  Forearms: ['lower arms'],
  Lower_back: [
    'lower back',
    'erectorspinae',
    'erector-spinae',
    'erector',
    'lower_back',
    'lowerback',
  ],
  Traps: ['trapezius', 'upper back'],
};

// Search operations helper
interface SearchOperationsParams {
  isSearchActive: boolean;
  searchWidthAnim: Animated.Value;
  contentOffsetAnim: Animated.Value;
  searchInputRef: React.RefObject<TextInput | null>;
  setIsSearchActive: (active: boolean) => void;
  setSearchQuery: (query: string) => void;
  SCREEN_WIDTH: number;
}

const handleSearchOperations = ({
  isSearchActive,
  searchWidthAnim,
  contentOffsetAnim,
  searchInputRef,
  setIsSearchActive,
  setSearchQuery,
  SCREEN_WIDTH,
}: SearchOperationsParams) => {
  const openSearch = () => {
    try {
      // Track search activation
      Sentry.addBreadcrumb({
        message: 'Search Bar Opened',
        category: 'user.interaction',
        level: 'info',
        data: {
          trigger: 'search_icon_click',
          screenWidth: SCREEN_WIDTH,
        },
      });

      setIsSearchActive(true);
      Animated.timing(searchWidthAnim, {
        toValue: SCREEN_WIDTH - 32,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      });

      Animated.timing(contentOffsetAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      captureUIError(error as Error, 'SearchOperations.openSearch', 'add-exercise-modal');
    }
  };

  const collapseSearchUI = () => {
    Animated.timing(searchWidthAnim, {
      toValue: 40,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsSearchActive(false);
    });

    Animated.timing(contentOffsetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const clearSearch = () => {
    setSearchQuery('');
    collapseSearchUI();
  };

  const handleSearchIconPress = () => {
    if (isSearchActive) {
      collapseSearchUI();
    } else {
      openSearch();
    }
  };

  const handleSearchSubmit = () => {
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  return {
    openSearch,
    collapseSearchUI,
    clearSearch,
    handleSearchIconPress,
    handleSearchSubmit,
  };
};

// Custom hook for search state management
const useSearchState = (onSearchFromStep1?: () => void) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldActivateSearchOnStep2, setShouldActivateSearchOnStep2] = useState(false);
  const searchWidthAnim = useRef(new Animated.Value(40)).current;
  const contentOffsetAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;

  const searchOperations = handleSearchOperations({
    isSearchActive,
    searchWidthAnim,
    contentOffsetAnim,
    searchInputRef,
    setIsSearchActive,
    setSearchQuery,
    SCREEN_WIDTH,
  });

  // Override openSearch for step 1 to navigate to step 2 with all exercises
  const openSearchWithNavigation = () => {
    if (onSearchFromStep1) {
      setShouldActivateSearchOnStep2(true);
      onSearchFromStep1();
    } else {
      searchOperations.openSearch();
    }
  };

  // Search results header animation
  useEffect(() => {
    if (!isSearchActive && searchQuery.trim() !== '') {
      Animated.timing(searchResultsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(searchResultsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isSearchActive, searchQuery]);

  // Keyboard dismiss listener
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (isSearchActive && searchQuery.trim() !== '') {
        searchOperations.collapseSearchUI();
      }
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [isSearchActive, searchQuery]);

  // Auto-activate search when navigating from step 1 search
  const activateSearchOnStep2 = () => {
    if (shouldActivateSearchOnStep2) {
      setShouldActivateSearchOnStep2(false);
      // Delay to ensure the component is mounted
      setTimeout(() => {
        searchOperations.openSearch();
      }, 100);
    }
  };

  return {
    isSearchActive,
    setIsSearchActive,
    searchQuery,
    setSearchQuery,
    searchWidthAnim,
    contentOffsetAnim,
    searchInputRef,
    searchResultsOpacity,
    shouldActivateSearchOnStep2,
    setShouldActivateSearchOnStep2,
    activateSearchOnStep2,
    ...searchOperations,
    openSearchWithNavigation,
  };
};

// Enhanced filtering hook for exercises
const useExerciseFiltering = (exercises: Exercise[], searchQuery: string) => {
  const matchesMuscleGroup = useCallback((exercise: Exercise, query: string): boolean => {
    if (exercise.muscle_group && exercise.muscle_group.toLowerCase().includes(query)) {
      return true;
    }

    if (exercise.muscle_group) {
      const aliases = MUSCLE_GROUP_ALIASES[exercise.muscle_group as ExerciseCategory] || [];
      return aliases.some((alias) => alias.toLowerCase().includes(query));
    }

    return false;
  }, []);

  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;

    const query = searchQuery.toLowerCase().trim();
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(query) ||
        (ex.muscle_group && ex.muscle_group.toLowerCase().includes(query)) ||
        matchesMuscleGroup(ex, query),
    );
  }, [exercises, searchQuery, matchesMuscleGroup]);

  return { filteredExercises };
};

// Muscle group filtering hook
const useMuscleGroupFiltering = (searchQuery: string, currentView: 'front' | 'back') => {
  const filteredMuscleGroups = useMemo(() => {
    const viewFilteredMuscles = muscleGroups.filter((muscle) => muscle.view === currentView);

    if (!searchQuery.trim()) return viewFilteredMuscles;

    const query = searchQuery.toLowerCase().trim();
    return viewFilteredMuscles.filter((muscle) => {
      // Check muscle name
      if (muscle.name.toLowerCase().includes(query)) {
        return true;
      }

      // Check aliases
      const aliases = MUSCLE_GROUP_ALIASES[muscle.name] || [];
      return aliases.some((alias) => alias.toLowerCase().includes(query));
    });
  }, [searchQuery, currentView]);

  return { filteredMuscleGroups };
};

// Floating Search UI Component
interface FloatingSearchUIProps {
  searchState: ReturnType<typeof useSearchState>;
  stepTitle: string;
  currentStep?: number;
}

const FloatingSearchUI = ({ searchState, stepTitle, currentStep }: FloatingSearchUIProps) => {
  const getPlaceholder = () => {
    if (currentStep === 1) {
      return 'Search muscle groups...';
    }
    return 'Search exercises...';
  };

  return (
    <>
      {/* Floating Search */}
      <View style={styles.floatingSearchRow}>
        <Animated.View
          style={[
            styles.searchContainer,
            {
              width: searchState.isSearchActive ? searchState.searchWidthAnim : 40,
              flex: searchState.isSearchActive ? 1 : undefined,
            },
          ]}
        >
          {!searchState.isSearchActive ? (
            <TouchableOpacity
              style={styles.searchIconButton}
              onPress={
                currentStep === 1 ? searchState.openSearchWithNavigation : searchState.openSearch
              }
            >
              <MaterialIcons
                name="search"
                size={22}
                color={searchState.searchQuery.trim() ? COLORS.primary : COLORS.text}
              />
              {searchState.searchQuery.trim() !== '' && (
                <View style={styles.activeFilterIndicator} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.activeSearchContainer}>
              <TouchableOpacity onPress={searchState.handleSearchIconPress}>
                <MaterialIcons
                  name="search"
                  size={24}
                  color={COLORS.text}
                  style={styles.searchIconActive}
                />
              </TouchableOpacity>
              <TextInput
                ref={searchState.searchInputRef}
                style={styles.searchInput}
                placeholder={getPlaceholder()}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchState.searchQuery}
                onChangeText={searchState.setSearchQuery}
                autoFocus={searchState.isSearchActive}
                returnKeyType="search"
                onSubmitEditing={searchState.handleSearchSubmit}
              />
              <TouchableOpacity onPress={searchState.clearSearch}>
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Background Overlay to collapse search */}
      {searchState.isSearchActive && (
        <TouchableWithoutFeedback onPress={searchState.collapseSearchUI}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Floating search results header */}
      {!searchState.isSearchActive && searchState.searchQuery.trim() !== '' && (
        <Animated.View
          style={[
            styles.searchResultsHeader,
            {
              opacity: searchState.searchResultsOpacity,
              transform: [
                {
                  translateY: searchState.searchResultsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.searchResultsText} numberOfLines={1}>
            Results for "
            <Text style={styles.queryHighlight} numberOfLines={1} ellipsizeMode="middle">
              {searchState.searchQuery.length > 15
                ? searchState.searchQuery.substring(0, 15) + '...'
                : searchState.searchQuery}
            </Text>
            " in {stepTitle}
          </Text>
          <TouchableOpacity
            onPress={searchState.clearSearch}
            style={styles.clearSearchResultsButton}
          >
            <MaterialIcons name="close" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </>
  );
};

// Step components
const Step1MuscleSelection = ({
  currentView,
  setCurrentView,
  onMuscleSelect,
  pulseAnim,
  searchState,
}: {
  currentView: 'front' | 'back';
  setCurrentView: (view: 'front' | 'back') => void;
  onMuscleSelect: (muscle: string) => void;
  pulseAnim: Animated.Value;
  searchState: ReturnType<typeof useSearchState>;
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const SWIPE_THRESHOLD = 50;

  // Track step 1 rendering
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Step 1 Muscle Selection Rendered',
      category: 'ui.render',
      level: 'info',
      data: {
        currentView,
        isImageLoaded,
        searchQuery: searchState.searchQuery,
      },
    });
  }, [currentView, isImageLoaded, searchState.searchQuery]);

  const frontBodyModel = require('../../../assets/body-model_front.png');
  const backBodyModel = require('../../../assets/body-model_back.png');

  // Use muscle group filtering
  const { filteredMuscleGroups } = useMuscleGroupFiltering(searchState.searchQuery, currentView);

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

    try {
      // Track view change
      Sentry.addBreadcrumb({
        message: 'Body Model View Changed',
        category: 'user.interaction',
        level: 'info',
        data: {
          fromView: currentView,
          toView: newView,
          trigger: 'swipe',
        },
      });

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
    } catch (error) {
      captureUIError(error as Error, 'Step1MuscleSelection.handleViewChange', 'add-exercise-modal');
    }
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
            filteredMuscleGroups.map((muscle) => (
              <MuscleGroupRender
                key={muscle.id}
                muscle={muscle}
                pulseAnim={pulseAnim}
                onPress={onMuscleSelect}
              />
            ))}
        </Animated.View>
      </View>

      {/* Show empty state when search has no results */}
      {isImageLoaded && searchState.searchQuery.trim() && filteredMuscleGroups.length === 0 && (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyText}>No muscle groups match your search</Text>
        </View>
      )}
    </View>
  );
};

// Step for all exercises (when searching from step 1)
const StepAllExercises = ({
  selectedExercises,
  onExerciseToggle,
  onNext,
  searchState,
  isExerciseAlreadyAdded,
}: {
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-activate search when component mounts from step 1 navigation
  useEffect(() => {
    searchState.activateSearchOnStep2();
  }, []);

  useEffect(() => {
    const loadAllExercises = async () => {
      const startTime = Date.now();

      try {
        setLoading(true);

        // Track all exercises loading start
        Sentry.addBreadcrumb({
          message: 'Loading All Exercises from Search',
          category: 'api.request',
          level: 'info',
          data: {
            trigger: 'step1_search',
            step: 'all_exercises',
          },
        });

        // Load all exercises from all categories
        const allCategories: ExerciseCategory[] = [
          'Chest',
          'Biceps',
          'Triceps',
          'Abs',
          'Shoulders',
          'Lats',
          'Quads',
          'Hamstrings',
          'Glutes',
          'Calves',
          'Forearms',
          'Lower_back',
          'Traps',
          'Obliques',
          'Adductors',
          'Abductors',
          'Cardio',
        ];

        const allExercises: Exercise[] = [];
        const failedCategories: string[] = [];

        for (const category of allCategories) {
          try {
            const categoryExercises = await exerciseService.getExercisesByCategory(category);
            allExercises.push(...categoryExercises);
          } catch (error) {
            console.warn(`Failed to load exercises for category ${category}:`, error);
            failedCategories.push(category);

            // Track individual category failures
            captureAPIError(error as Error, `category-${category}-loading`, 'StepAllExercises');
          }
        }

        setExercises(allExercises);

        // Track successful loading
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'All Exercises Loaded',
          category: 'api.success',
          level: 'info',
          data: {
            totalExercises: allExercises.length,
            categoriesLoaded: allCategories.length - failedCategories.length,
            failedCategories,
            loadDuration: duration,
          },
        });
      } catch (error) {
        console.error('Error loading all exercises:', error);

        // Capture comprehensive error
        captureAPIError(error as Error, 'all-exercises-loading', 'StepAllExercises');

        Sentry.addBreadcrumb({
          message: 'Failed to Load All Exercises',
          category: 'api.error',
          level: 'error',
          data: {
            error: (error as Error).message,
            duration: Date.now() - startTime,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadAllExercises();
  }, []);

  const { filteredExercises } = useExerciseFiltering(exercises, searchState.searchQuery);

  const emptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyText}>
        {searchState.searchQuery.trim()
          ? 'No exercises match your search'
          : 'No exercises available'}
      </Text>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading all exercises...</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {filteredExercises.length === 0
              ? emptyComponent()
              : Array.from({ length: Math.ceil(filteredExercises.length / 2) }).map(
                  (_, rowIndex) => {
                    const startIdx = rowIndex * 2;
                    const rowItems = filteredExercises.slice(startIdx, startIdx + 2);

                    return (
                      <View key={`row-${rowIndex}`} style={styles.exerciseRow}>
                        {rowItems.map((exercise) => (
                          <View key={exercise.id} style={styles.exerciseCardContainer}>
                            <ExerciseCard
                              id={exercise.id}
                              name={exercise.name}
                              image={
                                exercise.image_url
                                  ? { uri: exercise.image_url }
                                  : FALLBACK_IMAGE_OBJECT
                              }
                              isFavorite={false}
                              onPress={() => onExerciseToggle(exercise.id)}
                              onToggleFavorite={() => {}}
                              useOptimizedImage={true}
                              hideFavoriteButton={true}
                              disabled={isExerciseAlreadyAdded?.(exercise.id) || false}
                              disabledReason="Already in workout"
                            />
                            {selectedExercises.has(exercise.id) && (
                              <View style={styles.selectedOverlay}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={24}
                                  color={COLORS.primary}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                        {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                      </View>
                    );
                  },
                )}
          </View>
        </ScrollView>
      )}

      <View style={styles.stepActions}>
        <Text style={styles.summaryText}>Selected Exercises: {selectedExercises.size}</Text>

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

const Step2ExerciseSelection = ({
  selectedMuscleGroup,
  selectedExercises,
  onExerciseToggle,
  onNext,
  searchState,
  isExerciseAlreadyAdded,
}: {
  selectedMuscleGroup: string;
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExercises = async () => {
      const startTime = Date.now();

      try {
        setLoading(true);

        // Track exercise loading start
        Sentry.addBreadcrumb({
          message: 'Loading Exercises for Muscle Group',
          category: 'api.request',
          level: 'info',
          data: {
            muscleGroup: selectedMuscleGroup,
            step: 'exercise_selection',
          },
        });

        let categoryKey = selectedMuscleGroup;
        if (selectedMuscleGroup === 'Lower back') {
          categoryKey = 'Lower_back';
        }

        const exerciseData = await exerciseService.getExercisesByCategory(
          categoryKey as ExerciseCategory,
        );

        setExercises(exerciseData);

        // Track successful loading
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Exercises Loaded Successfully',
          category: 'api.success',
          level: 'info',
          data: {
            muscleGroup: selectedMuscleGroup,
            exerciseCount: exerciseData.length,
            loadDuration: duration,
          },
        });
      } catch (error) {
        console.error('Error loading exercises:', error);

        // Capture API error
        captureAPIError(error as Error, 'exercise-loading', 'Step2ExerciseSelection');

        Sentry.addBreadcrumb({
          message: 'Failed to Load Exercises',
          category: 'api.error',
          level: 'error',
          data: {
            error: (error as Error).message,
            muscleGroup: selectedMuscleGroup,
            duration: Date.now() - startTime,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [selectedMuscleGroup]);

  const { filteredExercises } = useExerciseFiltering(exercises, searchState.searchQuery);

  const emptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyText}>
        {searchState.searchQuery.trim()
          ? 'No exercises match your search'
          : 'No exercises available'}
      </Text>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {filteredExercises.length === 0
              ? emptyComponent()
              : Array.from({ length: Math.ceil(filteredExercises.length / 2) }).map(
                  (_, rowIndex) => {
                    const startIdx = rowIndex * 2;
                    const rowItems = filteredExercises.slice(startIdx, startIdx + 2);

                    return (
                      <View key={`row-${rowIndex}`} style={styles.exerciseRow}>
                        {rowItems.map((exercise) => (
                          <View key={exercise.id} style={styles.exerciseCardContainer}>
                            <ExerciseCard
                              id={exercise.id}
                              name={exercise.name}
                              image={
                                exercise.image_url
                                  ? { uri: exercise.image_url }
                                  : FALLBACK_IMAGE_OBJECT
                              }
                              isFavorite={false}
                              onPress={() => onExerciseToggle(exercise.id)}
                              onToggleFavorite={() => {}}
                              useOptimizedImage={true}
                              hideFavoriteButton={true}
                              disabled={isExerciseAlreadyAdded?.(exercise.id) || false}
                              disabledReason="Already in workout"
                            />
                            {selectedExercises.has(exercise.id) && (
                              <View style={styles.selectedOverlay}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={24}
                                  color={COLORS.primary}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                        {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                      </View>
                    );
                  },
                )}
          </View>
        </ScrollView>
      )}

      <View style={styles.stepActions}>
        <Text style={styles.summaryText}>Selected Exercises: {selectedExercises.size}</Text>

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
  onNext,
  selectedMuscleGroup,
  searchState,
  isExerciseAlreadyAdded,
}: {
  selectedExercises: Set<string>;
  onExerciseToggle: (exerciseId: string) => void;
  onNext: () => void;
  selectedMuscleGroup?: string;
  searchState: ReturnType<typeof useSearchState>;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
}) => {
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

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

  const { filteredExercises } = useExerciseFiltering(favoriteExercises, searchState.searchQuery);

  const getEmptyStateText = () => {
    if (searchState.searchQuery.trim()) {
      return 'No favorite exercises match your search';
    }
    if (selectedMuscleGroup) {
      return `No favorite ${selectedMuscleGroup.toLowerCase()} exercises found`;
    }
    return 'No favorite exercises found';
  };

  const getEmptyStateSubtext = () => {
    if (searchState.searchQuery.trim()) {
      return 'Try adjusting your search terms';
    }
    if (selectedMuscleGroup) {
      return `Mark ${selectedMuscleGroup.toLowerCase()} exercises as favorites to see them here`;
    }
    return 'Mark exercises as favorites to see them here';
  };

  const emptyComponent = () => (
    <View style={styles.emptyFavoritesContainer}>
      <Ionicons name="star-outline" size={64} color={COLORS.placeholder} />
      <Text style={styles.emptyFavoritesTitle}>{getEmptyStateText()}</Text>
      <Text style={styles.emptyFavoritesText}>{getEmptyStateSubtext()}</Text>
    </View>
  );

  return (
    <View style={styles.stepContainer}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading favorite exercises...</Text>
        </View>
      ) : (
        <ScrollView style={styles.exerciseGrid} showsVerticalScrollIndicator={false}>
          <View style={styles.exerciseCardsContainer}>
            {filteredExercises.length === 0
              ? emptyComponent()
              : Array.from({ length: Math.ceil(filteredExercises.length / 2) }).map(
                  (_, rowIndex) => {
                    const startIdx = rowIndex * 2;
                    const rowItems = filteredExercises.slice(startIdx, startIdx + 2);

                    return (
                      <View key={`row-${rowIndex}`} style={styles.exerciseRow}>
                        {rowItems.map((exercise) => (
                          <View key={exercise.id} style={styles.exerciseCardContainer}>
                            <ExerciseCard
                              id={exercise.id}
                              name={exercise.name}
                              image={
                                exercise.image_url
                                  ? { uri: exercise.image_url }
                                  : FALLBACK_IMAGE_OBJECT
                              }
                              isFavorite={true}
                              onPress={() => onExerciseToggle(exercise.id)}
                              onToggleFavorite={() => {}}
                              useOptimizedImage={true}
                              hideFavoriteButton={true}
                              disabled={isExerciseAlreadyAdded?.(exercise.id) || false}
                              disabledReason="Already in workout"
                            />
                            {selectedExercises.has(exercise.id) && (
                              <View style={styles.selectedOverlay}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={24}
                                  color={COLORS.primary}
                                />
                              </View>
                            )}
                          </View>
                        ))}
                        {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                      </View>
                    );
                  },
                )}
          </View>
        </ScrollView>
      )}

      <View style={styles.stepActions}>
        <Text style={styles.summaryText}>Selected Exercises: {selectedExercises.size}</Text>

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
  onAddAll,
}: {
  selectedExercises: SelectedExercise[];
  onAddAll: (exercises: SelectedExercise[]) => void;
}) => {
  const [localExercises, setLocalExercises] = useState(selectedExercises || []);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(-1);
  const [dragTargetIndex, setDragTargetIndex] = useState(-1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Only initialize once when the component mounts
  useEffect(() => {
    if (!isInitialized && selectedExercises && selectedExercises.length > 0) {
      setLocalExercises(selectedExercises);
      setIsInitialized(true);
    }
  }, [selectedExercises, isInitialized]);

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDraggedIndex(index);
    setDragTargetIndex(index);
  }, []);

  const handleDragUpdate = useCallback(
    (draggedIndex: number, currentY: number) => {
      // Simple calculation - determine target position based on drag distance
      const itemsMoved = Math.round(currentY / ITEM_HEIGHT);
      const exerciseCount = localExercises?.length || 0;
      const newTargetIndex = Math.max(0, Math.min(draggedIndex + itemsMoved, exerciseCount - 1));
      setDragTargetIndex(newTargetIndex);
    },
    [localExercises?.length],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Reset drag state
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Only reorder if position actually changed and localExercises exists
      if (
        localExercises &&
        fromIndex !== toIndex &&
        toIndex >= 0 &&
        toIndex < localExercises.length
      ) {
        const newExercises = [...localExercises];
        const [movedExercise] = newExercises.splice(fromIndex, 1);
        newExercises.splice(toIndex, 0, movedExercise);

        setLocalExercises(newExercises);
      }
    },
    [localExercises],
  );

  const handleRemoveExercise = useCallback(
    (index: number) => {
      if (localExercises) {
        const newExercises = localExercises.filter((_, i) => i !== index);
        setLocalExercises(newExercises);
      }
    },
    [localExercises],
  );

  const handleConfigurationChangeLocal = useCallback(
    (exerciseId: string, field: 'sets' | 'reps_range', value: string | number) => {
      setLocalExercises((prev) =>
        (prev || []).map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex)),
      );
      // Don't call onConfigurationChange here to avoid triggering parent re-renders
      // The parent will get the updated exercises when onAddAll is called
    },
    [],
  );

  return (
    <View style={styles.stepContainer}>
      <ScrollView
        style={styles.configurationList}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDragging}
      >
        {(localExercises || []).map((exercise, index) => (
          <DraggableConfigurationItem
            key={exercise.id}
            exercise={exercise}
            index={index}
            onConfigurationChange={handleConfigurationChangeLocal}
            onRemoveExercise={handleRemoveExercise}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragUpdate={handleDragUpdate}
            isDragging={isDragging}
            draggedIndex={draggedIndex}
            dragTargetIndex={dragTargetIndex}
            totalExercises={localExercises?.length || 0}
          />
        ))}
      </ScrollView>

      <View style={styles.stepActions}>
        <Text style={styles.summaryText}>Selected Exercises: {localExercises?.length || 0}</Text>

        <TouchableOpacity
          style={[
            styles.nextButton,
            (localExercises?.length || 0) === 0 && styles.nextButtonDisabled,
          ]}
          onPress={() => onAddAll(localExercises || [])}
          disabled={(localExercises?.length || 0) === 0}
        >
          <Text style={styles.nextButtonText}>Add All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Custom hook for favorite functionality
const useFavoriteLogic = ({
  currentStep,
  showFavorites,
  selectedMuscleGroup,
  setShowFavorites,
  setCurrentStep,
  setSelectedMuscleGroup,
  setSelectedExerciseIds,
}: {
  currentStep: number;
  showFavorites: boolean;
  selectedMuscleGroup: string;
  setShowFavorites: (show: boolean) => void;
  setCurrentStep: (step: number) => void;
  setSelectedMuscleGroup: (group: string) => void;
  setSelectedExerciseIds: (ids: Set<string>) => void;
}) => {
  const handleFavoritePress = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics might not be available
    }

    if (showFavorites) {
      // If currently showing favorites, turn it off and go back to step 1
      setShowFavorites(false);
      setCurrentStep(1);
      setSelectedMuscleGroup('');
      // Keep selected exercises when exiting favorites mode
    } else {
      // If not showing favorites, turn it on and go to step 2
      setShowFavorites(true);
      setCurrentStep(2);

      // If we're on step 1 (no muscle group selected), clear muscle group to show all favorites
      // If we're on step 2 (muscle group selected), keep the muscle group to show filtered favorites
      if (currentStep === 1) {
        setSelectedMuscleGroup('');
      }
      // Keep the current selectedMuscleGroup if we're on step 2

      // Keep selected exercises when entering favorites mode
    }
  }, [
    showFavorites,
    selectedMuscleGroup,
    currentStep,
    setShowFavorites,
    setCurrentStep,
    setSelectedMuscleGroup,
    setSelectedExerciseIds,
  ]);

  return { handleFavoritePress };
};

// Step content renderer
const renderStepContent = ({
  currentStep,
  showFavorites,
  showAllExercises,
  currentView,
  setCurrentView,
  handleMuscleSelect,
  pulseAnim,
  selectedMuscleGroup,
  selectedExerciseIds,
  handleExerciseToggle,
  handleStep2Next,
  searchState,
  selectedExercises,
  handleAddAll,
  isExerciseAlreadyAdded,
}: {
  currentStep: number;
  showFavorites: boolean;
  showAllExercises: boolean;
  currentView: 'front' | 'back';
  setCurrentView: (view: 'front' | 'back') => void;
  handleMuscleSelect: (muscle: string) => void;
  pulseAnim: Animated.Value;
  selectedMuscleGroup: string;
  selectedExerciseIds: Set<string>;
  handleExerciseToggle: (exerciseId: string) => void;
  handleStep2Next: () => void;
  searchState: ReturnType<typeof useSearchState>;
  selectedExercises: SelectedExercise[];
  handleAddAll: (exercises: SelectedExercise[]) => void;
  isExerciseAlreadyAdded?: (exerciseId: string) => boolean;
}) => {
  if (currentStep === 1) {
    return (
      <Step1MuscleSelection
        currentView={currentView}
        setCurrentView={setCurrentView}
        onMuscleSelect={handleMuscleSelect}
        pulseAnim={pulseAnim}
        searchState={searchState}
      />
    );
  }

  if (currentStep === 2 && !showFavorites) {
    // Show all exercises if coming from search on step 1
    if (showAllExercises) {
      return (
        <StepAllExercises
          selectedExercises={selectedExerciseIds}
          onExerciseToggle={handleExerciseToggle}
          onNext={handleStep2Next}
          searchState={searchState}
          isExerciseAlreadyAdded={isExerciseAlreadyAdded}
        />
      );
    }

    return (
      <Step2ExerciseSelection
        selectedMuscleGroup={selectedMuscleGroup}
        selectedExercises={selectedExerciseIds}
        onExerciseToggle={handleExerciseToggle}
        onNext={handleStep2Next}
        searchState={searchState}
        isExerciseAlreadyAdded={isExerciseAlreadyAdded}
      />
    );
  }

  if (currentStep === 2 && showFavorites) {
    return (
      <StepFavorites
        selectedExercises={selectedExerciseIds}
        onExerciseToggle={handleExerciseToggle}
        onNext={handleStep2Next}
        selectedMuscleGroup={selectedMuscleGroup}
        searchState={searchState}
        isExerciseAlreadyAdded={isExerciseAlreadyAdded}
      />
    );
  }

  if (currentStep === 3) {
    return <Step3Configuration selectedExercises={selectedExercises} onAddAll={handleAddAll} />;
  }

  return null;
};

export default function AddExerciseModal({
  visible,
  onClose,
  onAddExercises,
  currentWorkoutExercises = [],
}: AddExerciseModalProps) {
  const insets = useSafeAreaInsets();

  // Create a set of existing exercise IDs for quick lookup
  const existingExerciseIds = useMemo(() => {
    const idSet = new Set<string>();
    currentWorkoutExercises.forEach((exercise) => {
      // Check both id and exercise_id fields to handle different exercise formats
      if (exercise.id) idSet.add(exercise.id);
      if (exercise.exercise_id) idSet.add(exercise.exercise_id);
    });
    return idSet;
  }, [currentWorkoutExercises]);

  // Helper function to check if an exercise is already in the workout
  const isExerciseAlreadyAdded = useCallback(
    (exerciseId: string) => {
      return existingExerciseIds.has(exerciseId);
    },
    [existingExerciseIds],
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);

  const [showFavorites, setShowFavorites] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);

  // Track modal lifecycle and errors
  useEffect(() => {
    if (visible) {
      // Track modal opening
      Sentry.addBreadcrumb({
        message: 'Add Exercise Modal Opened',
        category: 'user.interaction',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          initialStep: currentStep,
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('AddExerciseModal', 'mount');
    } else {
      // Track modal closing
      Sentry.addBreadcrumb({
        message: 'Add Exercise Modal Closed',
        category: 'user.interaction',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          finalStep: currentStep,
          selectedExercisesCount: selectedExercises.length,
          selectedMuscleGroup,
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('AddExerciseModal', 'unmount');
    }
  }, [visible]);

  // Track step changes
  useEffect(() => {
    if (visible && currentStep > 1) {
      Sentry.addBreadcrumb({
        message: `Step Changed to ${currentStep}`,
        category: 'user.navigation',
        level: 'info',
        data: {
          step: currentStep,
          muscleGroup: selectedMuscleGroup,
          exerciseCount: selectedExerciseIds.size,
          showFavorites,
          showAllExercises,
        },
      });
    }
  }, [currentStep, visible]);

  // Handle search from step 1 - navigate to step 2 with all exercises
  const handleSearchFromStep1 = useCallback(() => {
    setShowAllExercises(true);
    setSelectedMuscleGroup(''); // Clear muscle group selection
    setShowFavorites(false); // Turn off favorites
    setCurrentStep(2);
    // Keep selected exercises when searching from step 1
  }, []);

  // Search state
  const searchState = useSearchState(handleSearchFromStep1);

  // Favorite logic
  const favoriteLogic = useFavoriteLogic({
    currentStep,
    showFavorites,
    selectedMuscleGroup,
    setShowFavorites,
    setCurrentStep,
    setSelectedMuscleGroup,
    setSelectedExerciseIds,
  });

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
      setShowFavorites(false);
      setShowAllExercises(false);
      // Clear search when modal closes
      searchState.setSearchQuery('');
      searchState.setIsSearchActive(false);
      searchState.setShouldActivateSearchOnStep2(false);
      searchState.searchWidthAnim.setValue(40);
      searchState.contentOffsetAnim.setValue(0);
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

  const handleMuscleSelect = useCallback(
    async (muscleName: string) => {
      try {
        // Track muscle group selection
        Sentry.addBreadcrumb({
          message: 'Muscle Group Selected',
          category: 'user.interaction',
          level: 'info',
          data: {
            muscleGroup: muscleName,
            previousStep: currentStep,
            timestamp: new Date().toISOString(),
          },
        });

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setSelectedMuscleGroup(muscleName);
        setCurrentStep(2);
      } catch (error) {
        // Capture haptics or other errors
        captureUIError(error as Error, 'AddExerciseModal.handleMuscleSelect', 'add-exercise-modal');

        // Still proceed with muscle selection even if haptics fail
        setSelectedMuscleGroup(muscleName);
        setCurrentStep(2);
      }
    },
    [currentStep],
  );

  const handleExerciseToggle = useCallback(
    (exerciseId: string) => {
      try {
        // Don't allow selecting exercises that are already in the workout
        if (isExerciseAlreadyAdded(exerciseId)) {
          Sentry.addBreadcrumb({
            message: 'Attempted to select already added exercise',
            category: 'user.interaction',
            level: 'info',
            data: {
              exerciseId,
              action: 'exercise_already_added',
            },
          });
          return;
        }

        setSelectedExerciseIds((prev) => {
          const newSet = new Set(prev);
          const wasSelected = newSet.has(exerciseId);

          if (wasSelected) {
            newSet.delete(exerciseId);
          } else {
            newSet.add(exerciseId);
          }

          // Track exercise selection/deselection
          Sentry.addBreadcrumb({
            message: `Exercise ${wasSelected ? 'Deselected' : 'Selected'}`,
            category: 'user.interaction',
            level: 'info',
            data: {
              exerciseId,
              action: wasSelected ? 'deselect' : 'select',
              totalSelected: newSet.size,
              muscleGroup: selectedMuscleGroup,
              step: currentStep,
            },
          });

          return newSet;
        });
      } catch (error) {
        captureUIError(
          error as Error,
          'AddExerciseModal.handleExerciseToggle',
          'add-exercise-modal',
        );
      }
    },
    [selectedMuscleGroup, currentStep, isExerciseAlreadyAdded],
  );

  const handleStep2Next = useCallback(async () => {
    const startTime = Date.now();

    try {
      // Track progression to configuration step
      Sentry.addBreadcrumb({
        message: 'Proceeding to Exercise Configuration',
        category: 'user.navigation',
        level: 'info',
        data: {
          selectedCount: selectedExerciseIds.size,
          muscleGroup: selectedMuscleGroup,
          showFavorites,
          showAllExercises,
        },
      });

      setCurrentStep(3);

      let exerciseData: Exercise[] = [];

      if (showFavorites) {
        // If we're in favorites mode, get all favorite exercises
        Sentry.addBreadcrumb({
          message: 'Loading Favorite Exercises for Configuration',
          category: 'api.request',
          level: 'info',
        });

        exerciseData = await exerciseService.getFavoriteExercises();
      } else if (showAllExercises) {
        // If we're showing all exercises (from search), load all categories
        Sentry.addBreadcrumb({
          message: 'Loading All Exercises for Configuration (from search)',
          category: 'api.request',
          level: 'info',
        });

        const allCategories: ExerciseCategory[] = [
          'Chest',
          'Biceps',
          'Triceps',
          'Abs',
          'Shoulders',
          'Lats',
          'Quads',
          'Hamstrings',
          'Glutes',
          'Calves',
          'Forearms',
          'Lower_back',
          'Traps',
          'Obliques',
          'Adductors',
          'Abductors',
          'Cardio',
        ];

        for (const category of allCategories) {
          try {
            const categoryExercises = await exerciseService.getExercisesByCategory(category);
            exerciseData = [...exerciseData, ...categoryExercises];
          } catch (error) {
            console.warn(`Failed to load exercises for category ${category}:`, error);
          }
        }
      } else {
        // We need to determine if the selected exercises span multiple muscle groups
        // If so, load exercises from all categories to ensure we get all selected exercises
        const selectedIds = Array.from(selectedExerciseIds);

        // First, try loading from the current muscle group
        let categoryKey = selectedMuscleGroup;
        if (selectedMuscleGroup === 'Lower back') {
          categoryKey = 'Lower_back';
        }

        Sentry.addBreadcrumb({
          message: 'Loading Category Exercises for Configuration',
          category: 'api.request',
          level: 'info',
          data: {
            category: categoryKey,
            originalMuscleGroup: selectedMuscleGroup,
            selectedCount: selectedIds.length,
          },
        });

        exerciseData = await exerciseService.getExercisesByCategory(
          categoryKey as ExerciseCategory,
        );

        // Check if all selected exercises are found in the current category
        const foundExerciseIds = exerciseData.map((ex) => ex.id);
        const missingExerciseIds = selectedIds.filter((id) => !foundExerciseIds.includes(id));

        // If there are missing exercises, they're from other muscle groups
        // Load all categories to find them
        if (missingExerciseIds.length > 0) {
          Sentry.addBreadcrumb({
            message: 'Loading exercises from all categories (multi-group selection detected)',
            category: 'api.request',
            level: 'info',
            data: {
              missingCount: missingExerciseIds.length,
              totalSelected: selectedIds.length,
              currentCategory: categoryKey,
            },
          });

          const allCategories: ExerciseCategory[] = [
            'Chest',
            'Biceps',
            'Triceps',
            'Abs',
            'Shoulders',
            'Lats',
            'Quads',
            'Hamstrings',
            'Glutes',
            'Calves',
            'Forearms',
            'Lower_back',
            'Traps',
            'Obliques',
            'Adductors',
            'Abductors',
            'Cardio',
          ];

          // Load exercises from all categories (excluding the one we already loaded)
          for (const category of allCategories) {
            if (category !== categoryKey) {
              try {
                const categoryExercises = await exerciseService.getExercisesByCategory(category);
                exerciseData = [...exerciseData, ...categoryExercises];
              } catch (error) {
                console.warn(`Failed to load exercises for category ${category}:`, error);
              }
            }
          }
        }
      }

      const selected = exerciseData
        .filter((ex) => selectedExerciseIds.has(ex.id))
        .map((ex) => ({
          ...ex,
          sets: 3, // Default sets
          reps_range: '8-10', // Default reps
        }));

      setSelectedExercises(selected);

      // Track successful progression
      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Exercise Configuration Data Loaded Successfully',
        category: 'api.success',
        level: 'info',
        data: {
          exercisesLoaded: exerciseData.length,
          selectedForConfiguration: selected.length,
          loadDuration: duration,
        },
      });
    } catch (error) {
      console.error('Error loading exercise data:', error);

      // Capture API error with detailed context
      captureAPIError(error as Error, 'exercise-configuration-load', 'AddExerciseModal');

      Sentry.addBreadcrumb({
        message: 'Failed to Load Exercise Configuration Data',
        category: 'api.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          muscleGroup: selectedMuscleGroup,
          showFavorites,
          selectedCount: selectedExerciseIds.size,
        },
      });
    }
  }, [selectedMuscleGroup, selectedExerciseIds, showFavorites, showAllExercises]);

  const handleAddAll = useCallback(
    (exercisesToAdd: SelectedExercise[]) => {
      // Transform SelectedExercise to ExerciseConfiguration
      const exerciseConfigurations: ExerciseConfiguration[] = exercisesToAdd.map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps_range: exercise.reps_range,
        image_url: exercise.image_url,
        muscle_group: exercise.muscle_group || selectedMuscleGroup,
        primary_muscles: exercise.primary_muscles,
        requires_weight: exercise.requires_weight,
      }));

      onAddExercises(exerciseConfigurations);
      onClose();
    },
    [onAddExercises, onClose, selectedMuscleGroup],
  );

  const handleBack = useCallback(() => {
    if (currentStep === 2) {
      // If we're showing all exercises (from search), go back to step 1
      if (showAllExercises) {
        setShowAllExercises(false);
        setCurrentStep(1);
        // Keep selected exercises when going back from search
        // Clear search when going back
        searchState.setSearchQuery('');
        searchState.setIsSearchActive(false);
        searchState.setShouldActivateSearchOnStep2(false);
        return;
      }

      // If we're showing favorites, turn off favorites mode and go back to step 1
      if (showFavorites) {
        setShowFavorites(false);
        setCurrentStep(1);
        setSelectedMuscleGroup('');
        // Keep selected exercises when going back from favorites
      } else {
        // Regular back behavior: go to step 1
        setCurrentStep(1);
        setSelectedMuscleGroup('');
        // Keep selected exercises when going back to muscle group selection
      }
    } else if (currentStep === 3) {
      setCurrentStep(2);
      setSelectedExercises([]);
    }
  }, [currentStep, showFavorites, showAllExercises, selectedMuscleGroup, searchState]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const getStepTitle = () => {
    if (showFavorites && currentStep === 2) {
      if (selectedMuscleGroup) {
        return `Favorite ${selectedMuscleGroup} Exercises`;
      }
      return 'Favorite Exercises';
    }

    if (showAllExercises && currentStep === 2) {
      return 'All Exercises';
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
      onRequestClose={currentStep === 1 && !showFavorites ? handleClose : handleBack}
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
                  <TouchableOpacity
                    onPress={currentStep === 1 && !showFavorites ? handleClose : handleBack}
                    style={styles.headerButton}
                  >
                    <Ionicons
                      name={currentStep === 1 && !showFavorites ? 'close' : 'arrow-back'}
                      size={24}
                      color={COLORS.text}
                    />
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
                  {/* Only show favorite button on steps 1 and 2 */}
                  {currentStep !== 3 && (
                    <TouchableOpacity
                      style={styles.headerButton}
                      onPress={favoriteLogic.handleFavoritePress}
                    >
                      <Ionicons
                        name={showFavorites ? 'star' : 'star-outline'}
                        size={24}
                        color={showFavorites ? '#FFD700' : COLORS.text}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Animated.View
                  style={[
                    styles.animatedContentContainer,
                    {
                      transform: [
                        {
                          translateY: searchState.contentOffsetAnim,
                        },
                      ],
                    },
                  ]}
                >
                  {renderStepContent({
                    currentStep,
                    showFavorites,
                    showAllExercises,
                    currentView,
                    setCurrentView,
                    handleMuscleSelect,
                    pulseAnim,
                    selectedMuscleGroup,
                    selectedExerciseIds,
                    handleExerciseToggle,
                    handleStep2Next,
                    searchState,
                    selectedExercises,
                    handleAddAll,
                    isExerciseAlreadyAdded,
                  })}
                </Animated.View>
              </View>
            </View>
          </Animated.View>

          {/* Floating Search UI - show on steps 1 and 2 */}
          {(currentStep === 1 || currentStep === 2) && (
            <FloatingSearchUI
              searchState={searchState}
              stepTitle={getStepTitle()}
              currentStep={currentStep}
            />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
