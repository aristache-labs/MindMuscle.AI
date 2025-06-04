import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SectionList,
  TouchableOpacity,
  TextInput,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import useImagePreloader from '../hooks/useImagePreloader';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
import type { PreloadingStatus } from '../hooks/useImagePreloader';

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

// Simple performance tracking utility
const loadTimeTracker = {
  timePoints: new Map<
    string,
    { start?: number; end?: number; marks: { time: number; duration: number; label: string }[] }
  >(),

  startLoadTimeTracking: (id: string) => {
    console.log(`[LoadTracker] Starting tracking for ${id}`);
    loadTimeTracker.timePoints.set(id, {
      start: Date.now(),
      marks: [],
    });
  },

  endLoadTimeTracking: (id: string) => {
    const timePoint = loadTimeTracker.timePoints.get(id);
    if (timePoint) {
      timePoint.end = Date.now();
      const totalDuration = timePoint.end - (timePoint.start || 0);
      console.log(`[LoadTracker] Completed tracking for ${id}: ${totalDuration}ms`);
    }
  },

  markLoadTime: (id: string, label: string) => {
    const timePoint = loadTimeTracker.timePoints.get(id);
    if (timePoint) {
      const now = Date.now();
      const duration =
        timePoint.marks.length > 0
          ? now - timePoint.marks[timePoint.marks.length - 1].time
          : now - (timePoint.start || 0);

      const mark = { time: now, duration, label };
      timePoint.marks.push(mark);
      console.log(`[LoadTracker] ${id} - ${label}: ${duration}ms`);
    }
  },
};

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

// Interface for section data
interface _ExerciseSection {
  title: string;
  data: Exercise[];
}

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

