import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import workoutPlanService, { WorkoutPlan } from '../services/workoutPlanService';
import { MaterialIcons } from '@expo/vector-icons';
import OptimizedImage from '../components/OptimizedImage';
import { markAsImportantImage, batchPreloadImages, ImagePriority } from '../utils/imagePreloader';

const { width } = Dimensions.get('window');

export default function PlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const subcategoryId = params.subcategoryId as string;
  const title = params.title as string;
  const accent = params.accent as string;
  const subcategoryName = params.subcategoryName as string;
  const subcategoryTitle = params.subcategoryTitle as string;
  const subcategorySubtitle = params.subcategorySubtitle as string;
  const categoryName = params.categoryName as string;
  
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredPlan, setFeaturedPlan] = useState<WorkoutPlan | null>(null);
  const [imagesPreloaded, setImagesPreloaded] = useState(false);

  // Map for plan images based on the ones in assets/exercises
  const imageMap: { [key: string]: any } = {
    'placeholder.jpg': require('../../assets/exercises/placeholder.jpg'),
  };

  // Fetch workout plans
  useEffect(() => {
    async function fetchPlans() {
      try {
        setIsLoading(true);
        
        let fetchedPlans: WorkoutPlan[] = [];
        
        // Fetch plans by subcategory if available
        if (subcategoryId) {
          fetchedPlans = await workoutPlanService.getPlansBySubcategory(subcategoryId.toString());
        } else {
          // Fetch all plans as fallback
          fetchedPlans = await workoutPlanService.getAllPlans();
        }
        
        // Set featured plan (first one or null)
        if (fetchedPlans.length > 0) {
          setFeaturedPlan(fetchedPlans[0]);
        } else {
          setFeaturedPlan(null);
        }
        
        setPlans(fetchedPlans);
        setIsLoading(false);
        
        // Preload images to improve performance
        if (fetchedPlans.length > 0) {
          const imagesToPreload = fetchedPlans
            .map(plan => plan.image_url)
            .filter((url): url is string => {
              return !!url && typeof url === 'string' && url.startsWith('http');
            });
          
          if (imagesToPreload.length > 0) {
            // Mark featured plan image as important for immediate display
            if (fetchedPlans[0]?.image_url && typeof fetchedPlans[0].image_url === 'string') {
              markAsImportantImage(fetchedPlans[0].image_url);
            }
            
            // Batch preload other images
            batchPreloadImages(
              imagesToPreload, 
              ImagePriority.HIGH, 
              5,
              (progress) => {
                if (progress === 1) {
                  setImagesPreloaded(true);
                }
              }
            );
          }
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
        setPlans([]);
        setFeaturedPlan(null);
        setIsLoading(false);
      }
    }

    fetchPlans();
  }, [subcategoryId]);

  const handleBackPress = () => {
    // Check if we have subcategoryId and send back to discover with that subcategory
    if (subcategoryId) {
      router.push({
        pathname: '/discover',
        params: { 
          subcategoryId,
          category: categoryName,
          title: subcategoryTitle || title
        }
      });
    } else {
      // If no subcategoryId, fallback to regular back navigation
      router.back();
    }
  };

  const handlePlanPress = (planId: string, planTitle: string, index: number) => {
    // Navigate to the plan details screen with the planId and planNumber
    router.push({
      pathname: "/(tabs)/plan-details",
      params: { 
        planId, 
        planTitle,
        planNumber: index + 1,
        subcategoryId: subcategoryId, // Pass subcategoryId for back navigation
        accent: accent, // Pass accent color for maintaining color scheme
        subcategoryName: subcategoryName,
        subcategoryTitle: subcategoryTitle,
        subcategorySubtitle: subcategorySubtitle,
        categoryName: categoryName
      }
    });
  };

  // Helper to get appropriate image source with fallback
  const getImageSource = (imageUrl: string | null) => {
    if (!imageUrl) return imageMap['placeholder.jpg'];
    
    // Check if it's a full URL (starts with http/https)
    if (imageUrl.startsWith('http')) {
      return { uri: imageUrl };
    }
    
    // Check if it's a key in our image map
    if (imageMap[imageUrl]) {
      return imageMap[imageUrl];
    }
    
    // Default fallback
    return imageMap['placeholder.jpg'];
  };

  const renderPlanItem = ({ item, index }: { item: WorkoutPlan; index: number }) => {
    // Get image source with fallback
    const imageSource = getImageSource(item.image_url);
    
    // Get accent color from params (passed from subcategory) or from the default theme color
    // Since accent_color is now removed from workout_plans and available only in workout_subcategories
    const accentColor = accent || COLORS.primary;
    
    return (
      <Pressable 
        style={styles.planCard} 
        onPress={() => handlePlanPress(item.id, item.title, index)}
        android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
      >
        <View style={[styles.planCardAccent, { backgroundColor: accentColor }]} />
        <View style={styles.planCardContent}>
          <View style={styles.planCardLeft}>
            <Text style={styles.planNumber}>PLAN {index + 1}</Text>
            {item.days_per_week !== undefined && (
              <Text style={styles.planDaysPerWeek}>
                {item.days_per_week} {item.days_per_week === 1 ? 'Day' : 'Days'} per Week
              </Text>
            )}
          </View>
          <IconButton
            icon="chevron-right"
            size={24}
            iconColor={COLORS.primary}
            style={styles.arrowIcon}
          />
        </View>
      </Pressable>
    );
  };

  // Get the featured plan image with fallback
  const featuredImageSource = featuredPlan 
    ? getImageSource(featuredPlan.image_url)
    : imageMap['placeholder.jpg'];

  // Get text color for featured title - use accent color from params or default to primary color
  const featuredTextColor = accent || COLORS.primary;

  // Format for the subtitle - changed to "subcategory subtitle • category name"
  const getFormattedSubtitle = () => {
    if (featuredPlan) {
      // Try to get the subtitle from the plan
      const subtitle = featuredPlan.subcategory_subtitle || subcategorySubtitle || '';
      
      // Get category name from params
      const category = categoryName || '';
      
      // Use the format "subtitle • category" if both exist
      if (subtitle && category) {
        return `${subtitle} • ${category}`;
      }
      
      // Fallbacks if either value is missing
      if (subtitle) return subtitle;
      if (category) return category;
      
      // Final fallback to days per week info
      const daysText = `${featuredPlan.days_per_week} ${featuredPlan.days_per_week === 1 ? 'Day' : 'Days'} a Week`;
      return daysText;
    }
    
    // Fallback for when no plan is available but we have params
    if (subcategorySubtitle && categoryName) {
      return `${subcategorySubtitle} • ${categoryName}`;
    } else if (subcategorySubtitle) {
      return subcategorySubtitle;
    } else if (categoryName) {
      return categoryName;
    }
    
    return subcategoryName || 'No plans available';
  };

  // Calculate content padding based on bottom insets
  const contentPadding = insets.bottom + SPACING.xl;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={28}
            onPress={handleBackPress}
            iconColor={COLORS.text}
            style={styles.backButton}
          />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>PLANS</Text>
        </View>
        <View style={styles.headerRight} />
      </View>
      <Divider style={styles.divider} />
      
      {/* Featured Plan Image */}
      <View style={styles.featuredImageContainer}>
        <OptimizedImage
          source={featuredImageSource}
          style={styles.featuredImage}
          resizeMode="cover"
          priority="high"
          cachePolicy="immutable"
          isImportant={true}
          showLoader={isLoading && !imagesPreloaded}
          loaderColor={COLORS.primary}
          loaderSize="large"
          fallback={imageMap['placeholder.jpg']}
          debugLabel="FeaturedPlanImage"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.featuredGradient}
        />
        <View style={styles.featuredContent}>
          <Text style={[styles.featuredTitle, { color: featuredTextColor }]}>
            {title || (featuredPlan ? featuredPlan.title : subcategoryName || 'COMING SOON')}
          </Text>
          <Text style={styles.featuredSubtitle}>
            {getFormattedSubtitle()}
          </Text>
        </View>
      </View>
      
      {/* Plans List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading workout plans...</Text>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderPlanItem}
          contentContainerStyle={[
            styles.plansList,
            { paddingBottom: contentPadding }
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="fitness-center" size={64} color={`${COLORS.primary}80`} />
              <Text style={styles.emptyText}>No plans added yet</Text>
              <Text style={styles.emptySubtext}>Plans for this category will be available soon</Text>
            </View>
          }
        />
      )}
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
    paddingHorizontal: SPACING.sm,
    height: 56,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  divider: {
    height: 0.2,
    backgroundColor: COLORS.primary,
  },
  featuredImageContainer: {
    height: 220,
    width: '100%',
    position: 'relative',
    marginBottom: SPACING.md,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  featuredTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  featuredSubtitle: {
    fontSize: 15,
    color: COLORS.text,
    opacity: 0.9,
    marginTop: 4,
  },
  sectionTitleContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sectionDivider: {
    backgroundColor: `${COLORS.primary}60`,
    height: 2,
    width: 40,
  },
  plansList: {
    padding: SPACING.md,
    paddingTop: SPACING.md,
  },
  planCard: {
    height: 70,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: `${COLORS.surface}60`,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.2,
    borderColor: `${COLORS.primary}80`,
  },
  planCardAccent: {
    width: 4,
    height: '100%',
  },
  planCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  planCardLeft: {
    flexDirection: 'column',
  },
  planNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  planDaysPerWeek: {
    fontSize: 13,
    color: `${COLORS.text}B3`,
    marginTop: 2,
  },
  arrowIcon: {
    margin: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 200,
    backgroundColor: `${COLORS.surface}30`,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 0.2,
    borderColor: `${COLORS.primary}80`,
    marginTop: SPACING.md,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    color: COLORS.text,
    opacity: 0.7,
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
}); 