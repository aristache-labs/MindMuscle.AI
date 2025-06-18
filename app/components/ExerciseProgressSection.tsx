import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Surface } from 'react-native-paper';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { addBreadcrumb, captureError } from '../services/sentry/simpleErrorHandler';
import supabase from '../services/supabase';

const { width: screenWidth } = Dimensions.get('window');

interface ExerciseHistoryRecord {
  id: string;
  date: string;
  totalVolume: number;
  sets: Array<{
    setNumber: number;
    weight: number;
    reps: number;
  }>;
}

interface MaxWeightDataPoint {
  date: string;
  value: number;
  reps?: number;
  fullDate: string; // For click handling
}

interface ExerciseProgressSectionProps {
  exerciseId: string;
  userId?: string;
  visible: boolean;
}

interface InteractiveGraphProps {
  data: MaxWeightDataPoint[];
  onPointClick: (point: MaxWeightDataPoint) => void;
  selectedPoint: MaxWeightDataPoint | null;
}

interface WorkoutRecord {
  id: string;
  completed_at: string;
  user_exercise_records: Array<{
    set_number: number;
    weight: string | null;
    reps: string | null;
    exercise_id: string;
  }>;
}

interface SetData {
  setNumber: number;
  weight: number;
  reps: number;
}

// Interactive Graph Component with clickable points
const InteractiveExerciseGraph: React.FC<InteractiveGraphProps> = ({
  data,
  onPointClick,
  selectedPoint,
}) => {
  const chartWidth = screenWidth - SPACING.md * 4;
  const chartHeight = 120;
  const padding = 20;

  if (!data || data.length === 0) {
    return (
      <View style={styles.noDataChart}>
        <Text style={styles.noDataText}>Start tracking to see progress</Text>
      </View>
    );
  }

  if (data.length === 1) {
    return (
      <View style={styles.singleDataChart}>
        <Text style={styles.progressText}>Keep going to see trends!</Text>
      </View>
    );
  }

  // Calculate chart points
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  const paddedMin = Math.max(0, minValue - valueRange * 0.1);
  const paddedMax = maxValue + valueRange * 0.1;
  const paddedRange = paddedMax - paddedMin;

  const points = data.map((point, index) => {
    const startX = chartWidth * 0.15;
    const usableWidth = chartWidth * 0.7;
    const x = startX + (index / (data.length - 1)) * usableWidth;
    const normalizedValue = (point.value - paddedMin) / paddedRange;
    const y = padding + (chartHeight - padding * 2) * (1 - normalizedValue);
    return { x, y, value: point.value, dataPoint: point };
  });

  // Create paths
  const createLinePath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  const createAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return '';
    const bottomY = chartHeight - padding;
    let path = `M ${points[0].x} ${bottomY}`;
    path += ` L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    path += ` L ${points[points.length - 1].x} ${bottomY} Z`;
    return path;
  };

  const linePath = createLinePath(points);
  const areaPath = createAreaPath(points);

  return (
    <View style={styles.chartArea}>
      <Svg width={chartWidth} height={chartHeight} style={styles.svg}>
        <Defs>
          <SvgLinearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#FFA500" stopOpacity="1" />
          </SvgLinearGradient>
          <SvgLinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#FFA500" stopOpacity="0.1" />
          </SvgLinearGradient>
        </Defs>

        {/* Area under the line */}
        <Path d={areaPath} fill="url(#areaGradient)" stroke="none" />

        {/* Main trend line */}
        <Path
          d={linePath}
          stroke="url(#lineGradient)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Clickable data points */}
        {points.map((point, index) => {
          const isSelected = selectedPoint?.fullDate === point.dataPoint.fullDate;
          return (
            <Circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={isSelected ? '6' : '4'}
              fill={isSelected ? '#FFD700' : '#FFA500'}
              stroke="#FFF"
              strokeWidth="2"
              onPress={() => onPointClick(point.dataPoint)}
            />
          );
        })}
      </Svg>

      {/* Month labels at bottom */}
      <View style={styles.monthLabels}>
        {data.map((_, index) => {
          if (index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2)) {
            const point = points[index];
            const month = new Date(data[index].fullDate).toLocaleDateString('en-US', {
              month: 'short',
            });
            return (
              <Text key={index} style={[styles.monthLabel, { left: point.x - 15 }]}>
                {month}
              </Text>
            );
          }
          return null;
        })}
      </View>
    </View>
  );
};

// Exercise History List Component
const ExerciseHistoryList: React.FC<{
  history: ExerciseHistoryRecord[];
  loading: boolean;
  requiresWeight: boolean;
}> = ({ history, loading, requiresWeight }) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  if (!history || history.length === 0) {
    return (
      <View style={styles.noHistoryContainer}>
        <Text style={styles.noHistoryText}>No workout history yet</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
      {history.map((record) => (
        <View key={record.id} style={styles.historyItem}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyDate}>{record.date}</Text>
            <Text style={styles.historyVolume}>
              {requiresWeight && `Total Volume: ${record.totalVolume.toFixed(1)} kg | `}
              {record.sets.length} Set{record.sets.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.setsContainer}>
            {record.sets.map((set, index) => (
              <View key={index} style={styles.setRow}>
                {set.weight > 0 && <Text style={styles.setWeight}>{set.weight} kg</Text>}
                <Text style={styles.setReps}>{set.reps} reps</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// Main ExerciseProgressSection Component
export default function ExerciseProgressSection({
  exerciseId,
  userId,
  visible,
}: ExerciseProgressSectionProps) {
  const [maxWeightData, setMaxWeightData] = useState<MaxWeightDataPoint[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<MaxWeightDataPoint | null>(null);
  const [absoluteMaxWeight, setAbsoluteMaxWeight] = useState<{
    weight: number;
    reps: number;
    date: string;
    isWeight: boolean;
  } | null>(null);
  const [requiresWeight, setRequiresWeight] = useState(true);

  const sectionHeight = useSharedValue(0);

  // Fetch max weight data for graph
  const fetchMaxWeightData = useCallback(async () => {
    if (!userId || !exerciseId) return;

    try {
      setLoading(true);
      addBreadcrumb('Fetching exercise max weight data for graph', 'exercise.progress', {
        exerciseId,
        userId,
      });

      // First check if this exercise requires weight
      const { data: exerciseInfo } = await supabase
        .from('exercises')
        .select('requires_weight')
        .eq('id', exerciseId)
        .single();

      const requiresWeight = exerciseInfo?.requires_weight !== false;

      let query = supabase
        .from('user_exercise_records')
        .select(
          `
          weight,
          reps,
          user_workout_history!inner(
            completed_at,
            user_id
          )
        `,
        )
        .eq('exercise_id', exerciseId)
        .eq('user_workout_history.user_id', userId)
        .eq('completed', true);

      // Only filter by weight for exercises that require weight
      if (requiresWeight) {
        query = query.not('weight', 'is', null).neq('weight', 0);
      }

      const { data: exerciseRecords, error } = await query.order(
        'user_workout_history(completed_at)',
        { ascending: true },
      );

      if (error) {
        captureError(new Error(`Failed to fetch max weight data: ${error.message}`), {
          category: 'database_error',
          component: 'ExerciseProgressSection',
          action: 'fetchMaxWeightData',
          exerciseId,
          userId,
        });
        return;
      }

      if (exerciseRecords && exerciseRecords.length > 0) {
        // Group by workout date and find max value per session (weight or reps)
        const sessionData = new Map<
          string,
          { maxValue: number; reps: number; date: Date; isWeight: boolean }
        >();

        exerciseRecords.forEach((record: Record<string, unknown>) => {
          const weight = parseFloat((record.weight as string) || '0') || 0;
          const reps = parseInt((record.reps as string) || '0') || 0;
          const completedAt = new Date(
            (record.user_workout_history as { completed_at: string }).completed_at,
          );
          const dateKey = completedAt.toDateString();

          // For weight exercises, track max weight; for bodyweight, track max reps
          const value = requiresWeight ? weight : reps;
          const existing = sessionData.get(dateKey);

          if (!existing || value > existing.maxValue) {
            sessionData.set(dateKey, {
              maxValue: value,
              reps: reps,
              date: completedAt,
              isWeight: requiresWeight,
            });
          }
        });

        // Convert to chart data format
        const chartData = Array.from(sessionData.values())
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(-10) // Take last 10 sessions
          .map((item) => ({
            date: item.date.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
            }),
            value: item.maxValue,
            reps: item.reps,
            fullDate: item.date.toISOString(),
          }));

        setMaxWeightData(chartData);

        // Find absolute max
        const maxRecord = Array.from(sessionData.values()).reduce((max, current) =>
          current.maxValue > max.maxValue ? current : max,
        );

        setRequiresWeight(requiresWeight);
        setAbsoluteMaxWeight({
          weight: maxRecord.maxValue,
          reps: maxRecord.reps,
          date: maxRecord.date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          isWeight: requiresWeight,
        });

        // Auto-select the latest point
        if (chartData.length > 0) {
          setSelectedPoint(chartData[chartData.length - 1]);
        }
      }
    } catch (error) {
      captureError(error as Error, {
        category: 'database_error',
        component: 'ExerciseProgressSection',
        action: 'fetchMaxWeightData',
        exerciseId,
        userId,
      });
    } finally {
      setLoading(false);
    }
  }, [userId, exerciseId]);

  // Fetch exercise history for list
  const fetchExerciseHistory = useCallback(async () => {
    if (!userId || !exerciseId) return;

    try {
      setHistoryLoading(true);
      addBreadcrumb('Fetching exercise history for list', 'exercise.progress', {
        exerciseId,
        userId,
      });

      const { data: historyData, error } = await supabase
        .from('user_workout_history')
        .select(
          `
          id,
          completed_at,
          user_exercise_records!inner(
            set_number,
            weight,
            reps,
            exercise_id
          )
        `,
        )
        .eq('user_id', userId)
        .eq('user_exercise_records.exercise_id', exerciseId)
        .eq('user_exercise_records.completed', true)
        .order('completed_at', { ascending: false })
        .limit(10);

      if (error) {
        captureError(new Error(`Failed to fetch exercise history: ${error.message}`), {
          category: 'database_error',
          component: 'ExerciseProgressSection',
          action: 'fetchExerciseHistory',
          exerciseId,
          userId,
        });
        return;
      }

      if (historyData && historyData.length > 0) {
        const formattedHistory = historyData.map((workout: WorkoutRecord) => {
          const sets = workout.user_exercise_records
            .map((record) => ({
              setNumber: record.set_number,
              weight: parseFloat(record.weight || '0') || 0,
              reps: parseInt(record.reps || '0') || 0,
            }))
            .sort((a: SetData, b: SetData) => a.setNumber - b.setNumber);

          const totalVolume = sets.reduce(
            (sum: number, set: SetData) => sum + set.weight * set.reps,
            0,
          );

          return {
            id: workout.id,
            date: new Date(workout.completed_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            }),
            totalVolume,
            sets,
          };
        });

        setExerciseHistory(formattedHistory);
      }
    } catch (error) {
      captureError(error as Error, {
        category: 'database_error',
        component: 'ExerciseProgressSection',
        action: 'fetchExerciseHistory',
        exerciseId,
        userId,
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [userId, exerciseId]);

  // Effect to fetch data when visible
  useEffect(() => {
    if (visible && userId && exerciseId) {
      fetchMaxWeightData();
      fetchExerciseHistory();
    }
  }, [visible, userId, exerciseId, fetchMaxWeightData, fetchExerciseHistory]);

  // Handle point click on graph
  const handlePointClick = useCallback(
    (point: MaxWeightDataPoint) => {
      setSelectedPoint(point);
      addBreadcrumb('Graph point clicked', 'user.interaction', {
        exerciseId,
        pointDate: point.fullDate,
        pointValue: point.value,
      });
    },
    [exerciseId],
  );

  // Animated section style
  const animatedSectionStyle = useAnimatedStyle(() => ({
    height: withTiming(sectionHeight.value, { duration: 300 }),
  }));

  // Show section height when data is loaded
  useEffect(() => {
    if (!loading) {
      // For bodyweight exercises, show smaller height (just history)
      // For weighted exercises, show full height with graph
      const height = requiresWeight && maxWeightData.length > 0 ? 510 : 310;
      sectionHeight.value = height;
    }
  }, [loading, maxWeightData.length, requiresWeight, sectionHeight]);

  // Display current selection info
  const displayInfo = useMemo(() => {
    if (selectedPoint) {
      return {
        weight: selectedPoint.value,
        reps: selectedPoint.reps || 0,
        date: new Date(selectedPoint.fullDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      };
    }
    return absoluteMaxWeight;
  }, [selectedPoint, absoluteMaxWeight]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedSectionStyle]}>
      <Surface style={styles.sectionContent}>
        {/* Max Weight Section - Only show for weighted exercises */}
        {requiresWeight && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Max Weight Lifted</Text>
              {displayInfo && (
                <View style={styles.statsContainer}>
                  <Text style={styles.maxWeightText}>{displayInfo.weight} kg</Text>
                  <Text style={styles.maxDetailsText}>
                    {displayInfo.date}, {displayInfo.reps} reps
                  </Text>
                </View>
              )}
            </View>

            {/* Interactive Graph */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <InteractiveExerciseGraph
                data={maxWeightData}
                onPointClick={handlePointClick}
                selectedPoint={selectedPoint}
              />
            )}
          </>
        )}

        {/* Exercise History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Exercise History</Text>
          <ExerciseHistoryList 
            history={exerciseHistory} 
            loading={historyLoading} 
            requiresWeight={requiresWeight} 
          />
        </View>
      </Surface>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  sectionContent: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  maxWeightText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 2,
  },
  maxDetailsText: {
    fontSize: 12,
    color: COLORS.secondary,
    opacity: 0.8,
  },
  chartArea: {
    height: 120,
    marginVertical: SPACING.sm,
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  monthLabels: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    height: 20,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 10,
    color: COLORS.secondary,
    opacity: 0.7,
    width: 30,
    textAlign: 'center',
  },
  noDataChart: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  noDataText: {
    color: COLORS.secondary,
    fontSize: 14,
    opacity: 0.6,
  },
  singleDataChart: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  progressText: {
    color: COLORS.secondary,
    fontSize: 12,
    opacity: 0.7,
  },
  historySection: {
    borderTopWidth: 0,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  historyList: {
    maxHeight: 250,
  },
  historyItem: {
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: SPACING.sm,
  },
  historyHeader: {
    marginBottom: SPACING.xs,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  historyVolume: {
    fontSize: 12,
    color: COLORS.secondary,
    opacity: 0.8,
  },
  setsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  setRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 80,
    justifyContent: 'space-between',
  },
  setWeight: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  setReps: {
    fontSize: 12,
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  loadingText: {
    color: COLORS.secondary,
    fontSize: 14,
    marginLeft: SPACING.xs,
  },
  noHistoryContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noHistoryText: {
    color: COLORS.secondary,
    fontSize: 14,
    opacity: 0.6,
  },
  bodyweightHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bodyweightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bodyweightSubtitle: {
    fontSize: 14,
    color: COLORS.secondary,
    opacity: 0.8,
    textAlign: 'center',
  },
});
