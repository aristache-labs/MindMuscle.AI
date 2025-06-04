import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { Divider } from 'react-native-paper';
import * as Sentry from '@sentry/react-native';

interface GeneralHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onSettingsPress?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export function GeneralHeader({ title, icon, rightElement, style }: GeneralHeaderProps) {
  // Track component lifecycle
  React.useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'GeneralHeader component mounted',
      category: 'component.lifecycle',
      level: 'info',
      data: {
        title,
        hasIcon: !!icon,
        hasRightElement: !!rightElement,
        hasCustomStyle: !!style,
      },
    });

    return () => {
      Sentry.addBreadcrumb({
        message: 'GeneralHeader component unmounted',
        category: 'component.lifecycle',
        level: 'info',
        data: { title },
      });
    };
  }, [title, icon, rightElement, style]);

  // Track title changes
  React.useEffect(() => {
    if (title) {
      Sentry.addBreadcrumb({
        message: 'GeneralHeader title updated',
        category: 'component.update',
        level: 'info',
        data: { newTitle: title },
      });
    }
  }, [title]);

  return (
    <View style={[styles.headerContainer, style]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {icon && <View style={styles.headerIcon}>{icon}</View>}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.headerRight}>{rightElement}</View>
      </View>
      <Divider style={styles.divider} />
    </View>
  );
}

export default GeneralHeader;

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xxl * 1.5,
    paddingBottom: SPACING.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    backgroundColor: COLORS.primary,
    margin: 0,
    borderRadius: BORDER_RADIUS.round,
    padding: 4,
  },
  headerTitle: {
    marginLeft: SPACING.sm,
    fontWeight: '600',
    color: COLORS.text,
    fontSize: 20,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    padding: 8,
  },
  divider: {
    backgroundColor: COLORS.primary,
    height: 0.5,
  },
});
