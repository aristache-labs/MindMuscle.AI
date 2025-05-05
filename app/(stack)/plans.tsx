import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OptimizedImage from '../components/OptimizedImage';
import { LinearGradient } from 'expo-linear-gradient';
import workoutPlanService, { WorkoutPlan } from '../services/workoutPlanService';

const { width } = Dimensions.get('window');

export default function PlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const subcategoryId = params.subcategoryId as string;
  const title = params.title as string;
  const accent = params.accent as string;
  
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [featuredPlan, setFeaturedPlan] = useState<WorkoutPlan | null>(null);

  // Map for plan images based on the ones in assets/exercises
  const imageMap: { [key: string]: any } = {
    'fullbody.jpg': require('../../assets/exercises/fullbody.jpg'),
    'dumbbell.jpg': require('../../assets/exercises/dumbbell.jpg'),
    'pushup.jpg': require('../../assets/exercises/pushup.jpg'),
    'squat.jpg': require('../../assets/exercises/squat.jpg'),
    'yoga.jpg': require('../../assets/exercises/yoga.jpg'),
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
          console.log('Fetching plans for subcategory:', subcategoryId);
          fetchedPlans = await workoutPlanService.getPlansBySubcategory(subcategoryId.toString());
        } else {
          console.log('No subcategory provided, fetching all plans');
          // Fetch all plans as fallback
          fetchedPlans = await workoutPlanService.getAllPlans();
        }

        // Log to debug
        console.log(`Fetched ${fetchedPlans.length} plans`);
        if (fetchedPlans.length > 0) {
          console.log('First plan:', JSON.stringify(fetchedPlans[0], null, 2));
        }
        
        // Set featured plan (first one or null)
        if (fetchedPlans.length > 0) {
          setFeaturedPlan(fetchedPlans[0]);
          console.log('Set featured plan:', fetchedPlans[0].title);
        }
        
        setPlans(fetchedPlans);
        setIsLoading(false);
      } catch (error) {
        console.error('Error in fetchPlans:', error);
        setIsLoading(false);
      }
    }

    fetchPlans();
  }, [subcategoryId]);

  const handleBackPress = () => {
    router.back();
  };

  const handlePlanPress = (planId: string, planTitle: string) => {
    // Navigate to the selected plan details screen
    console.log('Selected plan:', planId, planTitle);
    // This would redirect to a plan details page in the future
    router.back();
  };

  // Helper to get appropriate image source with fallback
  const getImageSource = (imageUrl: string | null) => {
    if (!imageUrl) return imageMap['placeholder.jpg'];
    
    // Check if the image exists in our map
    return imageMap[imageUrl] || imageMap['placeholder.jpg'];
  };

  const renderPlanItem = ({ item }: { item: WorkoutPlan }) => {
    // Get image source with fallback
    const imageSource = getImageSource(item.image_url);
    
    // Get text color with string type guarantee
    const textColor = accent || COLORS.primary;
    
    return (
      <Pressable 
        style={styles.planCard} 
        onPress={() => handlePlanPress(item.id, item.title)}
      >
        <View style={styles.cardImageContainer}>
          <OptimizedImage
            source={imageSource}
            style={styles.cardImageWrapper}
            imageStyle={styles.cardImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.cardGradient}
          />
          <View style={styles.cardContent}>
            <Text style={[styles.planTitle, { color: textColor }]}>
              {item.title}
            </Text>
            <Text style={styles.planSubtitle}>
              {item.days_per_week} {item.days_per_week === 1 ? 'day' : 'days'} a week • {item.duration_weeks} weeks
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  // Get the featured plan image with fallback
  const featuredImageSource = featuredPlan 
    ? getImageSource(featuredPlan.image_url)
    : imageMap['placeholder.jpg'];

  // Get text color with string type guarantee for featured title
  const featuredTextColor = accent || COLORS.primary;

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
          imageStyle={styles.featuredImageStyle}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.featuredGradient}
        />
        <View style={styles.featuredContent}>
          <Text style={[styles.featuredTitle, { color: featuredTextColor }]}>
            {title || (featuredPlan ? featuredPlan.title : 'GET IN SHAPE')}
          </Text>
          <Text style={styles.featuredSubtitle}>
            {featuredPlan 
              ? `${featuredPlan.days_per_week} ${featuredPlan.days_per_week === 1 ? 'day' : 'days'} a week • ${featuredPlan.duration_weeks} weeks` 
              : 'Full Body Split, 1 Day a Week'}
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
              <Text style={styles.emptyText}>No workout plans available for this category.</Text>
              <Text style={styles.emptySubtext}>Try choosing a different category or check back later.</Text>
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
    height: 250,
    width: '100%',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredImageStyle: {
    width: '100%',
    height: '100%',
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  featuredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'white',
  },
  featuredSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
  },
  plansList: {
    padding: SPACING.md,
  },
  planCard: {
    height: 90,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  cardImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  cardImageWrapper: {
    width: '100%',
    height: '100%',
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
    height: '100%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  planSubtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.85,
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
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: COLORS.text,
    opacity: 0.7,
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
}); 