import React from 'react';
import { View } from 'react-native';
import CoachingInterface from '../components/CoachingInterface';
import { CoachingProvider } from '../store/CoachingContext';

export default function CoachingScreen() {
  return (
    <CoachingProvider>
      <View style={{ flex: 1 }}>
        <CoachingInterface />
      </View>
    </CoachingProvider>
  );
}
