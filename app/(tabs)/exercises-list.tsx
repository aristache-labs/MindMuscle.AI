import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import useImagePreloader from '../hooks/useImagePreloader';

import type { PreloadingStatus } from '../hooks/useImagePreloader';
import {
  addBreadcrumb,
  captureError,
  capturePerformanceError,
} from '../services/sentry/simpleErrorHandler';
import { setTag, SentryReactProfiler } from '../services/sentry';

// Define types for global placeholders
interface PlaceholderImages {
  exercise?: unknown;
  exerciseObject?: {
    uri: string | null;
    testUri: string;
  };
}

interface GlobalWithPlaceholders {
  placeholderImages?: PlaceholderImages;
  exercisesCache?: {
    all?: Exercise[];
    byCategory?: Record<string, Exercise[]>;
  };
}

// Get screen width for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Create a stable reference to the fallback image object
const FALLBACK_IMAGE_OBJECT = (global as GlobalWithPlaceholders).placeholderImages
  ?.exerciseObject || {
  uri: null,
  testUri: '../../assets/exercises/placeholder.jpg',
};

// Map for category display names
const CATEGORY_NAMES = {
  Cardio: 'CARDIO',
  Shoulders: 'SHOULDERS',
  Chest: 'CHEST',
  Biceps: 'BICEPS',
  Abs: 'ABS',
  Forearms: 'FOREARMS',
  Obliques: 'OBLIQUES',
  Quads: 'QUADS',
  Adductors: 'ADDUCTORS',
  Traps: 'TRAPS',
  Triceps: 'TRICEPS',
  Lats: 'LATS',
  Lower_back: 'LOWER BACK',
  Abductors: 'ABDUCTORS',
  Glutes: 'GLUTES',
  Hamstrings: 'HAMSTRINGS',
  Calves: 'CALVES',
  all: 'ALL EXERCISES',
};

// Map of alternative names for muscle groups to support better search (simplified)
const MUSCLE_GROUP_ALIASES: Record<string, string[]> = {
  Chest: ['pecs', 'pectorals'],
  Biceps: ['bis', 'arms'],
  Triceps: ['tris'],
  Abs: ['abdominals', 'core'],
  Shoulders: ['delts'],
  Lats: ['latissimus', 'back'],
  Quads: ['quadriceps'],
  Hamstrings: ['hammies'],
  Glutes: ['butt'],
  Calves: ['calf'],
  Lower_back: ['lower back', 'lowerback'],
  Traps: ['trapezius'],
};

// Helper function to render search results

// Helper function to render all exercises view

// Helper function to create exercise sections
const createExerciseSections = (
  displayedExercises: Exercise[],
  searchQuery: string,
  currentCategory: string,
  shouldGroupByMuscle: boolean,
): { title: string; data: Exercise[] }[] => {
  const sections: { title: string; data: Exercise[] }[] = [];

  // If searching, group alphabetically
  if (searchQuery.trim() !== '') {
    // Create sections based on first letter
    const sectionMap = new Map<string, Exercise[]>();

    displayedExercises.forEach((exercise) => {
      const firstLetter = exercise.name.charAt(0).toUpperCase();
      if (!sectionMap.has(firstLetter)) {
        sectionMap.set(firstLetter, []);
      }
      sectionMap.get(firstLetter)!.push(exercise);
    });

    // Convert map to array and sort sections alphabetically
    Array.from(sectionMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([title, data]) => {
        sections.push({ title, data });
      });
  }
  // If viewing all exercises and groupByMuscle is true, group by muscle group
  else if (currentCategory === 'all' && shouldGroupByMuscle) {
    // Create sections based on muscle groups
    const sectionMap = new Map<string, Exercise[]>();

    // Define the order of muscle groups for better organization
    const muscleGroupOrder: ExerciseCategory[] = [
      'Cardio',
      'Chest',
      'Shoulders',
      'Biceps',
      'Triceps',
      'Forearms',
      'Abs',
      'Obliques',
      'Lats',
      'Traps',
      'Lower_back',
      'Glutes',
      'Quads',
      'Hamstrings',
      'Adductors',
      'Abductors',
      'Calves',
    ];

    // Group exercises by muscle group
    displayedExercises.forEach((exercise) => {
      const muscleGroup = exercise.muscle_group || 'Other';
      if (!sectionMap.has(muscleGroup)) {
        sectionMap.set(muscleGroup, []);
      }
      sectionMap.get(muscleGroup)!.push(exercise);
    });

    // Add sections in the defined order
    muscleGroupOrder.forEach((muscleGroup) => {
      if (sectionMap.has(muscleGroup)) {
        const data = sectionMap.get(muscleGroup)!;
        // Sort exercises alphabetically within each muscle group
        data.sort((a, b) => a.name.localeCompare(b.name));
        sections.push({
          title: CATEGORY_NAMES[muscleGroup] || muscleGroup,
          data,
        });
        sectionMap.delete(muscleGroup);
      }
    });

    // Add any remaining muscle groups that weren't in our predefined order
    Array.from(sectionMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([muscleGroup, data]) => {
        // Sort exercises alphabetically within each muscle group
        data.sort((a, b) => a.name.localeCompare(b.name));
        sections.push({
          title: CATEGORY_NAMES[muscleGroup as ExerciseCategory] || muscleGroup,
          data,
        });
      });
  }
  // For specific category view or all without groupByMuscle, keep the alphabetical grouping
  else {
    // Create sections based on first letter
    const sectionMap = new Map<string, Exercise[]>();

    displayedExercises.forEach((exercise) => {
      const firstLetter = exercise.name.charAt(0).toUpperCase();
      if (!sectionMap.has(firstLetter)) {
        sectionMap.set(firstLetter, []);
      }
      sectionMap.get(firstLetter)!.push(exercise);
    });

    // Convert map to array and sort sections alphabetically
    Array.from(sectionMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([title, data]) => {
        sections.push({ title, data });
      });
  }

  return sections;
};

