import React, { useEffect } from 'react';
import { StyleSheet, View, Alert, Platform, ScrollView, Dimensions } from 'react-native';
import { Text, IconButton, Surface, useTheme, Button } from 'react-native-paper';
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
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width - 32; // Account for outer container margins

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
          screenWidth,
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
  }, [exercises.length, screenWidth]);

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
            exercises.map((exercise) => (
              <View key={exercise.id} style={styles.graphCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <View style={styles.maxValueContainer}>
                    {exercise.data.length > 0 ? (
                      <>
                        <Text style={styles.maxValue}>
                          {Math.max(...exercise.data.map((d) => d.value))}
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

                <View style={styles.graphContentWrapper}>
                  {/* Chart Section */}
                  <View style={styles.chartSection}>
                    {exercise.data.length > 0 ? (
                      <LineChart
                        data={exercise.data.map((d) => ({
                          value: d.value,
                          label: new Date(d.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          }),
                          dataPointText: `${d.value}`,
                        }))}
                        width={screenWidth - 200}
                        height={120}
                        noOfSections={4}
                        spacing={30}
                        color={COLORS.primary}
                        thickness={2}
                        startFillColor={COLORS.primary}
                        startOpacity={0.3}
                        endOpacity={0.1}
                        initialSpacing={10}
                        endSpacing={10}
                        hideDataPoints={false}
                        dataPointsColor={COLORS.primary}
                        dataPointsRadius={3}
                        focusEnabled
                        showTextOnFocus
                        textFontSize={10}
                        textColor={theme.colors.onBackground}
                        yAxisTextStyle={{ color: theme.colors.onSurface, fontSize: 8 }}
                        xAxisLabelTextStyle={{ color: theme.colors.onSurface, fontSize: 8 }}
                        curved
                      />
                    ) : (
                      <View style={styles.noDataContainer}>
                        <Text style={styles.noDataText}>No workout data yet</Text>
                        <Text style={styles.noDataSubtext}>
                          Complete workouts with this exercise to see progress
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons Section */}
                  <View style={styles.actionsSection}>
                    <View style={styles.actionButtonGroup}>
                      <IconButton
                        icon="flag"
                        mode="contained"
                        iconColor={COLORS.text}
                        size={14}
                        onPress={() => {
                          try {
                            Sentry.addBreadcrumb({
                              message: 'Set goal button pressed',
                              category: 'user.interaction',
                              level: 'info',
                              data: {
                                exerciseId: exercise.id,
                                exerciseName: exercise.name,
                                currentDataPoints: exercise.data.length,
                                currentMaxValue: Math.max(...exercise.data.map((d) => d.value)),
                              },
                            });

                            onSetGoal?.(exercise.id);
                          } catch (error) {
                            Sentry.captureException(error, {
                              tags: {
                                component: 'ExerciseGraphs',
                                action: 'handleSetGoal',
                              },
                              extra: {
                                exerciseId: exercise.id,
                              },
                            });
                            console.error('Error in ExerciseGraphs handleSetGoal:', error);

                            // Still call the original handler
                            onSetGoal?.(exercise.id);
                          }
                        }}
                        style={styles.compactGoalButton}
                        containerColor={COLORS.primary}
                      />
                      <Text style={styles.compactButtonText}>Set Goal</Text>
                    </View>
                    <View style={styles.actionButtonGroup}>
                      <IconButton
                        icon="delete"
                        mode="contained"
                        iconColor={COLORS.text}
                        size={14}
                        onPress={() => handleDeletePress(exercise.id)}
                        style={styles.compactDeleteButton}
                        containerColor={COLORS.error}
                      />
                      <Text style={styles.compactButtonText}>Delete Exercise</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))
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
    borderRadius: 12,
    backgroundColor: 'rgba(108, 71, 255, 0.05)',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.2)',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  maxValueContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  maxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  unitText: {
    fontSize: 14,
    color: COLORS.secondary,
    marginLeft: 2,
  },
  maxLabel: {
    fontSize: 12,
    color: COLORS.secondary,
  },
  prLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 2,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  graphContentWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartSection: {
    flex: 1,
    alignItems: 'center',
    marginRight: 16,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    paddingHorizontal: 16,
  },
  noDataText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 12,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 16,
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
