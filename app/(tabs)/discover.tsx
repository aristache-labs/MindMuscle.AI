import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, SectionList, ImageSourcePropType, Pressable, SectionListRenderItemInfo, SectionListData, Animated, NativeSyntheticEvent, NativeScrollEvent, LayoutChangeEvent, SectionListProps, ViewToken, findNodeHandle, Easing, ScrollView } from 'react-native';
import { Text, Chip, IconButton, Surface, Divider, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, HEADER_HEIGHT, BORDER_RADIUS } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from '../components/OptimizedImage';
import { LinearGradient } from 'expo-linear-gradient';
import supabase, { supabaseUrl } from '../services/supabase';
import { useRouter } from 'expo-router';
import { GeneralHeader } from '../components/GeneralHeader';
import { markAsImportantImage } from '../utils/imagePreloader';
import loadTimeTracker from '../utils/loadTimeTracker';

// Add debug tracking for discover screen - add after imports
const DEBUG_NAVIGATION = true;

// Heights
const FILTER_HEIGHT = 48;
const CATEGORY_HEIGHT = 46;
const CARD_HEIGHT = 200; // Height of workout card
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

// Interfaces for Supabase data
interface WorkoutCategory {
  id: string;
  name: string;
  display_order: number;
  identifier: string;
}

interface WorkoutSubcategory {
  id: string;
  category_id: string;
  category_identifier: string;
  title: string;
  subtitle: string;
  accent_color: string;
  image_url: string;
  display_order: number;
  identifier: string;
}

interface WorkoutProgram {
  id: string;
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  category: string;
  accent: string;
}

// Workout card component
const WorkoutCard = ({ id, title, subtitle, image, accent, category }: WorkoutProgram) => {
  const router = useRouter();
  
  // Add this at the start of the component to mark images as important
  useEffect(() => {
    try {
      // If image is a string URL, mark it as important
      if (typeof image === 'string') {
        if (DEBUG_NAVIGATION) console.log(`🔒 Marking workout card image as important: ${id}`);
        markAsImportantImage(image);
      } else if (image && typeof image === 'object') {
        // Try to safely extract URI if it exists
        const imgObj = image as any;
        if (imgObj.uri) {
          if (DEBUG_NAVIGATION) console.log(`🔒 Marking workout card image URI as important: ${id}`);
          markAsImportantImage(imgObj.uri);
        }
      }
    } catch (err) {
      console.warn('Error marking image as important:', err);
    }
  }, [image, id]);
  
  const handlePress = () => {
    if (DEBUG_NAVIGATION) {
      console.log(`🔀 NAVIGATION: Navigating from discover to plans with subcategoryId=${id}`);
      console.log(`🖼️ IMAGE DATA: Navigating with image data`, image);
    }
    
    router.push({
      pathname: "plans",
      params: {
        subcategoryId: id,
        title,
        accent,
        subcategoryName: title,
        subcategoryTitle: title,
        subcategorySubtitle: subtitle,
        categoryName: category
      }
    });
  };
  
  return (
    <Pressable onPress={handlePress}>
      <Surface style={styles.card} elevation={2}>
        <View style={styles.cardContentContainer}>
          <View style={styles.cardImageContainer}>
            <OptimizedImage 
              source={typeof image === 'string' ? { uri: image } : image as any}
              style={[styles.cardImageContainer, styles.cardImage]}
              contentFit="cover"
              debugLabel={`workout-card-${id}`}
              priority="high"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
              style={styles.cardGradient}
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
    </Pressable>
  );
};

