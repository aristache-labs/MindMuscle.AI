import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING } from '../constants/theme';
import { MenuHeader } from '../components/MenuHeader';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { useAuth } from '../store/AuthContext';

interface AiCoachingScreenProps {
  embedded?: boolean;
}

export default function AiCoachingScreen({ embedded = false }: AiCoachingScreenProps) {
  const { user } = useAuth();

  useEffect(() => {
    try {
      // Log AI coaching screen access
      SentryLogger.info('AI coaching screen accessed', {
        user_id: user?.id,
        embedded_mode: embedded,
        feature_status: 'coming_soon',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for screen navigation
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to AI coaching screen',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'ai-coaching',
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

      // Set context for AI coaching analytics
      SentryDataCollection.setContext('ai_coaching_screen', {
        embedded_mode: embedded,
        feature_status: 'placeholder',
        development_stage: 'coming_soon',
        user_interest: 'screen_access', // User showed interest by accessing
      });

      // Set tag for feature analytics
      SentryDataCollection.setTag('ai_coaching_interest', 'true');

      // Log user interest in AI coaching feature
      SentryLogger.info('User showed interest in AI coaching feature', {
        user_id: user?.id,
        feature: 'ai_coaching',
        status: 'coming_soon',
        user_engagement: 'screen_visit',
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'ai_coaching_screen_initialization',
        user_id: user?.id,
        embedded,
      });
    }
  }, [user, embedded]);

  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="AI Coaching" />}
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>AI Coaching will be available soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
});
