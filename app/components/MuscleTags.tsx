import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  // Normalize and trim muscle names once
  const normalized = useMemo(() => muscles.map((m) => m.trim()), [muscles]);

  if (normalized.length === 0) {
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
