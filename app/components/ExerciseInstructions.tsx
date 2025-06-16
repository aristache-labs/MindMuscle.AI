import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { COLORS, SPACING } from '../constants/theme';

interface ExerciseInstructionsProps {
  instructions: string[] | string | null;
  loading: boolean;
}

export default function ExerciseInstructions({ instructions, loading }: ExerciseInstructionsProps) {
  // Track component lifecycle with Sentry
  useEffect(() => {
    try {
      Sentry.addBreadcrumb({
        message: 'ExerciseInstructions component mounted',
        category: 'component',
        level: 'info',
        data: {
          hasInstructions: !!instructions,
          instructionsType: typeof instructions,
          isArray: Array.isArray(instructions),
          instructionsLength: Array.isArray(instructions)
            ? instructions.length
            : typeof instructions === 'string'
              ? instructions.length
              : 0,
          loading,
        },
      });
    } catch (error) {
      console.warn('Failed to log Sentry breadcrumb for ExerciseInstructions mount:', error);
    }

    return () => {
      try {
        Sentry.addBreadcrumb({
          message: 'ExerciseInstructions component unmounted',
          category: 'component',
          level: 'info',
          data: {
            hasInstructions: !!instructions,
          },
        });
      } catch (error) {
        console.warn('Failed to log Sentry breadcrumb for ExerciseInstructions unmount:', error);
      }
    };
  }, [instructions, loading]);

  // Track loading state changes
  useEffect(() => {
    if (loading) {
      try {
        Sentry.addBreadcrumb({
          message: 'Exercise instructions loading started',
          category: 'data.load',
          level: 'info',
        });
      } catch (error) {
        console.warn('Failed to log instructions loading start:', error);
      }
    } else {
      try {
        Sentry.addBreadcrumb({
          message: 'Exercise instructions loading completed',
          category: 'data.load',
          level: 'info',
          data: {
            hasInstructions: !!instructions,
            instructionsType: typeof instructions,
            isArray: Array.isArray(instructions),
          },
        });
      } catch (error) {
        console.warn('Failed to log instructions loading completion:', error);
      }
    }
  }, [loading, instructions]);

  // Format instructions for display
  const formatInstructions = (instructionsData: string[] | string | null): string => {
    try {
      if (!instructionsData) {
        Sentry.addBreadcrumb({
          message: 'No instructions data provided',
          category: 'data.format',
          level: 'info',
        });
        return 'No instructions available for this exercise.';
      }

      // If instructions is a string, handle it
      if (typeof instructionsData === 'string') {
        const lines = instructionsData.includes('\n')
          ? instructionsData.split('\n').filter((line) => line.trim() !== '')
          : [instructionsData];

        Sentry.addBreadcrumb({
          message: 'Instructions formatted from string',
          category: 'data.format',
          level: 'info',
          data: {
            originalLength: instructionsData.length,
            formattedLinesCount: lines.length,
            hasNewlines: instructionsData.includes('\n'),
          },
        });

        return lines.join('\n');
      }

      // If instructions is an array, join them with newlines
      if (Array.isArray(instructionsData)) {
        Sentry.addBreadcrumb({
          message: 'Instructions formatted from array',
          category: 'data.format',
          level: 'info',
          data: {
            arrayLength: instructionsData.length,
            totalCharacters: instructionsData.join('').length,
          },
        });

        return instructionsData.join('\n');
      }

      Sentry.addBreadcrumb({
        message: 'Unknown instructions format encountered',
        category: 'data.format',
        level: 'warning',
        data: {
          instructionsType: typeof instructionsData,
          instructionsConstructor:
            (instructionsData as Record<string, unknown>)?.constructor?.name || 'unknown',
        },
      });

      return 'Instructions format not recognized.';
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseInstructions',
          action: 'formatInstructions',
        },
        extra: {
          instructionsType: typeof instructionsData,
          instructionsLength: instructionsData ? String(instructionsData).length : 0,
        },
      });
      console.error('Error formatting instructions:', error);
      return 'Error formatting instructions. Please try again.';
    }
  };

  const handleScrollBeginDrag = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'User started scrolling instructions',
        category: 'user.interaction',
        level: 'info',
        data: {
          hasInstructions: !!instructions,
          instructionsLength: Array.isArray(instructions)
            ? instructions.length
            : typeof instructions === 'string'
              ? instructions.length
              : 0,
        },
      });
    } catch (error) {
      console.warn('Failed to log instructions scroll start:', error);
    }
  };

  const handleScrollEndDrag = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'User finished scrolling instructions',
        category: 'user.interaction',
        level: 'info',
      });
    } catch (error) {
      console.warn('Failed to log instructions scroll end:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Instructions</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading instructions...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          nestedScrollEnabled={true}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
        >
          <Text style={styles.instructionText}>{formatInstructions(instructions)}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollView: {
    flex: 1,
    height: 350, // Increased from 250 to 350 to match the larger section
  },
  scrollContent: {
    paddingBottom: SPACING.md, // Add some bottom padding for better scrolling
  },
  instructionText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
});
