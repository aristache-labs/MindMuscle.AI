import React, { useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MenuHeader } from '../components/MenuHeader';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { useAuth } from '../store/AuthContext';

interface SingleWorkoutScreenProps {
  embedded?: boolean;
}

export default function SingleWorkoutScreen({ embedded = false }: SingleWorkoutScreenProps) {
  const { user } = useAuth();

  useEffect(() => {
    try {
      // Log single workout screen access
      SentryLogger.info('Single workout screen accessed', {
        user_id: user?.id,
        embedded_mode: embedded,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for screen navigation
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to single workout screen',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'single-workout',
          embedded: embedded,
          user_authenticated: !!user,
        },
      });

      // Set user context for this session
      if (user) {
        SentryDataCollection.setUser({
          id: user.id,
          email: user.email,
        });
      }

      // Set context for single workout analytics
      SentryDataCollection.setContext('single_workout_screen', {
        embedded_mode: embedded,
        feature_status: 'placeholder', // Since this is a placeholder screen
        workout_type: 'single_workout',
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'single_workout_screen_initialization',
        user_id: user?.id,
        embedded,
      });
    }
  }, [user, embedded]);

  const handleRefreshPress = () => {
    try {
      // Log refresh button interaction
      SentryLogger.info('User pressed refresh button', {
        user_id: user?.id,
        screen: 'single-workout',
        action: 'refresh',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for user interaction
      SentryDataCollection.addBreadcrumb({
        message: 'User pressed refresh button',
        category: 'user-interaction',
        level: 'info',
        data: {
          button_type: 'refresh',
          screen: 'single-workout',
          user_id: user?.id,
        },
      });

      // TODO: Implement refresh functionality
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'refresh_button_press',
        user_id: user?.id,
        screen: 'single-workout',
      });
    }
  };

  const handleMusclesPress = () => {
    try {
      // Log muscles button interaction
      SentryLogger.info('User pressed muscles button', {
        user_id: user?.id,
        screen: 'single-workout',
        action: 'muscles_filter',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for user interaction
      SentryDataCollection.addBreadcrumb({
        message: 'User pressed muscles button',
        category: 'user-interaction',
        level: 'info',
        data: {
          button_type: 'muscles',
          screen: 'single-workout',
          user_id: user?.id,
        },
      });

      // TODO: Implement muscles filter functionality
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'muscles_button_press',
        user_id: user?.id,
        screen: 'single-workout',
      });
    }
  };

  const handleDurationPress = () => {
    try {
      // Log duration button interaction
      SentryLogger.info('User pressed duration button', {
        user_id: user?.id,
        screen: 'single-workout',
        action: 'duration_filter',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for user interaction
      SentryDataCollection.addBreadcrumb({
        message: 'User pressed duration button',
        category: 'user-interaction',
        level: 'info',
        data: {
          button_type: 'duration',
          screen: 'single-workout',
          user_id: user?.id,
        },
      });

      // TODO: Implement duration filter functionality
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'duration_button_press',
        user_id: user?.id,
        screen: 'single-workout',
      });
    }
  };

  const handleStartWorkoutPress = () => {
    try {
      // Log start workout button interaction
      SentryLogger.info('User pressed start workout button', {
        user_id: user?.id,
        screen: 'single-workout',
        action: 'start_workout',
        workout_type: 'full_body',
        workout_level: 'intermediate',
        workout_exercises: 8,
        workout_duration: 45,
        workout_calories: 400,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for important user action
      SentryDataCollection.addBreadcrumb({
        message: 'User attempted to start single workout',
        category: 'user-action',
        level: 'info',
        data: {
          action_type: 'start_workout',
          workout_type: 'full_body',
          screen: 'single-workout',
          user_id: user?.id,
        },
      });

      // Set tag for workout analytics
      SentryDataCollection.setTag('last_workout_attempt', 'single_workout');

      // TODO: Implement start workout functionality
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'start_workout_button_press',
        user_id: user?.id,
        screen: 'single-workout',
      });
    }
  };

  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="Single Workout" />}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.workoutTypeHeader}>
          <Button
            mode="outlined"
            icon="refresh"
            style={styles.actionButton}
            textColor={COLORS.text}
            onPress={handleRefreshPress}
          >
            Refresh
          </Button>
          <Button
            mode="outlined"
            icon="dumbbell"
            style={styles.actionButton}
            textColor={COLORS.text}
            onPress={handleMusclesPress}
          >
            Muscles
          </Button>
          <Button
            mode="outlined"
            icon="clock-outline"
            style={styles.actionButton}
            textColor={COLORS.text}
            onPress={handleDurationPress}
          >
            Duration
          </Button>
        </View>

        <View style={styles.workoutHeader}>
          <Text style={styles.workoutTitle}>Full Body Workout</Text>
          <Text style={styles.subtitleText}>Intermediate Level</Text>
        </View>

        <View style={styles.workoutStats}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="lightning-bolt" size={24} color={COLORS.primary} />
            <Text style={styles.statText}>8 Exercises</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={COLORS.primary} />
            <Text style={styles.statText}>45 Min</Text>
          </View>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="fire" size={24} color={COLORS.primary} />
            <Text style={styles.statText}>400 Cal</Text>
          </View>
        </View>

        <Button
          mode="contained"
          style={styles.startButton}
          labelStyle={styles.startButtonLabel}
          onPress={handleStartWorkoutPress}
        >
          START WORKOUT
        </Button>
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
    padding: 16,
  },
  workoutTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    borderColor: COLORS.primary,
  },
  workoutHeader: {
    marginBottom: 20,
  },
  workoutTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitleText: {
    color: COLORS.secondary,
    fontSize: 16,
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: COLORS.text,
    marginLeft: 8,
    fontSize: 16,
  },
  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  startButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
