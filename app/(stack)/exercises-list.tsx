import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, TextInput, Animated, TouchableWithoutFeedback, Dimensions, ActivityIndicator } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import exerciseService, { Exercise, ExerciseCategory } from '../services/exerciseService';

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

export default function ExercisesListScreen() {
  const { categoryId, fromScreen } = useLocalSearchParams();
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
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(new Animated.Value(40)).current;

  // Fetch exercises on mount and when category changes
  useEffect(() => {
    const loadExercises = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch exercises for the current muscle group category
        const exercisesData = await exerciseService.getExercisesByCategory(currentCategory);
        setExercises(exercisesData);
        
        // Fetch all exercises for global search
        if (currentCategory !== 'all') {
          const allExercisesData = await exerciseService.getExercisesByCategory('all');
          setAllExercises(allExercisesData);
        } else {
          setAllExercises(exercisesData);
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
  
  // Filter exercises based on favorite state and search query
  const displayedExercises = useMemo(() => {
    // Determine which set of exercises to use based on search
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
        ex.name.toLowerCase().includes(query)
      );
    }
    
    return filteredExercises;
  }, [exercises, allExercises, favoriteIds, showFavoritesOnly, searchQuery]);

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
    // Navigate to exercise detail page
    console.log(`Navigating to exercise ${exerciseId}`);
    // router.push(`/exercise-detail/${exerciseId}`);
  };

  const openSearch = () => {
    setIsSearchActive(true);
    Animated.timing(searchWidthAnim, {
      toValue: SCREEN_WIDTH - 32, // Almost full width with 16px padding on each side
      duration: 300,
      useNativeDriver: false
    }).start();
  };

  const closeSearch = () => {
    Animated.timing(searchWidthAnim, {
      toValue: 40,
      duration: 300,
      useNativeDriver: false
    }).start(() => {
      setIsSearchActive(false);
      setSearchQuery('');
    });
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
    // Check if we can go back in navigation history
    try {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // If we can't go back (no history), navigate to tabs
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Fallback if navigation fails
      router.replace('/(tabs)');
    }
  };

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

    return (
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
          <View style={styles.categoryTitleContainer}>
            <Text style={styles.categoryTitle}>
              {CATEGORY_NAMES[currentCategory] || 'EXERCISES'}
            </Text>
          </View>
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
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Custom Header */}
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
              style={styles.searchInput}
              placeholder="Search for exercises"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
            <TouchableOpacity onPress={closeSearch}>
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
    backgroundColor: 'rgb(70, 70, 70)',
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
    paddingTop: 6,
    flexGrow: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
    textAlign: 'center',
  },
}); 