import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { Divider } from 'react-native-paper';

interface GeneralHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onSettingsPress?: () => void;
  rightElement?: React.ReactNode;
  style?: any;
}

export function GeneralHeader({ 
  title, 
  icon, 
  onSettingsPress, 
  rightElement, 
  style
}: GeneralHeaderProps) {
  const router = useRouter();

  return (
    <View style={[styles.headerContainer, style]}> 
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {icon && <View style={styles.headerIcon}>{icon}</View>}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          {rightElement}
        </View>
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