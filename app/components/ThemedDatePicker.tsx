import React, { useState } from 'react';
import { Modal, View, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { IconButton } from 'react-native-paper';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import { SentryDataCollection, SentryLogger, SentryAutoInstrumentation } from '../services/sentry';

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
    try {
      if (picked) {
        setTempDate(picked);

        // Track user interaction
        SentryAutoInstrumentation.trackUserInteraction(
          'date_change',
          'date_picker',
          'themed_date_picker',
          {
            selected_date: picked.toISOString(),
            previous_date: tempDate.toISOString(),
            platform: Platform.OS,
          },
        );

        // Add breadcrumb for date selection
        SentryDataCollection.addBreadcrumb({
          message: 'User changed date in ThemedDatePicker',
          category: 'user-interaction',
          level: 'info',
          data: {
            component: 'ThemedDatePicker',
            action: 'date_change',
            selected_date: picked.toISOString(),
            platform: Platform.OS,
          },
        });
      }

      // on Android we pick and immediately confirm:
      if (Platform.OS === 'android' && picked) {
        handleConfirm(picked);
      }
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedDatePicker',
        action: 'date_change_handler',
        platform: Platform.OS,
        selected_date: picked?.toISOString(),
      });

      SentryLogger.error('Error in ThemedDatePicker onChange handler', {
        error: error as Error,
        component: 'ThemedDatePicker',
        platform: Platform.OS,
      });
    }
  };

  const handleCancel = () => {
    try {
      // Track cancel interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'cancel',
        'cancel_button',
        'themed_date_picker',
        {
          current_date: tempDate.toISOString(),
          original_date: date.toISOString(),
          platform: Platform.OS,
        },
      );

      // Add breadcrumb for cancel action
      SentryDataCollection.addBreadcrumb({
        message: 'User cancelled date picker',
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'ThemedDatePicker',
          action: 'cancel',
          platform: Platform.OS,
        },
      });

      onCancel();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedDatePicker',
        action: 'cancel_handler',
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedDatePicker cancel handler', {
        error: error as Error,
        component: 'ThemedDatePicker',
      });

      // Still try to execute the cancel even if tracking fails
      try {
        onCancel();
      } catch (cancelError) {
        SentryDataCollection.captureException(cancelError as Error, {
          component: 'ThemedDatePicker',
          action: 'cancel_execution',
          platform: Platform.OS,
        });
      }
    }
  };

  const handleConfirm = (dateToConfirm: Date = tempDate) => {
    try {
      // Validate date is within bounds
      if (maximumDate && dateToConfirm > maximumDate) {
        const errorMessage = 'Selected date exceeds maximum allowed date';
        SentryLogger.warn(errorMessage, {
          component: 'ThemedDatePicker',
          selected_date: dateToConfirm.toISOString(),
          maximum_date: maximumDate.toISOString(),
        });
      }

      if (minimumDate && dateToConfirm < minimumDate) {
        const errorMessage = 'Selected date is before minimum allowed date';
        SentryLogger.warn(errorMessage, {
          component: 'ThemedDatePicker',
          selected_date: dateToConfirm.toISOString(),
          minimum_date: minimumDate.toISOString(),
        });
      }

      // Track confirm interaction
      SentryAutoInstrumentation.trackUserInteraction(
        'confirm',
        'confirm_button',
        'themed_date_picker',
        {
          selected_date: dateToConfirm.toISOString(),
          original_date: date.toISOString(),
          date_changed: dateToConfirm.getTime() !== date.getTime(),
          platform: Platform.OS,
        },
      );

      // Add breadcrumb for confirm action
      SentryDataCollection.addBreadcrumb({
        message: 'User confirmed date selection',
        category: 'user-interaction',
        level: 'info',
        data: {
          component: 'ThemedDatePicker',
          action: 'confirm',
          selected_date: dateToConfirm.toISOString(),
          date_changed: dateToConfirm.getTime() !== date.getTime(),
          platform: Platform.OS,
        },
      });

      onConfirm(dateToConfirm);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'ThemedDatePicker',
        action: 'confirm_handler',
        selected_date: dateToConfirm.toISOString(),
        platform: Platform.OS,
      });

      SentryLogger.error('Error in ThemedDatePicker confirm handler', {
        error: error as Error,
        component: 'ThemedDatePicker',
        selected_date: dateToConfirm.toISOString(),
      });

      // Still try to execute the confirm even if tracking fails
      try {
        onConfirm(dateToConfirm);
      } catch (confirmError) {
        SentryDataCollection.captureException(confirmError as Error, {
          component: 'ThemedDatePicker',
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
          message: 'ThemedDatePicker modal opened',
          category: 'ui-lifecycle',
          level: 'info',
          data: {
            component: 'ThemedDatePicker',
            action: 'modal_open',
            initial_date: date.toISOString(),
            has_max_date: !!maximumDate,
            has_min_date: !!minimumDate,
            platform: Platform.OS,
          },
        });
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'ThemedDatePicker',
          action: 'modal_visibility_tracking',
          platform: Platform.OS,
        });
      }
    }
  }, [visible, date, maximumDate, minimumDate]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
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
              onPress={handleCancel}
              style={styles.actionButton}
              iconColor="#fff"
            />
            <IconButton
              icon="check"
              size={24}
              onPress={() => handleConfirm(tempDate)}
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
