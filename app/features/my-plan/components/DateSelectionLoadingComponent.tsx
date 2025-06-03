import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { COLORS } from '../../../constants/theme';
import { styles } from '../styles';

const DateSelectionLoadingComponent: React.FC = () => (
  <View style={styles.dateSelectionLoadingContainer}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.dateSelectionLoadingText}>Loading workout...</Text>
  </View>
);

export default DateSelectionLoadingComponent;
