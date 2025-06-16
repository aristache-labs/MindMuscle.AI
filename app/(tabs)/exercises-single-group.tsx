import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Text,
  Animated,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import ExerciseCard from '../components/ExerciseCard';
import useImagePreloader from '../hooks/useImagePreloader';
import ExerciseDetailsModal from '../components/ExerciseDetailsModal';
// Sentry imports
import {
  SentryLogger,
  SentryDistributedTracing,
  SentryAutoInstrumentation,
  SentryDataCollection,
  captureException,
  addBreadcrumb,
  setContext,
  setTag,
} from '../services/sentry';

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

// Custom hook for exercise data management
const useExerciseData = (muscleGroup: string) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadExercises = async () => {
      const startTime = Date.now();

      try {
        setLoading(true);
        setError(null);

        // Log data loading start
        addBreadcrumb({
          message: `Loading exercises for muscle group: ${muscleGroup}`,
          category: 'data.loading',
          level: 'info',
          data: { muscle_group: muscleGroup, timestamp: new Date().toISOString() },
        });

        // Trace exercise data loading
        const exercisesData = await SentryDistributedTracing.traceDbOperation(
          () => exerciseService.getExercisesByCategory(muscleGroup as ExerciseCategory),
          'exercises',
          'getByCategory',
          { muscle_group: muscleGroup },
        );

        exercisesData.sort((a, b) => a.name.localeCompare(b.name));
        setExercises(exercisesData);

        // Log successful data loading
        SentryLogger.database.query('exercises', 'getByCategory', {
          muscle_group: muscleGroup,
          exercise_count: exercisesData.length,
          duration_ms: Date.now() - startTime,
        });

        try {
          // Trace favorites loading
          const favorites = await SentryDistributedTracing.traceDbOperation(
            () => exerciseService.getFavoriteExercises(),
            'user_favorite_exercises',
            'getFavorites',
            { muscle_group: muscleGroup },
          );

          const favoriteIdSet = new Set(favorites.map((fav) => fav.id));
          setFavoriteIds(favoriteIdSet);

          SentryLogger.database.query('user_favorite_exercises', 'getFavorites', {
            favorite_count: favorites.length,
          });
        } catch (favError) {
          console.error('Error loading favorites:', favError);
          SentryLogger.database.error(
            'user_favorite_exercises',
            'getFavorites',
            favError instanceof Error ? favError.message : 'Unknown error',
            { muscle_group: muscleGroup },
          );
          captureException(favError instanceof Error ? favError : new Error(String(favError)));
        }
      } catch (err) {
        console.error('Error loading exercises:', err);
        const errorMessage = 'Failed to load exercises. Please try again.';
        setError(errorMessage);

        // Log database error
        SentryLogger.database.error(
          'exercises',
          'getByCategory',
          err instanceof Error ? err.message : 'Unknown error',
          {
            muscle_group: muscleGroup,
            duration_ms: Date.now() - startTime,
          },
        );

        // Capture exception with context
        SentryDataCollection.captureException(err instanceof Error ? err : new Error(String(err)), {
          screen: 'exercises-single-group',
          operation: 'loadExercises',
          muscle_group: muscleGroup,
          user_action: 'data_loading',
        });
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [muscleGroup]);

  const toggleFavorite = useCallback(
    (exerciseId: string) => {
      setFavoriteIds((prev) => {
        const newFavorites = new Set(prev);
        const isRemoving = newFavorites.has(exerciseId);
        const action = isRemoving ? 'remove' : 'add';

        if (isRemoving) {
          newFavorites.delete(exerciseId);
        } else {
          newFavorites.add(exerciseId);
        }

        // Log user interaction
        SentryAutoInstrumentation.trackUserInteraction(
          `${action}_favorite`,
          'exercise_card',
          'exercises-single-group',
          {
            exercise_id: exerciseId,
            muscle_group: muscleGroup,
            is_favorite: !isRemoving,
          },
        );

        // Trace favorite toggle operation
        SentryDistributedTracing.traceDbOperation(
          () => exerciseService.toggleFavoriteExercise(exerciseId, !isRemoving),
          'user_favorite_exercises',
          'toggle',
          {
            exercise_id: exerciseId,
            action,
            muscle_group: muscleGroup,
          },
        ).catch((error) => {
          SentryLogger.database.error(
            'user_favorite_exercises',
            'toggle',
            error instanceof Error ? error.message : 'Unknown error',
            { exercise_id: exerciseId, action },
          );
          captureException(error instanceof Error ? error : new Error(String(error)));
        });

        return newFavorites;
      });
    },
    [muscleGroup],
  );

  return {
    exercises,
    loading,
    error,
    favoriteIds,
    toggleFavorite,
  };
};

