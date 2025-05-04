import React, { useRef, useState } from 'react';
import { StyleSheet, View, SectionList, ImageSourcePropType, Pressable, SectionListRenderItemInfo, SectionListData } from 'react-native';
import { Text, Chip, IconButton, Surface, Divider } from 'react-native-paper';
import { COLORS, SPACING, HEADER_HEIGHT } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import OptimizedImage from '../components/OptimizedImage';
import { useImagePreloader } from '../hooks/useImagePreloader';
import { LinearGradient } from 'expo-linear-gradient';

// Heights
const FILTER_HEIGHT = 48;
const CATEGORY_HEIGHT = 46;

interface WorkoutProgram {
  id: string;
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  category: string;
  accent: string;
}

// Workout program data organized by frequency categories
const workoutPrograms: WorkoutProgram[] = [
  // 1 Day a Week
  {
    id: '1-1',
    title: 'GET IN SHAPE',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/fullbody.jpg'),
    category: '1 Day a Week',
    accent: '#9eff00', // Green accent
  },
  {
    id: '1-2',
    title: 'GET LEAN',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/dumbbell.jpg'),
    category: '1 Day a Week',
    accent: '#00f7ff', // Teal accent
  },
  {
    id: '1-3',
    title: 'OVERALL FITNESS',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/pushup.jpg'),
    category: '1 Day a Week',
    accent: '#ff5252', // Red accent
  },
  
  // 2 Days a Week
  {
    id: '2-1',
    title: 'BUILD STRENGTH',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/squat.jpg'),
    category: '2 Days a Week',
    accent: '#00ff7f', // Green accent
  },
  {
    id: '2-2',
    title: 'GET IN SHAPE',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/yoga.jpg'),
    category: '2 Days a Week',
    accent: '#9eff00', // Green accent
  },
  {
    id: '2-3',
    title: 'LOSE WEIGHT',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/fullbody.jpg'),
    category: '2 Days a Week',
    accent: '#4178ff', // Blue accent
  },
  
  // 3 Days a Week
  {
    id: '3-1',
    title: 'BUILD STRENGTH',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/dumbbell.jpg'),
    category: '3 Days a Week',
    accent: '#00ff7f', // Green accent
  },
  {
    id: '3-2',
    title: 'GET IN SHAPE',
    subtitle: 'Full Body Split',
    image: require('../../assets/exercises/squat.jpg'),
    category: '3 Days a Week',
    accent: '#9eff00', // Green accent
  },
  
  // 4 Days a Week
  {
    id: '4-1',
    title: 'MUSCLE BUILDING',
    subtitle: 'Upper/Lower Split',
    image: require('../../assets/exercises/fullbody.jpg'),
    category: '4 Days a Week',
    accent: '#ff9100', // Orange accent
  },
  
  // 5 Days a Week
  {
    id: '5-1',
    title: 'PROGRESSIVE OVERLOAD',
    subtitle: 'Push/Pull/Legs',
    image: require('../../assets/exercises/pushup.jpg'),
    category: '5 Days a Week',
    accent: '#ffeb3b', // Yellow accent
  },
  
  // 6 Days a Week
  {
    id: '6-1',
    title: 'BODYBUILDING',
    subtitle: 'Arnold Split',
    image: require('../../assets/exercises/dumbbell.jpg'),
    category: '6 Days a Week',
    accent: '#aa00ff', // Purple accent
  },
  
  // 7 Days a Week
  {
    id: '7-1',
    title: 'ELITE PHYSIQUE',
    subtitle: 'Daily Training Split',
    image: require('../../assets/exercises/yoga.jpg'),
    category: '7 Days a Week',
    accent: '#ff0055', // Pink accent
  },
];

// Extract unique categories
const categories = Array.from(new Set(workoutPrograms.map(program => program.category)));

// Format data for SectionList
const sections = categories.map(category => ({
  title: category,
  data: workoutPrograms.filter(program => program.category === category)
}));

// Workout card component
const WorkoutCard = ({ title, subtitle, image, accent }: WorkoutProgram) => {
  return (
    <Surface style={styles.card} elevation={2}>
      <View style={styles.cardContentContainer}>
        <View style={styles.cardImageContainer}>
          <OptimizedImage 
            source={image}
            style={styles.cardImageContainer}
            imageStyle={styles.cardImage}
            contentFit="cover"
          />
          <View style={styles.cardContent}>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: accent }]}>{title}</Text>
              <Text variant="bodyMedium" style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
          </View>
        </View>
      </View>
    </Surface>
  );
};

