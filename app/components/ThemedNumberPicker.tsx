import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { Text, TextInput, IconButton } from 'react-native-paper';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import { SentryDataCollection, SentryLogger, SentryAutoInstrumentation } from '../services/sentry';

interface ThemedNumberPickerProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (value: number) => void;
  value: number;
  width?: number;
  type: 'weight' | 'height';
  onUnitChange?: (unit: 'KG' | 'LB' | 'CM' | 'INCH') => void;
  initialUnit?: 'KG' | 'LB' | 'CM' | 'INCH';
}

// More precise conversion functions
const kgToLbs = (kg: number) => Number(Math.round(kg * 2.20462 * 10) / 10);
const lbsToKg = (lbs: number) => Number(Math.round((lbs / 2.20462) * 10) / 10);
const cmToInch = (cm: number) => Number(Math.round((cm / 2.54) * 10) / 10);
const inchToCm = (inch: number) => Number(Math.round(inch * 2.54 * 10) / 10);

const MAX_WEIGHT_KG = 200.0;
const MAX_WEIGHT_LB = 441.0;
const MAX_HEIGHT_CM = 300.0;
const MAX_HEIGHT_INCH = 120.0;

const isValueWithinLimits = (
  value: number,
  type: 'weight' | 'height',
  unit: 'KG' | 'LB' | 'CM' | 'INCH',
): boolean => {
  if (type === 'weight') {
    return unit === 'KG' ? value <= MAX_WEIGHT_KG : value <= MAX_WEIGHT_LB;
  } else {
    return unit === 'CM' ? value <= MAX_HEIGHT_CM : value <= MAX_HEIGHT_INCH;
  }
};

