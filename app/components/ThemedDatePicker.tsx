import React, { useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { IconButton } from 'react-native-paper';
import { SPACING, BORDER_RADIUS } from '../constants/theme';

interface Props {
  visible: boolean;
  date: Date;
  onCancel: () => void;
  onConfirm: (d: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  width?: number;
}

export function ThemedDatePicker({
  visible,
  date,
  onCancel,
  onConfirm,
  maximumDate,
  minimumDate,
  width,
}: Props) {
  const [tempDate, setTempDate] = useState(date);

  const onChange = (_: DateTimePickerEvent, picked?: Date) => {
    if (picked) setTempDate(picked);
    // on Android we pick and immediately confirm:
    if (Platform.OS === 'android' && picked) {
      onConfirm(picked);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View style={[styles.pickerBox, width ? { width } : { width: '90%', maxWidth: 360 }]}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            style={styles.picker}
            textColor="#fff"
          />

          <View style={styles.actionRow}>
            <IconButton
              icon="close"
              size={24}
              onPress={onCancel}
              style={styles.actionButton}
              iconColor="#fff"
            />
            <IconButton
              icon="check"
              size={24}
              onPress={() => onConfirm(tempDate)}
              style={[styles.actionButton, styles.confirmButton]}
              iconColor="#fff"
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBox: {
    backgroundColor: '#1f222a',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    // purple glow effect
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
  },
  picker: {
    backgroundColor: '#1f222a',
    height: 200,
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
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
});

export default ThemedDatePicker;
