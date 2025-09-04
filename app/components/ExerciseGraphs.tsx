import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Alert, Platform, ScrollView, Dimensions } from 'react-native';
import { Text, IconButton, Surface, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  VictoryChart,
  VictoryArea,
  VictoryAxis,
  VictoryScatter,
  VictoryLabel,
} from 'victory-native';
import { LinearGradient } from 'expo-linear-gradient';
import { parse } from 'date-fns';
import * as Sentry from '@sentry/react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export interface ExerciseData {
  id: string;
  name: string;
  data: {
    date: string;
    value: number;
  }[];
  unit?: string;
}

interface ExerciseGraphsProps {
  exercises: ExerciseData[];
  onAddExercise: () => void;
  onSetGoal?: (exerciseId: string) => void;
  onDeleteExercise?: (exerciseId: string) => void;
}

interface SelectedDataPoint {
  exerciseId: string;
  dataIndex: number;
  date: string;
  weight: number;
  x: number;
  y: number;
}

const ExerciseGraphs: React.FC<ExerciseGraphsProps> = ({
  exercises,
  onAddExercise,
  onSetGoal,
  onDeleteExercise,
}) => {
  const [selectedDataPoint, setSelectedDataPoint] = useState<SelectedDataPoint | null>(null);
  const windowWidth = Dimensions.get('window').width;
  const SURFACE_MARGIN = 8; // container margins
  const CARD_MARGIN = 4; // card horizontal margins
  const CARD_BORDER = 0; // card border width
  const CHART_SECTION_PADDING = 4; // SPACING.xs
  const CHART_CLIP_PADDING = 0; // no padding for maximum chart space
  // Chart width calculation accounting for all margins and padding
  const chartWidth =
    windowWidth -
    (SURFACE_MARGIN * 2 +
      CARD_MARGIN * 2 +
      CARD_BORDER * 2 +
      CHART_SECTION_PADDING * 2 +
      CHART_CLIP_PADDING * 2) -
    0; // Additional buffer for 4 wider labels

  // getLabelInterval removed; buildXAxisLabels handles label spacing

  function reduceByDate(data: { date: string; value: number }[]) {
    const byDate = new Map<string, number>();
    for (const point of data) {
      const existing = byDate.get(point.date);
      // Keep the highest weight for each date (Personal Record for that day)
      if (existing === undefined || point.value > existing) {
        byDate.set(point.date, point.value);
      }
    }
    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => {
        // Sort by date to ensure proper chronological order (dd.MM format)
        const currentYear = new Date().getFullYear();
        const dateA = parse(a.date + '.' + currentYear, 'dd.MM.yyyy', new Date());
        const dateB = parse(b.date + '.' + currentYear, 'dd.MM.yyyy', new Date());
        return dateA.getTime() - dateB.getTime();
      });
  }

  function getExerciseStats(exercise: ExerciseData) {
    const reduced = reduceByDate(exercise.data);
    const values = reduced.map((d) => d.value);
    const firstValue = values.length > 0 ? values[0] : 0;
    const lastValue = values.length > 0 ? values[values.length - 1] : 0;
    const prevValue = values.length > 1 ? values[values.length - 2] : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    const growthPercent = firstValue > 0 ? ((maxValue - firstValue) / firstValue) * 100 : 0;
    const startedLabel = reduced.length > 0 ? reduced[0].date : '--';

    // Calculate progress change with proper formatting
    const progressChange = lastValue - prevValue;
    const progressChangeText =
      values.length >= 2 ? `${progressChange > 0 ? '+' : ''}${progressChange}kg` : '--';

    return {
      values,
      firstValue,
      lastValue,
      prevValue,
      maxValue,
      growthPercent,
      startedLabel,
      reduced,
      progressChangeText,
    };
  }

  function getProgressColor(lastValue: number, prevValue: number, hasData: boolean) {
    if (!hasData) return COLORS.text;
    if (lastValue - prevValue > 0) return COLORS.success;
    if (lastValue - prevValue < 0) return COLORS.error;
    return COLORS.primary;
  }

  function getProgressIcon(lastValue: number, prevValue: number, hasData: boolean) {
    if (!hasData) return 'minus';
    if (lastValue - prevValue > 0) return 'arrow-up-bold';
    if (lastValue - prevValue < 0) return 'arrow-down-bold';
    return 'minus';
  }

  // Get 4 strategic dates from the exercise data
  function getStrategicDates(exerciseData: { date: string; value: number }[]) {
    if (exerciseData.length === 0) return [];
    if (exerciseData.length === 1) return [exerciseData[0].date];
    if (exerciseData.length === 2) return [exerciseData[0].date, exerciseData[1].date];
    if (exerciseData.length === 3)
      return [exerciseData[0].date, exerciseData[1].date, exerciseData[2].date];

    const dataLength = exerciseData.length;
    const firstIndex = 0;
    const lastIndex = dataLength - 1;
    const middleIndex1 = Math.round(dataLength / 3) - 1;
    const middleIndex2 = Math.round((dataLength * 2) / 3) - 1;

    return [
      exerciseData[firstIndex].date, // First date
      exerciseData[middleIndex1].date, // 1/3 date
      exerciseData[middleIndex2].date, // 2/3 date
      exerciseData[lastIndex].date, // Last date
    ];
  }

  // Map each data point proportionally across the full range (1 to 4)
  function getDataPointPosition(dataIndex: number, totalDataPoints: number) {
    if (totalDataPoints === 1) return 1;

    // For multiple data points, distribute them evenly across positions 1 to 4
    const progress = dataIndex / (totalDataPoints - 1); // 0 to 1
    return 1 + progress * 3; // Maps 0-1 to 1-4 range
  }

  // Transform data for Victory charts with proportional X positions
  function transformDataForVictory(exerciseData: { date: string; value: number }[]) {
    return exerciseData.map((point, index) => ({
      x: getDataPointPosition(index, exerciseData.length), // Proportional positions across 1-4 range
      y: point.value,
      date: point.date,
      index,
    }));
  }

  // Get fixed axis labels for positions 1, 2, 3, 4 with adjusted label positions
  function getFixedAxisLabels(exerciseData: { date: string; value: number }[]) {
    const strategicDates = getStrategicDates(exerciseData);

    // Always use positions 1, 2, 3, 4 but only show labels we have
    const maxPositions = Math.min(4, strategicDates.length);

    // Adjust label positions - move the first label right and last label left
    const tickValues = Array.from({ length: maxPositions }, (_, i) => {
      if (i === 0) {
        return 1.1; // Move the first date label slightly right
      }
      if (i === maxPositions - 1 && maxPositions === 4) {
        return 3.9; // Move the last date label slightly left
      }
      return i + 1;
    });

    const tickLabels = strategicDates.slice(0, maxPositions);

    return { tickValues, tickLabels };
  }

  function renderExerciseCard(exercise: ExerciseData) {
    const {
      lastValue,
      prevValue,
      maxValue,
      growthPercent,
      startedLabel,
      reduced,
      progressChangeText,
    } = getExerciseStats(exercise);

    return (
      <View key={exercise.id} style={styles.graphCard}>
        <LinearGradient
          colors={['rgba(42, 45, 58, 0.95)', 'rgba(38, 42, 52, 0.98)']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.exerciseHeader}>
          <View style={styles.exerciseNameContainer}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.data.length > 0 && (
              <Text style={styles.dataPointsCount}>
                {exercise.data.length} workout{exercise.data.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={styles.maxValueContainer}>
            {exercise.data.length > 0 ? (
              <>
                <Text style={styles.maxValue}>
                  {maxValue}
                  <Text style={styles.unitText}>{exercise.unit}</Text>
                </Text>
                <Text style={styles.maxLabel}>Max</Text>
                {exercise.data.some((d) => d.date.includes('PR')) && (
                  <Text style={styles.prLabel}>PR</Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.maxValue}>
                  --
                  <Text style={styles.unitText}>{exercise.unit}</Text>
                </Text>
                <Text style={styles.maxLabel}>Max</Text>
              </>
            )}
          </View>
        </View>

        {/* Progress Info Section */}
        {exercise.data.length > 0 && (
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
            style={styles.progressInfoSection}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.progressItem}>
              <View style={styles.progressValueContainer}>
                <MaterialCommunityIcons
                  name="trending-up"
                  size={16}
                  color={COLORS.success}
                  style={styles.progressIcon}
                />
                <Text style={[styles.progressValue, { color: COLORS.success }]}>
                  {growthPercent.toFixed(1)}%
                </Text>
              </View>
              <Text style={styles.progressLabel}>Total Growth</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressItem}>
              <View style={styles.progressValueContainer}>
                {exercise.data.length >= 2 && (
                  <MaterialCommunityIcons
                    name={getProgressIcon(lastValue, prevValue, exercise.data.length >= 2)}
                    size={16}
                    color={getProgressColor(lastValue, prevValue, exercise.data.length >= 2)}
                    style={styles.progressIcon}
                  />
                )}
                <Text
                  style={[
                    styles.progressValue,
                    {
                      color: getProgressColor(lastValue, prevValue, exercise.data.length >= 2),
                    },
                  ]}
                >
                  {progressChangeText}
                </Text>
              </View>
              <Text style={styles.progressLabel}>Last Session</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressItem}>
              <View style={styles.progressValueContainer}>
                <MaterialCommunityIcons
                  name="calendar-clock"
                  size={16}
                  color={COLORS.secondary}
                  style={styles.progressIcon}
                />
                <Text style={[styles.progressValue, { color: COLORS.secondary }]}>
                  {startedLabel}
                </Text>
              </View>
              <Text style={styles.progressLabel}>First Session</Text>
            </View>
          </LinearGradient>
        )}

        {/* Chart Section */}
        <View style={styles.chartSection}>
          {reduced.length > 0 ? (
            <View style={[styles.chartClip, { width: chartWidth }]}>{renderChart(exercise)}</View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No workout data yet</Text>
              <Text style={styles.noDataSubtext}>
                Complete workouts with this exercise to see progress
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons Section - Bottom Row */}
        <View style={styles.bottomActionsSection}>
          <View style={styles.bottomActionButton}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.gradientEnd]}
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <IconButton
                icon="flag-variant"
                mode="contained"
                iconColor={COLORS.text}
                size={16}
                onPress={() => onSetGoal?.(exercise.id)}
                style={styles.bottomButtonIcon}
                containerColor="transparent"
              />
            </LinearGradient>
            <Text style={styles.bottomButtonText}>Set Goal</Text>
          </View>
          <View style={styles.bottomActionButton}>
            <LinearGradient
              colors={[COLORS.error, '#E53E3E']}
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <IconButton
                icon="trash-can-outline"
                mode="contained"
                iconColor={COLORS.text}
                size={16}
                onPress={() => handleDeletePress(exercise.id)}
                style={styles.bottomButtonIcon}
                containerColor="transparent"
              />
            </LinearGradient>
            <Text style={styles.bottomButtonText}>Remove</Text>
          </View>
        </View>
      </View>
    );
  }

  // Track component lifecycle with Sentry
  useEffect(() => {
    try {
      Sentry.addBreadcrumb({
        message: 'ExerciseGraphs component mounted',
        category: 'component',
        level: 'info',
        data: {
          exerciseCount: exercises.length,
          hasExercises: exercises.length > 0,
          exerciseNames: exercises.map((e) => e.name).slice(0, 5), // First 5 exercise names
          chartWidth,
        },
      });
    } catch (error) {
      console.warn('Failed to log Sentry breadcrumb for ExerciseGraphs mount:', error);
    }

    return () => {
      try {
        Sentry.addBreadcrumb({
          message: 'ExerciseGraphs component unmounted',
          category: 'component',
          level: 'info',
          data: {
            exerciseCount: exercises.length,
          },
        });
      } catch (error) {
        console.warn('Failed to log Sentry breadcrumb for ExerciseGraphs unmount:', error);
      }
    };
  }, [exercises.length, chartWidth]);

  // Track when exercises data changes
  useEffect(() => {
    if (exercises.length > 0) {
      try {
        const totalDataPoints = exercises.reduce((sum, ex) => sum + ex.data.length, 0);
        const exercisesWithGoals = exercises.filter((ex) =>
          ex.data.some((d) => d.date.includes('PR')),
        );

        Sentry.addBreadcrumb({
          message: 'Exercise data updated',
          category: 'data.update',
          level: 'info',
          data: {
            exerciseCount: exercises.length,
            totalDataPoints,
            exercisesWithPRs: exercisesWithGoals.length,
            avgDataPointsPerExercise: Math.round(totalDataPoints / exercises.length),
          },
        });
      } catch (error) {
        Sentry.captureException(error, {
          tags: {
            component: 'ExerciseGraphs',
            action: 'trackDataChanges',
          },
          extra: {
            exerciseCount: exercises.length,
          },
        });
      }
    }
  }, [exercises]);

  // Helper function to render chart for an exercise
  const renderChart = (exercise: ExerciseData) => {
    const chartData = transformDataForVictory(exercise.data);
    const maxDataValue = Math.max(...exercise.data.map((d) => d.value));
    const prDataPoint = exercise.data.find((d) => d.value === maxDataValue);
    const prIndex = chartData.findIndex((d) => d.date === prDataPoint?.date);
    const showPR = exercise.data.length > 1;
    const { tickValues, tickLabels } = getFixedAxisLabels(exercise.data);

    return (
      <>
        <VictoryChart
          domain={{ x: [1, 4], y: [-maxDataValue * 0.15, maxDataValue * 1.3] }}
          padding={{ left: 45, top: 20, right: 15, bottom: 40 }}
          height={250}
          width={chartWidth}
        >
          <VictoryArea
            data={chartData}
            style={{
              data: {
                fill: COLORS.gradientStart,
                fillOpacity: 0.3,
                stroke: COLORS.primary,
                strokeWidth: 3,
              },
            }}
            interpolation="cardinal"
          />

          {/* Invisible larger touch targets */}
          <VictoryScatter
            data={chartData}
            size={20}
            style={{
              data: {
                fill: 'transparent',
                stroke: 'transparent',
              },
            }}
            events={[
              {
                target: 'data',
                eventHandlers: {
                  onPress: (_event, props) => {
                    const dataIndex = props.index as number;
                    const datum = props.datum;
                    if (
                      selectedDataPoint?.exerciseId === exercise.id &&
                      selectedDataPoint?.dataIndex === dataIndex
                    ) {
                      setSelectedDataPoint(null);
                    } else {
                      setSelectedDataPoint({
                        exerciseId: exercise.id,
                        dataIndex,
                        date: datum.date,
                        weight: datum.y,
                        x: datum.x,
                        y: datum.y,
                      });
                    }
                    return null;
                  },
                },
              },
            ]}
          />

          {/* Visible data points */}
          <VictoryScatter
            data={chartData}
            size={(data) => {
              const dataIndex = data.index as number;
              const isSelected =
                selectedDataPoint?.exerciseId === exercise.id &&
                selectedDataPoint?.dataIndex === dataIndex;
              if (isSelected) return 6;
              return dataIndex === prIndex ? 5 : 3;
            }}
            style={{
              data: {
                fill: (data) => {
                  const dataIndex = data.index as number;
                  const isSelected =
                    selectedDataPoint?.exerciseId === exercise.id &&
                    selectedDataPoint?.dataIndex === dataIndex;
                  if (isSelected) return COLORS.warning;
                  return dataIndex === prIndex ? COLORS.success : COLORS.primary;
                },
                stroke: (data) => {
                  const dataIndex = data.index as number;
                  const isSelected =
                    selectedDataPoint?.exerciseId === exercise.id &&
                    selectedDataPoint?.dataIndex === dataIndex;
                  if (isSelected) return COLORS.warning;
                  return dataIndex === prIndex ? COLORS.success : COLORS.primary;
                },
                strokeWidth: 3,
                cursor: 'pointer',
              },
            }}
          />

          {showPR && (
            <VictoryScatter
              data={[chartData[prIndex]]}
              labelComponent={
                <VictoryLabel
                  style={{
                    fill: COLORS.success,
                    fontSize: FONT_SIZES.xs,
                    fontWeight: 'bold',
                  }}
                  dy={-15}
                />
              }
              labels={() => 'PR'}
            />
          )}

          <VictoryAxis
            dependentAxis
            tickFormat={(t) => `${Math.round(t)}kg`}
            domain={[-maxDataValue * 1.15, maxDataValue * 1.1]}
            tickValues={(() => {
              const maxValue = maxDataValue * 1.1;
              const step = maxValue / 4;
              return [0, step, step * 2, step * 3, maxValue];
            })()}
            style={{
              axis: { stroke: 'rgba(255,255,255,0.15)' },
              tickLabels: {
                fill: 'rgba(255,255,255,0.8)',
                fontSize: FONT_SIZES.xs,
                fontWeight: '600',
              },
              grid: { stroke: 'rgba(255,255,255,0.1)' },
            }}
          />

          <VictoryAxis
            tickValues={tickValues}
            tickFormat={(x, i) => tickLabels[i] || ''}
            style={{
              axis: { stroke: 'rgba(255,255,255,0.15)' },
              tickLabels: {
                fill: 'rgba(255,255,255,0.8)',
                fontSize: FONT_SIZES.xs,
                fontWeight: '600',
                angle: 0,
              },
            }}
          />
        </VictoryChart>

        {selectedDataPoint?.exerciseId === exercise.id && selectedDataPoint && (
          <View
            style={[
              styles.customTooltip,
              {
                left: ((selectedDataPoint.x - 1) / 3) * (chartWidth - 60) + 45 - 40,
                top: 25,
              },
            ]}
          >
            <Text style={styles.tooltipDate}>{selectedDataPoint.date}</Text>
            <Text style={styles.tooltipWeight}>{selectedDataPoint.weight}kg</Text>
          </View>
        )}
      </>
    );
  };

  const handleDeletePress = (exerciseId: string) => {
    try {
      const exercise = exercises.find((e) => e.id === exerciseId);
      if (!exercise) {
        Sentry.addBreadcrumb({
          message: 'Delete button pressed for non-existent exercise',
          category: 'user.interaction',
          level: 'warning',
          data: {
            exerciseId,
            availableExerciseIds: exercises.map((e) => e.id),
          },
        });
        return;
      }

      Sentry.addBreadcrumb({
        message: 'Delete exercise button pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          exerciseId,
          exerciseName: exercise.name,
          dataPointsToDelete: exercise.data.length,
          exerciseUnit: exercise.unit,
        },
      });

      Alert.alert(
        'Delete Exercise',
        `Are you sure you want to delete "${exercise.name}"? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              try {
                Sentry.addBreadcrumb({
                  message: 'Exercise deletion cancelled',
                  category: 'user.interaction',
                  level: 'info',
                  data: {
                    exerciseId,
                    exerciseName: exercise.name,
                  },
                });
              } catch (error) {
                console.warn('Error logging deletion cancel:', error);
              }
            },
          },
          {
            text: 'Delete',
            onPress: () => {
              try {
                Sentry.addBreadcrumb({
                  message: 'Exercise deletion confirmed',
                  category: 'user.interaction',
                  level: 'info',
                  data: {
                    exerciseId,
                    exerciseName: exercise.name,
                    dataPointsDeleted: exercise.data.length,
                  },
                });

                onDeleteExercise?.(exerciseId);
              } catch (error) {
                Sentry.captureException(error, {
                  tags: {
                    component: 'ExerciseGraphs',
                    action: 'confirmDelete',
                  },
                  extra: {
                    exerciseId,
                    exerciseName: exercise.name,
                  },
                });
                console.error('Error in exercise deletion confirmation:', error);

                // Still try to delete
                onDeleteExercise?.(exerciseId);
              }
            },
            style: 'destructive',
          },
        ],
      );
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'ExerciseGraphs',
          action: 'handleDeletePress',
        },
        extra: {
          exerciseId,
          exerciseCount: exercises.length,
        },
      });
      console.error('Error in ExerciseGraphs handleDeletePress:', error);
    }
  };

  return (
    <ScrollView style={styles.scrollContainer}>
      <Surface style={styles.container} elevation={4}>
        <LinearGradient
          colors={[COLORS.surface, COLORS.surfaceLight]}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>📊 Exercise Progress</Text>
            <Text style={styles.subtitle}>
              Track your strength gains and monitor{'\n'}your fitness journey over time
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.addExerciseButton}>
          <LinearGradient
            colors={[COLORS.gradientStart, COLORS.primary]}
            style={styles.trackButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Button
              mode="contained"
              icon="plus-circle"
              onPress={() => {
                try {
                  Sentry.addBreadcrumb({
                    message: 'Add exercise button pressed',
                    category: 'user.interaction',
                    level: 'info',
                    data: {
                      currentExerciseCount: exercises.length,
                    },
                  });

                  onAddExercise();
                } catch (error) {
                  Sentry.captureException(error, {
                    tags: {
                      component: 'ExerciseGraphs',
                      action: 'handleAddExercise',
                    },
                    extra: {
                      exerciseCount: exercises.length,
                    },
                  });
                  console.error('Error in ExerciseGraphs handleAddExercise:', error);

                  // Still call the original handler
                  onAddExercise();
                }
              }}
              style={styles.trackButton}
              labelStyle={styles.buttonLabel}
              contentStyle={{ flexDirection: 'row', alignItems: 'center' }}
              buttonColor="transparent"
            >
              Track New Exercise
            </Button>
          </LinearGradient>
        </View>

        <View style={styles.graphsContainer}>
          {exercises.length === 0 ? (
            <LinearGradient
              colors={['rgba(139,109,255,0.1)', 'rgba(112,72,232,0.05)']}
              style={styles.emptyState}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons
                name="chart-line"
                size={64}
                color={COLORS.primary}
                style={styles.emptyStateIcon}
              />
              <Text style={styles.emptyStateText}>Start Your Progress Journey</Text>
              <Text style={styles.emptyStateSubtext}>
                Add exercises to visualize your strength gains{'\n'}
                and track your fitness milestones
              </Text>
              <View style={styles.emptyStateFeatures}>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="trending-up" size={16} color={COLORS.success} />
                  <Text style={styles.featureText}>Track progress over time</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="target" size={16} color={COLORS.primary} />
                  <Text style={styles.featureText}>Set and achieve goals</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="trophy" size={16} color={COLORS.warning} />
                  <Text style={styles.featureText}>Celebrate milestones</Text>
                </View>
              </View>
            </LinearGradient>
          ) : (
            exercises.map(renderExerciseCard)
          )}
        </View>
      </Surface>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    marginHorizontal: SPACING.sm,
    marginVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 109, 255, 0.3)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  headerGradient: {
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  addExerciseButton: {
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginVertical: SPACING.lg,
  },
  trackButtonGradient: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  trackButton: {
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: SPACING.lg,
  },
  buttonLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginLeft: SPACING.xs,
    color: COLORS.text,
  },
  graphsContainer: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.lg,
    gap: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 109, 255, 0.4)',
    minHeight: 320,
  },
  emptyStateIcon: {
    marginBottom: SPACING.lg,
    opacity: 0.8,
  },
  emptyStateText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  emptyStateFeatures: {
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureText: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  graphCard: {
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(42, 45, 58, 0.95)',
    marginBottom: SPACING.lg,
    marginHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(139, 109, 255, 0.25)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    zIndex: 1,
  },
  exerciseNameContainer: {
    flex: 1,
  },
  exerciseName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
    letterSpacing: 0.3,
  },
  dataPointsCount: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  maxValueContainer: {
    alignItems: 'center',
    minWidth: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  maxValue: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.xs / 2,
    textAlign: 'center',
  },
  unitText: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: SPACING.xs / 2,
    fontWeight: '600',
  },
  maxLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prLabel: {
    fontSize: FONT_SIZES.xs - 1,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SPACING.xs / 2,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.xs / 2,
  },
  progressIcon: {
    opacity: 0.9,
  },
  progressValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  progressLabel: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.sm,
  },
  chartSection: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    width: '100%',
    zIndex: 1,
  },
  chartClip: {
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.xs,
    paddingHorizontal: 1,
    paddingVertical: 1,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  noDataText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  bottomActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    marginTop: SPACING.sm,
    zIndex: 1,
  },
  bottomActionButton: {
    alignItems: 'center',
    flex: 1,
    gap: SPACING.xs,
  },
  actionButtonGradient: {
    borderRadius: BORDER_RADIUS.round,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bottomButtonIcon: {
    borderRadius: BORDER_RADIUS.round,
    margin: 0,
    width: 44,
    height: 44,
  },
  bottomButtonText: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customTooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(42, 45, 58, 0.95)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  tooltipDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  tooltipWeight: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});

// Modern and professional ExerciseGraphs component
// Features:
// - Gradient backgrounds and modern card designs
// - Enhanced chart styling with better colors and visual hierarchy
// - Improved progress indicators with icons and better typography
// - Modern action buttons with gradient styling
// - Enhanced empty states with feature highlights
// - Theme-consistent colors and spacing
// - Better visual feedback and professional appearance

export default ExerciseGraphs;
