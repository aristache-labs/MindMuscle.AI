import React from 'react';
import { StyleSheet, View, ScrollView, ImageBackground, ImageSourcePropType, Platform, Pressable } from 'react-native';
import { Text, Chip, IconButton, Surface, Divider } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import OptimizedImage from '../components/OptimizedImage';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ExerciseCard {
  id: string;
  title: string;
  duration: string;
  level: string;
  image: ImageSourcePropType;
}

// Temporary placeholder image for exercises
const DEFAULT_EXERCISE_IMAGE = require('../../assets/adaptive-icon.png');

const exerciseData: ExerciseCard[] = [
  {
    id: '1',
    title: 'Full Body Training Exercise',
    duration: '6 minutes',
    level: 'Intermediate',
    image: require('../../assets/exercises/fullbody.jpg'),
  },
  {
    id: '2',
    title: 'Squat Movement Exercise',
    duration: '12 minutes',
    level: 'Intermediate',
    image: require('../../assets/exercises/squat.jpg'),
  },
  {
    id: '3',
    title: 'Push up Training',
    duration: '6 minutes',
    level: 'Intermediate',
    image: require('../../assets/exercises/pushup.jpg'),
  },
  {
    id: '4',
    title: 'Dumbbell Man Exercise',
    duration: '8 minutes',
    level: 'Intermediate',
    image: require('../../assets/exercises/dumbbell.jpg'),
  },
  {
    id: '5',
    title: 'Yoga Women Exercise',
    duration: '8 minutes',
    level: 'Intermediate',
    image: require('../../assets/exercises/yoga.jpg'),
  },
];

const ExerciseCard = ({ title, duration, level, image }: ExerciseCard) => {
  return (
    <Surface style={styles.card} elevation={2}>
      <View style={styles.cardOverflowContainer}>
        <View style={styles.cardImageContainer}>
          <OptimizedImage 
            source={image}
            style={styles.cardImageContainer}
            imageStyle={styles.cardImage}
            contentFit="cover"
          />
          <View style={styles.cardContent}>
            <Text variant="titleMedium" style={styles.cardTitle}>{title}</Text>
            <View style={styles.cardMeta}>
              <Text variant="bodySmall" style={styles.cardMetaText}>{duration}</Text>
              <Text variant="bodySmall" style={styles.cardMetaText}>{level}</Text>
            </View>
            <IconButton
              icon="bookmark-outline"
              iconColor="white"
              size={24}
              style={styles.bookmarkIcon}
              onPress={() => {}}
            />
          </View>
        </View>
      </View>
    </Surface>
  );
};

export default function DiscoverScreen() {
  const [selectedFilter, setSelectedFilter] = React.useState('Intermediate');
  const insets = useSafeAreaInsets();

  // Preload all exercise images
  const imagesToPreload = exerciseData.map(exercise => exercise.image);
  const { loaded: imagesPreloaded } = useImagePreloader(imagesToPreload);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Fixed Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="compass"
              size={24}
              style={styles.headerIcon}
              iconColor={COLORS.text}
            />
            <Text variant="headlineSmall" style={[styles.headerTitle, { color: COLORS.text }]}>Discover</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.premiumButton} onPress={() => {}}>
              <IconButton
                icon="crown"
                iconColor="#f9e009"
                size={26}
                style={styles.premiumIcon}
              />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </Pressable>
          </View>
        </View>
        <Divider style={styles.divider} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.exerciseList, { paddingTop: 100 }]}
      >
        <View style={styles.filtersContainer}>
          <View style={styles.filters}>
            {['Beginner', 'Intermediate', 'Advanced'].map((filter) => (
              <Chip
                key={filter}
                selected={selectedFilter === filter}
                onPress={() => setSelectedFilter(filter)}
                style={[
                  styles.filterChip,
                  selectedFilter === filter && styles.filterChipSelected
                ]}
                textStyle={[
                  styles.filterChipText,
                  selectedFilter === filter && styles.filterChipTextSelected
                ]}
              >
                {filter}
              </Chip>
            ))}
          </View>
        </View>
        
        {exerciseData.map((exercise) => (
          <ExerciseCard key={exercise.id} {...exercise} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.background,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    backgroundColor: COLORS.primary,
    margin: 0,
  },
  headerTitle: {
    marginLeft: SPACING.sm,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    backgroundColor: '#333',
    height: 1,
  },
  premiumButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  premiumIcon: {
    margin: 0,
    marginTop: 0,
    marginLeft: 0,
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -10,
  },
  filtersContainer: {
    backgroundColor: COLORS.background,
    paddingVertical: 10,
  },
  filters: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  content: {
    flex: 1,
  },
  exerciseList: {
    padding: 16,
    gap: 16,
  },
  card: {
    height: 160,
    borderRadius: 25,
    backgroundColor: '#1C1C1E',
  },
  cardOverflowContainer: {
    flex: 1,
    borderRadius: 25,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
  },
  cardTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cardMetaText: {
    color: 'white',
    opacity: 0.7,
  },
  bookmarkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  filterChip: {
    backgroundColor: '#1f222a',
    borderWidth: 1,
    borderColor: '#6B4EFF',
  },
  filterChipSelected: {
    backgroundColor: '#6B4EFF',
  },
  filterChipText: {
    color: '#6B4EFF',
  },
  filterChipTextSelected: {
    color: 'white',
  },
}); 