import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { IconButton, Portal, Provider, Text } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { Measurement, MeasurementCategory, measurementService } from '../services/measurements';
import { validationService } from '../services/validationService';
import { logger } from '../utils/logger';
import MeasurementHistory from './MeasurementHistory';
import * as Sentry from '@sentry/react-native';

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

const MIN_VALUE = 25;
const MAX_VALUE = 226;
const STEP = 0.1;

interface CategoryIcon {
  type: 'material' | 'image';
  source: string | ImageSourcePropType;
}

const CATEGORY_ICONS: Record<MeasurementCategory, CategoryIcon> = {
  WEIGHT: {
    type: 'image',
    source: require('../../assets/measurements/instructions/weight-instruction.png'),
  },
  BICEPS: {
    type: 'image',
    source: require('../../assets/measurements/instructions/biceps-instruction.png'),
  },
  ABS: {
    type: 'image',
    source: require('../../assets/measurements/instructions/abs-instruction.png'),
  },
  WAIST: {
    type: 'image',
    source: require('../../assets/measurements/instructions/waist-instruction.png'),
  },
  CHEST: {
    type: 'image',
    source: require('../../assets/measurements/instructions/chest-instruction.png'),
  },
  SHOULDERS: {
    type: 'image',
    source: require('../../assets/measurements/instructions/shoulders-instruction.png'),
  },
  THIGH: {
    type: 'image',
    source: require('../../assets/measurements/instructions/thigh-instruction.png'),
  },
  CALF: {
    type: 'image',
    source: require('../../assets/measurements/instructions/calf-instruction.png'),
  },
};