// Define base styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: COLORS.background,
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
    zIndex: 15,
    elevation: 15,
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
    height: 200,
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
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
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
    marginTop: -10,
  },
  premiumIconColumn: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<string[]>([]);
  const [workoutPrograms, setWorkoutPrograms] = useState<WorkoutProgram[]>([]);
  const [sections, setSections] = useState<Array<{title: string, data: WorkoutProgram[]}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState('');
  const [nextSection, setNextSection] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sectionListRef = useRef<any>(null);
  const filterScrollRef = useRef<ScrollView>(null);
  
  // For performance tracking - add this right after the component starts
  useEffect(() => {
    loadTimeTracker.startLoadTimeTracking('DiscoverScreen');
    return () => {
      loadTimeTracker.endLoadTimeTracking('DiscoverScreen');
    };
  }, []);

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
  
  // Calculate heights with new header structure
  const filterHeaderH = FILTER_HEIGHT;
  const totalHeaderH = HEADER_HEIGHT + filterHeaderH;
  const categoryBarTop = insets.top + HEADER_HEIGHT + filterHeaderH;

  // Fetch workout categories and subcategories from Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        loadTimeTracker.markLoadTime('DiscoverScreen', 'fetchData started');
        setIsLoading(true);
        
        // Fetch workout categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('workout_categories')
          .select('*')
          .order('display_order', { ascending: true });

        if (categoriesError) {
          console.error('Error fetching categories:', categoriesError);
          return;
        }

        loadTimeTracker.markLoadTime('DiscoverScreen', 'Categories fetched');

        // Fetch workout subcategories
        const { data: subcategoriesData, error: subcategoriesError } = await supabase
          .from('workout_subcategories')
          .select('*')
          .order('display_order', { ascending: true });

        if (subcategoriesError) {
          console.error('Error fetching subcategories:', subcategoriesError);
          return;
        }

        loadTimeTracker.markLoadTime('DiscoverScreen', 'Subcategories fetched');

        // Map the data to our required format
        const categoryNames = (categoriesData as WorkoutCategory[]).map(category => category.name);
        setCategories(categoryNames);

        // Initialize the current section if we have categories
        if (categoryNames.length > 0) {
          setCurrentSection(categoryNames[0]);
        }

        // Process the workout programs
        const mappedPrograms: WorkoutProgram[] = (subcategoriesData as WorkoutSubcategory[]).map(subcat => {
          // Find the category name for this subcategory using the category_identifier
          const category = (categoriesData as WorkoutCategory[]).find(cat => cat.identifier === subcat.category_identifier);
          const categoryName = category ? category.name : '';

          // Map the image URL to the correct asset
          const imageMap: { [key: string]: ImageSourcePropType } = {
            'fullbody.jpg': require('../../assets/exercises/fullbody.jpg'),
            'dumbbell.jpg': require('../../assets/exercises/dumbbell.jpg'),
            'pushup.jpg': require('../../assets/exercises/pushup.jpg'),
            'squat.jpg': require('../../assets/exercises/squat.jpg'),
            'yoga.jpg': require('../../assets/exercises/yoga.jpg'),
          };

          // Handle image URL
          let imageSource: ImageSourcePropType;
          
          if (subcat.image_url) {
            // If it's a full URL, use it directly
            if (subcat.image_url.startsWith('http')) {
              imageSource = { uri: subcat.image_url };
            }
            // If it's a key in our image map, use the corresponding require()
            else if (imageMap[subcat.image_url]) {
              imageSource = imageMap[subcat.image_url];
            }
            // Otherwise, assume it's in Supabase storage
            else {
              // Use the Supabase URL format for storage
              const storageUrl = `${supabaseUrl}/storage/v1/object/public/images/${subcat.image_url}`;
              imageSource = { uri: storageUrl };
            }
          } else {
            // Default fallback
            imageSource = require('../../assets/exercises/fullbody.jpg');
          }

          return {
            id: subcat.identifier, // Use identifier instead of UUID
            title: subcat.title,
            subtitle: subcat.subtitle,
            image: imageSource,
            category: categoryName,
            accent: subcat.accent_color,
          };
        });

        setWorkoutPrograms(mappedPrograms);

        // Create sections for the SectionList
        const formattedSections = categoryNames.map(categoryName => ({
          title: categoryName,
          data: mappedPrograms.filter(program => program.category === categoryName)
        }));

        setSections(formattedSections);
        
        // Add before setting isLoading to false
        loadTimeTracker.markLoadTime('DiscoverScreen', 'Data processing complete');
        
        setIsLoading(false);
        
        // Add this at the end of the successful data fetch
        setTimeout(() => {
          loadTimeTracker.markLoadTime('DiscoverScreen', 'UI fully rendered');
        }, 500);
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);
  
  // No need to use useImagePreloader as all images are already preloaded during splash screen
  const imagesPreloaded = true; // All images are already preloaded in SplashScreenManager

  // Function to render section headers - hide the first one
  const renderSectionHeader = ({ section }: { section: {title: string, data: WorkoutProgram[]} }) => {
    if (categories.length > 0 && section.title === categories[0]) {
      return <View style={{ height: 0, opacity: 0 }} />;
    }
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 16, color: COLORS.text }}>Loading workout programs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header with GeneralHeader component */}
      <GeneralHeader
        title="Discover"
        icon={<MaterialCommunityIcons name="compass" size={24} color={COLORS.text} />}
        rightElement={
          <View style={styles.premiumIconColumn}>
            <IconButton
              icon="crown"
              iconColor="#f9e009"
              size={26}
              style={styles.premiumIcon}
            />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        }
      />
        
      {/* Filter bar */}
      <View style={[styles.filterBarContainer, { top: insets.top + HEADER_HEIGHT }]}>

        <View style={styles.filterBar}>
          <ScrollView 
            ref={filterScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
            style={styles.filterScroll}
          >
            {filterCategories.map(category => {
              const isActive = activeFilters[category.id].includes(category.id);
              const count = category.options.length;
              
              return (
                <Chip 
                  key={category.id}
                  style={[styles.chip, isActive && styles.activeChip]} 
                  textStyle={styles.chipText}
                  onPress={() => {
                    if (isActive) {
                      setActiveFilters(prev => ({
                        ...prev,
                        [category.id]: prev[category.id].filter(id => id !== category.id)
                      }));
                    } else {
                      setActiveFilters(prev => ({
                        ...prev,
                        [category.id]: [...prev[category.id], category.id]
                      }));
                    }
                  }}
                >
                  {category.name} ({count}) {isActive ? '▾' : ''}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      </View>
      
      {/* Floating category bar */}
      <View style={[styles.categoryBar, { top: insets.top + HEADER_HEIGHT + FILTER_HEIGHT }]}>
        <Animated.Text 
          style={[
            styles.categoryText,
            { 
              opacity: currentSection ? 1 : 0,
              transform: [{ translateY: currentSection ? 0 : -20 }] 
            }
          ]}
        >
          {currentSection}
        </Animated.Text>
      </View>
      
      {/* 3) Scrollable list */}
      <AnimatedSectionList
        ref={sectionListRef}
        style={{ flex: 1, marginTop: insets.top + HEADER_HEIGHT + FILTER_HEIGHT }}
        sections={sections}
        keyExtractor={(item: WorkoutProgram) => item.id}
        renderItem={({ item }: { item: WorkoutProgram }) => (
          <View style={styles.programItem}>
            <WorkoutCard {...item} />
          </View>
        )}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
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