import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, Button, Card, Divider } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MenuHeader } from '../components/MenuHeader';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import workoutPlanService from '../services/workoutPlanService';

interface AiCoachingScreenProps {
  embedded?: boolean;
}

interface AIPlan {
  id: string;
  name: string;
  subtitle: string;
  exercise_count: number;
  duration: number;
  calories: number;
  accent_color: string;
  ai_prompt?: string;
  date_added: string;
  user_active_plan_exercises?: any[];
}

export default function AiCoachingScreen({ embedded = false }: AiCoachingScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const [aiPlans, setAiPlans] = useState<AIPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAIPlans() {
      if (!user) return;
      
      try {
        setIsLoading(true);
        // Fetch AI plans from the 'ai_coaching' section
        const plans = await workoutPlanService.getActivePlansBySection('ai_coaching');
        setAiPlans(plans);
      } catch (error) {
        console.error('Error fetching AI plans:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAIPlans();
    
    // Refetch when a new plan is added
    if (params.planAdded === 'true') {
      fetchAIPlans();
    }
  }, [user, params.planAdded]);

  const navigateToAIGenerator = () => {
    router.push('/coaching/ai-plan-generator');
  };

  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="AI Coaching" />}
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.title}>AI Coaching</Text>
          <Text style={styles.description}>
            Get personalized workout recommendations powered by AI.
          </Text>
          <Button
            mode="contained"
            icon="plus"
            style={styles.createButton}
            onPress={navigateToAIGenerator}
          >
            CREATE AI PLAN
          </Button>
        </View>
        
        <Divider style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Your AI Workout Plans</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : aiPlans.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="robot" size={60} color={COLORS.primary} />
            <Text style={styles.emptyText}>
              You don't have any AI-generated workout plans yet.
            </Text>
            <Button
              mode="contained"
              style={styles.emptyButton}
              onPress={navigateToAIGenerator}
            >
              CREATE YOUR FIRST PLAN
            </Button>
          </View>
        ) : (
          aiPlans.map(plan => (
            <Card key={plan.id} style={styles.planCard}>
              <Card.Content>
                <View style={styles.planHeader}>
                  <View>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                  </View>
                  <View style={[styles.planBadge, { backgroundColor: plan.accent_color || '#34C759' }]}>
                    <Text style={styles.planBadgeText}>AI</Text>
                  </View>
                </View>
                
                <View style={styles.planStats}>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color={COLORS.primary} />
                    <Text style={styles.statText}>{plan.exercise_count} Exercises</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.statText}>{plan.duration} Min</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons name="fire" size={18} color={COLORS.primary} />
                    <Text style={styles.statText}>{plan.calories} Cal</Text>
                  </View>
                </View>
                
                {plan.ai_prompt && (
                  <View style={styles.promptContainer}>
                    <Text style={styles.promptLabel}>Prompt:</Text>
                    <Text style={styles.promptText} numberOfLines={2}>{plan.ai_prompt}</Text>
                  </View>
                )}
                
                <View style={styles.cardActions}>
                  <Button mode="contained" style={styles.startButton}>START</Button>
                  <Button mode="outlined" style={styles.viewButton}>VIEW</Button>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  headerContainer: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: 16,
    color: COLORS.secondary,
    marginBottom: SPACING.md,
  },
  createButton: {
    marginTop: SPACING.md,
  },
  divider: {
    marginVertical: SPACING.md,
    backgroundColor: `${COLORS.primary}30`,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.lg,
  },
  emptyText: {
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: SPACING.md,
    fontSize: 16,
  },
  emptyButton: {
    marginTop: SPACING.md,
  },
  planCard: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  planSubtitle: {
    fontSize: 14,
    color: COLORS.secondary,
  },
  planBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  planBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planStats: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  statText: {
    color: COLORS.text,
    fontSize: 14,
    marginLeft: 4,
  },
  promptContainer: {
    marginVertical: SPACING.sm,
    backgroundColor: `${COLORS.surface}80`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
  },
  promptLabel: {
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  promptText: {
    color: COLORS.secondary,
    fontSize: 14,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  startButton: {
    flex: 1,
    marginRight: SPACING.xs,
  },
  viewButton: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
}); 