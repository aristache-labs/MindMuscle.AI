import React from 'react';
import { StyleSheet, View, ScrollView, Image, Dimensions } from 'react-native';
import { Text, Card, Button, IconButton, useTheme, Chip } from 'react-native-paper';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../constants/theme';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 150; // Full width minus padding
const CARD_HEIGHT = 200;

const getGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return '🌞  Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return '☀️  Good Afternoon';
  } else if (hour >= 17 && hour < 21) {
    return '☀️  Good Evening';
  } else {
    return '🌔  Good Night';
  }
};

const workoutLevels = ['Beginner', 'Intermediate', 'Advanced'];

const featuredWorkouts = [
  {
    id: 1,
    title: 'Full Body Stretching',
    duration: '10 minutes',
    level: 'Intermediate',
    image: 'https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80'
  },
  {
    id: 2,
    title: 'Body Weight Training',
    duration: '8 minutes',
    level: 'Beginner',
    image: 'https://images.unsplash.com/photo-1434682881908-b43d0467b798?ixlib=rb-4.0.3&auto=format&fit=crop&w=1740&q=80'
  },
  {
    id: 3,
    title: 'Squat Movement Exercise',
    duration: '12 minutes',
    level: 'Intermediate',
    image: 'https://images.unsplash.com/photo-1566241440091-ec10de8db2e1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1746&q=80'
  }
];

const workoutLevelCards = [
  {
    id: 1,
    title: 'Squat Movement Exercise',
    duration: '10 minutes',
    level: 'Intermediate',
    image: 'https://www.sundried.com/cdn/shop/articles/squat-gym-workout-sundried_1100x.jpg?v=1515425792'
  },
  {
    id: 2,
    title: 'Yoga Women Exercise',
    duration: '1 hour',
    level: 'Intermediate',
    image: 'https://www.healthkart.com/connect//wp-content/uploads/2021/01/banner-2.jpg'
  }
];

export default function HomeScreen() {
  const { user, isLoading, signOut } = useAuth();
  const [selectedLevel, setSelectedLevel] = React.useState('Intermediate');
  const theme = useTheme();
  const greeting = React.useMemo(() => getGreeting(), []);
  const fullName = React.useMemo(() => {
    if (isLoading) return '...';
    return user?.user_metadata?.name  || 'User';
  }, [user, isLoading]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderWorkoutCard = (workout: typeof featuredWorkouts[0]) => (
    <View key={workout.id} style={styles.workoutCard}>
      <Image source={{ uri: workout.image }} style={styles.workoutImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <View style={styles.workoutContent}>
          <Text variant="titleMedium" style={styles.workoutTitle}>
            {workout.title}
          </Text>
          <View style={styles.workoutMeta}>
            <Text variant="bodySmall" style={styles.workoutInfo}>
              {workout.duration}
            </Text>
            <Text variant="bodySmall" style={[styles.workoutInfo, styles.bulletPoint]}>
              •
            </Text>
            <Text variant="bodySmall" style={styles.workoutInfo}>
              {workout.level}
            </Text>
          </View>
        </View>
        <IconButton
          icon="bookmark-outline"
          size={20}
          style={styles.bookmarkButton}
          iconColor="white"
          onPress={() => {}}
        />
      </LinearGradient>
    </View>
  );

  const renderLevelCard = (workout: typeof workoutLevelCards[0]) => (
    <View key={workout.id} style={styles.levelCard}>
      <Image source={{ uri: workout.image }} style={styles.levelCardImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.levelCardGradient}
      >
        <View style={styles.levelCardContent}>
          <Text variant="titleLarge" style={styles.levelCardTitle}>
            {workout.title}
          </Text>
          <View style={styles.levelCardMeta}>
            <Text variant="bodyMedium" style={styles.levelCardInfo}>
              {workout.duration}
            </Text>
            <Text style={styles.levelCardDot}>•</Text>
            <Text variant="bodyMedium" style={styles.levelCardInfo}>
              {workout.level}
            </Text>
          </View>
        </View>
        <IconButton
          icon="bookmark-outline"
          iconColor="white"
          size={24}
          style={styles.levelCardBookmark}
          onPress={() => {}}
        />
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.floatingHeader}>
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            <Text style={styles.logoText}>AI</Text>
          </View>
          <Text style={styles.appName}>MindMuscle</Text>
        </View>
        <View style={styles.headerButtons}>
          <IconButton
            icon="bell-outline"
            mode="contained"
            containerColor="transparent"
            iconColor='#6B4EFF'
            size={28}
            onPress={() => {}}
            style={styles.headerButton}
          />
          <IconButton
            icon="bookmark-outline"
            mode="contained"
            containerColor="transparent"
            iconColor='#6B4EFF'
            size={28}
            onPress={() => {}}
            style={styles.headerButton}
          />
          <IconButton
            icon="logout"
            mode="contained"
            containerColor="transparent"
            iconColor='#6B4EFF'
            size={28}
            onPress={handleLogout}
            style={styles.headerButton}
          />
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSpacer} />
        
        <View style={styles.welcomeSection}>
          <Text variant="headlineMedium" style={styles.welcomeText}>
            {greeting}, {fullName}!
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Featured Workout</Text>
            <Text style={styles.seeAllText}>See All</Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.workoutCardsContainer}>
            {featuredWorkouts.map(renderWorkoutCard)}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Workout Levels</Text>
            <Text style={styles.seeAllText}>See All</Text>
          </View>
          <View style={styles.filtersWrapper}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.levelsContainer}>
              {workoutLevels.map((level) => (
                <Chip
                  key={level}
                  selected={selectedLevel === level}
                  onPress={() => setSelectedLevel(level)}
                  style={[
                    styles.filterChip,
                    selectedLevel === level && styles.filterChipSelected
                  ]}
                  textStyle={[
                    styles.filterChipText,
                    selectedLevel === level && styles.filterChipTextSelected
                  ]}>
                  {level}
                </Chip>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.levelCardsSection}>
          {workoutLevelCards.map(renderLevelCard)}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: COLORS.background,
  },
  headerSpacer: {
    height: 150, // Height to account for the floating header
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 100,
    paddingBottom: 25,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#6B4EFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  appName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 8,
  },
  welcomeSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  seeAllText: {
    color: '#6B4EFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  workoutCardsContainer: {
    paddingRight: 16,
  },
  workoutCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  workoutImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  workoutContent: {
    flex: 1,
  },
  workoutTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutInfo: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  bulletPoint: {
    marginHorizontal: 8,
  },
  bookmarkButton: {
    margin: 0,
    backgroundColor: '#6B4EFF',
  },
  filtersWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelsContainer: {
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  filterChip: {
    backgroundColor: '#1f222a',
    borderWidth: 1,
    borderColor: '#6B4EFF',
    marginRight: 8,
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
  levelCardsSection: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  levelCard: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    marginBottom: 16,
  },
  levelCardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  levelCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 16,
  },
  levelCardContent: {
    flex: 1,
  },
  levelCardTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  levelCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelCardInfo: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  levelCardDot: {
    color: '#FFFFFF',
    opacity: 0.8,
  },
  levelCardBookmark: {
    margin: 0,
    backgroundColor: '#6c47ff',
    borderRadius: 20,
  },
}); 