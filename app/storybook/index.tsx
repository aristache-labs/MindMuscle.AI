import React from 'react';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadStories } from './storyLoader';

// Import addons
import '@storybook/addon-ondevice-controls/register';
import '@storybook/addon-ondevice-actions/register';

// Load stories
loadStories();

// Fallback component for when Storybook is not properly configured
const StorybookFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>Storybook not configured properly</Text>
    <Text>Make sure to run metro with Storybook configuration</Text>
  </View>
);

// For Storybook v9, we need to import from the generated requires file
let StorybookUIRoot = StorybookFallback;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { view } = require('./storybook.requires');

  // Get the Storybook UI component
  StorybookUIRoot = view.getStorybookUI({
    port: 7007,
    onDeviceUI: true,
    storage: {
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
    },
    shouldDisableKeyboardAvoidingView: false,
    keyboardAvoidingViewVerticalOffset: 0,
  });
} catch (error) {
  console.warn('Storybook requires file not found. Using fallback component.');
}

export default StorybookUIRoot;
