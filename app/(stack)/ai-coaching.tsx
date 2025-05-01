import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { COLORS } from '../constants/theme';
import { MenuHeader } from '../components/MenuHeader';

interface AiCoachingScreenProps {
  embedded?: boolean;
}

export default function AiCoachingScreen({ embedded = false }: AiCoachingScreenProps) {
  return (
    <View style={styles.container}>
      {!embedded && <MenuHeader currentOption="AI Coaching" />}
      <View style={styles.content}>
        <Text style={styles.title}>AI Coaching</Text>
        <Text style={styles.description}>
          Get personalized workout recommendations and real-time form feedback from our AI coach.
          This feature is coming soon!
        </Text>
        <Button
          mode="contained"
          style={styles.button}
          labelStyle={styles.buttonLabel}
          onPress={() => {}}>
          JOIN WAITLIST
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