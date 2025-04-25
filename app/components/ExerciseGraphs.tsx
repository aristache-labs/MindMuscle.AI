import React, { useState } from 'react';
import { StyleSheet, View, Pressable, Alert, Platform } from 'react-native';
import { Text, IconButton, Surface, useTheme, Button, Portal, Dialog } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
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
  onExercisePress,
  onSetGoal,
  onDeleteExercise,
}) => {
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width - 32; // Account for outer container margins only

  const chartConfig = {
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    fillShadowGradient: '#F9E009',
    fillShadowGradientOpacity: 0.3,
    fillShadowGradientFrom: '#F9E009',
    fillShadowGradientFromOpacity: 0.3,
    fillShadowGradientTo: '#F9E009',
    fillShadowGradientToOpacity: 0.05,
    color: (opacity = 1) => `rgba(249, 224, 9, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#F9E009'
    },
    propsForLabels: {
      fontSize: 10,
      color: COLORS.text
    },
    propsForVerticalLabels: {
      fontSize: 10,
      color: COLORS.text
    },
    decimalPlaces: 0,
  };

  const handleDeletePress = (exerciseId: string) => {
    const exercise = exercises.find(e => e.id === exerciseId);
    if (!exercise) return;

    Alert.alert(
      "Delete Exercise",
      `Are you sure you want to delete "${exercise.name}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: () => onDeleteExercise?.(exerciseId),
          style: "destructive"
        }
      ]
    );
  };

  return (
    <Surface style={styles.container} elevation={2}>
      <View style={styles.header}>
        <Text style={styles.title}>EXERCISE GRAPHS</Text>
        <Text style={styles.subtitle}>Add exercises and set goals to see{'\n'}your progress over time</Text>
      </View>

      <View style={styles.addExerciseButton}>
        <Button
          mode="contained"
          onPress={onAddExercise}
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
                    {Math.max(...exercise.data.map(d => d.value))}
                    <Text style={styles.unitText}>{exercise.unit}</Text>
                  </Text>
                  <Text style={styles.maxLabel}>Max</Text>
                  {exercise.data.some(d => d.date.includes('PR')) && (
                    <Text style={styles.prLabel}>PR</Text>
                  )}
                </View>
                <LineChart
                  data={{
                    labels: exercise.data.map(d => d.date),
                    datasets: [{
                      data: exercise.data.map(d => d.value),
                      color: (opacity = 1) => `rgba(249, 224, 9, ${opacity})`,
                      strokeWidth: 2,
                    }]
                  }}
                  width={screenWidth}
                  height={180}
                  chartConfig={chartConfig}
                  bezier
                  style={styles.chart}
                  withVerticalLines={false}
                  withHorizontalLines={true}
                  withDots={true}
                  withShadow={true}
                  withInnerLines={true}
                  withOuterLines={false}
                  withVerticalLabels={true}
                  segments={5}
                  yAxisInterval={5}
                  formatYLabel={(value) => Math.round(Number(value)).toString()}
                />
              </View>
              <View style={styles.buttonContainer}>
                <View style={styles.buttonGroup}>
                  <IconButton
                    icon="flag"
                    mode="contained"
                    iconColor={COLORS.text}
                    size={16}
                    onPress={() => onSetGoal?.(exercise.id)}
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
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
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
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  addExerciseButton: {
    paddingHorizontal: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  trackButton: {
    backgroundColor: COLORS.primary,
    height: 40,
    width: '55%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlignVertical: 'center',
  },
  graphsContainer: {
    marginHorizontal: -25, // Negative margin to allow graph to extend to edges
  },
  graphCard: {
    marginBottom: 16,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 0,
    paddingBottom: 32,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 20,
    marginBottom: 8,
  },
  graphWrapper: {
    position: 'relative',
    height: 180,
    marginBottom: 5,
  },
  valueContainer: {
    position: 'absolute',
    right: 20,
    bottom: 140,
    alignItems: 'flex-end',
    zIndex: 1,
  },
  maxValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F9E009',
  },
  unitText: {
    fontSize: 12,
    color: '#F9E009',
    marginLeft: 4,
  },
  maxLabel: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 2,
  },
  prLabel: {
    fontSize: 12,
    color: '#F9E009',
    marginTop: 2,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -16,
    marginRight: -16,
    paddingBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalButton: {
    margin: 0,
    borderRadius: 6,
    width: 28,
    height: 28,
  },
  deleteButton: {
    margin: 0,
    borderRadius: 6,
    width: 28,
    height: 28,
  },
  buttonText: {
    fontSize: 11,
    color: COLORS.text,
    marginLeft: 4,
  },
  deleteText: {
    color: COLORS.text,
  },
  emptyState: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
  },
});

export default ExerciseGraphs;