// Enhanced load exercises data function with Sentry tracking
const loadExercisesData = async (
  currentCategory: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  setExercises: (exercises: Exercise[]) => void,
  setAllExercises: (exercises: Exercise[]) => void,
  setFavoriteIds: (favoriteIds: Set<string>) => void,
) => {
  const startTime = Date.now();

  addBreadcrumb(`Loading exercises data for category: ${currentCategory}`, 'api', {
    category: currentCategory,
    timestamp: new Date().toISOString(),
  });

  try {
    setLoading(true);
    setError(null);

    const [exercisesData, favorites] = await Promise.all([
      currentCategory === 'all'
        ? exerciseService.getAllExercises()
        : exerciseService.getExercisesByCategory(currentCategory as ExerciseCategory),
      exerciseService.getFavoriteExercises().catch(() => []), // Graceful fallback
    ]);

    const loadTime = Date.now() - startTime;

    addBreadcrumb('Exercises data loaded successfully', 'api', {
      category: currentCategory,
      exerciseCount: exercisesData.length,
      favoriteCount: favorites.length,
      loadTime,
    });

    exercisesData.sort((a, b) => a.name.localeCompare(b.name));
    setExercises(exercisesData);
    setAllExercises(exercisesData);

    const favoriteIdSet = new Set(favorites.map((fav) => fav.id));
    setFavoriteIds(favoriteIdSet);

    if (loadTime > 2000) {
      capturePerformanceError('Slow exercises data loading', 'data_load_time', loadTime);
    }

    setTag('exercise_category', currentCategory);
    setTag('exercise_count', exercisesData.length.toString());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    captureError(error as Error, {
      category: 'api_error',
      screen: 'exercises_list',
      operation: 'loadExercisesData',
      exerciseCategory: currentCategory,
      loadTime: Date.now() - startTime,
    });

    setError('Failed to load exercises. Please try again.');

    addBreadcrumb('Exercises data loading failed', 'api', {
      category: currentCategory,
      errorMessage,
      loadTime: Date.now() - startTime,
    });
  } finally {
    setLoading(false);
  }
};

// Helper function to handle search operations with object parameter pattern
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

