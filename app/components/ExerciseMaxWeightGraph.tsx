import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');

interface MaxWeightDataPoint {
  date: string;
  value: number;
  reps?: number;
}

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

interface ExerciseMaxWeightGraphProps {
  data: MaxWeightDataPoint[];
  exerciseName: string;
  absoluteMaxWeight?: { weight: number; reps: number; date: string } | null;
}

export default function ExerciseMaxWeightGraph({
  data,
  absoluteMaxWeight,
}: ExerciseMaxWeightGraphProps) {
  // Calculate chart dimensions
  const chartWidth = screenWidth - SPACING.md * 4;
  const chartHeight = 80;
  const padding = 20;

  if (!data || data.length === 0) {
    // Show a placeholder with absolute max weight if available
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Max Weight Lifted</Text>
        </View>
        <View style={styles.chartContainer}>
          <View style={styles.statsContainer}>
            {absoluteMaxWeight ? (
              <>
                <Text style={styles.maxWeightText}>{absoluteMaxWeight.weight} kg</Text>
                <Text style={styles.maxRepsText}>{absoluteMaxWeight.reps} reps</Text>
                <Text style={styles.maxDateText}>{absoluteMaxWeight.date}</Text>
              </>
            ) : (
              <>
                <Text style={styles.statsText}>-- kg</Text>
                <Text style={styles.statsText}>-- reps</Text>
                <Text style={styles.statsText}>--/--/----</Text>
              </>
            )}
          </View>
          <View style={styles.noDataChart}>
            <Text style={styles.noDataText}>Start tracking to see progress</Text>
          </View>
        </View>
      </View>
    );
  }

  // Show single data point as a simple display
  if (data.length === 1) {
    const singleValue = data[0]?.value || 0;
    const singleReps = data[0]?.reps || 0;
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Max Weight Lifted</Text>
        </View>
        <View style={styles.chartContainer}>
          <View style={styles.statsContainer}>
            {absoluteMaxWeight ? (
              <>
                <Text style={styles.maxWeightText}>{absoluteMaxWeight.weight} kg</Text>
                <Text style={styles.maxRepsText}>{absoluteMaxWeight.reps} reps</Text>
                <Text style={styles.maxDateText}>{absoluteMaxWeight.date}</Text>
              </>
            ) : (
              <>
                <Text style={styles.maxWeightText}>{singleValue} kg</Text>
                <Text style={styles.maxRepsText}>{singleReps} reps</Text>
                <Text style={styles.maxDateText}>First workout</Text>
              </>
            )}
          </View>
          <View style={styles.singleDataChart}>
            <Text style={styles.progressText}>Keep going to see trends!</Text>
          </View>
        </View>
      </View>
    );
  }

  // Multiple data points - create trending line chart
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  // Add some padding to the range for better visualization
  const valueRange = maxValue - minValue || 1;
  const paddedMin = Math.max(0, minValue - valueRange * 0);
  const paddedMax = maxValue + valueRange * 0;
  const paddedRange = paddedMax - paddedMin;

  // Calculate points for the line chart
  const points = data.map((point, index) => {
    // Start from 30% of the chart width and use 60% of the remaining width
    const startX = chartWidth * 0.2;
    const usableWidth = chartWidth * 0.7;
    const x = startX + (index / (data.length - 1.5)) * usableWidth;
    const normalizedValue = (point.value - paddedMin) / paddedRange;
    const y = padding + (chartHeight - padding * 2) * (1 - normalizedValue);
    return { x, y, value: point.value };
  });

  // Create simple line path
  const createLinePath = (points: ChartPoint[]) => {
    if (points.length < 2) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Create filled area path
  const createAreaPath = (points: ChartPoint[]) => {
    if (points.length < 2) return '';

    const bottomY = chartHeight - padding;
    let path = `M ${points[0].x} ${bottomY}`;
    path += ` L ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    path += ` L ${points[points.length - 1].x} ${bottomY}`;
    path += ' Z';
    return path;
  };

  const linePath = createLinePath(points);
  const areaPath = createAreaPath(points);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Max Weight Lifted</Text>
      </View>
      <View style={styles.chartContainer}>
        <View style={styles.statsContainer}>
          {absoluteMaxWeight ? (
            <>
              <Text style={styles.maxWeightText}>{absoluteMaxWeight.weight} kg</Text>
              <Text style={styles.maxRepsText}>{absoluteMaxWeight.reps} reps</Text>
              <Text style={styles.maxDateText}>{absoluteMaxWeight.date}</Text>
            </>
          ) : (
            <>
              <Text style={styles.statsText}>-- kg</Text>
              <Text style={styles.statsText}>-- reps</Text>
              <Text style={styles.statsText}>--/--/----</Text>
            </>
          )}
        </View>
        <View style={styles.chartArea}>
          <Svg width={chartWidth} height={chartHeight} style={styles.svg}>
            <Defs>
              <SvgLinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={COLORS.secondary} stopOpacity="1" />
              </SvgLinearGradient>
              <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={COLORS.primary} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={COLORS.secondary} stopOpacity="0.1" />
              </SvgLinearGradient>
            </Defs>

            {/* Filled area under the line */}
            <Path d={areaPath} fill="url(#areaGradient)" stroke="none" />

            {/* Main trend line */}
            <Path
              d={linePath}
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points - only show the last one */}
            {points.slice(-1).map((point) => (
              <Circle
                key={points.length - 1.5}
                cx={point.x}
                cy={point.y}
                r="4"
                fill={COLORS.primary}
                stroke="#FFF"
                strokeWidth="2"
              />
            ))}
          </Svg>

          {/* Weight labels at start and end - REMOVED */}
          {/* 
          <View style={[styles.weightLabel, { left: padding - 10 }]}>
            <Text style={styles.weightLabelText}>{values[0]} kg</Text>
          </View>
          <View style={[styles.weightLabel, { right: padding - 10 }]}>
            <Text style={styles.weightLabelText}>{values[values.length - 1]} kg</Text>
          </View>
          */}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: SPACING.xs,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  chartContainer: {
    position: 'relative',
    paddingBottom: SPACING.sm,
  },
  statsContainer: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    zIndex: 2,
    alignItems: 'flex-start',
  },
  statsText: {
    color: COLORS.secondary,
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  chartArea: {
    height: 80,
    marginTop: SPACING.sm,
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: SPACING.sm,
  },
  noDataChart: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  noDataText: {
    color: COLORS.secondary,
    fontSize: 14,
    opacity: 0.6,
  },
  singleDataChart: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  progressText: {
    color: COLORS.secondary,
    fontSize: 12,
    opacity: 0.7,
  },
  maxWeightText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  maxRepsText: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  maxDateText: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.6,
  },
  weightLabel: {
    position: 'absolute',
    bottom: -5,
  },
  weightLabelText: {
    color: COLORS.secondary,
    fontSize: 10,
    opacity: 0.8,
  },
});
