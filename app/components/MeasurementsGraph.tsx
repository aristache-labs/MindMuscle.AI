import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MeasurementCategory, Measurement } from '../services/measurements';
import { COLORS } from '../constants/theme';

interface Props {
  measurements: Record<MeasurementCategory, Measurement | null>;
  onMeasurementPress: (category: MeasurementCategory) => void;
}

const PURPLE_COLOR = '#6c47ff';
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
    value: Math.abs(difference).toFixed(1)
  };
};

export default function MeasurementsGraph({ measurements, onMeasurementPress }: Props) {
  // Find the maximum value to scale the bars
  const maxValue = Math.max(
    ...Object.entries(measurements)
      .filter(([category]) => category !== 'WEIGHT')
      .map(([_, measurement]) => measurement?.value || 0)
  );

  // Calculate the scale factor for the bars (max height 200)
  const scale = maxValue > 0 ? 200 / maxValue : 1;

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

      {/* Graph Container */}
      <View style={styles.graphWrapper}>
        {/* Measurements Bars */}
        <View style={styles.barsContainer}>
          {Object.entries(measurements)
            .filter(([category]) => category !== 'WEIGHT')
            .map(([category, measurement]) => {
              const value = measurement?.value || 0;
              const height = value * scale;
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
                  {/* Floating value container */}
                  <View style={[
                    styles.floatingValueContainer, 
                    { 
                      bottom: `${(height / 200) * 100}%`,
                      transform: [{ translateY: 0 }] 
                    }
                  ]}>
                    <Text style={[styles.valueText, { color: categoryColor }]}>
                      {value.toFixed(1)}
                    </Text>
                    {progress && (
                      <IconButton
                        icon={progress.icon}
                        iconColor={progress.color}
                        size={12}
                        style={styles.arrowIcon}
                      />
                    )}
                  </View>

                  {/* Bar */}
                  <View style={[styles.barWrapper, { height: 160 }]}>
                    <View 
                      style={[
                        styles.bar, 
                        { height: `${(height / 200) * 100}%` }
                      ]} 
                    />
                  </View>

                  {/* Labels */}
                  <View style={styles.labelContainer}>
                    <Text style={styles.unitLabel}>cm</Text>
                    <Text style={[styles.measurementLabel, { color: categoryColor }]} numberOfLines={1}>
                      {category}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>
    </View>
  );
}

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
    height: 250,
    position: 'relative',
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
    paddingHorizontal: 8,
    paddingTop: 40,
    paddingBottom: 40,
  },
  barContainer: {
    alignItems: 'center',
    width: '13.5%',
    position: 'relative',
    height: 160,
  },
  floatingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    width: '100%',
    justifyContent: 'center',
    zIndex: 1,
  },
  valueText: {
    fontSize: 12,
    fontWeight: '500',
  },
  arrowIcon: {
    margin: 0,
    marginLeft: -6,
    marginTop: -2,
  },
  barWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: FADED_PURPLE,
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 4,
    width: '100%',
  },
  unitLabel: {
    fontSize: 10,
    color: COLORS.text,
    marginBottom: 2,
  },
  measurementLabel: {
    fontSize: 10,
    fontWeight: '500',
    width: '100%',
    textAlign: 'center',
  },
}); 