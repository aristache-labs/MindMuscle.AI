import Achievements from './components/Achievements';
import { Stack } from 'expo-router';

export default function AchievementsScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Achievements />
    </>
  );
} 