// Custom hook for search functionality
const useSearchState = (openSearchParam: string | string[] | undefined, muscleGroup: string) => {
  const [isSearchActive, setIsSearchActive] = useState(openSearchParam === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(
    new Animated.Value(openSearchParam === 'true' ? SCREEN_WIDTH - 32 : 40),
  ).current;
  const contentOffsetAnim = useRef(new Animated.Value(openSearchParam === 'true' ? 50 : 0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;

  const openSearch = useCallback(() => {
    // Track user interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'open_search',
      'search_button',
      'exercises-single-group',
      { muscle_group: muscleGroup },
    );

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
  }, [searchWidthAnim, contentOffsetAnim, muscleGroup]);

  const collapseSearchUI = useCallback(() => {
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
  }, [searchWidthAnim, contentOffsetAnim]);

  const clearSearch = useCallback(() => {
    // Track search clear interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'clear_search',
      'clear_button',
      'exercises-single-group',
      {
        muscle_group: muscleGroup,
        previous_query: searchQuery,
        query_length: searchQuery.length,
      },
    );

    setSearchQuery('');
    collapseSearchUI();
  }, [collapseSearchUI, muscleGroup, searchQuery]);

  const handleSearchIconPress = useCallback(() => {
    if (isSearchActive) {
      collapseSearchUI();
    } else {
      openSearch();
    }
  }, [isSearchActive, collapseSearchUI, openSearch]);

  const handleSearchSubmit = useCallback(() => {
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, []);

  return {
    isSearchActive,
    setIsSearchActive,
    searchQuery,
    setSearchQuery,
    searchWidthAnim,
    contentOffsetAnim,
    searchInputRef,
    searchResultsOpacity,
    openSearch,
    collapseSearchUI,
    clearSearch,
    handleSearchIconPress,
    handleSearchSubmit,
  };
};

// Custom hook for exercise filtering
const useExerciseFiltering = (
  exercises: Exercise[],
  searchQuery: string,
  showFavoritesOnly: boolean,
  favoriteIds: Set<string>,
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
    let filtered = [...exercises];
    const isSearching = searchQuery.trim() !== '';

    if (isSearching) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (ex) =>
          ex.name.toLowerCase().includes(query) ||
          (ex.muscle_group && ex.muscle_group.toLowerCase().includes(query)) ||
          matchesMuscleGroup(ex, query),
      );
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter((ex) => favoriteIds.has(ex.id));
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, searchQuery, showFavoritesOnly, favoriteIds, matchesMuscleGroup]);

  return { displayedExercises };
};

