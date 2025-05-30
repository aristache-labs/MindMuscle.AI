import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { Text, TextInput, IconButton } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

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
const lbsToKg = (lbs: number) => Number(Math.round(lbs / 2.20462 * 10) / 10);
const cmToInch = (cm: number) => Number(Math.round(cm / 2.54 * 10) / 10);
const inchToCm = (inch: number) => Number(Math.round(inch * 2.54 * 10) / 10);

const MAX_WEIGHT_KG = 200.0;
const MAX_WEIGHT_LB = 441.0;
const MAX_HEIGHT_CM = 300.0;
const MAX_HEIGHT_INCH = 120.0;

const isValueWithinLimits = (value: number, type: 'weight' | 'height', unit: 'KG' | 'LB' | 'CM' | 'INCH'): boolean => {
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
  initialUnit
}: ThemedNumberPickerProps) {
  const [selectedUnit, setSelectedUnit] = useState<'KG' | 'LB' | 'CM' | 'INCH'>(
    initialUnit || (type === 'weight' ? 'KG' : 'CM')
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
    setSelectedUnit(newUnit);
    onUnitChange?.(newUnit);
  };

  const handleIncrement = () => {
    const step = 0.1;
    // if user is mid-typing, parse that; otherwise use displayValue
    const current = isCustomInput
      ? parseFloat(customValue) || 0
      : displayValue;
    const newDisplay = Number(Math.round((current + step) * 10) / 10);

    // Check if the new value is within limits
    if (!isValueWithinLimits(newDisplay, type, selectedUnit)) {
      return;
    }

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
  };

  const handleDecrement = () => {
    const step = 0.1;
    const current = isCustomInput
      ? parseFloat(customValue) || 0
      : displayValue;
    const newDisplay = Number(Math.round((current - step) * 10) / 10);

    // No need to check lower limit as we want to allow any positive number
    if (newDisplay < 0) {
      return;
    }

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
  };

  const handleCustomValueChange = (text: string) => {
    // Only update the text value during typing
    setCustomValue(text);
  };

  const handleCustomInputBlur = () => {
    const numValue = parseFloat(customValue);
    if (!isNaN(numValue)) {
      const roundedValue = Number(Math.round(numValue * 10) / 10);
      
      // Check if the value is within limits
      if (!isValueWithinLimits(roundedValue, type, selectedUnit)) {
        // If over limit, set to maximum allowed value
        const maxValue = type === 'weight' 
          ? (selectedUnit === 'KG' ? MAX_WEIGHT_KG : MAX_WEIGHT_LB)
          : (selectedUnit === 'CM' ? MAX_HEIGHT_CM : MAX_HEIGHT_INCH);
        setDisplayValue(maxValue);
        setCustomValue(maxValue.toFixed(1));
        
        // Convert max value to base units
        if (type === 'weight' && selectedUnit === 'LB') {
          setBaseValue(lbsToKg(maxValue));
        } else if (type === 'height' && selectedUnit === 'INCH') {
          setBaseValue(inchToCm(maxValue));
        } else {
          setBaseValue(maxValue);
        }
      } else {
        setDisplayValue(roundedValue);
        setCustomValue(roundedValue.toFixed(1));
        
        // Convert display value back to base value
        if (type === 'weight' && selectedUnit === 'LB') {
          setBaseValue(lbsToKg(roundedValue));
        } else if (type === 'height' && selectedUnit === 'INCH') {
          setBaseValue(inchToCm(roundedValue));
        } else {
          setBaseValue(roundedValue);
        }
      }
    } else {
      // If invalid number, revert to current display value
      setCustomValue(displayValue.toFixed(1));
    }
    setIsCustomInput(false);
  };

  const handleConfirm = () => {
    // figure out the "final" numeric value right now
    let finalBase = baseValue;

    if (isCustomInput) {
      const num = parseFloat(customValue);
      if (!isNaN(num)) {
        const rounded = Math.round(num * 10) / 10;
        
        // Check if the value is within limits
        if (!isValueWithinLimits(rounded, type, selectedUnit)) {
          // If over limit, use maximum allowed value
          const maxValue = type === 'weight' 
            ? (selectedUnit === 'KG' ? MAX_WEIGHT_KG : MAX_WEIGHT_LB)
            : (selectedUnit === 'CM' ? MAX_HEIGHT_CM : MAX_HEIGHT_INCH);
          
          // convert max value back to KG/CM if needed
          if (type === 'weight' && selectedUnit === 'LB') {
            finalBase = lbsToKg(maxValue);
          } else if (type === 'height' && selectedUnit === 'INCH') {
            finalBase = inchToCm(maxValue);
          } else {
            finalBase = maxValue;
          }
        } else {
          // convert back to KG/CM if needed
          if (type === 'weight' && selectedUnit === 'LB') {
            finalBase = lbsToKg(rounded);
          } else if (type === 'height' && selectedUnit === 'INCH') {
            finalBase = inchToCm(rounded);
          } else {
            finalBase = rounded;
          }
        }
      }
      setIsCustomInput(false);
      setDisplayValue(
        type === 'weight'
          ? selectedUnit === 'LB'
            ? kgToLbs(finalBase)
            : finalBase
          : selectedUnit === 'INCH'
          ? cmToInch(finalBase)
          : finalBase
      );
      setCustomValue(finalBase.toFixed(1));
      setBaseValue(finalBase);
    }

    // now synchronously pass the correct value
    onConfirm(finalBase);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable style={[styles.modalContent, width ? { width } : null]} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <IconButton
              icon="close"
              size={24}
              onPress={onCancel}
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
                    <Text style={[styles.unitText, selectedUnit === 'KG' && styles.selectedUnitText]}>KG</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'LB' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('LB')}
                  >
                    <Text style={[styles.unitText, selectedUnit === 'LB' && styles.selectedUnitText]}>LB</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'CM' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('CM')}
                  >
                    <Text style={[styles.unitText, selectedUnit === 'CM' && styles.selectedUnitText]}>CM</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitButton, selectedUnit === 'INCH' && styles.selectedUnit]}
                    onPress={() => handleUnitChange('INCH')}
                  >
                    <Text style={[styles.unitText, selectedUnit === 'INCH' && styles.selectedUnitText]}>INCH</Text>
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
                    } 
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