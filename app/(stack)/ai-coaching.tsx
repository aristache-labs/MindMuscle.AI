import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';
import { MenuHeader } from '../components/MenuHeader';

interface AiCoachingScreenProps {
  embedded?: boolean;
}

export default function AiCoachingScreen({ embedded = false }: AiCoachingScreenProps) {
  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="AI Coaching" />}
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>AI Coaching will be available soon.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: SPACING.md,
  },
}); 