export function ThemedNumberPicker({
  visible,
  onCancel,
  onConfirm,
  value,
  width,
  type,
  onUnitChange,
  initialUnit,
}: ThemedNumberPickerProps) {
  const [selectedUnit, setSelectedUnit] = useState<'KG' | 'LB' | 'CM' | 'INCH'>(
    initialUnit || (type === 'weight' ? 'KG' : 'CM'),
  );

  // Sync selectedUnit with initialUnit whenever the picker becomes visible
  useEffect(() => {
    if (visible) {
      setSelectedUnit(initialUnit || (type === 'weight' ? 'KG' : 'CM'));
    }
  }, [visible, initialUnit, type]);

  // Always treat incoming value as base units (KG or CM)
  const [baseValue, setBaseValue] = useState(value);

  // Display value is derived from base value and selected unit
  const [displayValue, setDisplayValue] = useState(() => {
    if (type === 'weight' && selectedUnit === 'LB') {
      return kgToLbs(value);
    } else if (type === 'height' && selectedUnit === 'INCH') {
      return cmToInch(value);
    }
    return value;
  });

  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState(displayValue.toFixed(1));

  // Update base value when prop changes
  useEffect(() => {
    if (visible) {
      // Always start from the prop (in KG or CM) when opened
      setBaseValue(value);
    }
  }, [visible, value]);

  // Update display value when base value or unit changes
  useEffect(() => {
    if (visible && !isCustomInput) {
      let newDisplayValue;
      if (type === 'weight') {
        newDisplayValue = selectedUnit === 'LB' ? kgToLbs(baseValue) : baseValue;
      } else {
        newDisplayValue = selectedUnit === 'INCH' ? cmToInch(baseValue) : baseValue;
      }
      setDisplayValue(newDisplayValue);
      setCustomValue(newDisplayValue.toFixed(1));
    }
  }, [visible, baseValue, selectedUnit, type, isCustomInput]);

  const handleUnitChange = (newUnit: 'KG' | 'LB' | 'CM' | 'INCH') => {
    try {
      const previousUnit = selectedUnit;
      const previousValue = displayValue;

      setSelectedUnit(newUnit);
      onUnitChange?.(newUnit);

      // Track unit change interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'unit_change',
        'unit_selector',
        'themed_number_picker',
        {
          previous_unit: previousUnit,
          new_unit: newUnit,
          current_value: previousValue,
          picker_type: type,
          platform: Platform.OS,
        },
      );

      // Add breadcrumb for unit change
      SentryDataCollection.addBreadcrumb({
        message: `User changed unit from ${previousUnit} to ${newUnit}`,
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'ThemedNumberPicker',
          action: 'unit_change',
          previous_unit: previousUnit,
          new_unit: newUnit,
          current_value: previousValue,
          picker_type: type,
          platform: Platform.OS,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedNumberPicker',
        action: 'unit_change_handler',
        new_unit: newUnit,
        picker_type: type,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedNumberPicker unit change handler', {
        error: error as Error,
        component: 'ThemedNumberPicker',
        new_unit: newUnit,
        picker_type: type,
      });

      // Still try to execute the unit change even if tracking fails
      try {
        setSelectedUnit(newUnit);
        onUnitChange?.(newUnit);
      } catch (unitChangeError) {
        SentryDataCollection.captureException(unitChangeError as Error, {
          component: 'ThemedNumberPicker',
          action: 'unit_change_execution',
          new_unit: newUnit,
          platform: Platform.OS,
        });
      }
    }
  };

  const handleIncrement = () => {
    try {
      const step = 0.1;
      // if user is mid-typing, parse that; otherwise use displayValue
      const current = isCustomInput ? parseFloat(customValue) || 0 : displayValue;
      const newDisplay = Number(Math.round((current + step) * 10) / 10);

      // Check if the new value is within limits
      if (!isValueWithinLimits(newDisplay, type, selectedUnit)) {
        // Track when user hits limit
        SentryDataCollection.addBreadcrumb({
          message: `User hit increment limit in ThemedNumberPicker`,
          category: 'user-interaction',
          level: 'info',
          data: {
            component: 'ThemedNumberPicker',
            action: 'increment_limit_reached',
            attempted_value: newDisplay,
            current_value: current,
            picker_type: type,
            unit: selectedUnit,
            platform: Platform.OS,
          },
        });
        return;
      }

      // Track increment interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'increment',
        'increment_button',
        'themed_number_picker',
        {
          previous_value: current,
          new_value: newDisplay,
          picker_type: type,
          unit: selectedUnit,
          platform: Platform.OS,
        },
      );

      // drop out of custom input, update everything
      setIsCustomInput(false);
      setCustomValue(newDisplay.toFixed(1));
      setDisplayValue(newDisplay);
      // mirror back to your KG/CM base
      if (type === 'weight' && selectedUnit === 'LB') {
        setBaseValue(lbsToKg(newDisplay));
      } else if (type === 'height' && selectedUnit === 'INCH') {
        setBaseValue(inchToCm(newDisplay));
      } else {
        setBaseValue(newDisplay);
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedNumberPicker',
        action: 'increment_handler',
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedNumberPicker increment handler', {
        error: error as Error,
        component: 'ThemedNumberPicker',
        picker_type: type,
        unit: selectedUnit,
      });
    }
  };

  const handleDecrement = () => {
    try {
      const step = 0.1;
      const current = isCustomInput ? parseFloat(customValue) || 0 : displayValue;
      const newDisplay = Number(Math.round((current - step) * 10) / 10);

      // No need to check lower limit as we want to allow any positive number
      if (newDisplay < 0) {
        // Track when user hits lower limit
        SentryDataCollection.addBreadcrumb({
          message: `User hit decrement limit in ThemedNumberPicker`,
          category: 'user-interaction',
          level: 'info',
          data: {
            component: 'ThemedNumberPicker',
            action: 'decrement_limit_reached',
            attempted_value: newDisplay,
            current_value: current,
            picker_type: type,
            unit: selectedUnit,
            platform: Platform.OS,
          },
        });
        return;
      }

      // Track decrement interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'decrement',
        'decrement_button',
        'themed_number_picker',
        {
          previous_value: current,
          new_value: newDisplay,
          picker_type: type,
          unit: selectedUnit,
          platform: Platform.OS,
        },
      );

      setIsCustomInput(false);
      setCustomValue(newDisplay.toFixed(1));
      setDisplayValue(newDisplay);
      if (type === 'weight' && selectedUnit === 'LB') {
        setBaseValue(lbsToKg(newDisplay));
      } else if (type === 'height' && selectedUnit === 'INCH') {
        setBaseValue(inchToCm(newDisplay));
      } else {
        setBaseValue(newDisplay);
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedNumberPicker',
        action: 'decrement_handler',
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedNumberPicker decrement handler', {
        error: error as Error,
        component: 'ThemedNumberPicker',
        picker_type: type,
        unit: selectedUnit,
      });
    }
  };

  const handleCustomValueChange = (text: string) => {
    // Only update the text value during typing
    setCustomValue(text);
  };

  // Helper function to handle limit exceeded scenario
  const handleLimitExceeded = (roundedValue: number) => {
    const maxValue = getMaxValue();

    // Track when user input exceeds limits
    SentryDataCollection.addBreadcrumb({
      message: `User input exceeded limits in ThemedNumberPicker`,
      category: 'user-interaction',
      level: 'warning',
      data: {
        component: 'ThemedNumberPicker',
        action: 'custom_input_limit_exceeded',
        attempted_value: roundedValue,
        max_value: maxValue,
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      },
    });

    setDisplayValue(maxValue);
    setCustomValue(maxValue.toFixed(1));
    setBaseValue(convertToBaseValue(maxValue));
  };

  // Helper function to handle valid input
  const handleValidInput = (roundedValue: number) => {
    // Track successful custom input
    SentryAutoInstrumentation.trackUserInteraction(
      'custom_input',
      'text_input',
      'themed_number_picker',
      {
        entered_value: roundedValue,
        previous_value: displayValue,
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      },
    );

    setDisplayValue(roundedValue);
    setCustomValue(roundedValue.toFixed(1));
    setBaseValue(convertToBaseValue(roundedValue));
  };

  // Helper function to handle invalid input
  const handleInvalidInput = () => {
    // Track invalid input
    SentryDataCollection.addBreadcrumb({
      message: `User entered invalid input in ThemedNumberPicker`,
      category: 'user-interaction',
      level: 'warning',
      data: {
        component: 'ThemedNumberPicker',
        action: 'invalid_custom_input',
        invalid_value: customValue,
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      },
    });

    setCustomValue(displayValue.toFixed(1));
  };

  const handleCustomInputBlur = () => {
    try {
      const numValue = parseFloat(customValue);
      if (!isNaN(numValue)) {
        const roundedValue = Number(Math.round(numValue * 10) / 10);

        if (!isValueWithinLimits(roundedValue, type, selectedUnit)) {
          handleLimitExceeded(roundedValue);
        } else {
          handleValidInput(roundedValue);
        }
      } else {
        handleInvalidInput();
      }
      setIsCustomInput(false);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedNumberPicker',
        action: 'custom_input_blur_handler',
        custom_value: customValue,
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedNumberPicker custom input blur handler', {
        error: error as Error,
        component: 'ThemedNumberPicker',
        custom_value: customValue,
        picker_type: type,
        unit: selectedUnit,
      });

      // Fallback: revert to display value and exit custom input
      try {
        setCustomValue(displayValue.toFixed(1));
        setIsCustomInput(false);
      } catch (fallbackError) {
        SentryDataCollection.captureException(fallbackError as Error, {
          component: 'ThemedNumberPicker',
          action: 'custom_input_fallback',
          platform: Platform.OS,
        });
      }
    }
  };

  // Helper function to get maximum allowed value for current type and unit
  const getMaxValue = () => {
    if (type === 'weight') {
      return selectedUnit === 'KG' ? MAX_WEIGHT_KG : MAX_WEIGHT_LB;
    }
    return selectedUnit === 'CM' ? MAX_HEIGHT_CM : MAX_HEIGHT_INCH;
  };

  // Helper function to convert display value to base value
  const convertToBaseValue = (displayVal: number) => {
    if (type === 'weight' && selectedUnit === 'LB') {
      return lbsToKg(displayVal);
    }
    if (type === 'height' && selectedUnit === 'INCH') {
      return inchToCm(displayVal);
    }
    return displayVal;
  };

  // Helper function to convert base value to display value
  const convertToDisplayValue = (baseVal: number) => {
    if (type === 'weight' && selectedUnit === 'LB') {
      return kgToLbs(baseVal);
    }
    if (type === 'height' && selectedUnit === 'INCH') {
      return cmToInch(baseVal);
    }
    return baseVal;
  };

  // Helper function to process custom input value
  const processCustomInput = () => {
    const num = parseFloat(customValue);
    if (isNaN(num)) {
      return baseValue;
    }

    const rounded = Math.round(num * 10) / 10;

    if (!isValueWithinLimits(rounded, type, selectedUnit)) {
      const maxValue = getMaxValue();
      return convertToBaseValue(maxValue);
    }

    return convertToBaseValue(rounded);
  };

  // Helper function to update display state
  const updateDisplayState = (finalBase: number) => {
    const newDisplayValue = convertToDisplayValue(finalBase);
    setDisplayValue(newDisplayValue);
    setCustomValue(newDisplayValue.toFixed(1));
    setBaseValue(finalBase);
  };

  const handleCancel = () => {
    try {
      // Track cancel interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'cancel',
        'cancel_button',
        'themed_number_picker',
        {
          current_value: displayValue,
          original_value: value,
          picker_type: type,
          unit: selectedUnit,
          platform: Platform.OS,
        },
      );

      // Add breadcrumb for cancel action
      SentryDataCollection.addBreadcrumb({
        message: 'User cancelled number picker',
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'ThemedNumberPicker',
          action: 'cancel',
          current_value: displayValue,
          original_value: value,
          picker_type: type,
          unit: selectedUnit,
          platform: Platform.OS,
        },
      });

      onCancel();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedNumberPicker',
        action: 'cancel_handler',
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedNumberPicker cancel handler', {
        error: error as Error,
        component: 'ThemedNumberPicker',
        picker_type: type,
        unit: selectedUnit,
      });

      // Still try to execute the cancel even if tracking fails
      try {
        onCancel();
      } catch (cancelError) {
        SentryDataCollection.captureException(cancelError as Error, {
          component: 'ThemedNumberPicker',
          action: 'cancel_execution',
          platform: Platform.OS,
        });
      }
    }
  };

  const handleConfirm = () => {
    try {
      let finalBase = baseValue;

      if (isCustomInput) {
        finalBase = processCustomInput();
        setIsCustomInput(false);
        updateDisplayState(finalBase);
      }

      // Track confirm interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'confirm',
        'confirm_button',
        'themed_number_picker',
        {
          selected_value: finalBase,
          original_value: value,
          value_changed: finalBase !== value,
          picker_type: type,
          unit: selectedUnit,
          platform: Platform.OS,
        },
      );

      // Add breadcrumb for confirm action
      SentryDataCollection.addBreadcrumb({
        message: 'User confirmed number selection',
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'ThemedNumberPicker',
          action: 'confirm',
          selected_value: finalBase,
          original_value: value,
          value_changed: finalBase !== value,
          picker_type: type,
          unit: selectedUnit,
          platform: Platform.OS,
        },
      });

      onConfirm(finalBase);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedNumberPicker',
        action: 'confirm_handler',
        picker_type: type,
        unit: selectedUnit,
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedNumberPicker confirm handler', {
        error: error as Error,
        component: 'ThemedNumberPicker',
        picker_type: type,
        unit: selectedUnit,
      });

      // Still try to execute the confirm even if tracking fails
      try {
        onConfirm(baseValue);
      } catch (confirmError) {
        SentryDataCollection.captureException(confirmError as Error, {
          component: 'ThemedNumberPicker',
          action: 'confirm_execution',
          platform: Platform.OS,
        });
      }
    }
  };

  // Track when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      try {
        SentryDataCollection.addBreadcrumb({
          message: 'ThemedNumberPicker modal opened',
          category: 'ui-lifecycle',
          level: 'info',
          data: {
            component: 'ThemedNumberPicker',
            action: 'modal_open',
            initial_value: value,
            picker_type: type,
            initial_unit: initialUnit,
            platform: Platform.OS,
          },
        });
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'ThemedNumberPicker',
          action: 'modal_visibility_tracking',
          platform: Platform.OS,
        });
      }
    }
  }, [visible, value, type, initialUnit]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.modalOverlay} onPress={handleCancel}>
        <Pressable
          style={[styles.modalContent, width ? { width } : null]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <IconButton
              icon="close"
              size={24}
              onPress={handleCancel}
              style={styles.actionButton}
              iconColor="#fff"
            />
            <View style={styles.unitSelector}>
              {type === 'weight' ? (
                <>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'KG' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('KG')}
                  >
                    <Text
                      style={[styles.unitText, selectedUnit === 'KG' && styles.selectedUnitText]}
                    >
                      KG
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'LB' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('LB')}
                  >
                    <Text
                      style={[styles.unitText, selectedUnit === 'LB' && styles.selectedUnitText]}
                    >
                      LB
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'CM' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('CM')}
                  >
                    <Text
                      style={[styles.unitText, selectedUnit === 'CM' && styles.selectedUnitText]}
                    >
                      CM
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'INCH' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('INCH')}
                  >
                    <Text
                      style={[styles.unitText, selectedUnit === 'INCH' && styles.selectedUnitText]}
                    >
                      INCH
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
            <IconButton
              icon="check"
              size={24}
              onPress={handleConfirm}
              style={[styles.actionButton, styles.confirmButton]}
              iconColor="#fff"
            />
          </View>

          <View style={styles.pickerContainer}>
            <Pressable onPress={handleIncrement} style={styles.arrowButton}>
              <Text style={styles.arrowText}>▲</Text>
            </Pressable>

            <View style={styles.valueContainer}>
              {isCustomInput ? (
                <TextInput
                  value={customValue}
                  onChangeText={handleCustomValueChange}
                  keyboardType="numeric"
                  style={styles.customInput}
                  autoFocus
                  onBlur={handleCustomInputBlur}
                  theme={{
                    colors: {
                      text: '#fff',
                      primary: '#6c47ff',
                    },
                  }}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                />
              ) : (
                <Pressable onPress={() => setIsCustomInput(true)}>
                  <Text style={styles.valueText}>{displayValue.toFixed(1)}</Text>
                </Pressable>
              )}
              <Text style={styles.unitLabel}>{selectedUnit}</Text>
            </View>

            <Pressable onPress={handleDecrement} style={styles.arrowButton}>
              <Text style={styles.arrowText}>▼</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: '#1f222a',
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    // purple glow effect
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    margin: 0,
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: '#2a2d36',
  },
  confirmButton: {
    backgroundColor: '#6c47ff',
  },
  unitSelector: {
    flexDirection: 'row',
    backgroundColor: '#2a2d36',
    borderRadius: BORDER_RADIUS.lg,
    padding: 2,
  },
  unitButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 60,
    alignItems: 'center',
  },
  selectedUnit: {
    backgroundColor: '#6c47ff',
  },
  unitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedUnitText: {
    color: '#fff',
    fontWeight: '600',
  },
  pickerContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    minHeight: 250,
    justifyContent: 'space-between',
  },
  arrowButton: {
    padding: SPACING.sm,
    width: '60%',
    alignItems: 'center',
    backgroundColor: '#2a2d36',
    borderRadius: BORDER_RADIUS.lg,
  },
  arrowText: {
    color: '#6c47ff',
    fontSize: 32,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: '#2a2d36',
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    // purple glow effect
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    borderWidth: 0.1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  valueText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  unitLabel: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  customInput: {
    backgroundColor: 'transparent',
    fontSize: 48,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    height: 70,
    minWidth: 150,
    marginRight: SPACING.sm,
  },
} as const);

export default ThemedNumberPicker;
