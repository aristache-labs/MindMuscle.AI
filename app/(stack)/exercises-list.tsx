import React, { useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import ExerciseCard from '../components/ExerciseCard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  
  // New state for favorite filter
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
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
    // router.push(`/exercise-detail/${exerciseId}`);
    console.log(`Navigating to exercise ${exerciseId}`);
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
          {currentCategory.name === 'CARDIO' ? (
            <View style={styles.favoriteFilterContainer}>
              <IconButton
                icon={showFavoritesOnly ? 'star' : 'star-outline'}
                size={28}
                iconColor={showFavoritesOnly ? "#FFD700" : COLORS.text}
                onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
                style={styles.favoriteButton}
              />
              <Text style={styles.favoriteText}>
                {showFavoritesOnly ? 'Favorites' : 'All Exercises'}
              </Text>
            </View>
          ) : (
            <Text style={styles.title}>{currentCategory.name}</Text>
          )}
        </View>
        <View style={styles.headerRight} />
      </View>
      <Divider style={styles.divider} />

      {/* Search FAB */}
      <TouchableOpacity 
        style={[styles.searchFAB, { bottom: insets.bottom + 20 }]}
        onPress={() => console.log('Search pressed')}
      >
        <MaterialIcons name="search" size={26} color="white" />
      </TouchableOpacity>

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
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: 16 } // Adjust padding as we're not using HEADER_HEIGHT anymore
        ]}
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
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  favoriteFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    margin: 0,
  },
  favoriteText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: -8,
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.2,
  },
  listContent: {
    padding: 16,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  searchFAB: {
    position: 'absolute',
    left: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    zIndex: 100,
  }
}); 