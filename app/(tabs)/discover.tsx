import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SectionList,
  ImageSourcePropType,
  Pressable,
  Animated,
  LayoutChangeEvent,
  SectionListProps,
  ViewToken,
  Easing,
  ScrollView,
} from 'react-native';
import { Text, Chip, IconButton, Surface, ActivityIndicator } from 'react-native-paper';
import { COLORS, SPACING, HEADER_HEIGHT } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import supabase, { supabaseUrl } from '../services/supabase';
import { useRouter } from 'expo-router';
import { GeneralHeader } from '../components/GeneralHeader';
import OptimizedImage from '../components/OptimizedImage';
import { markAsImportantImage } from '../utils/imagePreloader';
import { strategicPreloadImages, PreloadStrategy } from '../utils/imagePreloader';
import useIntelligentPreloader from '../hooks/useIntelligentPreloader';

// Heights
const FILTER_HEIGHT = 48;
const CATEGORY_HEIGHT = 46;
const CARD_HEIGHT = 200; // Height of workout card
const SECTION_HEADER_HEIGHT = 30; // Approx height of section headers

// Create an animated version of SectionList with proper type
const AnimatedSectionList =
  Animated.createAnimatedComponent<
    React.ComponentType<SectionListProps<WorkoutProgram, { title: string; data: WorkoutProgram[] }>>
  >(SectionList);