// Helper function to render search results
const renderSearchResults = (
  displayedExercises: Exercise[],
  favoriteIds: Set<string>,
  handleExercisePress: (id: string) => void,
  toggleFavorite: (id: string) => void,
  ListEmptyComponent: React.ComponentType,
) => (
  <View style={styles.unifiedCategoryContainer}>
    <View style={styles.allExercisesTitleGradient}>
      <Text style={styles.categoryTitle}>SEARCH RESULTS</Text>
      <Text style={styles.exerciseCount}>
        {displayedExercises.length} {displayedExercises.length === 1 ? 'exercise' : 'exercises'}
      </Text>
    </View>

    <View style={styles.exerciseCardsContainer}>
      {Array.from({ length: Math.ceil(displayedExercises.length / 2) }).map((_, rowIndex) => {
        const startIdx = rowIndex * 2;
        const rowItems = displayedExercises.slice(startIdx, startIdx + 2);

        return (
          <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
            {rowItems.map((item) => (
              <ExerciseCard
                key={item.id}
                id={item.id}
                name={item.name}
                image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                isFavorite={favoriteIds.has(item.id)}
                onPress={handleExercisePress}
                onToggleFavorite={toggleFavorite}
                useOptimizedImage={true}
              />
            ))}
            {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
          </View>
        );
      })}
    </View>

    {displayedExercises.length === 0 && <ListEmptyComponent />}
  </View>
);

// Helper function to render all exercises view
const renderAllExercisesView = (
  currentCategory: string,
  searchQuery: string,
  displayedExercises: Exercise[],
  favoriteIds: Set<string>,
  handleExercisePress: (id: string) => void,
  toggleFavorite: (id: string) => void,
) => {
  if (currentCategory !== 'all' || searchQuery.trim()) {
    return null;
  }

  return (
    <View style={styles.unifiedCategoryContainer}>
      <View style={styles.allExercisesTitleGradient}>
        <Text style={styles.allExercisesTitle}>{CATEGORY_NAMES['all']}</Text>
        <Text style={styles.exerciseCount}>
          {displayedExercises.length} {displayedExercises.length === 1 ? 'exercise' : 'exercises'}
        </Text>
      </View>

      <View style={styles.exerciseCardsContainer}>
        {Array.from({ length: Math.ceil(displayedExercises.length / 2) }).map((_, rowIndex) => {
          const startIdx = rowIndex * 2;
          const rowItems = displayedExercises.slice(startIdx, startIdx + 2);

          return (
            <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
              {rowItems.map((item) => (
                <ExerciseCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                  isFavorite={favoriteIds.has(item.id)}
                  onPress={handleExercisePress}
                  onToggleFavorite={toggleFavorite}
                  useOptimizedImage={true}
                />
              ))}
              {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

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

// Helper function to load exercises data
const loadExercisesData = async (
  currentCategory: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  setExercises: (exercises: Exercise[]) => void,
  setAllExercises: (exercises: Exercise[]) => void,
  setFavoriteIds: (favoriteIds: Set<string>) => void,
) => {
  try {
    loadTimeTracker.markLoadTime('ExercisesListScreen', 'loadExercises started');

    // Check if data is already in cache before showing loading indicator
    const cache = (global as GlobalWithPlaceholders).exercisesCache;
    const isCached =
      cache?.all &&
      (currentCategory === 'all' || (cache.byCategory && cache.byCategory[currentCategory]));

    // Only show loading if data is not cached
    if (!isCached) {
      setLoading(true);
      console.log('[ExercisesListScreen] Cache miss, setting loading to true');
    } else {
      console.log('[ExercisesListScreen] Cache hit, not setting loading indicator initially');
    }

    setError(null);

    let exercisesData: Exercise[] = [];
    let allExercisesData: Exercise[] = [];

    // Try to load from cache first for better performance
    if (currentCategory !== 'all') {
      loadTimeTracker.markLoadTime(
        'ExercisesListScreen',
        `Loading from API for category: ${currentCategory}`,
      );
      exercisesData = await exerciseService.getExercisesByCategory(
        currentCategory as ExerciseCategory,
      );
    }

    // Always load all exercises from API
    loadTimeTracker.markLoadTime('ExercisesListScreen', 'Loading all exercises from API');
    allExercisesData = await exerciseService.getExercisesByCategory('all');
    if (currentCategory === 'all') {
      exercisesData = allExercisesData;
    }

    // Update state
    setExercises(exercisesData);
    setAllExercises(allExercisesData);
    console.log(
      `[ExercisesListScreen] Loaded ${exercisesData.length} exercises for category ${currentCategory}, ${allExercisesData.length} total exercises.`,
    );
    loadTimeTracker.markLoadTime(
      'ExercisesListScreen',
      `Exercises data loaded: ${exercisesData.length}`,
    );

    // Always hide loading indicator after data is loaded
    setLoading(false);

    // Load favorites (don't use this as a blocker for showing content)
    try {
      loadTimeTracker.markLoadTime('ExercisesListScreen', 'Loading favorites');
      const favorites = await exerciseService.getFavoriteExercises();
      const favoriteIdSet = new Set(favorites.map((fav) => fav.id));
      setFavoriteIds(favoriteIdSet);
      loadTimeTracker.markLoadTime(
        'ExercisesListScreen',
        `Favorites loaded: ${favoriteIdSet.size}`,
      );
    } catch (favError) {
      console.error('Error loading favorites:', favError);
      loadTimeTracker.markLoadTime('ExercisesListScreen', 'Error loading favorites');
      // Don't block the UI for favorites loading issues
    }
  } catch (err) {
    console.error('Error loading exercises:', err);
    loadTimeTracker.markLoadTime('ExercisesListScreen', 'Error loading exercises');
    setError('Failed to load exercises. Please try again.');
    setLoading(false);
  } finally {
    // Mark UI render time
    setTimeout(() => {
      loadTimeTracker.markLoadTime('ExercisesListScreen', 'UI fully rendered');
    }, 500);
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

const useExerciseModal = (displayedExercises: Exercise[]) => {
  const [exerciseDetailsVisible, setExerciseDetailsVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const handleExercisePress = useCallback(
    (exerciseId: string) => {
      const exercise = displayedExercises.find((ex) => ex.id === exerciseId);
      console.log(
        `[ExercisesListScreen] Exercise card pressed: ${exerciseId}, found exercise:`,
        exercise ? exercise.name : 'not found',
      );
      if (exercise) {
        setSelectedExercise(exercise);
        setExerciseDetailsVisible(true);
      }
    },
    [displayedExercises],
  );

  return {
    exerciseDetailsVisible,
    setExerciseDetailsVisible,
    selectedExercise,
    handleExercisePress,
  };
};

const useAnimations = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );

    shimmerAnimation.start();

    return () => {
      shimmerAnimation.stop();
    };
  }, []);

  return { shimmerAnim };
};

interface SearchStateType {
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchWidthAnim: Animated.Value;
  contentOffsetAnim: Animated.Value;
  searchInputRef: React.RefObject<TextInput>;
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

interface ContentAreaProps {
  error: string | null;
  currentCategory: string;
  searchState: SearchStateType;
  displayedExercises: Exercise[];
  favoriteIds: Set<string>;
  handleExercisePress: (id: string) => void;
  toggleFavorite: (id: string) => void;
  showFavoritesOnly: boolean;
  shouldGroupByMuscle: boolean;
  exerciseSections: { title: string; data: Exercise[] }[];
  router: ReturnType<typeof useRouter>;
}

const ContentArea = ({
  error,
  currentCategory,
  searchState,
  displayedExercises,
  favoriteIds,
  handleExercisePress,
  toggleFavorite,
  showFavoritesOnly,
  shouldGroupByMuscle,
  exerciseSections,
  router,
}: ContentAreaProps) => {
  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialIcons name="error-outline" size={48} color="rgba(255,255,255,0.7)" />
        <Text style={styles.messageText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace(`/(tabs)/exercises-list?categoryId=${currentCategory}`)}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyText}>
        {searchState.searchQuery.trim()
          ? 'No exercises match your search'
          : showFavoritesOnly
            ? 'No favorite exercises yet'
            : 'No exercises available'}
      </Text>
    </View>
  );

  if (searchState.searchQuery.trim() !== '') {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {renderSearchResults(
          displayedExercises,
          favoriteIds,
          handleExercisePress,
          toggleFavorite,
          emptyComponent,
        )}
      </ScrollView>
    );
  }

  if (shouldGroupByMuscle) {
    return (
      <SectionList
        sections={exerciseSections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderItem={() => null}
        renderSectionHeader={({ section }) => (
          <View style={[styles.unifiedCategoryContainer, { marginTop: 8 }]}>
            <View style={styles.muscleGroupHeader}>
              <Text style={styles.muscleGroupTitle}>{section.title}</Text>
              <Text style={styles.exerciseCount}>
                {section.data.length} {section.data.length === 1 ? 'exercise' : 'exercises'}
              </Text>
            </View>

            <View style={styles.exerciseCardsContainer}>
              {section.data.map((item) => (
                <ExerciseCard
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                  isFavorite={favoriteIds.has(item.id)}
                  onPress={handleExercisePress}
                  onToggleFavorite={toggleFavorite}
                  useOptimizedImage={true}
                />
              ))}
            </View>
          </View>
        )}
        contentContainerStyle={styles.scrollViewContent}
        ListEmptyComponent={emptyComponent}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollViewContent}
      showsVerticalScrollIndicator={false}
    >
      {renderAllExercisesView(
        currentCategory,
        searchState.searchQuery,
        displayedExercises,
        favoriteIds,
        handleExercisePress,
        toggleFavorite,
      )}
    </ScrollView>
  );
};

interface FloatingUIProps {
  searchState: SearchStateType;
  showFavoritesOnly: boolean;
}

const FloatingUI = ({ searchState, showFavoritesOnly }: FloatingUIProps) => (
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
          <TouchableOpacity style={styles.searchIconButton} onPress={searchState.openSearch}>
            <MaterialIcons
              name={searchState.searchQuery.trim() ? 'search' : 'search'}
              size={22}
              color={searchState.searchQuery.trim() ? COLORS.text : COLORS.text}
            />
            {searchState.searchQuery.trim() !== '' && <View style={styles.activeFilterIndicator} />}
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
              placeholder="Search exercises..."
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
            {searchState.searchQuery.length > 20
              ? searchState.searchQuery.substring(0, 20) + '...'
              : searchState.searchQuery}
          </Text>
          "{showFavoritesOnly ? ' in Favorites' : ' in all exercises'}
        </Text>
        <TouchableOpacity onPress={searchState.clearSearch} style={styles.clearSearchResultsButton}>
          <MaterialIcons name="close" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </Animated.View>
    )}
  </>
);

export default function ExercisesListScreen() {
  const {
    categoryId,
    fromScreen,
    openSearch: openSearchParam,
    resetSearch,
    groupByMuscle,
  } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Default to Cardio if no category provided
  const currentCategory =
    typeof categoryId === 'string'
      ? (categoryId === 'Lower back' ? 'Lower_back' : (categoryId as ExerciseCategory)) || 'all'
      : 'all';

  // Flag to determine if we should group by muscle
  const shouldGroupByMuscle = groupByMuscle === 'true';

  // Performance tracking
  useEffect(() => {
    loadTimeTracker.startLoadTimeTracking('ExercisesListScreen');
    console.log('[ExercisesListScreen] Mounted');
    return () => {
      loadTimeTracker.endLoadTimeTracking('ExercisesListScreen');
      console.log('[ExercisesListScreen] Unmounted');
    };
  }, []);

  // Custom hooks for state management
  const { exercises, allExercises, loading, error, favoriteIds, toggleFavorite } =
    useExerciseData(currentCategory);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const searchState = useSearchState(openSearchParam) as SearchStateType;
  const { displayedExercises } = useExerciseFiltering(
    allExercises,
    exercises,
    searchState.searchQuery,
    showFavoritesOnly,
    favoriteIds,
    currentCategory,
  );
  const exerciseModal = useExerciseModal(displayedExercises);
  const { shimmerAnim: _shimmerAnim } = useAnimations();

  const { preloadStatus, exerciseSections } = useContentRendering(
    displayedExercises,
    searchState,
    shouldGroupByMuscle,
    currentCategory,
  );

  useEffectsManagement(resetSearch, openSearchParam, searchState, preloadStatus);

  // Handle favorites filter toggle
  const toggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly((prev) => !prev);
  }, []);

  const handleBackPress = useCallback(() => {
    searchState.setSearchQuery('');

    if (searchState.isSearchActive) {
      searchState.setIsSearchActive(false);
      searchState.searchWidthAnim.setValue(40);
      searchState.contentOffsetAnim.setValue(0);
    }

    if (fromScreen === 'exercises') {
      router.push('/(tabs)/exercises');
    } else {
      router.back();
    }
  }, [fromScreen, router, searchState]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header with custom back button */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="arrow-left"
              size={28}
              onPress={handleBackPress}
              iconColor={COLORS.text}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            />
          </View>
          <View style={styles.headerCenter}>
            <IconButton
              icon={showFavoritesOnly ? 'star' : 'star-outline'}
              size={28}
              iconColor={showFavoritesOnly ? '#FFD700' : COLORS.text}
              onPress={toggleFavoritesFilter}
              style={styles.favoriteButton}
            />
          </View>
          <View style={styles.headerRight}>
            {loading && (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.headerLoader} />
            )}
          </View>
        </View>
        <Divider style={styles.divider} />
      </View>

      {/* Content container */}
      <View style={styles.contentWrapper}>
        <ContentArea
          error={error}
          currentCategory={currentCategory}
          searchState={searchState}
          displayedExercises={displayedExercises}
          favoriteIds={favoriteIds}
          handleExercisePress={exerciseModal.handleExercisePress}
          toggleFavorite={toggleFavorite}
          showFavoritesOnly={showFavoritesOnly}
          shouldGroupByMuscle={shouldGroupByMuscle}
          exerciseSections={exerciseSections}
          router={router}
        />
      </View>

      {/* Floating UI */}
      <FloatingUI searchState={searchState} showFavoritesOnly={showFavoritesOnly} />

      {/* Add ExerciseDetailsModal */}
      {exerciseModal.selectedExercise && (
        <ExerciseDetailsModal
          visible={exerciseModal.exerciseDetailsVisible}
          onClose={() => exerciseModal.setExerciseDetailsVisible(false)}
          exerciseId={exerciseModal.selectedExercise.id}
          exerciseName={exerciseModal.selectedExercise.name}
          exerciseImage={exerciseModal.selectedExercise.image_url}
        />
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
});
