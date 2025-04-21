import React from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Pressable } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { format } from 'date-fns';
import { MeasurementCategory, Measurement } from '../services/measurements';

interface Props {
  category: MeasurementCategory;
  measurements: Array<Measurement>;
  onAddMeasurement: () => void;
  onClose: () => void;
  onDeleteMeasurement?: (measurementId: string) => void;
}

export default function MeasurementHistory({ 
  category, 
  measurements, 
  onAddMeasurement, 
  onClose,
  onDeleteMeasurement 
}: Props) {
  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
        <View style={styles.header}>
          <IconButton
            icon="close"
            iconColor="#fff"
            size={24}
            style={styles.closeButton}
            onPress={onClose}
          />
          <Text style={styles.title}>{category}</Text>
        </View>

        <ScrollView style={styles.historyContainer}>
          {measurements.length > 0 ? (
            measurements.map((measurement, index) => (
              <View key={measurement.id} style={styles.historyItem}>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>
                    {format(new Date(measurement.created_at), 'MMMM dd, yyyy')}
                  </Text>
                  {index === measurements.length - 1 && (
                    <Text style={styles.firstMeasurement}>1st Measurement</Text>
                  )}
                </View>
                <View style={styles.measurementRow}>
                  <Text style={styles.measurementValue}>
                    {measurement.value.toFixed(1)} <Text style={styles.unit}>{measurement.unit}</Text>
                  </Text>
                  {onDeleteMeasurement && (
                    <IconButton
                      icon="delete"
                      iconColor="#FF4444"
                      size={20}
                      onPress={() => onDeleteMeasurement(measurement.id)}
                    />
                  )}
                </View>
                {index < measurements.length - 1 && (
                  <View style={styles.progressIndicator}>
                    <Text style={styles.progressValue}>
                      {(measurements[index + 1].value - measurement.value > 0 ? '+' : '') + 
                       (measurements[index + 1].value - measurement.value).toFixed(1)} {measurement.unit}
                    </Text>
                    <IconButton
                      icon={measurements[index + 1].value - measurement.value > 0 ? 'arrow-up' : 'arrow-down'}
                      iconColor={measurements[index + 1].value - measurement.value > 0 ? '#4CAF50' : '#F44336'}
                      size={20}
                    />
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No measurements recorded yet</Text>
            </View>
          )}
        </ScrollView>

        <Button
          mode="contained"
          style={styles.addButton}
          labelStyle={styles.addButtonLabel}
          onPress={onAddMeasurement}
        >
          Add Measurement
        </Button>
      </Pressable>
    </Pressable>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  container: {
    width: '100%',
    height: '85%',
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  closeButton: {
    margin: 0,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 40,
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  historyItem: {
    marginBottom: 24,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#888',
  },
  firstMeasurement: {
    fontSize: 12,
    color: '#FFE600',
    fontWeight: 'bold',
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  measurementValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  unit: {
    fontSize: 16,
    color: '#888',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressValue: {
    fontSize: 14,
    color: '#888',
  },
  addButton: {
    margin: 16,
    backgroundColor: '#FFE600',
    borderRadius: 25,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
}); 