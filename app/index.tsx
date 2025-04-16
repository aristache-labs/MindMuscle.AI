import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native-paper';
import { COLORS } from './constants/theme';

export default function Index() {
  // Here we'll add authentication check logic later
  const isAuthenticated = false;

  // Show loading indicator while checking auth status
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      {!isAuthenticated && <Redirect href="/(auth)/login" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 