// Filter data
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
    ],
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
    ],
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
    ],
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
    ],
  },
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
const WorkoutCard = React.memo(
  ({ id, title, subtitle, image, accent, category }: WorkoutProgram) => {
    const router = useRouter();

    const handlePress = () => {
      // Preload the plans screen and mark the current image as important before navigation
      if (typeof image === 'string') {
        markAsImportantImage(image);
      } else if (image && typeof image === 'object' && 'uri' in image) {
        const uri = (image as { uri: string }).uri;
        if (uri) markAsImportantImage(uri);
      }

      router.push({
        pathname: 'plans',
        params: {
          subcategoryId: id,
          title,
          accent,
          subcategoryName: title,
          subcategoryTitle: title,
          subcategorySubtitle: subtitle,
          categoryName: category,
        },
      });
    };

    return (
      <Pressable onPress={handlePress}>
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardContentContainer}>
            <View style={styles.cardImageContainer}>
              <OptimizedImage
                source={
                  typeof image === 'string'
                    ? { uri: image }
                    : typeof image === 'object' &&
                        image &&
                        'uri' in image &&
                        typeof image.uri === 'string'
                      ? { uri: image.uri }
                      : require('../../assets/exercises/fullbody.jpg')
                }
                style={[styles.cardImageContainer, styles.cardImage]}
                resizeMode="cover"
                priority="high"
                cachePolicy="immutable"
                isImportant={true}
                debugLabel={`DiscoverCard-${id}`}
                fallback={require('../../assets/exercises/fullbody.jpg')}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
                style={styles.cardGradient}
              />
              <View style={styles.cardContent}>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: accent }]}>{title}</Text>
                  <Text variant="bodyMedium" style={styles.cardSubtitle}>
                    {subtitle}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Surface>
      </Pressable>
    );
  },
);

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
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<string[]>([]);
  const [sections, setSections] = useState<Array<{ title: string; data: WorkoutProgram[] }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const sectionListRef =
    useRef<SectionList<WorkoutProgram, { title: string; data: WorkoutProgram[] }>>(null);
  const filterScrollRef = useRef<ScrollView>(null);

  // Image preloading state
  const [imageUrlsToPreload, setImageUrlsToPreload] = useState<string[]>([]);

  // Use intelligent preloader
  const preloader = useIntelligentPreloader(imageUrlsToPreload, {
    screenId: 'discover',
    enablePredictiveLoading: true,
    cacheManagement: 'balanced',
    debug: false,
  });

  // Handle viewability changes to load images intelligently
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    // Extract and preload images for items that just became visible
    const visibleImageUrls: string[] = [];
    viewableItems.forEach((viewableItem) => {
      const program = viewableItem.item as WorkoutProgram;
      if (program && program.image) {
        if (typeof program.image === 'string') {
          visibleImageUrls.push(program.image);
        } else if (typeof program.image === 'object' && program.image && 'uri' in program.image) {
          const uri = program.image.uri as string;
          if (uri) {
            visibleImageUrls.push(uri);
            // Mark as important for immediate loading
            markAsImportantImage(uri);
          }
        }
      }
    });

    // Preload visible images with high priority
    if (visibleImageUrls.length > 0) {
      strategicPreloadImages(visibleImageUrls, PreloadStrategy.CRITICAL);
    }
  }).current;

  // Add a new ref to track section indices and offsets
  const sectionIndexesRef = useRef<{
    [key: string]: { index: number; height: number; offset: number };
  }>({});

  // Configure viewability
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 30, // Item is considered visible when 30% of it is visible
    minimumViewTime: 300, // Item needs to be visible for at least 300ms
  };

  // Active filters state
  const [activeFilters, setActiveFilters] = useState<{ [key: string]: string[] }>({
    equipment: [],
    muscles: [],
    duration: [],
    type: [],
  });

  // Track scroll position using the Animated.Value
  const scrollY = useRef(new Animated.Value(0)).current;
  const lastScrollValue = useRef(0);

  // Calculate heights with new header structure
  const filterHeaderH = FILTER_HEIGHT;
  const categoryBarTop = insets.top + HEADER_HEIGHT + filterHeaderH;

  // Use scroll listener to update current section
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      // Calculate the threshold position where the category bar is located
      // Add header height to get the bottom edge of the category bar
      const categoryBarThreshold = CATEGORY_HEIGHT + 10; // Adding offset to trigger earlier

      // Determine scroll direction for transition bias
      const isScrollingDown = value > lastScrollValue.current;
      lastScrollValue.current = value;

      // Find which section header is closest to the category bar threshold
      let newSectionTitle = '';

      // For optimal transitions, we want to:
      // - When scrolling down: trigger before the section header reaches the bar
      // - When scrolling up: trigger when the section header is approaching the bar
      Object.entries(sectionIndexesRef.current).forEach(([title, info]) => {
        // Calculate how far the section top is from our trigger point
        // We adjust this value to trigger the transition earlier
        const sectionPosition = info.offset - value;

        // Add an early trigger offset (pixels before actually reaching the bar)
        const earlyTriggerOffset = 50; // Pixels before the bar to trigger change
        const adjustedPosition = sectionPosition - earlyTriggerOffset;

        if (isScrollingDown) {
          // When scrolling down, trigger when section is approaching but before reaching the bar
          // This makes the text change earlier than before
          if (adjustedPosition <= categoryBarThreshold && adjustedPosition > -info.height) {
            newSectionTitle = title;
          }
        } else {
          // When scrolling up, be more sensitive to approaching sections
          if (
            sectionPosition < categoryBarThreshold + earlyTriggerOffset &&
            sectionPosition > -info.height / 2
          ) {
            newSectionTitle = title;
          }
        }
      });

      // Only update if we found a section and it's different from current
      if (newSectionTitle && newSectionTitle !== currentSection) {
        // Prepare animation based on scroll direction
        fadeAnim.setValue(0);
        slideAnim.setValue(isScrollingDown ? 20 : -20); // Move from bottom or top

        // Update section title
        setCurrentSection(newSectionTitle);

        // Animate the transition
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180, // Even faster animation for responsiveness
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
        ]).start();
      }
    });

    return () => {
      scrollY.removeListener(listener);
    };
  }, [scrollY, currentSection, categoryBarTop, fadeAnim, slideAnim]);

  // Define a constant item layout to improve SectionList performance
  const getItemLayout = (
    data: Array<{ title: string; data: WorkoutProgram[] }> | null,
    index: number,
  ) => {
    // Fixed height for items simplifies calculations and improves performance
    const itemHeight = CARD_HEIGHT + 6 + 16; // Card height + margin + padding
    return {
      length: itemHeight,
      offset: itemHeight * index,
      index,
    };
  };

  // Update section indexes when sections change
  useEffect(() => {
    if (sections.length > 0) {
      // Calculate section offsets and indexes
      let currentOffset = CATEGORY_HEIGHT; // Start after the initial padding
      const newSectionIndexes: typeof sectionIndexesRef.current = {};

      sections.forEach((section, index) => {
        const sectionHeight = section.data.length * (CARD_HEIGHT + 6 + 16) + SECTION_HEADER_HEIGHT;
        newSectionIndexes[section.title] = {
          index,
          height: sectionHeight,
          offset: currentOffset,
        };
        currentOffset += sectionHeight;
      });

      sectionIndexesRef.current = newSectionIndexes;

      // Initialize current section if not set
      if (!currentSection && sections.length > 0) {
        setCurrentSection(sections[0].title);
      }
    }
  }, [sections, currentSection]);

  // Fetch workout categories and subcategories from Supabase
  useEffect(() => {
    async function fetchData() {
      try {
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

        // Fetch workout subcategories
        const { data: subcategoriesData, error: subcategoriesError } = await supabase
          .from('workout_subcategories')
          .select('*')
          .order('display_order', { ascending: true });

        if (subcategoriesError) {
          console.error('Error fetching subcategories:', subcategoriesError);
          return;
        }

        // Map the data to our required format
        const categoryNames = (categoriesData as WorkoutCategory[]).map(
          (category) => category.name,
        );
        setCategories(categoryNames);

        // Initialize the current section if we have categories
        if (categoryNames.length > 0) {
          setCurrentSection(categoryNames[0]);
        }

        // Process the workout programs
        const mappedPrograms: WorkoutProgram[] = (subcategoriesData as WorkoutSubcategory[]).map(
          (subcat) => {
            // Find the category name for this subcategory using the category_identifier
            const category = (categoriesData as WorkoutCategory[]).find(
              (cat) => cat.identifier === subcat.category_identifier,
            );
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
                // Use the Supabase URL format for storage with cache control
                const cacheVersion = '1.0';
                const storageUrl = `${supabaseUrl}/storage/v1/object/public/images/${subcat.image_url}?v=${cacheVersion}`;
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
          },
        );

        // Extract image URLs for intelligent preloading
        const urls: string[] = [];
        mappedPrograms.forEach((program) => {
          if (typeof program.image === 'string') {
            urls.push(program.image);
          } else if (program.image && typeof program.image === 'object' && 'uri' in program.image) {
            const uri = program.image.uri as string | undefined;
            if (typeof uri === 'string') {
              urls.push(uri);
            }
          }
        });

        // Set URLs for intelligent preloader
        setImageUrlsToPreload(urls);

        // Preload first batch of visible images immediately with high priority
        const initialVisibleImages = urls.slice(0, 8); // First 8 images likely to be visible
        if (initialVisibleImages.length > 0) {
          strategicPreloadImages(initialVisibleImages, PreloadStrategy.CRITICAL);
        }

        // Create sections for the SectionList
        const formattedSections = categoryNames.map((categoryName) => ({
          title: categoryName,
          data: mappedPrograms.filter((program) => program.category === categoryName),
        }));

        setSections(formattedSections);

        setIsLoading(false);

        // Prefetch plans and exercise-details screens as they're likely to be visited next
        preloader.predictiveLoadForScreens(['plans', 'exercises-list']);
      } catch (error) {
        console.error('Error fetching data:', error);
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Function to render section headers - hide the first one
  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string; data: WorkoutProgram[] };
  }) => {
    if (categories.length > 0 && section.title === categories[0]) {
      return <View style={{ height: 0, opacity: 0 }} />;
    }
    return (
      <View
        style={styles.sectionHeader}
        onLayout={(event: LayoutChangeEvent) => {
          // Update section height when rendered
          const { height } = event.nativeEvent.layout;
          sectionIndexesRef.current[section.title] = {
            index: section.data.length - 1,
            height: height,
            offset: section.data.length * (CARD_HEIGHT + 6 + 16) + SECTION_HEADER_HEIGHT,
          };
        }}
      >
        <Text style={styles.sectionHeaderText}>{section.title}</Text>
      </View>
    );
  };

  // Memoize renderItem to prevent unnecessary recreation
  const renderItem = useCallback(
    ({ item }: { item: WorkoutProgram }) => (
      <View style={styles.programItem}>
        <WorkoutCard {...item} />
      </View>
    ),
    [],
  );

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
            <IconButton icon="crown" iconColor="#f9e009" size={26} style={styles.premiumIcon} />
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
            {filterCategories.map((category) => {
              const isActive = activeFilters[category.id].includes(category.id);
              const count = category.options.length;

              return (
                <Chip
                  key={category.id}
                  style={[styles.chip, isActive && styles.activeChip]}
                  textStyle={styles.chipText}
                  onPress={() => {
                    if (isActive) {
                      setActiveFilters((prev) => ({
                        ...prev,
                        [category.id]: prev[category.id].filter((id) => id !== category.id),
                      }));
                    } else {
                      setActiveFilters((prev) => ({
                        ...prev,
                        [category.id]: [...prev[category.id], category.id],
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
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
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
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: CATEGORY_HEIGHT,
          paddingBottom: insets.bottom + SPACING.md + 60, // Added extra padding for bottom tab bar
        }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}
