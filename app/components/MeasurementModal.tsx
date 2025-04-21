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
  Platform,
  Image,
  ImageSourcePropType
} from 'react-native';
import { Text, IconButton, Portal, Provider } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MeasurementCategory, measurementService, Measurement } from '../services/measurements';
import MeasurementHistory from './MeasurementHistory';
import OptimizedImage from './OptimizedImage';

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

interface CategoryIcon {
  type: 'material' | 'image';
  source: string | ImageSourcePropType;
}

const CATEGORY_ICONS: Record<MeasurementCategory, CategoryIcon> = {
  WEIGHT: {
    type: 'image',
    source: require('../../assets/measurements/instructions/weight-instruction.png')
  },
  BICEPS: {
    type: 'image',
    source: require('../../assets/measurements/instructions/biceps-instruction.png')
  },
  ABS: {
    type: 'image',
    source: require('../../assets/measurements/instructions/abs-instruction.png')
  },
  WAIST: {
    type: 'image',
    source: require('../../assets/measurements/instructions/waist-instruction.png')
  },
  CHEST: {
    type: 'image',
    source: require('../../assets/measurements/instructions/chest-instruction.png')
  },
  SHLDRS: {
    type: 'image',
    source: require('../../assets/measurements/instructions/shoulders-instruction.png')
  },
  THIGH: {
    type: 'image',
    source: require('../../assets/measurements/instructions/thigh-instruction.png')
  },
  CALF: {
    type: 'image',
    source: require('../../assets/measurements/instructions/calf-instruction.png')
  }
};

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

  useEffect(() => {
    if (visible && lastValue) {
      setValue(lastValue.toString());
      setSliderValue(lastValue);
    }
  }, [visible, lastValue]);

  const handleAddMeasurement = () => {
    setValue(lastValue?.toString() || '0.0');
    setSliderValue(lastValue || 0);
    setShowInput(true);
  };

  const handleSave = async (value: number) => {
    try {
      const numericValue = isNaN(value) ? 0 : parseFloat(value.toFixed(1));
      await onSave(numericValue);
      const updatedMeasurements = await measurementService.getMeasurementHistory(userId, category);
      setMeasurements(updatedMeasurements);
      onMeasurementsChange?.();
      setShowInput(false);
    } catch (error) {
      console.error('Error saving measurement:', error);
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setShowInput(false);
    setValue(lastValue?.toString() || '0.0');
    setSliderValue(lastValue || 0);
    onClose();
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    try {
      await measurementService.deleteMeasurement(measurementId);
      const updatedMeasurements = await measurementService.getMeasurementHistory(userId, category);
      setMeasurements(updatedMeasurements);
      onMeasurementsChange?.();

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
    const sanitizedText = text.replace(/[^0-9.]/g, '');
    
    if (sanitizedText.includes('.')) {
      const numValue = parseFloat(sanitizedText);
      
      if (!isNaN(numValue) && numValue <= MAX_VALUE) {
        setValue(numValue.toFixed(1));
        setSliderValue(numValue);
      }
    } else {
      const numValue = parseInt(sanitizedText, 10);
      
      if (!isNaN(numValue) && numValue <= MAX_VALUE) {
        setValue(numValue.toString());
        setSliderValue(numValue);
      }
    }
  };

  const handleSliderChange = (newValue: number) => {
    const formattedValue = newValue.toFixed(1);
    setValue(formattedValue);
    setSliderValue(newValue);
  };

  const adjustValue = (increment: boolean) => {
    const current = parseFloat(value) || 0;
    const newValue = increment 
      ? Math.min(MAX_VALUE, current + STEP)
      : Math.max(0, current - STEP);
    setValue(newValue.toFixed(1));
    setSliderValue(newValue);
  };

  if (!visible) return null;

  const getCategoryIcon = (category: MeasurementCategory) => {
    return CATEGORY_ICONS[category] || { type: 'material', source: 'ruler' };
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
                        <View style={styles.measurementImageContainer}>
                          <Image
                            source={getCategoryIcon(category).source as ImageSourcePropType}
                            style={styles.measurementImage}
                            resizeMode="contain"
                          />
                        </View>
                        
                        <Text style={styles.lastMeasurement}>
                          Last: {lastValue?.toFixed(1) || '0.0'} {category === 'WEIGHT' ? 'kg' : 'cm'}
                        </Text>

                        <View style={styles.inputRow}>
                          <Pressable 
                            style={styles.adjustButton} 
                            onPress={() => adjustValue(false)}
                          >
                            <IconButton
                              icon="minus"
                              size={24}
                              iconColor="#fff"
                            />
                          </Pressable>
                          
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

                          <Pressable 
                            style={styles.adjustButton} 
                            onPress={() => adjustValue(true)}
                          >
                            <IconButton
                              icon="plus"
                              size={24}
                              iconColor="#fff"
                            />
                          </Pressable>
                        </View>

                        <View style={styles.sliderContainer}>
                          <Slider
                            value={sliderValue}
                            onValueChange={handleSliderChange}
                            minimumValue={0}
                            maximumValue={MAX_VALUE}
                            step={STEP}
                            minimumTrackTintColor="#6B4EFF"
                            maximumTrackTintColor="#333"
                            thumbTintColor="#6B4EFF"
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
    height: '60%',
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    fontSize: 20,
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
  measurementImageContainer: {
    width: 200,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  measurementImage: {
    width: '100%',
    height: '100%',
  },
  lastMeasurement: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6B4EFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flex: 1,
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
    color: '#fff',
    marginLeft: -10,
  },
  sliderContainer: {
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 16,
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
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#6B4EFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyButton: {
    paddingVertical: 8,
  },
  historyButtonText: {
    fontSize: 16,
    color: '#fff',
    textDecorationLine: 'underline',
  },
}); 