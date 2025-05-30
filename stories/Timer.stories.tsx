import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Timer from '../app/components/timer';

const meta: Meta<typeof Timer> = {
  title: 'Components/Timer',
  component: Timer,
  argTypes: {
    onClose: {
      action: 'onClose',
    },
  },
  args: {
    onClose: () => console.log('Timer closed'),
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
  args: {},
};

export const WithCloseHandler: Story = {
  args: {
    onClose: () => {
      console.log('Timer close button pressed');
      // In a real app, this would navigate back or close the modal
    },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Dark background to match the timer's design
  },
});
