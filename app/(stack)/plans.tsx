import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import supabase from '../services/supabase';
import OptimizedImage from '../components/OptimizedImage';
import useImagePreloader from '../hooks/useImagePreloader';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { useAuth } from '../store/AuthContext';

interface Plan {
  id: string;
  title: string;
  image_url?: string;
  difficulty_level?: string;
  estimated_duration?: number;
  display_order?: number;
  subtitle?: string;
}

interface Subcategory {
  id: string;
  title: string;
  image_url?: string;
  subtitle?: string;
  display_order?: number;
  category_identifier?: string;
  identifier: string;
}

interface CategoryData {
  name: string;
}

export default function PlansScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [categoryName, setCategoryName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Preload subcategory hero image when available
  const subcategoryImageUrl = subcategory?.image_url ? [subcategory.image_url] : [];
  useImagePreloader(subcategoryImageUrl, {
    priority: 'high',
    skipIfCached: true,
    debugLabel: 'PlansScreen',
  });

  // Extract Sentry initialization to reduce complexity
  const initializeSentryTracking = useCallback(() => {
    SentryLogger.info('Plans screen accessed', {
      user_id: user?.id,
      subcategory_id: params.subcategoryId,
      timestamp: new Date().toISOString(),
    });

    SentryDataCollection.addBreadcrumb({
      message: 'User navigated to plans screen',
      category: 'navigation',
      level: 'info',
      data: {
        screen: 'plans',
        subcategory_id: params.subcategoryId,
        user_authenticated: !!user,
      },
    });

    if (user) {
      SentryDataCollection.setUser({
        id: user.id,
        email: user.email,
      });
    }
  }, [user, params.subcategoryId]);

  // Extract subcategory fetching logic
  const fetchSubcategory = useCallback(
    async (subcategoryId: string | undefined): Promise<Subcategory | null> => {
      if (subcategoryId) {
        const { data: subcatData, error: subcatError } = await supabase
          .from('workout_subcategories')
          .select('*')
          .eq('identifier', subcategoryId)
          .single();
        if (subcatError) throw subcatError;
        return subcatData || null;
      } else {
        const { data: subcatData, error: subcatError } = await supabase
          .from('workout_subcategories')
          .select('*')
          .order('display_order', { ascending: true })
          .limit(1);
        if (subcatError) throw subcatError;
        return subcatData && subcatData.length > 0 ? subcatData[0] : null;
      }
    },
    [],
  );

  // Extract Sentry logging to reduce complexity
  const logPlansLoadSuccess = useCallback(
    (subcat: Subcategory | null, categoryData: CategoryData | null, plansData: Plan[]) => {
      SentryLogger.info('Plans loaded successfully', {
        user_id: user?.id,
        subcategory_id: subcat?.identifier,
        subcategory_title: subcat?.title,
        category_name: categoryData?.name,
        plans_count: plansData?.length || 0,
        plans_list:
          plansData?.map((plan) => ({
            id: plan.id,
            title: plan.title,
            difficulty: plan.difficulty_level,
          })) || [],
      });

      SentryDataCollection.setTag('current_subcategory', subcat?.identifier || 'unknown');
      SentryDataCollection.setTag('current_category', subcat?.category_identifier || 'unknown');

      SentryDataCollection.setContext('plans_screen', {
        subcategory_id: subcat?.identifier,
        subcategory_title: subcat?.title,
        category_name: categoryData?.name,
        plans_count: plansData?.length || 0,
        has_hero_image: !!subcat?.image_url,
      });
    },
    [user],
  );

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Initialize Sentry tracking
        initializeSentryTracking();

        // Fetch subcategory data
        const subcategoryId = params.subcategoryId as string | undefined;
        const subcat = await fetchSubcategory(subcategoryId);
        setSubcategory(subcat);

        // Log subcategory loading success
        if (subcat) {
          SentryLogger.info('Subcategory loaded successfully', {
            user_id: user?.id,
            subcategory_id: subcat.identifier,
            subcategory_title: subcat.title,
            category_identifier: subcat.category_identifier,
          });
        }

        // Fetch the category name for the subcategory
        let categoryData: CategoryData | null = null;
        if (subcat && subcat.category_identifier) {
          const { data: catData, error: catError } = await supabase
            .from('workout_categories')
            .select('name')
            .eq('identifier', subcat.category_identifier)
            .single();
          if (catError) throw catError;
          categoryData = catData;
          setCategoryName(catData?.name || '');
        } else {
          setCategoryName('');
        }

        // Fetch only plans for the current subcategory
        const { data: plansData, error: plansError } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('subcategory_identifier', subcat?.identifier)
          .order('display_order', { ascending: true });
        if (plansError) throw plansError;
        setPlans(plansData || []);

        // Log successful plans loading with analytics
        logPlansLoadSuccess(subcat, categoryData, plansData);
      } catch (fetchError) {
        const errorMessage = 'Failed to load plans.';
        console.error('Error fetching plans:', fetchError);
        setError(errorMessage);

        // Log plans loading error
        SentryDataCollection.captureException(fetchError as Error, {
          context: 'plans_screen_fetch',
          user_id: user?.id,
          subcategory_id: params.subcategoryId,
          error_type: 'plans_fetch_failed',
        });

        SentryLogger.error('Failed to fetch plans data', {
          error: fetchError,
          subcategory_id: params.subcategoryId,
          user_id: user?.id,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [params.subcategoryId, user, initializeSentryTracking, fetchSubcategory, logPlansLoadSuccess]);

  const handleBackPress = () => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated back from plans screen',
        category: 'navigation',
        level: 'info',
        data: {
          from_screen: 'plans',
          subcategory_id: subcategory?.identifier,
          subcategory_title: subcategory?.title,
          plans_viewed: plans.length,
        },
      });

      router.replace('/(tabs)/discover');
    } catch (navigationError) {
      SentryDataCollection.captureException(navigationError as Error, {
        context: 'plans_navigation_back',
        user_id: user?.id,
        subcategory_id: subcategory?.identifier,
      });
    }
  };

  const handlePlanPress = (plan: Plan) => {
    try {
      // Log plan selection
      SentryLogger.info('User selected plan', {
        user_id: user?.id,
        plan_id: plan.id,
        plan_title: plan.title,
        plan_difficulty: plan.difficulty_level,
        plan_duration: plan.estimated_duration,
        subcategory_id: subcategory?.identifier,
        subcategory_title: subcategory?.title,
        category_name: categoryName,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for plan selection
      SentryDataCollection.addBreadcrumb({
        message: `User selected plan: ${plan.title}`,
        category: 'user-interaction',
        level: 'info',
        data: {
          plan_id: plan.id,
          plan_title: plan.title,
          plan_difficulty: plan.difficulty_level,
          subcategory_id: subcategory?.identifier,
          user_id: user?.id,
          interaction_type: 'plan_selection',
        },
      });

      // Set tag for plan analytics
      SentryDataCollection.setTag('last_viewed_plan', plan.id);

      router.push({ pathname: '/(stack)/plan-details', params: { planId: plan.id } });
    } catch (planPressError) {
      SentryDataCollection.captureException(planPressError as Error, {
        context: 'plan_selection',
        user_id: user?.id,
        plan_id: plan.id,
        plan_title: plan.title,
      });
    }
  };

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
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : plans.length === 0 ? (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>No plans available.</Text>
        </View>
      ) : (
        <FlatList
          ListHeaderComponent={
            subcategory ? (
              <View style={styles.heroContainer}>
                {subcategory.image_url ? (
                  <OptimizedImage
                    source={{ uri: subcategory.image_url }}
                    style={styles.heroImage}
                    resizeMode="cover"
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    fallback={require('../../assets/exercises/placeholder.jpg')}
                    cachePolicy="immutable"
                    isImportant={true}
                    showLoader={false}
                  />
                ) : (
                  <View style={[styles.heroImage, styles.heroImagePlaceholder]} />
                )}
                <View style={styles.heroTextContainer}>
                  <Text style={styles.heroTitle}>{subcategory.title}</Text>
                  <Text style={styles.heroSubtitle}>
                    {subcategory.subtitle}
                    {subcategory.subtitle && categoryName ? ', ' : ''}
                    {categoryName}
                  </Text>
                </View>
              </View>
            ) : null
          }
          data={plans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.planCard}
              onPress={() => handlePlanPress(item)}
              activeOpacity={0.8}
            >
              <Text style={styles.planCardTitle}>{item.title}</Text>
              <IconButton
                icon="chevron-right"
                size={24}
                iconColor={COLORS.text}
                style={styles.planCardArrow}
              />
            </TouchableOpacity>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  heroContainer: {
    margin: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.lg,
    elevation: 2,
  },
  heroImage: {
    width: '100%',
    height: 260,
    backgroundColor: COLORS.surfaceLight,
  },
  heroImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroTitle: {
    color: '#D6FF2A',
    fontSize: 26,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: SPACING.xl,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    elevation: 1,
  },
  planCardTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  planCardArrow: {
    margin: 0,
  },
});
