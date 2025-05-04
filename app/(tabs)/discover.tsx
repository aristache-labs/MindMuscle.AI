import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, SectionList, ImageSourcePropType, Pressable, SectionListRenderItemInfo, SectionListData, Animated, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, SectionListProps, ViewToken, findNodeHandle, Easing, ScrollView } from 'react-native';
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
const CARD_HEIGHT = 160; // Height of workout card
const SECTION_HEADER_HEIGHT = 30; // Approx height of section headers
const CATEGORY_TRANSITION_THRESHOLD = 60; // Threshold in pixels when scrolling to trigger category change

// Create an animated version of SectionList with proper type
const AnimatedSectionList = Animated.createAnimatedComponent<React.ComponentType<SectionListProps<WorkoutProgram, {title: string, data: WorkoutProgram[]}>>>(SectionList);

// Filter data
interface FilterOption {
  id: string;
  label: string;
  count?: number;
}

const filterCategories = [
  {
    id: 'equipment',
    name: 'Equipment',
    options: [
      { id: 'eq-1', label: 'Bodyweight', count: 45 },
      { id: 'eq-2', label: 'Dumbbells', count: 64 },
      { id: 'eq-3', label: 'Barbell', count: 38 },
      { id: 'eq-4', label: 'Kettlebell', count: 22 },
      { id: 'eq-5', label: 'Resistance Band', count: 15 },
    ]
  },
  {
    id: 'muscles',
    name: 'Muscles',
    options: [
      { id: 'mu-1', label: 'Chest', count: 16 },
      { id: 'mu-2', label: 'Back', count: 24 },
      { id: 'mu-3', label: 'Arms', count: 26 },
      { id: 'mu-4', label: 'Legs', count: 28 },
      { id: 'mu-5', label: 'Core', count: 18 },
    ]
  },
  {
    id: 'duration',
    name: 'Workout Duration',
    options: [
      { id: 'du-1', label: '15-30 Min' },
      { id: 'du-2', label: '30-45 Min' },
      { id: 'du-3', label: '45-60 Min' },
      { id: 'du-4', label: '60-75 Min' },
      { id: 'du-5', label: '75-90 Min' },
    ]
  },
  {
    id: 'type',
    name: 'Exercise Type',
    options: [
      { id: 'ty-1', label: 'Strength', count: 75 },
      { id: 'ty-2', label: 'Cardio', count: 32 },
      { id: 'ty-3', label: 'Flexibility', count: 18 },
      { id: 'ty-4', label: 'HIIT', count: 25 },
      { id: 'ty-5', label: 'Calisthenics', count: 20 },
    ]
  }
];

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
  {
    id: '1-4',
    title: 'BEGINNER FRIENDLY',
    subtitle: 'Full Body Workout',
    image: require('../../assets/exercises/squat.jpg'),
    category: '1 Day a Week',
    accent: '#ffeb3b', // Yellow accent
  },
  {
    id: '1-5',
    title: 'BUSY LIFESTYLE',
    subtitle: 'Time-Efficient Full Body',
    image: require('../../assets/exercises/yoga.jpg'),
    category: '1 Day a Week',
    accent: '#4178ff', // Blue accent
  },
  {
    id: '1-6',
    title: 'MAINTAIN MUSCLE',
    subtitle: 'Maintenance Workout',
    image: require('../../assets/exercises/dumbbell.jpg'),
    category: '1 Day a Week',
    accent: '#aa00ff', // Purple accent
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
  {
    id: '2-4',
    title: 'UPPER/LOWER',
    subtitle: '2-Day Split',
    image: require('../../assets/exercises/pushup.jpg'),
    category: '2 Days a Week',
    accent: '#ff5252', // Red accent
  },
  {
    id: '2-5',
    title: 'PUSH/PULL',
    subtitle: '2-Day Split',
    image: require('../../assets/exercises/dumbbell.jpg'),
    category: '2 Days a Week',
    accent: '#00f7ff', // Teal accent
  },
  {
    id: '2-6',
    title: 'TOTAL WELLNESS',
    subtitle: 'Strength & Cardio',
    image: require('../../assets/exercises/yoga.jpg'),
    category: '2 Days a Week',
    accent: '#ff9100', // Orange accent
  },
  {
    id: '2-7',
    title: 'WEEKEND WARRIOR',
    subtitle: 'Weekend-Only Split',
    image: require('../../assets/exercises/fullbody.jpg'),
    category: '2 Days a Week',
    accent: '#aa00ff', // Purple accent
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
const sections: Array<{title: string, data: WorkoutProgram[]}> = categories.map(category => ({
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
    paddingHorizontal: 0,
  },
  filterScroll: {
    flexDirection: 'row',
    flex: 1,
  },
  filterScrollContent: {
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    height: '100%',
  },
  chip: {
    backgroundColor: '#272A33',
    borderRadius: 20,
    marginRight: 8,
    height: 30,
  },
  activeChip: {
    backgroundColor: '#373A43',
  },
  chipText: {
    color: COLORS.text,
    fontSize: 13,
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
});

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [currentSection, setCurrentSection] = useState(categories[0]);
  const [nextSection, setNextSection] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sectionListRef = useRef<any>(null);
  const filterScrollRef = useRef<ScrollView>(null);
  
  // Active filters state
  const [activeFilters, setActiveFilters] = useState<{[key: string]: string[]}>({
    equipment: [],
    muscles: [],
    duration: [],
    type: []
  });
  
  // Selected filter category
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('equipment');
  
  // Track scroll position using the Animated.Value
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Simplified approach: Store section heights and calculate current section based on scroll
  const [sectionHeights, setSectionHeights] = useState<{[key: string]: number}>({});
  const [sectionOffsets, setSectionOffsets] = useState<{[key: string]: number}>({});
  const sectionMeasured = useRef(false);
  
  // Calculate heights
  const headerTop = insets.top;
  const mainHeaderH = HEADER_HEIGHT;
  const filterHeaderH = FILTER_HEIGHT;
  const totalHeaderH = headerTop + mainHeaderH + filterHeaderH;
  const categoryBarTop = totalHeaderH;
  
  // Handle scroll to determine current section
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: ({ nativeEvent: { contentOffset: { y } } }: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!sectionMeasured.current) return;
        
        // Add CATEGORY_HEIGHT to align the "zero" of scroll position with the bottom of the category bar (green line)
        const triggerY = y;
        
        // Determine which section we're in based on the scroll position
        let activeSection = categories[0];
        
        for (const category of categories) {
          const sectionTop = sectionOffsets[category] || 0;
          if (triggerY >= sectionTop) {
            activeSection = category;
          } else {
            // We've gone past the current section, so the previous one is active
            break;
          }
        }
        
        if (activeSection !== currentSection && activeSection !== nextSection) {
          setNextSection(activeSection);
        }
      }
    }
  );
  
  // Toggle a filter selection
  const toggleFilter = (categoryId: string, optionId: string) => {
    setActiveFilters(prev => {
      const currentSelection = [...prev[categoryId]];
      const index = currentSelection.indexOf(optionId);
      
      if (index === -1) {
        currentSelection.push(optionId);
      } else {
        currentSelection.splice(index, 1);
      }
      
      return {
        ...prev,
        [categoryId]: currentSelection
      };
    });
  };
  
  // Calculate section heights and offsets after render
  useEffect(() => {
    // This runs after layout and gives time for the list to render
    const timer = setTimeout(() => {
      let cumulativeHeight = 0;
      const tempOffsets: {[key: string]: number} = {};
      
      // Process sections in order
      categories.forEach((category, index) => {
        // Compute the offset at which this section should become active
        // Subtract CATEGORY_HEIGHT so the section activates when it crosses the green line
        tempOffsets[category] = cumulativeHeight + CATEGORY_HEIGHT;
        
        // Get the height of this section's header
        const headerHeight = SECTION_HEADER_HEIGHT;
        
        // Get the total height of items in this section
        const items = workoutPrograms.filter(p => p.category === category);
        // Use the actual 6px margin
        const itemsHeight = items.length * (CARD_HEIGHT + 6);
        
        // Add this section's height to the cumulative total
        cumulativeHeight += headerHeight + itemsHeight;
      });
      
      setSectionOffsets(tempOffsets);
      sectionMeasured.current = true;
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Preload all workout program images
  const imagesToPreload = workoutPrograms.map(program => program.image);
  const { loaded: imagesPreloaded } = useImagePreloader(imagesToPreload);

  // Function to render section headers - hide the first one
  const renderSectionHeader = ({ section }: { section: {title: string, data: WorkoutProgram[]} }) => {
    if (section.title === categories[0]) {
      return <View style={{ height: 0, opacity: 0 }} />;
    }
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  };

  // Animate text change with spring and easing for smoother transitions
  useEffect(() => {
    if (nextSection && nextSection !== currentSection) {
      // Slide out current text and fade it out with easing
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ]).start(() => {
        // Update current section
        setCurrentSection(nextSection);
        
        // Reset slide position for new text
        slideAnim.setValue(20);
        
        // Slide in new text with spring and fade in with easing
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          })
        ]).start();
      });
    }
  }, [nextSection, currentSection, fadeAnim, slideAnim]);

  const renderFilterChips = () => {
    return filterCategories.map(category => {
      const isActive = selectedFilterCategory === category.id;
      const count = category.options.length;
      
      return (
        <Chip 
          key={category.id}
          style={[styles.chip, isActive && styles.activeChip]} 
          textStyle={styles.chipText}
          onPress={() => setSelectedFilterCategory(category.id)}
        >
          {category.name} ({count}) {isActive ? '▾' : ''}
        </Chip>
      );
    });
  };

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
          <ScrollView 
            ref={filterScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
            style={styles.filterScroll}
          >
            {renderFilterChips()}
          </ScrollView>
        </View>
      </View>
      
      {/* 2) Floating category bar */}
      <View style={[styles.categoryBar, { top: categoryBarTop }]}>
        <Animated.Text 
          style={[
            styles.categoryText,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }] 
            }
          ]}
        >
          {currentSection}
        </Animated.Text>
      </View>
      
      {/* 3) Scrollable list */}
      <AnimatedSectionList
        ref={sectionListRef}
        style={{ flex: 1 }}
        sections={sections}
        keyExtractor={(item: WorkoutProgram) => item.id}
        renderItem={({ item }: { item: WorkoutProgram }) => (
          <View style={styles.programItem}>
            <WorkoutCard {...item} />
          </View>
        )}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: CATEGORY_HEIGHT,
          paddingBottom: insets.bottom + SPACING.md + 60, // Added extra padding for bottom tab bar
        }}
      />
    </View>
  );
} 