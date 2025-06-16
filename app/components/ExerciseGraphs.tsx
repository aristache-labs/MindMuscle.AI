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
  onExercisePress: (exerciseId: string) => void;
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
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <View style={styles.graphWrapper}>
                  <View style={styles.valueContainer}>
                    <Text style={styles.maxValue}>
                      {Math.max(...exercise.data.map((d) => d.value))}
                      <Text style={styles.unitText}>{exercise.unit}</Text>
                    </Text>
                    <Text style={styles.maxLabel}>Max</Text>
                    {exercise.data.some((d) => d.date.includes('PR')) && (
                      <Text style={styles.prLabel}>PR</Text>
                    )}
                  </View>

                  {/* GiftedCharts LineChart */}
                  <View style={{ width: screenWidth - 100, height: 180 }}>
                    <LineChart
                      data={exercise.data.map((d) => ({
                        value: d.value,
                        label: new Date(d.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        }),
                        dataPointText: `${d.value}`,
                      }))}
                      width={screenWidth - 120}
                      height={180}
                      noOfSections={5}
                      spacing={40}
                      color={theme.colors.primary}
                      thickness={2}
                      startFillColor={theme.colors.primary}
                      startOpacity={0.3}
                      endOpacity={0.1}
                      initialSpacing={20}
                      endSpacing={20}
                      hideDataPoints={false}
                      dataPointsColor={theme.colors.primary}
                      dataPointsRadius={4}
                      focusEnabled
                      showTextOnFocus
                      textFontSize={12}
                      textColor={theme.colors.onBackground}
                      yAxisTextStyle={{ color: theme.colors.onSurface }}
                      xAxisLabelTextStyle={{ color: theme.colors.onSurface, fontSize: 10 }}
                      curved
                    />
                  </View>
                </View>
                <View style={styles.buttonContainer}>
                  <View style={styles.buttonGroup}>
                    <IconButton
                      icon="flag"
                      mode="contained"
                      iconColor={COLORS.text}
                      size={16}
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
                      style={styles.goalButton}
                      containerColor={COLORS.primary}
                    />
                    <Text style={styles.buttonText}>Set Goal</Text>
                  </View>
                  <View style={styles.buttonGroup}>
                    <IconButton
                      icon="delete"
                      mode="contained"
                      iconColor={COLORS.text}
                      size={16}
                      onPress={() => handleDeletePress(exercise.id)}
                      style={styles.deleteButton}
                      containerColor={COLORS.primary}
                    />
                    <Text style={styles.buttonText}>Delete Exercise</Text>
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
    gap: 24,
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
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  graphWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  valueContainer: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 70,
  },
  maxValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
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
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 4,
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
