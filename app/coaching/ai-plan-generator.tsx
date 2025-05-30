import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import supabase from '../services/supabase';

export default function AIPlanGenerator() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBackPress = () => {
    router.back();
  };

  const handleGeneratePlan = async () => {
    if (!prompt.trim() || !user) return;

    try {
      setIsGenerating(true);
      setError(null);

      // Here we would normally call an AI service to generate a plan
      // For now, we'll just simulate it with a timeout
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create a sample AI plan
      const planName = `AI Workout: ${prompt.split(' ').slice(0, 3).join(' ')}...`;

      // Add the new active plan
      const { data: newPlan, error: insertError } = await supabase
        .from('user_active_plans')
        .insert({
          user_id: user.id,
          name: planName,
          subtitle: 'AI-generated workout plan',
          exercise_count: 5, // Sample count
          duration: 45, // Sample duration
          calories: 350, // Sample calories
          image_url: '', // Would normally come from AI-generated content
          accent_color: '#34C759',
          is_active: true,
          source_type: 'ai_plan', // This is an AI-generated plan
          section: 'ai_coaching', // This will appear in the AI coaching section
          ai_prompt: prompt,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating AI plan:', insertError);
        setError('Failed to create AI plan. Please try again.');
        setIsGenerating(false);
        return;
      }

      // Sample exercises for the AI plan
      const sampleExercises = [
        { name: 'Push-ups', sets: 3, reps: '10-12', rest_time: 60, order_position: 1 },
        { name: 'Squats', sets: 3, reps: '12-15', rest_time: 60, order_position: 2 },
        { name: 'Lunges', sets: 3, reps: '10 each leg', rest_time: 45, order_position: 3 },
        { name: 'Plank', sets: 3, reps: '30s hold', rest_time: 30, order_position: 4 },
        {
          name: 'Mountain Climbers',
          sets: 3,
          reps: '20 each side',
          rest_time: 45,
          order_position: 5,
        },
      ];

      // Add exercises for the AI plan
      const exercisesToInsert = sampleExercises.map((ex) => ({
        active_plan_id: newPlan.id,
        exercise_id: '00000000-0000-0000-0000-000000000000', // Placeholder ID
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_time: ex.rest_time,
        order_position: ex.order_position,
      }));

      const { error: exerciseError } = await supabase
        .from('user_active_plan_exercises')
        .insert(exercisesToInsert);

      if (exerciseError) {
        console.error('Error adding exercises to AI plan:', exerciseError);
        setError('Created plan but failed to add exercises. Please try again.');
      } else {
        // Navigate to the AI coaching screen with the new plan
        router.push({
          pathname: '/(stack)/ai-coaching',
          params: {
            planAdded: 'true',
          },
        });
      }
    } catch (error) {
      console.error('Error in handleGeneratePlan:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Plan Generator</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Create Your AI Workout Plan</Text>
          <Text style={styles.description}>
            Describe your fitness goals, preferences, and any limitations. Our AI will create a
            personalized workout plan for you.
          </Text>

          <TextInput
            style={styles.promptInput}
            mode="outlined"
            label="Describe your workout plan"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={5}
            placeholder="e.g., I want a full-body workout plan for a beginner with no equipment, focusing on weight loss. I can exercise 3 times a week for 30 minutes each session."
            disabled={isGenerating}
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button
            mode="contained"
            style={styles.generateButton}
            onPress={handleGeneratePlan}
            loading={isGenerating}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? 'Generating Plan...' : 'Generate My Plan'}
          </Button>

          <View style={styles.examplesContainer}>
            <Text style={styles.examplesTitle}>Example Prompts:</Text>
            <TouchableOpacity
              style={styles.exampleItem}
              onPress={() =>
                setPrompt(
                  'I want a strength training plan for an intermediate level with dumbbells only. I have 45 minutes, 4 times a week.',
                )
              }
            >
              <Text style={styles.exampleText}>
                Intermediate strength training with dumbbells, 4x weekly, 45 min sessions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exampleItem}
              onPress={() =>
                setPrompt(
                  'I need a high-intensity cardio plan to improve endurance. I can work out 3 days a week for 30 minutes each.',
                )
              }
            >
              <Text style={styles.exampleText}>
                High-intensity cardio for endurance, 3x weekly, 30 min sessions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exampleItem}
              onPress={() =>
                setPrompt(
                  'Create a 5-day full body workout plan focused on functional fitness. I have access to a full gym and am at an advanced fitness level.',
                )
              }
            >
              <Text style={styles.exampleText}>
                5-day functional fitness plan, full gym access, advanced level
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidView: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.primary}20`,
  },
  backButton: {
    padding: SPACING.sm,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 70,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: 16,
    color: COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  promptInput: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  generateButton: {
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: SPACING.md,
  },
  examplesContainer: {
    marginTop: SPACING.md,
  },
  examplesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  exampleItem: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  exampleText: {
    color: COLORS.text,
    fontSize: 14,
  },
});
