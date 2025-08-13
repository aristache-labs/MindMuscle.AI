import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Platform, ScrollView, Dimensions } from 'react-native';
import { Text, IconButton, Surface, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import * as Sentry from '@sentry/react-native';
import { COLORS } from '../constants/theme';

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

const ExerciseGraphs: React.FC<ExerciseGraphsProps> = ({
  exercises,
  onAddExercise,
  onSetGoal,
  onDeleteExercise,
}) => {
  const windowWidth = Dimensions.get('window').width;
  const SURFACE_MARGIN = 0; // matches styles.container marginHorizontal
  const SURFACE_PADDING = 15; // matches styles.container padding
  const CARD_PADDING = 20; // matches styles.graphCard padding
  const BORDER_WIDTH = 0; // approximate, applied both sides
  const chartWidth =
    windowWidth - (SURFACE_MARGIN * 2 + SURFACE_PADDING * 2 + CARD_PADDING * 2 + BORDER_WIDTH * 2);

  function getLabelInterval(count: number): number {
    if (count <= 6) return 1;
    return Math.ceil(count / 6);
  }

  function reduceByDate(data: { date: string; value: number }[]) {
    const byDate = new Map<string, number>();
    for (const point of data) {
      const existing = byDate.get(point.date);
      if (existing === undefined || point.value > existing) byDate.set(point.date, point.value);
    }
    return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
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
    return {
      values,
      firstValue,
      lastValue,
      prevValue,
      maxValue,
      growthPercent,
      startedLabel,
      reduced,
    };
  }

  function renderExerciseCard(exercise: ExerciseData) {
    const { lastValue, prevValue, maxValue, growthPercent, startedLabel } =
      getExerciseStats(exercise);

    return (
      <View key={exercise.id} style={styles.graphCard}>
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
          <View style={styles.progressInfoSection}>
            <View style={styles.progressItem}>
              <Text style={styles.progressValue}>{growthPercent.toFixed(1)}%</Text>
              <Text style={styles.progressLabel}>Growth</Text>
            </View>
            <View style={styles.progressItem}>
              <View style={styles.progressValueWithIcon}>
                {exercise.data.length >= 2 && (
                  <MaterialCommunityIcons
                    name={
                      lastValue - prevValue > 0
                        ? 'trending-up'
                        : lastValue - prevValue < 0
                          ? 'trending-down'
                          : 'trending-neutral'
                    }
                    size={14}
                    color={
                      lastValue - prevValue > 0
                        ? '#00FF7F'
                        : lastValue - prevValue < 0
                          ? '#FF6B6B'
                          : '#6C47FF'
                    }
                    style={styles.trendIcon}
                  />
                )}
                <Text style={styles.progressValue}>
                  {exercise.data.length >= 2
                    ? `${lastValue - prevValue > 0 ? '+' : ''}${lastValue - prevValue}${exercise.unit}`
                    : '--'}
                </Text>
              </View>
              <Text style={styles.progressLabel}>Last Change</Text>
            </View>
            <View style={styles.progressItem}>
              <Text style={styles.progressValue}>{startedLabel}</Text>
              <Text style={styles.progressLabel}>Started</Text>
            </View>
          </View>
        )}

        {/* Chart Section */}
        <View style={styles.chartSection}>
          {exercise.data.length > 0 ? (
            <View style={[styles.chartClip, { width: chartWidth }]}>
              {(() => {
                const interval = getLabelInterval(exercise.data.length);
                const lastIndex = exercise.data.length - 1;
                const xLabels = exercise.data.map((d, i) => {
                  const shouldShow = i % interval === 0 || i === lastIndex || i === 0;
                  if (!shouldShow) return '';
                  // Normalize to two-digit day and month (dd.mm)
                  const parts = d.date.split('.');
                  if (parts.length === 2) {
                    const dd = parts[0].padStart(2, '0');
                    const mm = parts[1].padStart(2, '0');
                    return `${dd}.${mm}`;
                  }
                  return d.date;
                });
                const chartData = exercise.data.map((d) => ({ value: d.value, label: '' }));
                return (
                  <LineChart
                    data={chartData}
                    xAxisLabelTexts={xLabels}
                    width={chartWidth}
                    height={160}
                    noOfSections={3}
                    spacing={Math.max(16, (chartWidth - 40) / Math.max(exercise.data.length, 4))}
                    color={COLORS.primary}
                    thickness={3}
                    startFillColor={COLORS.primary}
                    startOpacity={0.25}
                    endFillColor={COLORS.primary}
                    endOpacity={0.05}
                    initialSpacing={10}
                    endSpacing={14}
                    hideDataPoints={false}
                    dataPointsColor="#FFFFFF"
                    dataPointsRadius={5}
                    focusEnabled={true}
                    showTextOnFocus={true}
                    textFontSize={12}
                    textColor="#FFFFFF"
                    textShiftY={-8}
                    textShiftX={-10}
                    yAxisColor="rgba(255,255,255,0.2)"
                    xAxisColor="rgba(255,255,255,0.2)"
                    yAxisTextStyle={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 10,
                      fontWeight: '500',
                    }}
                    xAxisLabelTextStyle={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 9,
                      fontWeight: '500',
                      textAlign: 'center',
                      width: 44,
                    }}
                    curved={true}
                    curvature={0.35}
                    areaChart={true}
                    hideAxesAndRules={false}
                    hideYAxisText={false}
                    rulesColor="rgba(108,71,255,0.15)"
                    rulesType="solid"
                    pointerConfig={{
                      pointerStripWidth: 2,
                      pointerStripColor: 'rgba(108,71,255,0.35)',
                      pointerColor: '#FFFFFF',
                      radius: 5,
                      showPointerStrip: true,
                    }}
                  />
                );
              })()}
            </View>
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
            <IconButton
              icon="flag"
              mode="contained"
              iconColor="#FFFFFF"
              size={16}
              onPress={() => onSetGoal?.(exercise.id)}
              style={styles.bottomButtonIcon}
              containerColor={COLORS.primary}
            />
            <Text style={styles.bottomButtonText}>Set Goal</Text>
          </View>
          <View style={styles.bottomActionButton}>
            <IconButton
              icon="delete"
              mode="contained"
              iconColor="#FFFFFF"
              size={16}
              onPress={() => handleDeletePress(exercise.id)}
              style={styles.bottomButtonIcon}
              containerColor="#FF6B6B"
            />
            <Text style={styles.bottomButtonText}>Delete Exercise</Text>
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
      <Surface style={styles.container} elevation={2}>
        <View style={styles.header}>
          <Text style={styles.title}>EXERCISE GRAPHS</Text>
          <Text style={styles.subtitle}>
            Add exercises and set goals to see{'\n'}your progress over time
          </Text>
        </View>

        <View style={styles.addExerciseButton}>
          <Button
            mode="contained"
            icon="plus"
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
          >
            Track Exercise
          </Button>
        </View>

        <View style={styles.graphsContainer}>
          {exercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No exercise graphs yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Add your first exercise to track progress
              </Text>
            </View>
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
  },
  container: {
    marginHorizontal: 16,
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  addExerciseButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trackButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  graphsContainer: {
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(108, 71, 255, 0.05)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  graphCard: {
    borderRadius: 16,
    backgroundColor: '#2A2D3A',
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNameContainer: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  dataPointsCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  maxValueContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  maxValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  unitText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 2,
  },
  maxLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  prLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 2,
    backgroundColor: 'rgba(108, 71, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  graphContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginVertical: 8,
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
  },
  progressValueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  trendIcon: {
    marginRight: 4,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C47FF',
  },
  progressLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textAlign: 'center',
  },
  chartSection: {
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  chartClip: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
  actionsSection: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    minWidth: 80,
  },
  actionButtonGroup: {
    alignItems: 'center',
  },
  compactGoalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    marginBottom: 4,
    width: 32,
    height: 32,
  },
  compactDeleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: 16,
    marginBottom: 4,
    width: 32,
    height: 32,
  },
  compactButtonText: {
    fontSize: 9,
    color: COLORS.secondary,
    textAlign: 'center',
    maxWidth: 60,
  },
  // New bottom action section styles
  bottomActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
  },
  bottomActionButton: {
    alignItems: 'center',
    flex: 1,
  },
  bottomButtonIcon: {
    borderRadius: 22,
    marginBottom: 8,
    width: 44,
    height: 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  bottomButtonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    fontWeight: '600',
  },
  // Legacy styles (keeping for backward compatibility)
  valueContainer: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 70,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  buttonGroup: {
    alignItems: 'center',
  },
  goalButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    marginBottom: 4,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
    borderRadius: 20,
    marginBottom: 4,
  },
  buttonText: {
    fontSize: 10,
    color: COLORS.secondary,
  },
  chartContainer: {
    marginVertical: 16,
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
});

export default ExerciseGraphs;
