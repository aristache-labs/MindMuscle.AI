import React, { useState, useRef } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, TextInput, Animated, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Get screen width for responsive sizing
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock data for exercises based on category
const CARDIO_EXERCISES = [
  { 
    id: 'c1', 
    name: 'Running', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: false 
  },
  { 
    id: 'c2', 
    name: 'Bicycle Machine', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: true 
  },
  { 
    id: 'c3', 
    name: 'Elliptical Machine', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: false 
  },
  { 
    id: 'c4', 
    name: 'Step Machine', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: false 
  },
  { 
    id: 'c5', 
    name: 'Rowing Machine', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: false 
  },
  { 
    id: 'c6', 
    name: 'Jump Rope', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: true 
  },
];

const STRENGTH_EXERCISES = [
  { 
    id: 's1', 
    name: 'Push-up', 
    image: require('../../assets/exercises/pushup.jpg'),
    isFavorite: true 
  },
  { 
    id: 's2', 
    name: 'Squat', 
    image: require('../../assets/exercises/squat.jpg'),
    isFavorite: false 
  },
  { 
    id: 's3', 
    name: 'Dumbbell Curl', 
    image: require('../../assets/exercises/dumbbell.jpg'),
    isFavorite: false 
  },
  { 
    id: 's4', 
    name: 'Plank', 
    image: require('../../assets/exercises/placeholder.jpg'),
    isFavorite: true 
  },
];

const YOGA_EXERCISES = [
  { 
    id: 'y1', 
    name: 'Downward Dog', 
    image: require('../../assets/exercises/yoga.jpg'),
    isFavorite: false 
  },
  { 
    id: 'y2', 
    name: 'Warrior Pose', 
    image: require('../../assets/exercises/yoga.jpg'),
    isFavorite: true 
  },
];

// Map of category IDs to their exercises and display names
const CATEGORIES = {
  'cardio': {
    name: 'CARDIO',
    exercises: CARDIO_EXERCISES
  },
  'strength': {
    name: 'STRENGTH TRAINING',
    exercises: STRENGTH_EXERCISES
  },
  'yoga': {
    name: 'YOGA',
    exercises: YOGA_EXERCISES
  }
};

export default function ExercisesListScreen() {
  const { categoryId } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Default to cardio if no category provided
  const currentCategory = typeof categoryId === 'string' 
    ? CATEGORIES[categoryId as keyof typeof CATEGORIES] || CATEGORIES.cardio
    : CATEGORIES.cardio;
  
  const [favoriteExercises, setFavoriteExercises] = useState(
    currentCategory.exercises.map(ex => ({ ...ex }))
  );
  
  // State for favorite filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // State & animation for search
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchWidthAnim = useRef(new Animated.Value(40)).current;
  
  // Filter exercises based on favorite state if needed
  const displayedExercises = showFavoritesOnly 
    ? favoriteExercises.filter(ex => ex.isFavorite) 
    : favoriteExercises;

  const toggleFavorite = (id: string) => {
    setFavoriteExercises(prev => 
      prev.map(ex => 
        ex.id === id ? { ...ex, isFavorite: !ex.isFavorite } : ex
      )
    );
  };

  const handleExercisePress = (exerciseId: string) => {
    // Navigate to exercise detail page
    console.log(`Navigating to exercise ${exerciseId}`);
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Custom Header */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={28}
            onPress={() => router.back()}
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
        <View style={styles.headerRight} />
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
            />
            <TouchableOpacity onPress={closeSearch}>
              <MaterialIcons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <FlatList
        data={displayedExercises}
        renderItem={({ item }) => (
          <ExerciseCard
            id={item.id}
            name={item.name}
            image={item.image}
            isFavorite={item.isFavorite}
            onPress={() => handleExercisePress(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
      />
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
    backgroundColor: 'rgba(70, 70, 70, 0.7)',
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
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
}); 