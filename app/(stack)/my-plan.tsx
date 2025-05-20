import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar } from 'react-native-paper';
import React from 'react';

interface MyPlanScreenProps {
  embedded?: boolean;
}

export default function MyPlanScreen({ embedded = false }: MyPlanScreenProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {!embedded && (
        <Appbar.Header>
          <Appbar.BackAction onPress={() => router.back()} />
          <Appbar.Content title="My Plan" />
        </Appbar.Header>
      )}
      <View style={styles.content}>
        <Text style={styles.title}>Your Workout Plan</Text>
        <Text style={styles.placeholder}>This is a sample page. Display your personalized workout plan here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  placeholder: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
}); 