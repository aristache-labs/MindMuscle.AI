import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MeasurementCategory, Measurement } from '../services/measurements';
import { COLORS } from '../constants/theme';

interface Props {
  measurements: Record<MeasurementCategory, Measurement | null>;
  onMeasurementPress: (category: MeasurementCategory) => void;
}

const FADED_PURPLE = 'rgba(107, 78, 255, 0.15)';

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'BICEPS':
      return '#FF69B4'; // Pink
    case 'ABS':
      return '#4CAF50'; // Green
    case 'WAIST':
      return '#FFB74D'; // Orange
    case 'CHEST':
      return '#64B5F6'; // Light Blue
    case 'SHLDRS':
      return '#BA68C8'; // Purple
    case 'THIGH':
      return '#4DB6AC'; // Teal
    case 'CALF':
      return '#FFD54F'; // Amber
    default:
      return '#fff';
  }
};

const getProgressIndicator = (currentValue: number, previousValue: number | null) => {
  if (previousValue === null) return null;

  const difference = currentValue - previousValue;
  if (Math.abs(difference) < 0.01) return null; // No significant change

  return {
    icon: difference > 0 ? 'arrow-up' : 'arrow-down',
    color: difference > 0 ? '#4CAF50' : '#F44336', // Green for increase, Red for decrease
    value: Math.abs(difference).toFixed(1),
  };
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 0,
  },
  weightContainer: {
    alignItems: 'center',
    marginBottom: -10,
  },
  weightValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFE600',
  },
  weightUnit: {
    fontSize: 16,
    color: '#FFE600',
  },
  weightLabel: {
    fontSize: 12,
    color: COLORS.text,
  },
  graphWrapper: {
    height: 290,
    position: 'relative',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    paddingTop: 0,
  },
  barContainer: {
    alignItems: 'center',
    width: '12%',
    position: 'relative',
    height: 240,
  },
  barWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: FADED_PURPLE,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
  },
  measurementLabel: {
    fontSize: 10,
    fontWeight: '500',
    width: '100%',
    textAlign: 'center',
  },
  valueAboveBar: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'transparent',
    paddingBottom: 4,
  },
  arrowIconInBar: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: '0%' }], // percentage-based centering
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  unitInsideBarContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 4,
  },
  unitLabelInsideBar: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  placeholderWrapper: {
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(107, 78, 255, 0.07)',
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 24,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.7,
    marginBottom: 20,
    textAlign: 'center',
  },
  addMeasurementButton: {
    backgroundColor: '#6c47ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6c47ff',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addMeasurementButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default function MeasurementsGraph({ measurements, onMeasurementPress }: Props) {
  // Find the maximum value to scale the bars
  const maxValue = Math.max(
    ...Object.entries(measurements)
      .filter(([category]) => category !== 'WEIGHT')
      .map(([_, measurement]) => measurement?.value || 0),
  );

  // Calculate the scale factor for the bars (max height 240)
  const MIN_BAR_HEIGHT = 24;
  const scale = maxValue > 0 ? (240 - MIN_BAR_HEIGHT) / maxValue : 1;

  // Check if all measurement values (excluding WEIGHT) are zero
  const allZero = Object.entries(measurements)
    .filter(([category]) => category !== 'WEIGHT')
    .every(([_, measurement]) => !measurement || !measurement.value || measurement.value === 0);

  // Find the first muscle group category (not WEIGHT) for the add button
  const firstMuscleGroup = Object.keys(measurements).find((key) => key !== 'WEIGHT') || 'BICEPS';

  return (
    <View style={styles.container}>
      {/* Weight Display */}
      <Pressable
        style={styles.weightContainer}
        onPress={() => {
          onMeasurementPress('WEIGHT');
        }}
      >
        <Text style={styles.weightValue}>
          {measurements.WEIGHT?.value.toFixed(1) || '0.0'}
          <Text style={styles.weightUnit}> kg</Text>
        </Text>
        <Text style={styles.weightLabel}>WEIGHT</Text>
      </Pressable>

      {/* Placeholder if all values are zero */}
      {allZero ? (
        <View style={styles.placeholderWrapper}>
          <Text style={styles.placeholderText}>No measurements yet!</Text>
          <Text style={styles.placeholderSubtext}>
            Start tracking your progress by adding your first measurement.
          </Text>
          <Pressable
            style={styles.addMeasurementButton}
            onPress={() => onMeasurementPress(firstMuscleGroup as MeasurementCategory)}
          >
            <Text style={styles.addMeasurementButtonText}>Add Measurement</Text>
          </Pressable>
        </View>
      ) : (
        // Graph Container
        <View style={styles.graphWrapper}>
          {/* Measurements Bars */}
          <View style={styles.barsContainer}>
            {Object.entries(measurements)
              .filter(([category]) => category !== 'WEIGHT')
              .map(([category, measurement]) => {
                const value = measurement?.value || 25;
                const height = allZero ? 0 : value * scale + MIN_BAR_HEIGHT;
                const categoryColor = getCategoryColor(category);

                // Get the previous measurement value
                const previousValue = measurement?.previous_value ?? null;
                const progress = getProgressIndicator(value, previousValue);

                return (
                  <Pressable
                    key={category}
                    style={styles.barContainer}
                    onPress={() => onMeasurementPress(category as MeasurementCategory)}
                  >
                    {/* Value above the bar, moving with the bar height */}
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: height + 6,
                        alignItems: 'center',
                        zIndex: 5,
                      }}
                      pointerEvents="none"
                    >
                      <Text style={[styles.valueAboveBar, { color: categoryColor }]}>
                        {value.toFixed(1)}
                      </Text>
                    </View>
                    {/* Bar */}
                    <View style={[styles.barWrapper, { height: 230 }]}>
                      <View style={[styles.bar, { height: `${(height / 240) * 100}%` }]}>
                        {/* Arrow icon inside the bar, top center, moves with bar height */}
                        {progress && (
                          <IconButton
                            icon={progress.icon}
                            iconColor={progress.color}
                            size={14}
                            style={styles.arrowIconInBar}
                          />
                        )}
                        {/* Unit label inside the bar at the bottom */}
                        {value > 0 && (
                          <View style={styles.unitInsideBarContainer} pointerEvents="none">
                            <Text style={styles.unitLabelInsideBar}>cm</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Labels */}
                    <View style={styles.labelContainer}>
                      <Text
                        style={[styles.measurementLabel, { color: categoryColor }]}
                        numberOfLines={1}
                      >
                        {category}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </View>
      )}
    </View>
  );
}
