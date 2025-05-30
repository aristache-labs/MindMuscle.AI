import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import ExerciseCard from '../app/components/ExerciseCard';

const meta: Meta<typeof ExerciseCard> = {
  title: 'Components/ExerciseCard',
  component: ExerciseCard,
  argTypes: {
    isFavorite: {
      control: { type: 'boolean' },
    },
    useOptimizedImage: {
      control: { type: 'boolean' },
    },
    name: {
      control: { type: 'text' },
    },
  },
  args: {
    id: '1',
    name: 'Push Up',
    image: require('../assets/exercises/pushup.jpg'),
    isFavorite: false,
    useOptimizedImage: true,
    onPress: (id: string) => console.log('Exercise pressed:', id),
    onToggleFavorite: (id: string) => console.log('Favorite toggled:', id),
  },
  decorators: [
    (Story: React.ComponentType) => (
      <View style={styles.container}>
        <Story />
      </View>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: 'Push Up',
    isFavorite: false,
  },
};

export const Favorite: Story = {
  args: {
    name: 'Squat',
    isFavorite: true,
  },
};

export const LongName: Story = {
  args: {
    name: 'Barbell Bench Press with Very Long Exercise Name',
    isFavorite: false,
  },
};

export const WithPlaceholder: Story = {
  args: {
    name: 'Unknown Exercise',
    image: { uri: null, testUri: '' },
    isFavorite: false,
  },
};

export const WithoutOptimizedImage: Story = {
  args: {
    name: 'Dumbbell Curl',
    isFavorite: true,
    useOptimizedImage: false,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
