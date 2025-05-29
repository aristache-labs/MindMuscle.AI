import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, IconButton, Divider } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import supabase from '../services/supabase';
import OptimizedImage from '../components/OptimizedImage';
import useImagePreloader from '../hooks/useImagePreloader';

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

export default function PlansScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Get subcategoryId from params, fallback to first if not provided
        const subcategoryId = params.subcategoryId as string | undefined;
        let subcat: Subcategory | null = null;
        if (subcategoryId) {
          const { data: subcatData, error: subcatError } = await supabase
            .from('workout_subcategories')
            .select('*')
            .eq('identifier', subcategoryId)
            .single();
          if (subcatError) throw subcatError;
          subcat = subcatData || null;
        } else {
          // fallback to first subcategory
          const { data: subcatData, error: subcatError } = await supabase
            .from('workout_subcategories')
            .select('*')
            .order('display_order', { ascending: true })
            .limit(1);
          if (subcatError) throw subcatError;
          subcat = subcatData && subcatData.length > 0 ? subcatData[0] : null;
        }
        setSubcategory(subcat);

        // Fetch the category name for the subcategory
        if (subcat && subcat.category_identifier) {
          const { data: catData, error: catError } = await supabase
            .from('workout_categories')
            .select('name')
            .eq('identifier', subcat.category_identifier)
            .single();
          if (catError) throw catError;
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
      } catch (error) {
        console.error('Error fetching plans:', error);
        setError('Failed to load plans.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [params.subcategoryId]);

  const handleBackPress = () => {
    router.replace('/(tabs)/discover');
  };

  const handlePlanPress = (plan: Plan) => {
    router.push({ pathname: '/(stack)/plan-details', params: { planId: plan.id } });
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
