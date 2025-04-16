import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, List, Text, Divider } from 'react-native-paper';
import { useProgress } from '../store/ProgressContext';
import { format } from 'date-fns';

export default function ProgressScreen() {
  const { metrics, workoutProgress, loading } = useProgress();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading progress data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.metricsContainer}>
        <Card style={styles.metricCard}>
          <Card.Content>
            <Title>Workout Streak</Title>
            <Paragraph style={styles.metricValue}>{metrics.streak} days</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content>
            <Title>Total Workouts</Title>
            <Paragraph style={styles.metricValue}>{metrics.totalWorkouts}</Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.metricCard}>
          <Card.Content>
            <Title>Average Duration</Title>
            <Paragraph style={styles.metricValue}>
              {Math.round(metrics.averageWorkoutDuration)} min
            </Paragraph>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title>Personal Records</Title>
          {metrics.personalRecords.length > 0 ? (
            <List.Section>
              {metrics.personalRecords.map((record, index) => (
                <React.Fragment key={record.exerciseId}>
                  <List.Item
                    title={`${record.weight} kg x ${record.reps} reps`}
                    description={`Set on ${format(new Date(record.date), 'MMM d, yyyy')}`}
                    left={props => <List.Icon {...props} icon="trophy" />}
                  />
                  {index < metrics.personalRecords.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List.Section>
          ) : (
            <Text>No personal records yet</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <Title>Recent Workouts</Title>
          {workoutProgress.length > 0 ? (
            <List.Section>
              {workoutProgress.slice(0, 5).map((workout, index) => (
                <React.Fragment key={workout.id}>
                  <List.Item
                    title={format(new Date(workout.date), 'MMM d, yyyy')}
                    description={`${workout.duration} minutes • ${workout.exercises.length} exercises`}
                    left={props => <List.Icon {...props} icon="dumbbell" />}
                  />
                  {index < Math.min(5, workoutProgress.length) - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List.Section>
          ) : (
            <Text>No workout history yet</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionCard: {
    marginBottom: 16,
  },
}); 