import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { COLORS, SPACING } from '../constants/theme';
import { getMuscleColor } from '../utils/muscleHighlighter';

interface MuscleTagsProps {
  muscles: string[];
  isPrimary: boolean;
  debug?: boolean;
}

/**
 * Renders a list of muscle tags with consistent colors.
 * - Uses textTransform for uppercase styling.
 * - Keys tags by normalized muscle name to avoid index-based keys.
 * - Memoizes normalized muscle list.
 */
function MuscleTags({ muscles, isPrimary, debug = false }: MuscleTagsProps) {
  // Track component mount
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MuscleTags component mounted',
      category: 'ui.lifecycle',
      data: {
        muscleCount: muscles.length,
        isPrimary,
        debug,
        muscles: muscles.join(', '),
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'MuscleTags component unmounted',
        category: 'ui.lifecycle',
      });
    };
  }, []);

  // Track muscle data changes
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MuscleTags muscle data updated',
      category: 'ui.update',
      data: {
        muscleCount: muscles.length,
        isPrimary,
        muscles: muscles.join(', '),
      },
    });
  }, [muscles.join(','), isPrimary]);

  // Normalize and trim muscle names once
  const normalized = useMemo(() => {
    try {
      const startTime = performance.now();
      const result = muscles.map((m) => m.trim());
      const endTime = performance.now();

      // Track normalization performance
      Sentry.addBreadcrumb({
        message: 'Muscle names normalized',
        category: 'performance',
        data: {
          duration: `${(endTime - startTime).toFixed(2)}ms`,
          originalCount: muscles.length,
          normalizedCount: result.length,
          isPrimary,
        },
      });

      return result;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MuscleTags',
          action: 'normalize_muscles',
        },
        extra: {
          muscles,
          isPrimary,
        },
      });
      return muscles; // Return original array on error
    }
  }, [muscles]);

  if (normalized.length === 0) {
    Sentry.addBreadcrumb({
      message: 'MuscleTags showing empty state',
      category: 'ui.state',
      data: {
        isPrimary,
      },
    });
    return <Text style={styles.emptyText}>No data available</Text>;
  }

  if (debug) {
    console.log(
      `MuscleTags - Rendering ${isPrimary ? 'primary' : 'secondary'} muscles:`,
      normalized,
    );
  }

  return (
    <View style={styles.container}>
      {normalized.map((muscle) => {
        try {
          const key = muscle.toLowerCase().replace(/\s+/g, '');
          const backgroundColor = getMuscleColor(key, isPrimary);

          if (debug) {
            console.log(`Muscle: ${muscle}, Key: ${key}, Color: ${backgroundColor}`);
          }

          return (
            <View key={key} style={[styles.tag, { backgroundColor }]}>
              <Text style={styles.tagText}>{muscle}</Text>
            </View>
          );
        } catch (error) {
          Sentry.captureException(error, {
            tags: {
              component: 'MuscleTags',
              action: 'render_muscle_tag',
            },
            extra: {
              muscle,
              isPrimary,
              debug,
            },
          });

          // Return a fallback tag on error
          return (
            <View key={`error-${muscle}`} style={[styles.tag, { backgroundColor: COLORS.surface }]}>
              <Text style={styles.tagText}>{muscle}</Text>
            </View>
          );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: SPACING.xs,
    marginBottom: 6,
  },
  tagText: {
    textTransform: 'uppercase',
    fontWeight: '500',
    fontSize: 12,
    color: COLORS.text, // Using standard text color instead of textOnPrimary
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
  },
});

export default React.memo(MuscleTags);
