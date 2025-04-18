import React from 'react';
import { StyleSheet, View, ScrollView, ImageBackground, ImageSourcePropType } from 'react-native';
import { Text, Chip, IconButton, Surface } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

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
      <ImageBackground 
        source={image}
        style={styles.cardImage} 
        imageStyle={[styles.cardImageStyle, styles.cardImageOverlay]}
      >
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
      </ImageBackground>
    </Surface>
  );
};

export default function DiscoverScreen() {
  const [selectedFilter, setSelectedFilter] = React.useState('Intermediate');

  const handleBackPress = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerContainer}>
        <View style={styles.topBar}>
          <IconButton
            icon="arrow-left"
            iconColor="white"
            size={24}
            onPress={handleBackPress}
          />
          <IconButton
            icon="magnify"
            iconColor="white"
            size={24}
            onPress={() => {}}
          />
        </View>
        <View style={styles.titleContainer}>
          <IconButton
            icon="dumbbell"
            iconColor="white"
            size={24}
            style={styles.dumbbellIcon}
          />
          <Text variant="headlineMedium" style={styles.headerTitle}>Discover</Text>
        </View>
      </View>

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
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.exerciseList}>
          {exerciseData.map((exercise) => (
            <ExerciseCard key={exercise.id} {...exercise} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181a20',
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 0,
    gap: 8,
    zIndex: 2,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  dumbbellIcon: {
    margin: 0,
    marginRight: 10,
    backgroundColor: '#6B4EFF',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  filtersContainer: {
    position: 'absolute',
    top: 170,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: '#181a20',
    paddingVertical: 8,
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
    marginTop: 60,
  },
  card: {
    height: 160,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
  },
  cardImage: {
    flex: 1,
  },
  cardImageStyle: {
    opacity: 0.7,
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
  cardImageOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  filterChip: {
    backgroundColor: 'transparent',
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
  exerciseList: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
}); 