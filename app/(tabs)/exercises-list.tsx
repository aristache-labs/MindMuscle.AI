import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, SectionList, TouchableOpacity, TextInput, Animated, TouchableWithoutFeedback, Dimensions, ActivityIndicator, Keyboard } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import { GeneralHeader } from '../components/GeneralHeader';
import OptimizedImage from '../components/OptimizedImage';
import useImagePreloader from '../hooks/useImagePreloader';

// Simple performance tracking utility
const loadTimeTracker = {
  timePoints: new Map<string, { start?: number, end?: number, marks: { time: number, duration: number, label: string }[] }>(),
  
  startLoadTimeTracking: (id: string) => {
    console.log(`[LoadTracker] Starting tracking for ${id}`);
    loadTimeTracker.timePoints.set(id, { 
      start: Date.now(), 
      marks: [] 
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
      const duration = timePoint.marks.length > 0 
        ? now - timePoint.marks[timePoint.marks.length - 1].time 
        : now - (timePoint.start || 0);
      
      const mark = { time: now, duration, label };
      timePoint.marks.push(mark);
      console.log(`[LoadTracker] ${id} - ${label}: ${duration}ms`);
    }
  }
};

// Get screen width for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Fallback image for exercises without an image
const FALLBACK_IMAGE = (global as any).placeholderImages?.exercise || require('../../assets/exercises/placeholder.jpg');

// Create a stable reference to the fallback image object
const FALLBACK_IMAGE_OBJECT = (global as any).placeholderImages?.exerciseObject || { uri: null, testUri: '../../assets/exercises/placeholder.jpg' };

// Map for category display names
const CATEGORY_NAMES = {
  'Cardio': 'CARDIO',
  'Shoulders': 'SHOULDERS',
  'Chest': 'CHEST',
  'Biceps': 'BICEPS',
  'Abs': 'ABS',
  'Forearms': 'FOREARMS',
  'Obliques': 'OBLIQUES',
  'Quads': 'QUADS',
  'Adductors': 'ADDUCTORS',
  'Traps': 'TRAPS',
  'Triceps': 'TRICEPS',
  'Lats': 'LATS',
  'Lower_back': 'LOWER BACK',
  'Abductors': 'ABDUCTORS',
  'Glutes': 'GLUTES',
  'Hamstrings': 'HAMSTRINGS',
  'Calves': 'CALVES',
  'all': 'ALL EXERCISES'
};

// Interface for section data
interface ExerciseSection {
  title: string;
  data: Exercise[];
}

// Map of alternative names for muscle groups to support better search
const MUSCLE_GROUP_ALIASES: Record<string, string[]> = {
  'Chest': ['pecs', 'pectorals', 'chest muscles'],
  'Biceps': ['bis', 'guns', 'arms'],
  'Triceps': ['tris', 'back of arms'],
  'Abs': ['abdominals', 'six pack', 'core', 'stomach', 'midsection'],
  'Shoulders': ['delts', 'deltoids'],
  'Lats': ['latissimus dorsi', 'wings', 'back'],
  'Quads': ['quadriceps', 'front thighs'],
  'Hamstrings': ['hammies', 'back thighs'],
  'Glutes': ['gluteus maximus', 'butt', 'buttocks'],
  'Calves': ['calf muscles', 'lower legs'],
  'Forearms': ['lower arms'],
  'Lower_back': ['lower back', 'erectorspinae', 'erector-spinae', 'erector', 'lower_back', 'lowerback'],
  'Traps': ['trapezius', 'upper back'],
};

export default function ExercisesListScreen() {
  const { 
    categoryId, 
    fromScreen, 
    openSearch: openSearchParam, 
    showAllCategories, 
    resetSearch,
    groupByMuscle 
  } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // Default to Cardio if no category provided
  const currentCategory = typeof categoryId === 'string' 
    ? (categoryId === 'Lower back' ? 'Lower_back' : categoryId as ExerciseCategory) || 'all'
    : 'all';
    
  // Flag to determine if we should group by muscle
  const shouldGroupByMuscle = groupByMuscle === 'true';
  
  // State for exercises
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  
  // For performance tracking
  useEffect(() => {
    loadTimeTracker.startLoadTimeTracking('ExercisesListScreen');
    console.log('[ExercisesListScreen] Mounted');
    return () => {
      loadTimeTracker.endLoadTimeTracking('ExercisesListScreen');
      console.log('[ExercisesListScreen] Unmounted');
    };
  }, []);

  // State for favorite filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // State & animation for search
  const [isSearchActive, setIsSearchActive] = useState(openSearchParam === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(new Animated.Value(openSearchParam === 'true' ? SCREEN_WIDTH - 32 : 40)).current;
  const contentOffsetAnim = useRef(new Animated.Value(openSearchParam === 'true' ? 50 : 0)).current;
  const searchInputRef = useRef<TextInput>(null);

  // Reset search if resetSearch param is true
  useEffect(() => {
    if (resetSearch === 'true') {
      setSearchQuery('');
      // Only close search if not explicitly asked to open it
      if (openSearchParam !== 'true') {
        setIsSearchActive(false);
        searchWidthAnim.setValue(40);
        contentOffsetAnim.setValue(0);
      }
    }
  }, [resetSearch, openSearchParam]);

  // Open search automatically if openSearch param is true
  useEffect(() => {
    if (openSearchParam === 'true') {
      setIsSearchActive(true);
      // Ensure search is fully opened
      Animated.timing(searchWidthAnim, {
        toValue: SCREEN_WIDTH - 32,
        duration: 300,
        useNativeDriver: false
      }).start();
      // Move content down
      Animated.timing(contentOffsetAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: false
      }).start();
    }
  }, [openSearchParam]);

  // Fetch exercises on mount and when category changes
  useEffect(() => {
    const loadExercises = async () => {
      try {
        loadTimeTracker.markLoadTime('ExercisesListScreen', 'loadExercises started');
        
        // Check if data is already in cache before showing loading indicator
        const cache = (global as any).exercisesCache;
        const isCached = cache?.all && 
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
          loadTimeTracker.markLoadTime('ExercisesListScreen', `Loading from API for category: ${currentCategory}`);
          exercisesData = await exerciseService.getExercisesByCategory(currentCategory as ExerciseCategory);
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
        console.log(`[ExercisesListScreen] Loaded ${exercisesData.length} exercises for category ${currentCategory}, ${allExercisesData.length} total exercises.`);
        loadTimeTracker.markLoadTime('ExercisesListScreen', `Exercises data loaded: ${exercisesData.length}`);
        
        // Always hide loading indicator after data is loaded
        setLoading(false);
        
        // Load favorites (don't use this as a blocker for showing content)
        try {
          loadTimeTracker.markLoadTime('ExercisesListScreen', 'Loading favorites');
          const favorites = await exerciseService.getFavoriteExercises();
          const favoriteIdSet = new Set(favorites.map(fav => fav.id));
          setFavoriteIds(favoriteIdSet);
          loadTimeTracker.markLoadTime('ExercisesListScreen', `Favorites loaded: ${favoriteIdSet.size}`);
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
    
    loadExercises();
  }, [currentCategory]);
  
  // Check if search query matches a muscle group or its aliases
  const matchesMuscleGroup = useCallback((exercise: Exercise, query: string): boolean => {
    // Check direct match with exercise muscle_group (case insensitive)
    if (exercise.muscle_group && exercise.muscle_group.toLowerCase().includes(query)) {
      return true;
    }
    
    // Check match through aliases
    if (exercise.muscle_group) {
      const aliases = MUSCLE_GROUP_ALIASES[exercise.muscle_group as ExerciseCategory] || [];
      return aliases.some(alias => alias.toLowerCase().includes(query));
    }
    
    return false;
  }, []);

  // Filter exercises based on search query and favorites filter
  const displayedExercises = useMemo(() => {
    console.log(`[ExercisesListScreen] Recalculating displayedExercises. SearchQuery: ${searchQuery} ShowFavoritesOnly: ${showFavoritesOnly}`);
    
    let filtered = [...allExercises];
    
    // Apply favorites filter if enabled (applies to both search and normal browsing)
    if (showFavoritesOnly) {
      filtered = filtered.filter(ex => favoriteIds.has(ex.id));
    }
    
    // Apply search filter if query exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(ex => 
        ex.name.toLowerCase().includes(query) || 
        (ex.muscle_group && ex.muscle_group.toLowerCase().includes(query)) ||
        matchesMuscleGroup(ex, query)
      );
      
      // When searching, we don't apply the category filter
      // This allows searching across all exercises regardless of current category
    } else {
      // Only apply category filter if not searching and not "all"
      if (currentCategory !== 'all') {
        filtered = filtered.filter(ex => ex.muscle_group === currentCategory);
      }
    }
    
    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [allExercises, searchQuery, showFavoritesOnly, favoriteIds, currentCategory, matchesMuscleGroup]);

  // Preload images for currently displayed exercises
  const displayedImageUrls = useMemo(() => {
    return displayedExercises
      .filter(ex => ex.image_url)
      .map(ex => ex.image_url as string);
  }, [displayedExercises]);
  
  // Use image preloader hook to preload visible exercise images
  const preloadStatus = useImagePreloader(displayedImageUrls, {
    priority: 'high',
    debugLabel: 'ExercisesListScreen',
    skipIfCached: true
  });

  useEffect(() => {
    console.log('[ExercisesListScreen] Image preload status:', preloadStatus);
  }, [preloadStatus]);

  // Group exercises by first letter for section list
  const exerciseSections = useMemo(() => {
    console.log(`[ExercisesListScreen] Recalculating exerciseSections.`);
    
    const sections: { title: string; data: Exercise[] }[] = [];
    
    // If searching, group alphabetically
    if (searchQuery.trim() !== '') {
      // Create sections based on first letter
      const sectionMap = new Map<string, Exercise[]>();
      
      displayedExercises.forEach(exercise => {
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
        'Cardio', 'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
        'Abs', 'Obliques', 'Lats', 'Traps', 'Lower_back',
        'Glutes', 'Quads', 'Hamstrings', 'Adductors', 'Abductors', 'Calves'
      ];
      
      // Group exercises by muscle group
      displayedExercises.forEach(exercise => {
        const muscleGroup = exercise.muscle_group || 'Other';
        if (!sectionMap.has(muscleGroup)) {
          sectionMap.set(muscleGroup, []);
        }
        sectionMap.get(muscleGroup)!.push(exercise);
      });
      
      // Add sections in the defined order
      muscleGroupOrder.forEach(muscleGroup => {
        if (sectionMap.has(muscleGroup)) {
          const data = sectionMap.get(muscleGroup)!;
          // Sort exercises alphabetically within each muscle group
          data.sort((a, b) => a.name.localeCompare(b.name));
          sections.push({ 
            title: CATEGORY_NAMES[muscleGroup] || muscleGroup, 
            data 
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
            data 
          });
        });
    }
    // For specific category view or all without groupByMuscle, keep the alphabetical grouping
    else {
      // Create sections based on first letter
      const sectionMap = new Map<string, Exercise[]>();
      
      displayedExercises.forEach(exercise => {
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
  }, [displayedExercises, currentCategory, searchQuery, shouldGroupByMuscle]);

  // Memoize section header - only show if not searching
  const renderSectionHeader = useCallback(({ section }: { section: ExerciseSection }) => {
    // Check if this is a muscle group header (when title matches a known category name)
    const isMuscleGroupHeader = Object.values(CATEGORY_NAMES).includes(section.title);
    
    return (
      <View style={[
        styles.sectionHeader,
        isMuscleGroupHeader && styles.muscleGroupSectionHeader
      ]}>
        <Text style={[
          styles.sectionTitle,
          isMuscleGroupHeader && styles.muscleGroupSectionTitle
        ]}>
          {section.title}
        </Text>
        {isMuscleGroupHeader && (
          <Text style={styles.muscleGroupExerciseCount}>
            {section.data.length} {section.data.length === 1 ? 'exercise' : 'exercises'}
          </Text>
        )}
      </View>
    );
  }, []);

  // Toggle favorite status
  const toggleFavorite = useCallback((exerciseId: string) => {
    console.log(`[ExercisesListScreen] Toggle favorite for ${exerciseId}`);
    
    // Find the exercise to get details
    const exercise = allExercises.find(ex => ex.id === exerciseId);
    if (!exercise) return;
    
    setFavoriteIds(prev => {
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
  }, [allExercises]);

  const handleExercisePress = useCallback((exerciseId: string) => {
    // Find the exercise to get details
    const exercise = displayedExercises.find(ex => ex.id === exerciseId);
    console.log(`[ExercisesListScreen] Exercise card pressed: ${exerciseId}, found exercise:`, exercise ? exercise.name : 'not found');
    if (exercise) {
      router.push({
        pathname: "/(tabs)/exercise-details",
        params: {
          id: exerciseId,
          name: exercise.name,
          image: exercise.image_url || 'placeholder.jpg',
          fromScreen: fromScreen
        }
      });
    }
  }, [displayedExercises, router, fromScreen]);

  const openSearch = () => {
    setIsSearchActive(true);
    // Animate search width expansion
    Animated.timing(searchWidthAnim, {
      toValue: SCREEN_WIDTH - 32, // Almost full width with 16px padding on each side
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      // Focus the search input when animation completes
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    });
    
    // Animate content moving down
    Animated.timing(contentOffsetAnim, {
      toValue: 50,
      duration: 300,
      useNativeDriver: false
    }).start();
  };

  const collapseSearchUI = () => {
    // Animate search width collapse without clearing the query
    Animated.timing(searchWidthAnim, {
      toValue: 40,
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      setIsSearchActive(false);
      // Do NOT clear search query when just collapsing the UI
    });
    
    // Animate content moving back up
    Animated.timing(contentOffsetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false
    }).start();
  };

  const clearSearch = () => {
    // Clear search query and close the search UI
    setSearchQuery('');
    collapseSearchUI();
  };

  const handleSearchIconPress = () => {
    if (isSearchActive) {
      // Just collapse the search UI without clearing the query
      collapseSearchUI();
    } else {
      openSearch();
    }
  };

  const handleSearchSubmit = () => {
    // Don't close search or clear query when submitting
    // Just dismiss the keyboard by removing focus from the input
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  };

  const handleBackPress = () => {
    // Clear search state before navigating back
    setSearchQuery('');
    
    // Close search UI if it's open
    if (isSearchActive) {
      // Immediately collapse search UI without animation for a smoother transition
      setIsSearchActive(false);
      searchWidthAnim.setValue(40);
      contentOffsetAnim.setValue(0);
    }
    
    // Navigate back to the previous screen using the fromScreen parameter
    if (fromScreen === 'exercises') {
      router.push('/(tabs)/exercises');
    } else {
      // Fallback to default navigation for other cases
      navigation.goBack();
    }
  };

  // Memoize the exercise card render function
  const renderExerciseCard = useCallback(({ item }: { item: Exercise }) => {
    // Determine the image source - use a stable reference for fallback
    const imageSource = item.image_url 
      ? { uri: item.image_url } 
      : FALLBACK_IMAGE_OBJECT;
      
    return (
      <ExerciseCard
        key={`exercise-${item.id}`}
        id={item.id}
        name={item.name}
        image={imageSource}
        isFavorite={favoriteIds.has(item.id)}
        onPress={handleExercisePress}
        onToggleFavorite={toggleFavorite}
        useOptimizedImage={true}
      />
    );
  }, [favoriteIds, handleExercisePress, toggleFavorite]);

  // Memoize the section row render function
  const renderSectionRow = useCallback((items: Exercise[]) => {
    // Create a row with up to two exercise cards
    const row = items.map(item => renderExerciseCard({ item }));
    
    // If odd number of items, add an empty view to maintain grid layout
    if (items.length === 1) {
      row.push(<View key="empty" style={styles.emptyCardSpace} />);
    }
    
    return (
      <View style={styles.columnWrapper}>
        {row}
      </View>
    );
  }, [renderExerciseCard]);

  // Memoize empty list component
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.5)" />
      <Text style={styles.emptyText}>
        {searchQuery.trim() 
          ? "No exercises match your search" 
          : showFavoritesOnly 
            ? "No favorite exercises yet" 
            : "No exercises available"}
      </Text>
    </View>
  ), [searchQuery, showFavoritesOnly]);

  // Extract key extractor function and memoize it to prevent re-renders
  const keyExtractor = useCallback((item: Exercise) => {
    // console.log(`[ExercisesListScreen] Extracting key for item: ${item.id}`); // This can be very noisy
    return `exercise-${item.id}`;
  }, []);
  
  // Memoize getItemLayout for better performance
  const getItemLayout = useCallback((data: any, index: number) => {
    // console.log(`[ExercisesListScreen] Calculating layout for index: ${index}`); // This can be very noisy
    return {
      length: 200,
      offset: 200 * Math.floor(index / 2),
      index,
    };
  }, []);

  // Memoize the list content
  const renderContent = () => {
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

    // Calculate the appropriate content offset based on search state
    const contentOffset = !isSearchActive && searchQuery.trim() !== '' ? 30 : 0;

    // Show categorized list for "all" or when searching, else show flat list
    if (currentCategory === 'all' || searchQuery.trim() !== '') {
      return (
        <Animated.View style={{ paddingTop: isSearchActive ? contentOffsetAnim : contentOffset }}>
          {loading && (
            <View style={styles.topLoaderContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading exercises...</Text>
            </View>
          )}
          
          {/* Header title for all exercises grouped by muscle */}
          {currentCategory === 'all' && !searchQuery.trim() && shouldGroupByMuscle && (
            <View style={styles.allExercisesHeaderContainer}>
              <Text style={styles.allExercisesHeaderTitle}>
                All Exercises by Muscle Group
              </Text>
              <Text style={styles.allExercisesHeaderSubtitle}>
                {displayedExercises.length} exercises available
              </Text>
            </View>
          )}
          
          {/* If searching, use a FlatList-like layout without section headers */}
          {searchQuery.trim() !== '' ? (
            <FlatList
              data={displayedExercises}
              keyExtractor={item => item.id}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                !isSearchActive && searchQuery.trim() !== '' ? (
                  <View style={styles.searchResultsHeader}>
                    <Text style={styles.searchResultsText} numberOfLines={1} ellipsizeMode="tail">
                      {showFavoritesOnly 
                        ? <Text>Results for "<Text style={styles.queryHighlight}>{searchQuery}</Text>" in Favorites</Text>
                        : currentCategory !== 'all'
                          ? <Text>Results for "<Text style={styles.queryHighlight}>{searchQuery}</Text>" (all exercises)</Text>
                          : <Text>Results for "<Text style={styles.queryHighlight}>{searchQuery}</Text>"</Text>
                      }
                    </Text>
                    <TouchableOpacity onPress={clearSearch} style={styles.clearSearchResultsButton}>
                      <MaterialIcons name="close" size={18} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <ExerciseCard
                  id={item.id}
                  name={item.name}
                  image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                  isFavorite={favoriteIds.has(item.id)}
                  onPress={handleExercisePress}
                  onToggleFavorite={toggleFavorite}
                  useOptimizedImage={true}
                />
              )}
              ListEmptyComponent={ListEmptyComponent}
            />
          ) : (
            // For "all" category without search, use SectionList with headers
            <SectionList
              sections={exerciseSections}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={renderSectionHeader}
              contentContainerStyle={[
                styles.listContent,
                shouldGroupByMuscle && { paddingTop: 10, paddingBottom: 120 }
              ]}
              renderItem={({ section, index, item }) => {
                // Process items in pairs for the two-column layout
                if (index % 2 === 0) {
                  const nextItem = section.data[index + 1];
                  const rowItems = nextItem ? [item, nextItem] : [item];
                  return renderSectionRow(rowItems);
                }
                // Skip odd indices as they're handled with the even indices
                return null;
              }}
              ListEmptyComponent={ListEmptyComponent}
            />
          )}
        </Animated.View>
      );
    } else {
      // For specific category view without search, use FlatList
      return (
        <Animated.View style={{ paddingTop: isSearchActive ? contentOffsetAnim : contentOffset }}>
          {loading && (
            <View style={styles.topLoaderContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading exercises...</Text>
            </View>
          )}
          
          <FlatList
            data={displayedExercises}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              // Show search results header if searching, otherwise show category title
              !isSearchActive && searchQuery.trim() !== '' ? (
                <View style={styles.searchResultsHeader}>
                  <Text style={styles.searchResultsText} numberOfLines={1} ellipsizeMode="tail">
                    {showFavoritesOnly 
                      ? <Text>Results for "<Text style={styles.queryHighlight}>{searchQuery}</Text>" in Favorites</Text>
                      : <Text>Results for "<Text style={styles.queryHighlight}>{searchQuery}</Text>" in {CATEGORY_NAMES[currentCategory] || currentCategory}</Text>
                    }
                  </Text>
                  <TouchableOpacity onPress={clearSearch} style={styles.clearSearchResultsButton}>
                    <MaterialIcons name="close" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              ) : !searchQuery.trim() ? (
                <View style={styles.categoryTitleContainer}>
                  <Text style={styles.categoryTitle}>
                    {CATEGORY_NAMES[currentCategory] || currentCategory.toUpperCase()}
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ExerciseCard
                id={item.id}
                name={item.name}
                image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE_OBJECT}
                isFavorite={favoriteIds.has(item.id)}
                onPress={handleExercisePress}
                onToggleFavorite={toggleFavorite}
              />
            )}
            ListEmptyComponent={ListEmptyComponent}
          />
        </Animated.View>
      );
    }
  };

  // Handle favorites filter toggle with optimistic UI updates
  const toggleFavoritesFilter = useCallback(() => {
    // Toggle the state
    setShowFavoritesOnly(prev => !prev);
  }, []);

  // Add keyboard dismiss listener to maintain search results when keyboard is dismissed
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // When keyboard hides, we want to maintain the search results
        // but collapse the search UI if it's still expanded
        if (isSearchActive && searchQuery.trim() !== '') {
          collapseSearchUI();
        }
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [isSearchActive, searchQuery]);

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
              iconColor={showFavoritesOnly ? "#FFD700" : COLORS.text}
              onPress={toggleFavoritesFilter}
              style={styles.favoriteButton}
            />
          </View>
          <View style={styles.headerRight}>
            {/* Non-intrusive loading indicator */}
            {loading && (
              <ActivityIndicator 
                size="small" 
                color={COLORS.primary}
                style={styles.headerLoader}
              />
            )}
          </View>
        </View>
        <Divider style={styles.divider} />
      </View>

      {/* Content container that scrolls under the header */}
      <View style={styles.contentWrapper}>
        {renderContent()}
      </View>

      {/* Floating Search */}
      <View style={styles.floatingSearchRow}>
        <Animated.View 
          style={[
            styles.searchContainer, 
            { 
              width: isSearchActive ? searchWidthAnim : 40,
              flex: isSearchActive ? 1 : undefined
            }
          ]}
        >
          {!isSearchActive ? (
            <TouchableOpacity 
              style={styles.searchIconButton}
              onPress={openSearch}
            >
              <MaterialIcons 
                name={searchQuery.trim() ? "filter-list" : "search"} 
                size={22} 
                color={searchQuery.trim() ? COLORS.primary : COLORS.text} 
              />
              {searchQuery.trim() !== '' && (
                <View style={styles.activeFilterIndicator} />
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.activeSearchContainer}>
              <TouchableOpacity onPress={handleSearchIconPress}>
                <MaterialIcons name="search" size={24} color={COLORS.text} style={styles.searchIconActive} />
              </TouchableOpacity>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search exercises or muscle groups..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={isSearchActive}
                returnKeyType="search"
                onSubmitEditing={handleSearchSubmit}
              />
              <TouchableOpacity onPress={clearSearch}>
                <MaterialIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>

      {/* Background Overlay to collapse search */}
      {isSearchActive && (
        <TouchableWithoutFeedback onPress={collapseSearchUI}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 30,
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
  listContent: {
    padding: 16,
    paddingTop: 30,
    paddingBottom: 110,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
    flexDirection: 'row',
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
    paddingVertical: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Section header styles
  sectionHeader: {
    paddingVertical: 5,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(108, 71, 255, 0.3)',
    marginBottom: 10,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  muscleGroupSectionHeader: {
    backgroundColor: 'rgba(108, 71, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.md,
    marginVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    marginHorizontal: 8,
  },
  muscleGroupSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  muscleGroupExerciseCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    textAlign: 'left',
  },
  emptyCardSpace: {
    flex: 1,
    marginHorizontal: 6,
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
  allExercisesHeaderContainer: {
    padding: 16,
    backgroundColor: 'rgba(108, 71, 255, 0.2)',
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  allExercisesHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  allExercisesHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
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
    justifyContent: 'space-between',
    backgroundColor: 'rgba(108, 71, 255, 0.37)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    marginLeft: 'auto',
    marginRight: 0,
    borderRadius: BORDER_RADIUS.md,
    width: '85%',
    alignSelf: 'flex-end',
    marginTop: -25,
  },
  searchResultsText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  clearSearchResultsButton: {
    padding: 4,
    marginLeft: 4,
  },
  queryHighlight: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  contentWrapper: {
    flex: 1,
    marginTop: 56, // Match header height
  },
}); 