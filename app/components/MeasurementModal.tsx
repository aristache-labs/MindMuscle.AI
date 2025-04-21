import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Modal, 
  Pressable, 
  Dimensions, 
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Text, IconButton, Portal, Provider } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MeasurementCategory, measurementService, Measurement } from '../services/measurements';
import MeasurementHistory from './MeasurementHistory';

interface Props {
  visible: boolean;
  category: MeasurementCategory;
  lastValue?: number;
  measurements: Array<Measurement>;
  onClose: () => void;
  onSave: (value: number) => void;
  userId: string;
  onMeasurementsChange?: () => void;
}

const MAX_VALUE = 200;
const STEP = 0.1;

export default function MeasurementModal({ 
  visible, 
  category, 
  lastValue, 
  measurements: initialMeasurements, 
  onClose, 
  onSave,
  userId,
  onMeasurementsChange
}: Props) {
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState(lastValue?.toString() || '0.0');
  const [sliderValue, setSliderValue] = useState(lastValue || 0);
  const [measurements, setMeasurements] = useState<Measurement[]>(initialMeasurements);

  useEffect(() => {
    setMeasurements(initialMeasurements);
  }, [initialMeasurements]);

  const handleAddMeasurement = () => {
    console.log('MeasurementModal: handleAddMeasurement called');
    setValue(lastValue?.toString() || '0.0');
    setSliderValue(lastValue || 0);
    setShowInput(true);
  };

  const handleSave = async (value: number) => {
    console.log('MeasurementModal: handleSave called with value:', value);
    try {
      // Ensure the value is a number and not NaN
      const numericValue = isNaN(value) ? 0 : value;
      await onSave(numericValue);
      // Refresh measurements after saving
      const updatedMeasurements = await measurementService.getMeasurementHistory(userId, category);
      setMeasurements(updatedMeasurements);
      onMeasurementsChange?.();
      setShowInput(false);
    } catch (error) {
      console.error('Error saving measurement:', error);
    }
  };

  const handleClose = () => {
    console.log('MeasurementModal: handleClose called');
    Keyboard.dismiss();
    setShowInput(false);
    setValue('');
    setSliderValue(0);
    onClose();
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    try {
      await measurementService.deleteMeasurement(measurementId);
      
      // Refresh measurements after deletion
      const updatedMeasurements = await measurementService.getMeasurementHistory(userId, category);
      setMeasurements(updatedMeasurements);
      onMeasurementsChange?.();

      // If we deleted all measurements or the most recent one, update the input values
      if (updatedMeasurements.length === 0) {
        setValue('0.0');
        setSliderValue(0);
      } else {
        const newLastValue = updatedMeasurements[0].value;
        setValue(newLastValue.toFixed(1));
        setSliderValue(newLastValue);
      }
    } catch (error) {
      console.error('Error deleting measurement:', error);
    }
  };

  const handleValueChange = (text: string) => {
    // Remove any non-numeric characters except decimal point
    const sanitizedText = text.replace(/[^0-9.]/g, '');
    
    // Check if the text contains a decimal point
    if (sanitizedText.includes('.')) {
      // If it has a decimal point, parse it as a float
      const numValue = parseFloat(sanitizedText);
      
      if (!isNaN(numValue) && numValue <= MAX_VALUE) {
        setValue(numValue.toFixed(1));
        setSliderValue(numValue);
      } else {
        setValue(sanitizedText);
      }
    } else {
      // If it doesn't have a decimal point, just use the sanitized text
      // This allows for whole numbers like "80" without forcing a decimal
      const numValue = parseInt(sanitizedText, 10);
      
      if (!isNaN(numValue) && numValue <= MAX_VALUE) {
        setValue(numValue.toString());
        setSliderValue(numValue);
      } else {
        setValue(sanitizedText);
      }
    }
  };

  const handleSliderChange = (newValue: number) => {
    // Only use toFixed(1) if the value has a decimal part
    const formattedValue = Number.isInteger(newValue) 
      ? newValue.toString() 
      : newValue.toFixed(1);
    
    setValue(formattedValue);
    setSliderValue(newValue);
  };

  if (!visible) return null;

  const getCategoryIcon = (category: MeasurementCategory) => {
    switch (category) {
      case 'WEIGHT':
        return 'weight';
      case 'BICEPS':
        return 'arm-flex-outline';
      case 'ABS':
        return 'human-male';
      case 'WAIST':
        return 'human-male';
      case 'CHEST':
        return 'human-male';
      case 'SHLDRS':
        return 'human-male';
      case 'THIGH':
        return 'human-male';
      case 'CALF':
        return 'human-male';
      default:
        return 'ruler';
    }
  };

  return (
    <Provider>
      <Portal>
        <Modal
          visible={visible}
          transparent={true}
          animationType="slide"
          onRequestClose={handleClose}
          statusBarTranslucent={true}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.overlay}
            >
              <View style={styles.modalContainer}>
                {showInput ? (
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.container}>
                      <View style={styles.header}>
                        <IconButton
                          icon="close"
                          iconColor="#fff"
                          size={24}
                          style={styles.closeButton}
                          onPress={() => setShowInput(false)}
                        />
                        <Text style={styles.title}>{category}</Text>
                      </View>

                      <View style={styles.bodyContainer}>
                        <View style={styles.measurementIcon}>
                          <IconButton
                            icon={getCategoryIcon(category)}
                            size={40}
                            iconColor="#FFE600"
                          />
                        </View>
                        
                        <Text style={styles.lastMeasurement}>
                          Last: {lastValue?.toFixed(1)} {category === 'WEIGHT' ? 'kg' : 'cm'}
                        </Text>

                        <View style={styles.inputRow}>
                          <IconButton
                            icon="minus"
                            size={24}
                            iconColor="#fff"
                            onPress={() => {
                              const current = parseFloat(value) || 0;
                              const newValue = Math.max(0, current - STEP).toFixed(1);
                              setValue(newValue);
                              setSliderValue(parseFloat(newValue));
                            }}
                          />
                          <View style={styles.valueContainer}>
                            <TextInput
                              style={styles.valueInput}
                              value={value}
                              onChangeText={handleValueChange}
                              keyboardType="numeric"
                              maxLength={5}
                              selectTextOnFocus
                              placeholderTextColor="#666"
                              returnKeyType="done"
                              onSubmitEditing={Keyboard.dismiss}
                            />
                            <Text style={styles.unit}>{category === 'WEIGHT' ? 'kg' : 'cm'}</Text>
                          </View>
                          <IconButton
                            icon="plus"
                            size={24}
                            iconColor="#fff"
                            onPress={() => {
                              const current = parseFloat(value) || 0;
                              const newValue = Math.min(MAX_VALUE, current + STEP).toFixed(1);
                              setValue(newValue);
                              setSliderValue(parseFloat(newValue));
                            }}
                          />
                        </View>

                        <View style={styles.sliderContainer}>
                          <Slider
                            value={sliderValue}
                            onValueChange={handleSliderChange}
                            minimumValue={0}
                            maximumValue={MAX_VALUE}
                            step={STEP}
                            minimumTrackTintColor="#FFE600"
                            maximumTrackTintColor="#333"
                            thumbTintColor="#FFE600"
                            style={styles.slider}
                          />
                          <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>0</Text>
                            <Text style={styles.sliderLabel}>{MAX_VALUE}</Text>
                          </View>
                        </View>

                        <Pressable
                          style={styles.saveButton}
                          onPress={() => handleSave(parseFloat(value))}
                        >
                          <Text style={styles.saveButtonText}>Save Measurement</Text>
                        </Pressable>

                        <Pressable
                          style={styles.historyButton}
                          onPress={() => setShowInput(false)}
                        >
                          <Text style={styles.historyButtonText}>Measurement History</Text>
                        </Pressable>
                      </View>
                    </View>
                  </TouchableWithoutFeedback>
                ) : (
                  <MeasurementHistory
                    category={category}
                    measurements={measurements}
                    onAddMeasurement={handleAddMeasurement}
                    onClose={handleClose}
                    onDeleteMeasurement={handleDeleteMeasurement}
                  />
                )}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Modal>
      </Portal>
    </Provider>
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
  modalContainer: {
    width: '100%',
    height: '85%',
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E1E1E',
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
  bodyContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
  },
  measurementIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 230, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lastMeasurement: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginHorizontal: 16,
  },
  valueInput: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  unit: {
    fontSize: 24,
    color: '#888',
    marginLeft: 8,
  },
  sliderContainer: {
    width: '100%',
    marginBottom: 32,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#888',
  },
  saveButton: {
    backgroundColor: '#FFE600',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  historyButton: {
    paddingVertical: 8,
  },
  historyButtonText: {
    fontSize: 14,
    color: '#FFE600',
    textDecorationLine: 'underline',
  },
}); 