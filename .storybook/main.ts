import type { StorybookConfig } from '@storybook/react-native';

const main: StorybookConfig = {
  stories: ['../app/components/**/*.stories.@(js|jsx|ts|tsx)', '../stories/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-ondevice-controls',
    '@storybook/addon-ondevice-actions',
  ],
};

export default main; 