export default function MeasurementModal({
  visible,
  category,
  lastValue,
  measurements: initialMeasurements,
  onClose,
  onSave,
  userId,
  onMeasurementsChange,
}: Props) {
  const [showInput, setShowInput] = useState(false);
  const [value, setValue] = useState(lastValue?.toString() || MIN_VALUE.toString());
  const [sliderValue, setSliderValue] = useState(lastValue || MIN_VALUE);
  const [measurements, setMeasurements] = useState<Measurement[]>(initialMeasurements);
  const [validationError, setValidationError] = useState<string>('');

  // Track component lifecycle
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'MeasurementModal component mounted',
      category: 'component.lifecycle',
      level: 'info',
      data: {
        category,
        userId,
        hasLastValue: !!lastValue,
        measurementCount: initialMeasurements.length,
        initialVisible: visible,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'MeasurementModal component unmounted',
        category: 'component.lifecycle',
        level: 'info',
        data: { category, userId },
      });
    };
  }, []);

  // Track modal visibility changes
  React.useEffect(() => {
    if (visible) {
      Sentry.addBreadcrumb({
        message: 'MeasurementModal opened',
        category: 'ui.modal',
        level: 'info',
        data: {
          category,
          userId,
          hasLastValue: !!lastValue,
          measurementCount: measurements.length,
        },
      });
    } else {
      Sentry.addBreadcrumb({
        message: 'MeasurementModal closed',
        category: 'ui.modal',
        level: 'info',
        data: { category, userId },
      });
    }
  }, [visible, category, userId, lastValue, measurements.length]);

  // Track input mode changes
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: `MeasurementModal mode changed to ${showInput ? 'input' : 'history'}`,
      category: 'ui.state',
      level: 'info',
      data: {
        category,
        showInput,
        currentValue: value,
      },
    });
  }, [showInput, category, value]);

  useEffect(() => {
    setMeasurements(initialMeasurements);
  }, [initialMeasurements]);

  useEffect(() => {
    if (visible && lastValue) {
      setValue(lastValue.toString());
      setSliderValue(lastValue);
    } else if (visible && !lastValue) {
      setValue(MIN_VALUE.toString());
      setSliderValue(MIN_VALUE);
    }
    // Clear validation error when modal opens
    setValidationError('');
  }, [visible, lastValue]);

  const validateMeasurement = (measurementValue: number) => {
    try {
      const formData = {
        category,
        value: measurementValue,
        unit: category === 'WEIGHT' ? 'kg' : 'cm',
        measuredAt: new Date(),
      };

      const validationResult = validationService.validateMeasurementForm(formData);

      if (!validationResult.success) {
        const errorMessage = validationResult.errors.map((e) => e.message).join(', ');
        setValidationError(errorMessage);

        Sentry.addBreadcrumb({
          message: 'MeasurementModal validation failed',
          category: 'validation.error',
          level: 'warning',
          data: {
            category,
            value: measurementValue,
            errors: validationResult.errors,
          },
        });

        logger.warn('Measurement validation failed', {
          context: { formData, errors: validationResult.errors },
        });
        return false;
      }

      setValidationError('');

      Sentry.addBreadcrumb({
        message: 'MeasurementModal validation passed',
        category: 'validation.success',
        level: 'info',
        data: {
          category,
          value: measurementValue,
        },
      });

      return true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'validate_measurement',
        },
        extra: {
          category,
          measurementValue,
          userId,
        },
      });
      setValidationError('Validation error occurred');
      return false;
    }
  };

  const handleAddMeasurement = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'MeasurementModal add measurement initiated',
        category: 'ui.interaction',
        level: 'info',
        data: {
          category,
          currentMeasurementCount: measurements.length,
        },
      });

      setValue(lastValue?.toString() || MIN_VALUE.toString());
      setSliderValue(lastValue || MIN_VALUE);
      setValidationError('');
      setShowInput(true);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'add_measurement',
        },
        extra: { category, userId },
      });
    }
  };

  const handleSave = async (value: number) => {
    try {
      const numericValue = Number.isNaN(value) ? 0 : parseFloat(value.toFixed(1));

      Sentry.addBreadcrumb({
        message: 'MeasurementModal save attempt',
        category: 'ui.interaction',
        level: 'info',
        data: {
          category,
          value: numericValue,
          userId,
        },
      });

      // Validate the measurement before saving
      if (!validateMeasurement(numericValue)) {
        return; // Don't save if validation fails
      }

      await onSave(numericValue);

      const updatedMeasurements = await measurementService.getMeasurementHistory(userId, category);
      setMeasurements(updatedMeasurements);
      onMeasurementsChange?.();
      setShowInput(false);

      Sentry.addBreadcrumb({
        message: 'MeasurementModal measurement saved successfully',
        category: 'data.save',
        level: 'info',
        data: {
          category,
          value: numericValue,
          userId,
          newMeasurementCount: updatedMeasurements.length,
        },
      });

      logger.info('Measurement saved successfully', {
        context: { userId, category, value: numericValue },
      });
    } catch (error) {
      logger.error('Error saving measurement', error as Error, {
        context: { userId, category, value },
      });

      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'save_measurement',
        },
        extra: {
          category,
          value,
          userId,
        },
      });

      setValidationError('Failed to save measurement. Please try again.');
    }
  };

  const handleClose = () => {
    try {
      Sentry.addBreadcrumb({
        message: 'MeasurementModal close initiated',
        category: 'ui.interaction',
        level: 'info',
        data: {
          category,
          userId,
          wasInInputMode: showInput,
        },
      });

      Keyboard.dismiss();
      setShowInput(false);
      setValue(lastValue?.toString() || MIN_VALUE.toString());
      setSliderValue(lastValue || MIN_VALUE);
      setValidationError('');
      onClose();
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'close',
        },
        extra: { category, userId },
      });
    }
  };

  const handleDeleteMeasurement = async (measurementId: string) => {
    try {
      Sentry.addBreadcrumb({
        message: 'MeasurementModal delete measurement initiated',
        category: 'ui.interaction',
        level: 'info',
        data: {
          category,
          measurementId,
          userId,
          currentCount: measurements.length,
        },
      });

      await measurementService.deleteMeasurement(measurementId);
      const updatedMeasurements = await measurementService.getMeasurementHistory(userId, category);
      setMeasurements(updatedMeasurements);
      onMeasurementsChange?.();

      if (updatedMeasurements.length === 0) {
        setValue(MIN_VALUE.toString());
        setSliderValue(MIN_VALUE);
      } else {
        const newLastValue = updatedMeasurements[0].value;
        setValue(newLastValue.toFixed(1));
        setSliderValue(newLastValue);
      }

      Sentry.addBreadcrumb({
        message: 'MeasurementModal measurement deleted successfully',
        category: 'data.delete',
        level: 'info',
        data: {
          category,
          measurementId,
          userId,
          remainingCount: updatedMeasurements.length,
        },
      });

      logger.info('Measurement deleted successfully', {
        context: { userId, category, measurementId },
      });
    } catch (error) {
      logger.error('Error deleting measurement', error as Error, {
        context: { userId, category, measurementId },
      });

      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'delete_measurement',
        },
        extra: {
          category,
          measurementId,
          userId,
        },
      });

      setValidationError('Failed to delete measurement. Please try again.');
    }
  };

  const handleValueChange = (text: string) => {
    try {
      // Allow user to type freely, only numbers and dot
      const sanitizedText = text.replace(/[^0-9.]/g, '');
      setValue(sanitizedText);

      Sentry.addBreadcrumb({
        message: 'MeasurementModal value input changed',
        category: 'ui.input',
        level: 'debug',
        data: {
          category,
          originalText: text,
          sanitizedText,
        },
      });

      // Clear validation error when user makes changes
      if (validationError) {
        setValidationError('');
      }

      // Only update slider if value is within bounds
      const numValue = parseFloat(sanitizedText);
      if (!Number.isNaN(numValue) && numValue >= MIN_VALUE && numValue <= MAX_VALUE) {
        setSliderValue(numValue);
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'value_change',
        },
        extra: { category, text, userId },
      });
    }
  };

  // Clamp and format value on blur
  const handleValueBlur = () => {
    try {
      let numValue = parseFloat(value);
      if (Number.isNaN(numValue)) numValue = MIN_VALUE;
      if (numValue < MIN_VALUE) numValue = MIN_VALUE;
      if (numValue > MAX_VALUE) numValue = MAX_VALUE;
      setValue(numValue.toFixed(1));
      setSliderValue(numValue);

      Sentry.addBreadcrumb({
        message: 'MeasurementModal value input blurred',
        category: 'ui.input',
        level: 'debug',
        data: {
          category,
          finalValue: numValue,
          wasClamped: parseFloat(value) !== numValue,
        },
      });

      // Validate the value when user finishes editing
      validateMeasurement(numValue);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'value_blur',
        },
        extra: { category, value, userId },
      });
    }
  };

  const handleSliderChange = (newValue: number) => {
    try {
      const clampedValue = Math.max(MIN_VALUE, Math.min(MAX_VALUE, newValue));
      const formattedValue = clampedValue.toFixed(1);
      setValue(formattedValue);
      setSliderValue(clampedValue);

      Sentry.addBreadcrumb({
        message: 'MeasurementModal slider value changed',
        category: 'ui.slider',
        level: 'debug',
        data: {
          category,
          originalValue: newValue,
          clampedValue,
        },
      });

      // Clear validation error when user makes changes
      if (validationError) {
        setValidationError('');
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'slider_change',
        },
        extra: { category, newValue, userId },
      });
    }
  };

  const adjustValue = (increment: boolean) => {
    try {
      const current = parseFloat(value) || MIN_VALUE;
      const newValue = increment
        ? Math.min(MAX_VALUE, current + STEP)
        : Math.max(MIN_VALUE, current - STEP);
      setValue(newValue.toFixed(1));
      setSliderValue(newValue);

      Sentry.addBreadcrumb({
        message: `MeasurementModal value ${increment ? 'incremented' : 'decremented'}`,
        category: 'ui.interaction',
        level: 'debug',
        data: {
          category,
          previousValue: current,
          newValue,
          increment,
        },
      });

      // Clear validation error when user makes changes
      if (validationError) {
        setValidationError('');
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'MeasurementModal',
          action: 'adjust_value',
        },
        extra: { category, increment, currentValue: value, userId },
      });
    }
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
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.overlay}
            >
              <View style={styles.modalContainer}>
                {showInput ? (
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.container}>
                      <View style={styles.topGlowLeft} />
                      <View style={styles.topGlowRight} />
                      <View style={styles.header}>
                        <IconButton
                          icon="close"
                          iconColor={COLORS.text}
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
                            onError={(error) => {
                              Sentry.captureException(error.nativeEvent.error, {
                                tags: {
                                  component: 'MeasurementModal',
                                  action: 'image_load_error',
                                },
                                extra: {
                                  category,
                                  userId,
                                },
                              });
                            }}
                          />
                        </View>

                        <Text style={styles.lastMeasurement}>
                          Last: {lastValue?.toFixed(1) || MIN_VALUE.toString()}{' '}
                          {category === 'WEIGHT' ? 'kg' : 'cm'}
                        </Text>

                        <View style={styles.inputRow}>
                          <Pressable style={styles.adjustButton} onPress={() => adjustValue(false)}>
                            <IconButton icon="minus" size={24} iconColor={COLORS.text} />
                          </Pressable>

                          <View style={styles.valueContainer}>
                            <TextInput
                              style={styles.valueInput}
                              value={value}
                              onChangeText={handleValueChange}
                              onBlur={handleValueBlur}
                              keyboardType="numeric"
                              maxLength={5}
                              selectTextOnFocus
                              placeholderTextColor="#666"
                              returnKeyType="done"
                              onSubmitEditing={Keyboard.dismiss}
                            />
                            <Text style={styles.unit}>{category === 'WEIGHT' ? 'kg' : 'cm'}</Text>
                          </View>

                          <Pressable style={styles.adjustButton} onPress={() => adjustValue(true)}>
                            <IconButton icon="plus" size={24} iconColor={COLORS.text} />
                          </Pressable>
                        </View>

                        <View style={styles.sliderContainer}>
                          <Slider
                            value={sliderValue}
                            onValueChange={handleSliderChange}
                            minimumValue={MIN_VALUE}
                            maximumValue={MAX_VALUE}
                            step={STEP}
                            minimumTrackTintColor={COLORS.primary}
                            maximumTrackTintColor="#333"
                            thumbTintColor={COLORS.primary}
                            style={styles.slider}
                          />
                          <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>{MIN_VALUE}</Text>
                            <Text style={styles.sliderLabel}>{MAX_VALUE}</Text>
                          </View>
                        </View>

                        <Pressable
                          style={styles.saveButton}
                          onPress={() => handleSave(parseFloat(value))}
                        >
                          <Text style={styles.saveButtonText}>Save Measurement</Text>
                        </Pressable>

                        <Pressable style={styles.historyButton} onPress={() => setShowInput(false)}>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '68%',
    backgroundColor: COLORS.background,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
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
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
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
    backgroundColor: COLORS.primary,
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
    color: COLORS.text,
    minWidth: 120,
    textAlign: 'center',
    padding: 0,
  },
  unit: {
    fontSize: 24,
    color: COLORS.text,
    marginLeft: 10,
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
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    margin: 10,
    width: '70%',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  historyButton: {
    paddingVertical: 8,
  },
  historyButtonText: {
    fontSize: 16,
    color: COLORS.text,
    textDecorationLine: 'underline',
  },
});
