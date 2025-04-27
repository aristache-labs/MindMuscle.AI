import React from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Pressable, Platform } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { format } from 'date-fns';
import { MeasurementCategory, Measurement } from '../services/measurements';
import { COLORS } from '../constants/theme';
interface Props {
  category: MeasurementCategory;
  measurements: Array<Measurement>;
  onAddMeasurement: () => void;
  onClose: () => void;
  onDeleteMeasurement: (measurementId: string) => Promise<void>;
}

export default function MeasurementHistory({ 
  category, 
  measurements, 
  onAddMeasurement, 
  onClose,
  onDeleteMeasurement,
}: Props) {
  // Sort measurements by date and get first and latest
  const sortedMeasurements = [...measurements].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  // First measurement is the earliest one chronologically
  const firstMeasurement = sortedMeasurements.length > 0 ? sortedMeasurements[0] : null;
  // Latest measurement is the most recent one
  const latestMeasurement = sortedMeasurements.length > 0 ? sortedMeasurements[sortedMeasurements.length - 1] : null;
  // Previous measurement (second to last)
  const previousMeasurement = sortedMeasurements.length > 1 ? sortedMeasurements[sortedMeasurements.length - 2] : null;

  // Calculate difference if we have both measurements
  const getDifferenceDisplay = () => {
    if (!previousMeasurement || !latestMeasurement) return null;
    
    const difference = latestMeasurement.value - previousMeasurement.value;
    const isIncrease = difference > 0;
    
    return {
      value: Math.abs(difference).toFixed(1),
      isIncrease
    };
  };

  const difference = getDifferenceDisplay();

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
        <View style={styles.topGlowLeft} />
        <View style={styles.topGlowRight} />
        <View style={styles.header}>
          <IconButton
            icon="close"
            iconColor={COLORS.text}
            size={24}
            style={styles.closeButton}
            onPress={onClose}
          />
          <Text style={styles.title}>{category}</Text>
        </View>

        <ScrollView style={styles.historyContainer}>
          {measurements.length > 0 ? (
            <>
              {/* Latest Measurement */}
              <View style={styles.historyItem}>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>
                    {format(new Date(latestMeasurement!.created_at), 'MMMM dd, yyyy')}
                  </Text>
                </View>
                <View style={styles.measurementRow}>
                  <View style={styles.measurementContent}>
                    <Text style={styles.measurementValue}>
                      {previousMeasurement ? previousMeasurement.value.toFixed(1) : latestMeasurement!.value.toFixed(1)}
                    </Text>
                    <Text style={styles.unit}>{latestMeasurement!.unit}</Text>
                    {measurements.length > 1 && (
                      <View style={styles.progressIndicator}>
                        <Text style={styles.arrow}> → </Text>
                        <Text style={styles.measurementValue}>
                          {latestMeasurement!.value.toFixed(1)}
                        </Text>
                        <Text style={styles.unit}>{latestMeasurement!.unit}</Text>
                        {difference && (
                          <View style={styles.differenceContainer}>
                            <IconButton
                              icon={difference.isIncrease ? 'arrow-up' : 'arrow-down'}
                              iconColor={difference.isIncrease ? '#4CAF50' : '#F44336'}
                              size={16}
                              style={styles.differenceArrow}
                            />
                            <Text style={[
                              styles.differenceValue,
                              { color: difference.isIncrease ? '#4CAF50' : '#F44336' }
                            ]}>
                              {difference.value} {latestMeasurement!.unit}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  {onDeleteMeasurement && latestMeasurement!.id !== firstMeasurement!.id && (
                    <IconButton
                      icon="delete"
                      iconColor="#FF4444"
                      size={20}
                      onPress={() => onDeleteMeasurement(latestMeasurement!.id)}
                    />
                  )}
                </View>
              </View>

              {/* First Measurement */}
              <View style={[styles.historyItem, styles.firstMeasurementItem]}>
                <View style={styles.dateContainer}>
                  <Text style={styles.date}>
                    {format(new Date(firstMeasurement!.created_at), 'MMMM dd, yyyy')}
                  </Text>
                  <Text style={styles.firstMeasurementLabel}>1st Measurement</Text>
                </View>
                <View style={styles.measurementRow}>
                  <View style={styles.measurementContent}>
                    <Text style={styles.measurementValue}>
                      {firstMeasurement!.value.toFixed(1)}
                    </Text>
                    <Text style={styles.unit}>{firstMeasurement!.unit}</Text>
                  </View>
                  {onDeleteMeasurement && measurements.length > 1 && (
                    <IconButton
                      icon="delete"
                      iconColor="#FF4444"
                      size={20}
                      onPress={() => onDeleteMeasurement(firstMeasurement!.id)}
                    />
                  )}
                </View>
              </View>
            </>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { 
          width: 10, 
          height: 0,
        },
        shadowOpacity: 1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  topGlowLeft: {
    position: 'absolute',
    top: -0.7,
    left: -0.2,
    width: 13,
    height: 13,
    borderTopLeftRadius: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 15,
  },
  topGlowRight: {
    position: 'absolute',
    top: -0.7,
    right: -0.2,
    width: 13,
    height: 13,
    borderTopRightRadius: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
  },
  closeButton: {
    margin: 0,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginRight: 40,
  },
  historyContainer: {
    flex: 1,
    padding: 16,

  },
  historyItem: {
    marginBottom: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  firstMeasurementItem: {
    opacity: 0.8,
  },
  dateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: COLORS.text,
  },
  firstMeasurementLabel: {
    fontSize: 12,
    color: '#FFE600',
    fontWeight: 'bold',
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  measurementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  measurementValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  unit: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 4,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  arrow: {
    fontSize: 24,
    color: '#888',
    marginHorizontal: 8,
  },
  differenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  differenceArrow: {
    margin: 0,
    marginRight: -8,
    height: 24,
    alignSelf: 'center',
  },
  differenceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  addButton: {
    margin: 80,
    marginBottom: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 45,
    height: 56,
    justifyContent: 'center',
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingVertical: 8,
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