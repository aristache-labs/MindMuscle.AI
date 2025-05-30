import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { MenuHeader } from '../components/MenuHeader';

interface CustomScreenProps {
  embedded?: boolean;
}

export default function CustomScreen({ embedded = false }: CustomScreenProps) {
  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="Custom" />}
      <View style={styles.content}>
        <Text style={styles.title}>Custom Workout</Text>
        <Text style={styles.description}>
          Create your own workout routine by selecting exercises, sets, and reps.
        </Text>
        <Button
          mode="contained"
          icon="plus"
          style={styles.button}
          labelStyle={styles.buttonLabel}
          onPress={() => {}}>
          CREATE WORKOUT
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: COLORS.secondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 32,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 