// Custom hook for exercise modal
const useExerciseModal = (exercises: Exercise[], muscleGroup: string) => {
  const [exerciseDetailsVisible, setExerciseDetailsVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const handleExercisePress = useCallback(
    (exerciseId: string) => {
      const exercise = exercises.find((ex) => ex.id === exerciseId);
      if (exercise) {
        // Track exercise selection
        SentryAutoInstrumentation.trackUserInteraction(
          'view_exercise_details',
          'exercise_card',
          'exercises-single-group',
          {
            exercise_id: exerciseId,
            exercise_name: exercise.name,
            muscle_group: muscleGroup,
            has_image: !!exercise.image_url,
          },
        );

        addBreadcrumb({
          message: `Exercise details opened: ${exercise.name}`,
          category: 'user.interaction',
          level: 'info',
          data: {
            exercise_id: exerciseId,
            exercise_name: exercise.name,
            muscle_group: muscleGroup,
            screen: 'exercises-single-group',
          },
        });

        setSelectedExercise(exercise);
        setExerciseDetailsVisible(true);
      }
    },
    [exercises, muscleGroup],
  );

  return {
    exerciseDetailsVisible,
    setExerciseDetailsVisible,
    selectedExercise,
    handleExercisePress,
  };
};

// Custom hook for navigation handling
const useNavigationHandling = (
  searchState: ReturnType<typeof useSearchState>,
  fromScreen: string | string[] | undefined,
  router: ReturnType<typeof useRouter>,
  muscleGroup: string,
) => {
  const handleBackPress = useCallback(() => {
    // Track navigation back
    const targetScreen = fromScreen ? `/(tabs)/${fromScreen}` : '/(tabs)/exercises';

    SentryDistributedTracing.traceNavigation('exercises-single-group', targetScreen);

    SentryAutoInstrumentation.trackUserInteraction(
      'navigate_back',
      'back_button',
      'exercises-single-group',
      {
        muscle_group: muscleGroup,
        target_screen: targetScreen,
        was_searching: searchState.isSearchActive,
        search_query: searchState.searchQuery,
      },
    );

    searchState.setSearchQuery('');

    if (searchState.isSearchActive) {
      searchState.setIsSearchActive(false);
      searchState.searchWidthAnim.setValue(40);
      searchState.contentOffsetAnim.setValue(0);
    }

    if (fromScreen) {
      router.push(`/(tabs)/${fromScreen}`);
    } else {
      router.push('/(tabs)/exercises');
    }
  }, [searchState, fromScreen, router, muscleGroup]);

  return { handleBackPress };
};

// Component for floating search UI
interface FloatingSearchProps {
  searchState: ReturnType<typeof useSearchState>;
  searchQuery: string;
  muscleGroup: string;
  showFavoritesOnly: boolean;
}

const FloatingSearch = ({
  searchState,
  searchQuery,
  muscleGroup,
  showFavoritesOnly,
}: FloatingSearchProps) => (
  <>
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
            <MaterialIcons name="search" size={22} color={COLORS.text} />
            {searchQuery.trim() !== '' && <View style={styles.activeFilterIndicator} />}
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
              value={searchQuery}
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

    {searchState.isSearchActive && (
      <TouchableWithoutFeedback onPress={searchState.collapseSearchUI}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
    )}

    {!searchState.isSearchActive && searchQuery.trim() !== '' && (
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
            {searchQuery.length > 20 ? searchQuery.substring(0, 20) + '...' : searchQuery}
          </Text>
          "
          {showFavoritesOnly
            ? ' in Favorites'
            : ` in ${CATEGORY_NAMES[muscleGroup as keyof typeof CATEGORY_NAMES] || muscleGroup}`}
        </Text>
        <TouchableOpacity onPress={searchState.clearSearch} style={styles.clearSearchResultsButton}>
          <MaterialIcons name="close" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </Animated.View>
    )}
  </>
);

// Main content component
interface ContentAreaProps {
  loading: boolean;
  error: string | null;
  isSearchActive: boolean;
  contentOffsetAnim: Animated.Value;
  displayedExercises: Exercise[];
  muscleGroup: string;
  favoriteIds: Set<string>;
  handleExercisePress: (id: string) => void;
  toggleFavorite: (id: string) => void;
  searchQuery: string;
  showFavoritesOnly: boolean;
  router: ReturnType<typeof useRouter>;
}

const ContentArea = ({
  loading,
  error,
  isSearchActive,
  contentOffsetAnim,
  displayedExercises,
  muscleGroup,
  favoriteIds,
  handleExercisePress,
  toggleFavorite,
  searchQuery,
  showFavoritesOnly,
  router,
}: ContentAreaProps) => {
  const EmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={styles.emptyText}>
          {searchQuery.trim()
            ? 'No exercises match your search'
            : showFavoritesOnly
              ? 'No favorite exercises yet'
              : 'No exercises available'}
        </Text>
      </View>
    ),
    [searchQuery, showFavoritesOnly],
  );

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialIcons name="error-outline" size={48} color="rgba(255,255,255,0.7)" />
        <Text style={styles.messageText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace(`/(tabs)/exercises-single-group?categoryId=${muscleGroup}`)}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.animatedContentContainer,
        { paddingTop: isSearchActive ? contentOffsetAnim : 0 },
      ]}
    >
      {loading && (
        <View style={styles.topLoaderContainer}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.unifiedCategoryContainer}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>
              {CATEGORY_NAMES[muscleGroup as keyof typeof CATEGORY_NAMES] || muscleGroup}
            </Text>
            <Text style={styles.exerciseCount}>
              {displayedExercises.length}{' '}
              {displayedExercises.length === 1 ? 'exercise' : 'exercises'}
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

        {displayedExercises.length === 0 && <EmptyComponent />}
      </ScrollView>
    </Animated.View>
  );
};