// Add custom hooks before the main component
const useExerciseData = (currentCategory: string) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExercisesData(
      currentCategory,
      setLoading,
      setError,
      setExercises,
      setAllExercises,
      setFavoriteIds,
    );
  }, [currentCategory]);

  const toggleFavorite = useCallback(
    (exerciseId: string) => {
      console.log(`[ExercisesListScreen] Toggle favorite for ${exerciseId}`);

      const exercise = allExercises.find((ex) => ex.id === exerciseId);
      if (!exercise) return;

      setFavoriteIds((prev) => {
        const newFavorites = new Set(prev);
        if (newFavorites.has(exerciseId)) {
          newFavorites.delete(exerciseId);
          void exerciseService.toggleFavoriteExercise(exerciseId, false);
        } else {
          newFavorites.add(exerciseId);
          void exerciseService.toggleFavoriteExercise(exerciseId, true);
        }
        return newFavorites;
      });
    },
    [allExercises],
  );

  return {
    exercises,
    allExercises,
    loading,
    error,
    favoriteIds,
    toggleFavorite,
  };
};

const useSearchState = (openSearchParam: string | string[] | undefined) => {
  const [isSearchActive, setIsSearchActive] = useState(openSearchParam === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(
    new Animated.Value(openSearchParam === 'true' ? SCREEN_WIDTH - 32 : 40),
  ).current;
  const contentOffsetAnim = useRef(new Animated.Value(openSearchParam === 'true' ? 50 : 0)).current;
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

  return {
    isSearchActive,
    setIsSearchActive,
    searchQuery,
    setSearchQuery,
    searchWidthAnim,
    contentOffsetAnim,
    searchInputRef,
    searchResultsOpacity,
    ...searchOperations,
  };
};

const useExerciseFiltering = (
  allExercises: Exercise[],
  exercises: Exercise[],
  searchQuery: string,
  showFavoritesOnly: boolean,
  favoriteIds: Set<string>,
  currentCategory: string,
) => {
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

  const displayedExercises = useMemo(() => {
    let filtered = [];
    const isSearching = searchQuery.trim() !== '';

    if (isSearching) {
      console.log(
        `[ExercisesListScreen] Searching across ALL exercises (${allExercises.length}) for: "${searchQuery}"`,
      );
      filtered = [...allExercises];
      const query = searchQuery.toLowerCase().trim();

      filtered = filtered.filter(
        (ex) =>
          ex.name.toLowerCase().includes(query) ||
          (ex.muscle_group && ex.muscle_group.toLowerCase().includes(query)) ||
          matchesMuscleGroup(ex, query),
      );

      console.log(`[ExercisesListScreen] Found ${filtered.length} matches across all exercises`);
    } else {
      console.log(
        `[ExercisesListScreen] Showing category filtered exercises (${exercises.length}) for: ${currentCategory}`,
      );
      filtered = [...exercises];
    }

    if (showFavoritesOnly) {
      const beforeCount = filtered.length;
      filtered = filtered.filter((ex) => favoriteIds.has(ex.id));
      console.log(
        `[ExercisesListScreen] Filtered to ${filtered.length} favorites (from ${beforeCount})`,
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    allExercises,
    exercises,
    searchQuery,
    showFavoritesOnly,
    favoriteIds,
    matchesMuscleGroup,
    currentCategory,
  ]);

  return { displayedExercises };
};

interface SearchStateType {
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchWidthAnim: Animated.Value;
  contentOffsetAnim: Animated.Value;
  searchInputRef: React.RefObject<TextInput | null>;
  searchResultsOpacity: Animated.Value;
  openSearch: () => void;
  collapseSearchUI: () => void;
  clearSearch: () => void;
  handleSearchIconPress: () => void;
  handleSearchSubmit: () => void;
}

const useEffectsManagement = (
  resetSearch: string | string[] | undefined,
  openSearchParam: string | string[] | undefined,
  searchState: SearchStateType,
  preloadStatus: PreloadingStatus,
) => {
  // Reset search if resetSearch param is true
  useEffect(() => {
    if (resetSearch === 'true') {
      searchState.setSearchQuery('');
      if (openSearchParam !== 'true') {
        searchState.setIsSearchActive(false);
        searchState.searchWidthAnim.setValue(40);
        searchState.contentOffsetAnim.setValue(0);
      }
    }
  }, [resetSearch, openSearchParam]);

  // Open search automatically if openSearch param is true
  useEffect(() => {
    if (openSearchParam === 'true') {
      searchState.setIsSearchActive(true);
      Animated.timing(searchState.searchWidthAnim, {
        toValue: SCREEN_WIDTH - 32,
        duration: 300,
        useNativeDriver: false,
      }).start();
      Animated.timing(searchState.contentOffsetAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [openSearchParam]);

  useEffect(() => {
    console.log('[ExercisesListScreen] Image preload status:', preloadStatus);
  }, [preloadStatus]);

  // Keyboard dismiss listener
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (searchState.isSearchActive && searchState.searchQuery.trim() !== '') {
        searchState.collapseSearchUI();
      }
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [searchState.isSearchActive, searchState.searchQuery]);

  // Search results header animation
  useEffect(() => {
    if (!searchState.isSearchActive && searchState.searchQuery.trim() !== '') {
      Animated.timing(searchState.searchResultsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(searchState.searchResultsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [searchState.isSearchActive, searchState.searchQuery]);
};

const useContentRendering = (
  displayedExercises: Exercise[],
  searchState: SearchStateType,
  shouldGroupByMuscle: boolean,
  currentCategory: string,
) => {
  // Preload images for currently displayed exercises
  const displayedImageUrls = useMemo(() => {
    return displayedExercises.filter((ex) => ex.image_url).map((ex) => ex.image_url as string);
  }, [displayedExercises]);

  const preloadStatus = useImagePreloader(displayedImageUrls, {
    priority: 'high',
    debugLabel: 'ExercisesListScreen',
    skipIfCached: true,
  });

  // Group exercises by first letter for section list
  const exerciseSections = useMemo(() => {
    console.log(`[ExercisesListScreen] Recalculating exerciseSections.`);
    return createExerciseSections(
      displayedExercises,
      searchState.searchQuery,
      currentCategory,
      shouldGroupByMuscle,
    );
  }, [displayedExercises, currentCategory, searchState.searchQuery, shouldGroupByMuscle]);

  return {
    displayedImageUrls,
    preloadStatus,
    exerciseSections,
  };
};

export default function ExercisesListScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Extract parameters
  const muscleGroup = Array.isArray(params.muscleGroup)
    ? params.muscleGroup[0]
    : params.muscleGroup;
  const showAllCategories = params.showAllCategories === 'true';
  const openSearchParam = params.openSearch;
  const resetSearch = params.resetSearch;
  const shouldGroupByMuscle = params.groupByMuscle === 'true' || showAllCategories;
  const fromScreen = Array.isArray(params.fromScreen) ? params.fromScreen[0] : params.fromScreen;

  const currentCategory = showAllCategories ? 'all' : muscleGroup || 'all';

  // Track screen initialization
  useEffect(() => {
    const startTime = Date.now();

    addBreadcrumb('ExercisesList screen initialized', 'navigation', {
      currentCategory,
      showAllCategories,
      shouldGroupByMuscle,
      fromScreen: fromScreen || 'unknown',
      openSearch: openSearchParam === 'true',
      timestamp: new Date().toISOString(),
    });

    setTag('current_screen', 'exercises_list');
    setTag('exercise_category', currentCategory);
    setTag('group_by_muscle', shouldGroupByMuscle.toString());
    SentryReactProfiler.trackComponentLifecycle('ExercisesListScreen', 'mount');

    return () => {
      const mountTime = Date.now() - startTime;
      addBreadcrumb('ExercisesList screen unmounted', 'navigation', {
        screenMountTime: mountTime,
        category: currentCategory,
      });

      SentryReactProfiler.trackComponentLifecycle('ExercisesListScreen', 'unmount');
    };
  }, []);

  // Use custom hooks
  const {
    exercises,
    allExercises,
    loading,
    error,
    favoriteIds,
    toggleFavorite: hookToggleFavorite,
  } = useExerciseData(currentCategory);
  const searchState = useSearchState(openSearchParam);
  const { displayedExercises } = useExerciseFiltering(
    allExercises,
    exercises,
    searchState.searchQuery,
    false, // showFavoritesOnly
    favoriteIds,
    currentCategory,
  );

  // Enhanced exercise press handler with Sentry tracking
  const handleExercisePress = useCallback(
    (exerciseId: string) => {
      const startTime = Date.now();
      const exercise = displayedExercises.find((ex) => ex.id === exerciseId);

      addBreadcrumb(`Exercise pressed: ${exercise?.name || exerciseId}`, 'user_interaction', {
        exerciseId,
        exerciseName: exercise?.name || 'unknown',
        category: currentCategory,
        isFavorite: favoriteIds.has(exerciseId),
      });

      try {
        // Handle exercise press logic here
        const interactionTime = Date.now() - startTime;

        if (interactionTime > 100) {
          capturePerformanceError('Slow exercise interaction', 'interaction_time', interactionTime);
        }

        setTag('last_selected_exercise', exerciseId);
      } catch (error) {
        captureError(error as Error, {
          category: 'ui_error',
          screen: 'exercises_list',
          component: 'ExercisePress',
          exerciseId,
        });
      }
    },
    [displayedExercises, currentCategory, favoriteIds],
  );

  // Enhanced toggle favorite with Sentry tracking
  const toggleFavorite = useCallback(
    async (exerciseId: string) => {
      const startTime = Date.now();
      const exercise = displayedExercises.find((ex) => ex.id === exerciseId);
      const wasFavorite = favoriteIds.has(exerciseId);

      addBreadcrumb(`Toggle favorite: ${exercise?.name || exerciseId}`, 'user_interaction', {
        exerciseId,
        exerciseName: exercise?.name || 'unknown',
        wasFavorite,
        newState: !wasFavorite,
      });

      try {
        // Use the hook's toggle function
        hookToggleFavorite(exerciseId);

        const operationTime = Date.now() - startTime;
        addBreadcrumb(`Favorite toggle completed: ${exercise?.name || exerciseId}`, 'api', {
          exerciseId,
          newState: !wasFavorite,
          operationTime,
        });

        if (operationTime > 1000) {
          capturePerformanceError('Slow favorite toggle', 'favorite_operation_time', operationTime);
        }
      } catch (error) {
        captureError(error as Error, {
          category: 'api_error',
          screen: 'exercises_list',
          component: 'ToggleFavorite',
          exerciseId,
          operation: wasFavorite ? 'remove' : 'add',
        });
      }
    },
    [displayedExercises, favoriteIds, hookToggleFavorite],
  );

  // Enhanced search handler with Sentry tracking
  const handleSearchQueryChange = useCallback(
    (query: string) => {
      const startTime = Date.now();

      addBreadcrumb(`Search query changed: "${query}"`, 'user_interaction', {
        searchQuery: query,
        queryLength: query.length,
        category: currentCategory,
      });

      try {
        searchState.setSearchQuery(query);

        const searchTime = Date.now() - startTime;
        if (searchTime > 100) {
          capturePerformanceError('Slow search operation', 'search_time', searchTime);
        }

        setTag('last_search_query', query || 'empty');
      } catch (error) {
        captureError(error as Error, {
          category: 'ui_error',
          screen: 'exercises_list',
          component: 'SearchHandler',
          searchQuery: query,
        });
      }
    },
    [searchState, currentCategory],
  );

  // Navigation handlers with Sentry tracking
  const handleBackPress = useCallback(() => {
    const startTime = Date.now();

    addBreadcrumb('Back navigation triggered', 'navigation', {
      fromScreen: 'exercises_list',
      category: currentCategory,
    });

    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/exercises');
      }

      const navigationTime = Date.now() - startTime;
      if (navigationTime > 300) {
        capturePerformanceError('Slow back navigation', 'navigation_time', navigationTime);
      }
    } catch (error) {
      captureError(error as Error, {
        category: 'navigation_error',
        screen: 'exercises_list',
        component: 'BackNavigation',
      });
    }
  }, [router, currentCategory]);

  const { preloadStatus } = useContentRendering(
    displayedExercises,
    searchState,
    shouldGroupByMuscle,
    currentCategory,
  );

  useEffectsManagement(resetSearch, openSearchParam, searchState, preloadStatus);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header with enhanced tracking */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>
              {CATEGORY_NAMES[currentCategory as keyof typeof CATEGORY_NAMES] || 'EXERCISES'}
            </Text>
          </View>

          <TouchableOpacity onPress={searchState.openSearch} style={styles.searchButton}>
            <MaterialIcons name="search" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content area with error handling */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              addBreadcrumb('Retry button pressed', 'user_interaction', {
                category: currentCategory,
              });
              // Trigger data reload
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      ) : (
        // Exercise list content would go here
        <View style={styles.contentContainer}>
          {displayedExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              id={exercise.id}
              name={exercise.name}
              image={exercise.image_url ? { uri: exercise.image_url } : FALLBACK_IMAGE_OBJECT}
              isFavorite={favoriteIds.has(exercise.id)}
              onPress={handleExercisePress}
              onToggleFavorite={toggleFavorite}
              useOptimizedImage={true}
            />
          ))}
        </View>
      )}

      {/* Search overlay */}
      {searchState.isSearchActive && (
        <View style={styles.searchOverlay}>
          <TextInput
            ref={searchState.searchInputRef}
            style={styles.searchInput}
            placeholder="Search exercises..."
            placeholderTextColor={COLORS.placeholder}
            value={searchState.searchQuery}
            onChangeText={handleSearchQueryChange}
            onSubmitEditing={searchState.handleSearchSubmit}
          />
          <TouchableOpacity onPress={searchState.collapseSearchUI}>
            <MaterialIcons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 15,
  },
  headerContainer: {
    backgroundColor: 'COLORS.background',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 101,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
  },
  backButton: {
    margin: 0,
  },
  favoriteButton: {
    margin: 0,
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.2,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 99,
  },
  searchContainer: {
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 71, 255, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    overflow: 'hidden',
  },
  searchIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeSearchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  searchIconActive: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: COLORS.text,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingHorizontal: 1,
    paddingTop: 40,
    paddingBottom: 110,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 0,
    flexDirection: 'row',
    paddingHorizontal: 0,
    gap: 0,
  },
  exerciseCardsContainer: {
    paddingTop: 4,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  retryText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  categoryTitleContainer: {
    paddingVertical: 0,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 16,
  },
  categoryTitleGradient: {
    width: '100%',
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 8,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    textShadowColor: 'rgba(108, 71, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 6,
  },
  // Section header styles
  sectionHeader: {
    paddingVertical: 8,
    marginBottom: 15,
    marginTop: 5,
    marginHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(108, 71, 255, 0.12)',
    shadowColor: 'rgba(108, 71, 255, 0.6)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    width: '40%',
    borderWidth: 0.5,
    borderColor: 'rgba(120, 86, 255, 0.3)',
    borderLeftWidth: 0.2,
    borderRightWidth: 0.2,
    borderTopWidth: 0.3,
    borderBottomWidth: 0.7,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(108, 71, 255, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  muscleGroupHeaderContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  muscleGroupOuter: {
    width: '100%',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: 'rgba(108, 71, 255, 0.35)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(120, 86, 255, 0.04)',
    borderLeftWidth: 0.2,
    borderRightWidth: 0.2,
    borderTopWidth: 0.3,
    borderBottomWidth: 0.8,
  },
  muscleGroupSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 16,
    marginHorizontal: 8,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  muscleGroupHeader: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    marginBottom: 4,
  },
  muscleGroupRow: {
    paddingHorizontal: 4,
  },
  muscleGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    marginBottom: 6,
    textShadowColor: 'rgba(108, 71, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  exerciseCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  emptyCardSpace: {
    flex: 1,
    marginHorizontal: 4,
  },
  topLoaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    margin: 10,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  headerLoader: {
    marginRight: 10,
  },
  activeFilterIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  floatingSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    zIndex: 100,
    height: 40,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(108, 71, 255, 0.55)',
    paddingVertical: 10,
    paddingHorizontal: 36,
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 100,
    borderRadius: BORDER_RADIUS.md,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.7)',
  },
  searchResultsText: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: '85%',
    paddingRight: 4,
  },
  queryHighlight: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    maxWidth: 150,
  },
  clearSearchResultsButton: {
    padding: 6,
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 8,
  },
  contentWrapper: {
    flex: 1,
    marginTop: 80, // Header height plus extra spacing
    marginBottom: 0,
  },
  unifiedCategoryContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: 0,
    marginBottom: 16,
    overflow: 'hidden',
    paddingBottom: 0,
    borderWidth: 0.2,
    borderColor: COLORS.primary,
  },
  allExercisesTitleGradient: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.primary,
    marginBottom: 8,
  },
  allExercisesTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    textShadowColor: 'rgba(108, 71, 255, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 6,
  },

  scrollViewContent: {
    paddingTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 30,
  },
  animatedContentContainer: {
    flex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  titleContainer: {
    flex: 2,
    alignItems: 'center',
  },
  searchButton: {
    margin: 0,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
