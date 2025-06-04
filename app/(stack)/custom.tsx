import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { MenuHeader } from '../components/MenuHeader';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { useAuth } from '../store/AuthContext';

interface CustomScreenProps {
  embedded?: boolean;
}

export default function CustomScreen({ embedded = false }: CustomScreenProps) {
  const { user } = useAuth();

  useEffect(() => {
    try {
      // Log custom workout screen access
      SentryLogger.info('Custom workout screen accessed', {
        user_id: user?.id,
        embedded_mode: embedded,
        feature_status: 'placeholder',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for screen navigation
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to custom workout screen',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'custom-workout',
          embedded: embedded,
          user_authenticated: !!user,
          feature_available: false,
        },
      });

      // Set user context for this session
      if (user) {
        SentryDataCollection.setUser({
          id: user.id,
          email: user.email,
        });
      }

      // Set context for custom workout analytics
      SentryDataCollection.setContext('custom_workout_screen', {
        embedded_mode: embedded,
        feature_status: 'placeholder',
        workout_type: 'custom',
        user_interest: 'screen_access',
      });

      // Set tag for feature analytics
      SentryDataCollection.setTag('custom_workout_interest', 'true');

      // Log user interest in custom workout feature
      SentryLogger.info('User showed interest in custom workout feature', {
        user_id: user?.id,
        feature: 'custom_workout',
        status: 'placeholder',
        user_engagement: 'screen_visit',
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'custom_workout_screen_initialization',
        user_id: user?.id,
        embedded,
      });
    }
  }, [user, embedded]);

  const handleCreateWorkoutPress = () => {
    try {
      // Log create workout button interaction
      SentryLogger.info('User pressed create workout button', {
        user_id: user?.id,
        screen: 'custom-workout',
        action: 'create_workout',
        workout_type: 'custom',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for important user action
      SentryDataCollection.addBreadcrumb({
        message: 'User attempted to create custom workout',
        category: 'user-action',
        level: 'info',
        data: {
          action_type: 'create_workout',
          workout_type: 'custom',
          screen: 'custom-workout',
          user_id: user?.id,
        },
      });

      // Set tag for custom workout creation analytics
      SentryDataCollection.setTag('custom_workout_creation_attempt', 'true');

      // Log user engagement with custom workout creation
      SentryLogger.info('User engaged with custom workout creation', {
        user_id: user?.id,
        feature: 'custom_workout_creation',
        engagement_level: 'button_press',
        user_intent: 'create_workout',
      });

      // TODO: Implement create workout functionality
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'create_workout_button_press',
        user_id: user?.id,
        screen: 'custom-workout',
      });
    }
  };

  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="Custom" />}
      <View style={styles.content}>
        <Text style={styles.title}>Custom Workout</Text>
        <Text style={styles.description}>
          Create your own workout routine by selecting exercises, sets, and reps.
        </Text>
        <Button
          mode="contained"
          icon="plus"
          style={styles.button}
          labelStyle={styles.buttonLabel}
          onPress={handleCreateWorkoutPress}
        >
          CREATE WORKOUT
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