export default function SingleGroupExercisesScreen() {
  const { categoryId, fromScreen, openSearch: openSearchParam } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const muscleGroup =
    typeof categoryId === 'string'
      ? categoryId === 'Lower back'
        ? 'Lower_back'
        : categoryId
      : 'Cardio';

  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Set Sentry context for this screen
  useEffect(() => {
    setContext('screen_context', {
      screen_name: 'exercises-single-group',
      muscle_group: muscleGroup,
      from_screen: fromScreen,
      open_search: openSearchParam,
      timestamp: new Date().toISOString(),
    });

    setTag('screen', 'exercises-single-group');
    setTag('muscle_group', muscleGroup);

    // Log screen view
    addBreadcrumb({
      message: `Screen viewed: exercises-single-group (${muscleGroup})`,
      category: 'navigation',
      level: 'info',
      data: {
        muscle_group: muscleGroup,
        from_screen: fromScreen,
        open_search: openSearchParam,
        category_display_name:
          CATEGORY_NAMES[muscleGroup as keyof typeof CATEGORY_NAMES] || muscleGroup,
      },
    });

    SentryAutoInstrumentation.trackUserInteraction(
      'screen_view',
      'screen',
      'exercises-single-group',
      {
        muscle_group: muscleGroup,
        from_screen: fromScreen,
        open_search: openSearchParam,
      },
    );
  }, [muscleGroup, fromScreen, openSearchParam]);

  // Custom hooks
  const exerciseData = useExerciseData(muscleGroup);
  const searchState = useSearchState(openSearchParam, muscleGroup);
  const { displayedExercises } = useExerciseFiltering(
    exerciseData.exercises,
    searchState.searchQuery,
    showFavoritesOnly,
    exerciseData.favoriteIds,
  );
  const exerciseModal = useExerciseModal(exerciseData.exercises, muscleGroup);
  const { handleBackPress } = useNavigationHandling(searchState, fromScreen, router, muscleGroup);

  // Preload images for currently displayed exercises
  const displayedImageUrls = useMemo(() => {
    return displayedExercises.filter((ex) => ex.image_url).map((ex) => ex.image_url as string);
  }, [displayedExercises]);

  useImagePreloader(displayedImageUrls, {
    priority: 'high',
    debugLabel: 'SingleGroupExercisesScreen',
    skipIfCached: true,
  });

  const toggleFavoritesFilter = useCallback(() => {
    setShowFavoritesOnly((prev) => {
      const newValue = !prev;

      // Track favorites filter toggle
      SentryAutoInstrumentation.trackUserInteraction(
        'toggle_favorites_filter',
        'favorites_button',
        'exercises-single-group',
        {
          muscle_group: muscleGroup,
          show_favorites_only: newValue,
          current_exercise_count: displayedExercises.length,
        },
      );

      addBreadcrumb({
        message: `Favorites filter ${newValue ? 'enabled' : 'disabled'}`,
        category: 'user.filter',
        level: 'info',
        data: {
          muscle_group: muscleGroup,
          show_favorites_only: newValue,
          exercise_count: displayedExercises.length,
        },
      });

      return newValue;
    });
  }, [muscleGroup, displayedExercises.length]);

  // Effects for search behavior
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
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (searchState.isSearchActive && searchState.searchQuery.trim() !== '') {
        searchState.collapseSearchUI();
      }
    });

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [searchState.isSearchActive, searchState.searchQuery]);

  useEffect(() => {
    if (!searchState.isSearchActive && searchState.searchQuery.trim() !== '') {
      // Track search completion
      SentryAutoInstrumentation.trackUserInteraction(
        'search_completed',
        'search_input',
        'exercises-single-group',
        {
          muscle_group: muscleGroup,
          search_query: searchState.searchQuery,
          query_length: searchState.searchQuery.length,
          results_count: displayedExercises.length,
          show_favorites_only: showFavoritesOnly,
        },
      );

      addBreadcrumb({
        message: `Search completed: "${searchState.searchQuery}" (${displayedExercises.length} results)`,
        category: 'user.search',
        level: 'info',
        data: {
          muscle_group: muscleGroup,
          search_query: searchState.searchQuery,
          results_count: displayedExercises.length,
          show_favorites_only: showFavoritesOnly,
        },
      });

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
  }, [
    searchState.isSearchActive,
    searchState.searchQuery,
    muscleGroup,
    displayedExercises.length,
    showFavoritesOnly,
  ]);

  // Track component render performance
  useEffect(() => {
    const renderStartTime = Date.now();

    return () => {
      const renderDuration = Date.now() - renderStartTime;
      if (renderDuration > 1000) {
        // Only log slow renders
        addBreadcrumb({
          message: `Slow render detected: exercises-single-group (${renderDuration}ms)`,
          category: 'performance.render',
          level: 'warning',
          data: {
            muscle_group: muscleGroup,
            render_duration_ms: renderDuration,
            exercise_count: displayedExercises.length,
            is_searching: searchState.isSearchActive,
          },
        });
      }
    };
  }, [muscleGroup, displayedExercises.length, searchState.isSearchActive]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

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
            {exerciseData.loading && (
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.headerLoader} />
            )}
          </View>
        </View>
        <Divider style={styles.divider} />
      </View>

      <View style={styles.contentWrapper}>
        <ContentArea
          loading={exerciseData.loading}
          error={exerciseData.error}
          isSearchActive={searchState.isSearchActive}
          contentOffsetAnim={searchState.contentOffsetAnim}
          displayedExercises={displayedExercises}
          muscleGroup={muscleGroup}
          favoriteIds={exerciseData.favoriteIds}
          handleExercisePress={exerciseModal.handleExercisePress}
          toggleFavorite={exerciseData.toggleFavorite}
          searchQuery={searchState.searchQuery}
          showFavoritesOnly={showFavoritesOnly}
          router={router}
        />
      </View>

      <FloatingSearch
        searchState={searchState}
        searchQuery={searchState.searchQuery}
        muscleGroup={muscleGroup}
        showFavoritesOnly={showFavoritesOnly}
      />

      {exerciseModal.selectedExercise && (
        <ExerciseDetailsModal
          visible={exerciseModal.exerciseDetailsVisible}
          onClose={() => {
            // Track modal close
            SentryAutoInstrumentation.trackUserInteraction(
              'close_exercise_details',
              'modal_close',
              'exercises-single-group',
              {
                exercise_id: exerciseModal.selectedExercise?.id,
                exercise_name: exerciseModal.selectedExercise?.name,
                muscle_group: muscleGroup,
              },
            );
            exerciseModal.setExerciseDetailsVisible(false);
          }}
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
    backgroundColor: COLORS.background,
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
  categoryHeader: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
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
  contentWrapper: {
    flex: 1,
    marginTop: 90, // Header height plus extra spacing
    marginBottom: 0,
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
  animatedContentContainer: {
    flex: 1,
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
  scrollViewContent: {
    paddingTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 30,
  },
  unifiedCategoryContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: 0,
    marginBottom: 16,
    overflow: 'hidden',
    paddingBottom: 0,
    elevation: 4,
    borderWidth: 0.2,
    borderColor: COLORS.primary,
  },
});
