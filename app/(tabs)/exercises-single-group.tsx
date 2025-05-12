import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Text, Animated, TextInput, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import ExerciseCard from '../components/ExerciseCard';
import OptimizedImage from '../components/OptimizedImage';
import useImagePreloader from '../hooks/useImagePreloader';

// Get screen width for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Card sizing constants for consistent spacing
const CARD_GAP = 8;
const CONTAINER_PADDING = 8 * 2;
const CARD_WIDTH = (SCREEN_WIDTH - CONTAINER_PADDING - CARD_GAP) / 2;

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

export default function SingleGroupExercisesScreen() {
  const { categoryId, fromScreen, openSearch: openSearchParam } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Get the muscle group from params
  const muscleGroup = typeof categoryId === 'string' 
    ? (categoryId === 'Lower back' ? 'Lower_back' : categoryId) 
    : 'Cardio'; // Default to Cardio if no category provided
  
  // State for exercises
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // State & animation for search
  const [isSearchActive, setIsSearchActive] = useState(openSearchParam === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(new Animated.Value(openSearchParam === 'true' ? SCREEN_WIDTH - 32 : 40)).current;
  const contentOffsetAnim = useRef(new Animated.Value(openSearchParam === 'true' ? 50 : 0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const searchResultsOpacity = useRef(new Animated.Value(0)).current;

  // Fetch exercises on mount
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load exercises for this muscle group
        const exercisesData = await exerciseService.getExercisesByCategory(muscleGroup as ExerciseCategory);
        
        // Sort alphabetically
        exercisesData.sort((a, b) => a.name.localeCompare(b.name));
        
        // Update state
        setExercises(exercisesData);
        console.log(`[SingleGroupExercisesScreen] Loaded ${exercisesData.length} exercises for ${muscleGroup}`);
        
        // Load favorites
        try {
          const favorites = await exerciseService.getFavoriteExercises();
          const favoriteIdSet = new Set(favorites.map(fav => fav.id));
          setFavoriteIds(favoriteIdSet);
        } catch (favError) {
          console.error('Error loading favorites:', favError);
        }
      } catch (err) {
        console.error('Error loading exercises:', err);
        setError('Failed to load exercises. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadExercises();
  }, [muscleGroup]);

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
    let filtered = [...exercises];
    const isSearching = searchQuery.trim() !== '';
    
    if (isSearching) {
      const query = searchQuery.toLowerCase().trim();
      
      // Apply search filter
      filtered = filtered.filter(ex => 
        ex.name.toLowerCase().includes(query) || 
        (ex.muscle_group && ex.muscle_group.toLowerCase().includes(query)) ||
        matchesMuscleGroup(ex, query)
      );
      
      console.log(`[SingleGroupExercisesScreen] Found ${filtered.length} matches for "${query}"`);
    }
    
    // Apply favorites filter if enabled
    if (showFavoritesOnly) {
      const beforeCount = filtered.length;
      filtered = filtered.filter(ex => favoriteIds.has(ex.id));
      console.log(`[SingleGroupExercisesScreen] Filtered to ${filtered.length} favorites (from ${beforeCount})`);
    }
    
    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, searchQuery, showFavoritesOnly, favoriteIds, matchesMuscleGroup]);

  // Preload images for currently displayed exercises
  const displayedImageUrls = useMemo(() => {
    return displayedExercises
      .filter(ex => ex.image_url)
      .map(ex => ex.image_url as string);
  }, [displayedExercises]);
  
  // Use image preloader hook to preload visible exercise images
  const preloadStatus = useImagePreloader(displayedImageUrls, {
    priority: 'high',
    debugLabel: 'SingleGroupExercisesScreen',
    skipIfCached: true
  });

  // Toggle favorite status
  const toggleFavorite = useCallback((exerciseId: string) => {
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
  }, []);

  // Handle exercise press to navigate to details
  const handleExercisePress = useCallback((exerciseId: string) => {
    // Find the exercise to get details
    const exercise = exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      router.push({
        pathname: "/(tabs)/exercise-details",
        params: {
          id: exerciseId,
          name: exercise.name,
          image: exercise.image_url || 'placeholder.jpg',
          fromScreen: 'exercises-single-group',
          originalFromScreen: fromScreen || 'exercises',
          categoryId: muscleGroup
        }
      });
    }
  }, [exercises, router, fromScreen, muscleGroup]);

  // Handle back button press
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
    
    if (fromScreen) {
      router.push(`/(tabs)/${fromScreen}`);
    } else {
      router.push('/(tabs)/exercises');
    }
  };

  // Search functionality
  const openSearch = () => {
    setIsSearchActive(true);
    // Animate search width expansion
    Animated.timing(searchWidthAnim, {
      toValue: SCREEN_WIDTH - 32,
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

  // Handle favorites filter toggle
  const toggleFavoritesFilter = useCallback(() => {
    // Toggle the state
    setShowFavoritesOnly(prev => !prev);
  }, []);

  // Add keyboard dismiss listener
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
  
  // Update search results opacity animation
  useEffect(() => {
    if (!isSearchActive && searchQuery.trim() !== '') {
      // Show the search results header with a fade in animation
      Animated.timing(searchResultsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Hide the search results header
      Animated.timing(searchResultsOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isSearchActive, searchQuery]);

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

      {/* Content container */}
      <View style={styles.contentWrapper}>
        {error ? (
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
        ) : (
          <Animated.View style={[
            styles.animatedContentContainer,
            { paddingTop: isSearchActive ? contentOffsetAnim : 0 }
          ]}>
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
                {/* Category Header */}
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryTitle}>
                    {CATEGORY_NAMES[muscleGroup as keyof typeof CATEGORY_NAMES] || muscleGroup}
                  </Text>
                  <Text style={styles.exerciseCount}>
                    {displayedExercises.length} {displayedExercises.length === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>
                
                {/* Exercise Cards */}
                <View style={styles.exerciseCardsContainer}>
                  {/* Group items in pairs for the two-column layout */}
                  {Array.from({ length: Math.ceil(displayedExercises.length / 2) }).map((_, rowIndex) => {
                    const startIdx = rowIndex * 2;
                    const rowItems = displayedExercises.slice(startIdx, startIdx + 2);
                    
                    return (
                      <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
                        {rowItems.map(item => (
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
                        {/* If odd number of items in the row, add an empty space */}
                        {rowItems.length === 1 && <View style={styles.emptyCardSpace} />}
                      </View>
                    );
                  })}
                </View>
              </View>
              
              {displayedExercises.length === 0 && (
                <ListEmptyComponent />
              )}
            </ScrollView>
          </Animated.View>
        )}
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
                name={searchQuery.trim() ? "search" : "search"} 
                size={22} 
                color={searchQuery.trim() ? COLORS.text : COLORS.text} 
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
                placeholder="Search exercises..."
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
      
      {/* Floating search results header */}
      {!isSearchActive && searchQuery.trim() !== '' && (
        <Animated.View 
          style={[
            styles.searchResultsHeader,
            { 
              opacity: searchResultsOpacity,
              transform: [
                { 
                  translateY: searchResultsOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }
              ]
            }
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
          <TouchableOpacity onPress={clearSearch} style={styles.clearSearchResultsButton}>
            <MaterialIcons name="close" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </Animated.View>
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