// Define base styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: COLORS.background,
  },
  mainHeader: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  headerTitle: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  divider: {
    height: 0.2,
    backgroundColor: COLORS.primary, // Purple color
  },
  filterBar: {
    height: FILTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  categoryBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CATEGORY_HEIGHT,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    zIndex: 25,
    elevation: 25,
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  programItem: {
    paddingHorizontal: 16,
    marginTop: 6,
  },
  sectionHeader: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'center',
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  sectionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '100%',
  },
  sectionIcon: {
    marginRight: 4, 
  },
  card: {
    height: 160,
    borderRadius: 16,
    backgroundColor: 'transparent',
    marginBottom: 6, // Further reduced from 8 to 6
  },
  cardContentContainer: {
    flex: 1,
    borderRadius: 16,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardInfo: {
    flexDirection: 'column',
  },
  cardTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    textTransform: 'uppercase',
  },
  cardSubtitle: {
    color: 'white',
    opacity: 0.85,
  },
  premiumIcon: {
    margin: 0,
  },
  premiumText: {
    color: '#f9e009',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -8,
  },
  premiumIconColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  chip: {
    backgroundColor: '#272A33',
    borderRadius: 20,
    marginRight: 8,
    height: 30,
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
  },
});

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [currentSection, setCurrentSection] = useState(categories[0]);
  
  // Preload all workout program images
  const imagesToPreload = workoutPrograms.map(program => program.image);
  const { loaded: imagesPreloaded } = useImagePreloader(imagesToPreload);

  // Track the current visible section
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<any> }) => {
    if (viewableItems.length > 0) {
      const firstItem = viewableItems[0];
      if (firstItem.section && firstItem.section.title) {
        setCurrentSection(firstItem.section.title);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  // Calculate positions
  const headerTop = insets.top;
  const mainHeaderH = HEADER_HEIGHT;
  const filterHeaderH = FILTER_HEIGHT;
  const totalHeaderH = headerTop + mainHeaderH + filterHeaderH;
  const categoryBarTop = totalHeaderH;

  return (
    <View style={[styles.container, { paddingTop: totalHeaderH }]}>
      <StatusBar style="light" />
      
      {/* 1) Custom top header with filters */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <View style={styles.mainHeader}>
          <MaterialCommunityIcons name="compass" size={24} color={COLORS.text} />
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={styles.premiumIconColumn}>
            <IconButton
              icon="crown"
              iconColor="#f9e009"
              size={26}
              style={styles.premiumIcon}
            />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        </View>
        
        {/* Purple divider above filters */}
        <Divider style={styles.divider} />
        
        <View style={styles.filterBar}>
          <Chip 
            style={styles.chip} 
            textStyle={styles.chipText}
            onPress={() => {}}
          >
            Equipment (64) ▾
          </Chip>
          <Chip 
            style={styles.chip} 
            textStyle={styles.chipText}
            onPress={() => {}}
          >
            Muscles (16) ▾
          </Chip>
          <Chip 
            style={styles.chip} 
            textStyle={styles.chipText}
            onPress={() => {}}
          >
            75-90 Min ▾
          </Chip>
        </View>
      </View>
      
      {/* 2) Floating category bar */}
      <View style={[styles.categoryBar, { top: categoryBarTop }]}>
        <Text style={styles.categoryText}>{currentSection}</Text>
      </View>
      
      {/* 3) Scrollable list */}
      <SectionList
        style={{ flex: 1, marginTop: CATEGORY_HEIGHT }}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.programItem}>
            <WorkoutCard {...item} />
          </View>
        )}
        renderSectionHeader={({ section }: { section: SectionListData<WorkoutProgram> }) => {
          // Skip rendering the header for the first section ("1 Day a Week")
          if (section.title === '1 Day a Week') return null;
          
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          );
        }}
        stickySectionHeadersEnabled={false} // Don't make these headers sticky
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + SPACING.md,
        }}
      />
    </View>
  );
} 