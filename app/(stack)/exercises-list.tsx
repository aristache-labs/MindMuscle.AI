import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, SectionList, TouchableOpacity, TextInput, Animated, TouchableWithoutFeedback, Dimensions, ActivityIndicator } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';
import { GeneralHeader } from '../components/GeneralHeader';

// Get screen width for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Fallback image for exercises without an image
const FALLBACK_IMAGE = require('../../assets/exercises/placeholder.jpg');

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
  'Lower back': 'LOWER BACK',
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
  'Traps': ['trapezius', 'upper back'],
};

export default function ExercisesListScreen() {
  const { categoryId, fromScreen, openSearch: openSearchParam, showAllCategories } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // Default to Cardio if no category provided
  const currentCategory = typeof categoryId === 'string' 
    ? (categoryId as ExerciseCategory) || 'all'
    : 'all';
  
  // State for exercises
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  
  // State for favorite filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // State & animation for search
  const [isSearchActive, setIsSearchActive] = useState(openSearchParam === 'true');
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(new Animated.Value(openSearchParam === 'true' ? SCREEN_WIDTH - 32 : 40)).current;
  const contentOffsetAnim = useRef(new Animated.Value(openSearchParam === 'true' ? 50 : 0)).current;
  const searchInputRef = useRef<TextInput>(null);

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
        setLoading(true);
        setError(null);
        
        // Always fetch all exercises for potential search and categorization
        const allExercisesData = await exerciseService.getExercisesByCategory('all');
        setAllExercises(allExercisesData);
        
        // If a specific category is selected, filter the exercises
        if (currentCategory !== 'all') {
          const categoryExercises = allExercisesData.filter(
            ex => ex.muscle_group === currentCategory
          );
          setExercises(categoryExercises);
        } else {
          setExercises(allExercisesData);
        }
        
        // Fetch favorite exercises to mark which ones are favorites
        const favorites = await exerciseService.getFavoriteExercises();
        const favoriteIdSet = new Set(favorites.map(fav => fav.id));
        setFavoriteIds(favoriteIdSet);
      } catch (err) {
        console.error('Error loading exercises:', err);
        setError('Failed to load exercises. Please try again.');
      } finally {
        setLoading(false);
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
  
  // Filter exercises based on favorite state and search query
  const displayedExercises = useMemo(() => {
    // Determine which set of exercises to use based on search
    // Always use all exercises when searching
    const exercisesToFilter = searchQuery.trim() ? allExercises : exercises;
    
    // First filter by favorites if needed
    let filteredExercises = exercisesToFilter;
    
    if (showFavoritesOnly) {
      filteredExercises = filteredExercises.filter(ex => favoriteIds.has(ex.id));
    }
    
    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredExercises = filteredExercises.filter(ex => 
        // Check if the name includes query
        ex.name.toLowerCase().includes(query) ||
        // Check if the muscle group matches query
        matchesMuscleGroup(ex, query)
      );
    }
    
    return filteredExercises;
  }, [exercises, allExercises, favoriteIds, showFavoritesOnly, searchQuery, matchesMuscleGroup]);

  // Group exercises by muscle category for section list
  const exerciseSections = useMemo(() => {
    // Create a map of categories to exercises
    const categoryMap: Record<string, Exercise[]> = {};
    
    // Group exercises by their muscle groups
    displayedExercises.forEach(exercise => {
      const category = exercise.muscle_group || 'Other';
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      categoryMap[category].push(exercise);
    });
    
    // Convert map to array of sections
    const sections: ExerciseSection[] = Object.entries(categoryMap)
      .filter(([_, exercises]) => exercises.length > 0) // Only include non-empty categories
      .map(([category, exercises]) => ({
        title: CATEGORY_NAMES[category as ExerciseCategory] || category.toUpperCase(),
        data: exercises
      }))
      .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by category name
    
    return sections;
  }, [displayedExercises]);

  const toggleFavorite = useCallback(async (id: string) => {
    try {
      const isFavorite = !favoriteIds.has(id);
      
      // Optimistically update the UI
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        if (isFavorite) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
      
      // Update in the database
      await exerciseService.toggleFavoriteExercise(id, isFavorite);
    } catch (err) {
      console.error('Error toggling favorite:', err);
      // Revert on error
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    }
  }, [favoriteIds]);

  const handleExercisePress = (exerciseId: string) => {
    // Find the exercise details to pass as params
    const exercise = allExercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      router.push({
        pathname: '/exercise-details',
        params: {
          id: exercise.id,
          name: exercise.name,
          image: exercise.image_url || '',
        }
      });
    }
  };

  const openSearch = () => {
    setIsSearchActive(true);
    // Animate search width expansion
    Animated.timing(searchWidthAnim, {
      toValue: SCREEN_WIDTH - 32, // Almost full width with 16px padding on each side
      duration: 300,
      useNativeDriver: false
    }).start();
    
    // Animate content moving down
    Animated.timing(contentOffsetAnim, {
      toValue: 50,
      duration: 300,
      useNativeDriver: false
    }).start();
  };

  const closeSearch = () => {
    // Animate search width collapse
    Animated.timing(searchWidthAnim, {
      toValue: 40,
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      setIsSearchActive(false);
      // Don't clear search query when closing the UI
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
    closeSearch();
  };

  const handleSearchIconPress = () => {
    if (isSearchActive) {
      closeSearch();
    } else {
      openSearch();
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim() === '') {
      closeSearch();
    }
  };

  const handleBackPress = () => {
    // Navigate back to the previous screen using the fromScreen parameter
    if (fromScreen === 'exercises') {
      router.push('/(tabs)/exercises');
    } else {
      // Fallback to default navigation for other cases
      navigation.goBack();
    }
  };

  // Render a row of two exercise cards for SectionList
  const renderSectionRow = (items: Exercise[]) => {
    // Create a row with up to two exercise cards
    const row = items.map(item => (
      <ExerciseCard
        key={item.id}
        id={item.id}
        name={item.name}
        image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE}
        isFavorite={favoriteIds.has(item.id)}
        onPress={() => handleExercisePress(item.id)}
        onToggleFavorite={() => toggleFavorite(item.id)}
      />
    ));
    
    // If odd number of items, add an empty view to maintain grid layout
    if (items.length === 1) {
      row.push(<View key="empty" style={styles.emptyCardSpace} />);
    }
    
    return (
      <View style={styles.columnWrapper}>
        {row}
      </View>
    );
  };

  // Render section header for SectionList
  const renderSectionHeader = ({ section }: { section: ExerciseSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.messageText}>Loading exercises...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centeredContainer}>
          <MaterialIcons name="error-outline" size={48} color="rgba(255,255,255,0.7)" />
          <Text style={styles.messageText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => router.replace(`/exercises-list?categoryId=${currentCategory}`)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Show categorized list for "all" or search, else show flat list
    if ((currentCategory === 'all' || searchQuery.trim() !== '')) {
      return (
        <Animated.View style={{ paddingTop: contentOffsetAnim }}>
          <SectionList
            sections={exerciseSections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={renderSectionHeader}
            contentContainerStyle={styles.listContent}
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
            ListEmptyComponent={
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
            }
          />
        </Animated.View>
      );
    } else {
      // For specific category view, use FlatList
      return (
        <Animated.View style={{ paddingTop: contentOffsetAnim }}>
          <FlatList
            data={displayedExercises}
            renderItem={({ item }) => (
              <ExerciseCard
                id={item.id}
                name={item.name}
                image={item.image_url ? { uri: item.image_url } : FALLBACK_IMAGE}
                isFavorite={favoriteIds.has(item.id)}
                onPress={() => handleExercisePress(item.id)}
                onToggleFavorite={() => toggleFavorite(item.id)}
              />
            )}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              // Only show category title when not searching
              !searchQuery.trim() ? (
                <View style={styles.categoryTitleContainer}>
                  <Text style={styles.categoryTitle}>
                    {CATEGORY_NAMES[currentCategory] || 'EXERCISES'}
                  </Text>
                </View>
              ) : searchQuery.trim() ? (
                <View style={styles.categoryTitleContainer}>
                  
                </View>
              ) : null
            }
            ListEmptyComponent={
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
            }
          />
        </Animated.View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header with custom back button */}
      <View style={[styles.header, { marginTop: insets.top }]}>
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
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={styles.favoriteButton}
          />
        </View>
        <View style={styles.headerRight}>
          {/* Favorite button moved to center */}
        </View>
      </View>
      <Divider style={styles.divider} />

      {/* Background Overlay to close search */}
      {isSearchActive && (
        <TouchableWithoutFeedback onPress={closeSearch}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Floating Search */}
      <Animated.View 
        style={[
          styles.searchContainer, 
          { width: searchWidthAnim }
        ]}
      >
        {!isSearchActive ? (
          <TouchableOpacity 
            style={styles.searchIconButton}
            onPress={openSearch}
          >
            <MaterialIcons name="search" size={22} color={COLORS.text} />
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

      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    position: 'absolute',
    top: 120,
    left: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 71, 255, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
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
    paddingVertical: 8,
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
  emptyCardSpace: {
    flex: 1,
    marginHorizontal: 6,
  },
}); 