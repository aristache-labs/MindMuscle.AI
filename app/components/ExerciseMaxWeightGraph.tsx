import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

const { width: screenWidth } = Dimensions.get('window');

interface MaxWeightDataPoint {
  date: string;
  value: number;
  reps?: number;
}

interface ExerciseMaxWeightGraphProps {
  data: MaxWeightDataPoint[];
  exerciseName: string;
  absoluteMaxWeight?: { weight: number, reps: number, date: string } | null;
}

export default function ExerciseMaxWeightGraph({ data, exerciseName, absoluteMaxWeight }: ExerciseMaxWeightGraphProps) {
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
            <Text style={styles.noDataText}>No trend data yet</Text>
          </View>
        </View>
      </View>
    );
  }

  // Show single data point
  if (data.length === 1) {
    const singleValue = data[0]?.value || 0;
    const singleDate = data[0]?.date || '';
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
                <Text style={styles.maxDateText}>{singleDate}</Text>
              </>
            )}
          </View>
          <View style={styles.singleDataChart}>
            <View style={styles.singleDataPoint} />
          </View>
        </View>
      </View>
    );
  }

  // Calculate chart dimensions
  const chartWidth = screenWidth - (SPACING.md * 2);
  const chartHeight = 100;
  const padding = 20;

  // Find min and max values for scaling
  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  
  // Create more dramatic scaling to show upward trend
  const paddedMin = Math.max(0, minValue - (valueRange * 0.4)); // Don't go below 0
  const paddedMax = maxValue + (valueRange * 0.2);
  const paddedRange = paddedMax - paddedMin;

  // Calculate points for smooth curve
  const points = data.map((point, index) => {
    const x = padding + (index / Math.max(data.length - 1, 1)) * (chartWidth - padding * 2);
    const normalizedValue = (point.value - paddedMin) / paddedRange;
    const y = padding + (chartHeight - padding * 2) * (1 - normalizedValue);
    return { x, y, value: point.value };
  });

  // Create smooth curve path
  const createSmoothPath = (points: any[]) => {
    if (points.length < 2) return '';
    
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      // Create smoother curves
      const cp1x = prev.x + (curr.x - prev.x) * 0.5;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) * 0.5;
      const cp2y = curr.y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }
    
    return path;
  };

  // Create area path for gradient fill
  const createAreaPath = (points: any[]) => {
    const linePath = createSmoothPath(points);
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    return `${linePath} L ${lastPoint.x} ${chartHeight - 10} L ${firstPoint.x} ${chartHeight - 10} Z`;
  };

  const linePath = createSmoothPath(points);
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
              <SvgLinearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.95" />
                <Stop offset="20%" stopColor="#FFD700" stopOpacity="0.8" />
                <Stop offset="60%" stopColor="#FFD700" stopOpacity="0.5" />
                <Stop offset="100%" stopColor="#FFD700" stopOpacity="0.1" />
              </SvgLinearGradient>
            </Defs>
            
            {/* Area fill */}
            <Path
              d={areaPath}
              fill="url(#gradient)"
            />
            
            {/* Line stroke */}
            <Path
              d={linePath}
              stroke="#FFD700"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  chartContainer: {
    position: 'relative',
  },
  statsContainer: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    zIndex: 2,
  },
  statsText: {
    color: COLORS.secondary,
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 2,
  },
  chartArea: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  noDataChart: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  noDataText: {
    color: COLORS.secondary,
    fontSize: 14,
    opacity: 0.6,
  },
  singleDataChart: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  singleDataPoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD700',
    marginTop: 10,
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
}); 