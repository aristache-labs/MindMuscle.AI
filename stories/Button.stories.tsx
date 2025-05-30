import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
  argTypes: {
    mode: {
      control: { type: 'select' },
      options: ['text', 'outlined', 'contained', 'elevated', 'contained-tonal'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
  args: {
    mode: 'contained',
    children: 'Button',
    disabled: false,
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

export const Primary: Story = {
  args: {
    mode: 'contained',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    mode: 'outlined',
    children: 'Secondary Button',
  },
};

export const Disabled: Story = {
  args: {
    mode: 'contained',
    children: 'Disabled Button',
    disabled: true,
  },
};

export const Large: Story = {
  args: {
    mode: 'contained',
    children: 'Large Button',
    contentStyle: { paddingVertical: 8 },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
