import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Platform, ScrollView, Dimensions } from 'react-native';
import { Text, IconButton, Surface, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
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

const ExerciseGraphs: React.FC<ExerciseGraphsProps> = ({
  exercises,
  onAddExercise,
  onSetGoal,
  onDeleteExercise,
}) => {
  const windowWidth = Dimensions.get('window').width;
  const SURFACE_MARGIN = 8; // container margins
  const CARD_MARGIN = 4; // card horizontal margins
  const CARD_BORDER = 0; // card border width
  const CHART_SECTION_PADDING = 4; // SPACING.xs
  const CHART_CLIP_PADDING = 1; // reduced padding for more chart space
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

  // Helper function to generate date labels positioned at graph edges and center
  function generatePositionedDateLabels(exerciseData: { date: string; value: number }[]): string[] {
    if (exerciseData.length === 0) return [];
    if (exerciseData.length === 1) return [exerciseData[0].date];
    if (exerciseData.length === 2) return [exerciseData[0].date, exerciseData[1].date];

    // Parse date format (assuming dd.mm)
    const parseDate = (dateStr: string) => {
      const [day, month] = dateStr.split('.').map(Number);
      return new Date(2024, month - 1, day); // Assuming current year
    };

    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month}`;
    };

    // Create array with same length as data points, filled with empty strings
    const labels = new Array(exerciseData.length).fill('');

    // Get first and last exercise dates
    const firstDate = parseDate(exerciseData[0].date);
    const lastDate = parseDate(exerciseData[exerciseData.length - 1].date);

    // Calculate middle date (halfway between first and last)
    const timeDiff = lastDate.getTime() - firstDate.getTime();
    const middleDate = new Date(firstDate.getTime() + timeDiff / 2);

    // Position labels slightly inward from edges to prevent cutoff, but maintain alignment
    const startIndex = exerciseData.length > 0 ? 0 : 0; // Slightly inward for longer datasets
    const endIndex = exerciseData.length > 3 ? exerciseData.length - 2 : exerciseData.length - 1; // Slightly inward for longer datasets

    labels[startIndex] = exerciseData[0].date; // Start date positioned near left edge
    labels[endIndex] = exerciseData[exerciseData.length - 1].date; // End date positioned near right edge

    // Middle position = center of graph
    const middleIndex = Math.floor(exerciseData.length / 2);
    labels[middleIndex] = formatDate(middleDate); // Calculated middle date at graph center

    return labels;
  }

  function renderExerciseCard(exercise: ExerciseData) {
    const { lastValue, prevValue, maxValue, growthPercent, startedLabel } =
      getExerciseStats(exercise);

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
                  {exercise.data.length >= 2
                    ? `${lastValue - prevValue > 0 ? '+' : ''}${lastValue - prevValue}${exercise.unit}`
                    : '--'}
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
          {exercise.data.length > 0 ? (
            <View style={[styles.chartClip, { width: chartWidth }]}>
              {(() => {
                const chartData = exercise.data.map((d) => ({ value: d.value, label: '' }));

                // Generate date labels positioned at graph edges and center
                const positionedDateLabels = generatePositionedDateLabels(exercise.data);

                return (
                  <LineChart
                    data={chartData}
                    xAxisLabelTexts={positionedDateLabels}
                    width={chartWidth}
                    height={160}
                    noOfSections={5}
                    spacing={Math.min(
                      30,
                      Math.max(15, (chartWidth - 75) / Math.max(exercise.data.length - 2, 0)),
                    )}
                    color={COLORS.primary}
                    thickness={3}
                    startFillColor={COLORS.gradientStart}
                    startOpacity={0.4}
                    endFillColor={COLORS.gradientEnd}
                    endOpacity={0.1}
                    initialSpacing={5}
                    endSpacing={5}
                    hideDataPoints={false}
                    dataPointsColor={COLORS.primary}
                    dataPointsColor1={COLORS.gradientStart}
                    dataPointsRadius={3}
                    dataPointsHeight={3}
                    dataPointsWidth={3}
                    focusEnabled={true}
                    showTextOnFocus={true}
                    textFontSize={FONT_SIZES.sm}
                    textColor={COLORS.text}
                    textShiftY={-12}
                    textShiftX={-15}
                    yAxisColor="rgba(255,255,255,0.15)"
                    xAxisColor="rgba(255,255,255,0.15)"
                    yAxisTextStyle={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: FONT_SIZES.xs,
                      fontWeight: '600',
                    }}
                    xAxisLabelTextStyle={{
                      color: 'rgba(255,255,255,0.8)',
                      fontSize: FONT_SIZES.xs - 1,
                      fontWeight: '600',
                      textAlign: 'center',
                      width: 35,
                    }}
                    curved={true}
                    curvature={0.25}
                    areaChart={true}
                    hideAxesAndRules={false}
                    hideYAxisText={false}
                    rulesColor="rgba(139,109,255,0.2)"
                    rulesType="solid"
                    showStripOnFocus={true}
                    stripHeight={160}
                    stripColor="rgba(139,109,255,0.15)"
                    stripOpacity={0.8}
                    pointerConfig={{
                      pointerStripWidth: 3,
                      pointerStripColor: COLORS.primary,
                      pointerColor: COLORS.text,
                      radius: 8,
                      showPointerStrip: true,
                      strokeDashArray: [5, 5],
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
    backgroundColor: 'rgba(255,255,255,0.02)',
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
