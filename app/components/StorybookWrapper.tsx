import React from 'react';
import StorybookUIRoot from '../storybook';

interface StorybookWrapperProps {
  children: React.ReactNode;
}

// Type the global object properly
declare global {
  // eslint-disable-next-line no-var
  var reactotron: {
    storybookSwitcher?: (storybookUI: React.ComponentType) => (app: () => React.ReactElement) => React.ComponentType;
    [key: string]: unknown;
  } | undefined;
}

const StorybookWrapper: React.FC<StorybookWrapperProps> = ({ children }) => {
  // In development, use Reactotron's storybook switcher if available
  if (__DEV__ && global.reactotron && global.reactotron.storybookSwitcher) {
    // Wrap the main app with Reactotron's storybook switcher
    const AppWithStorybook = global.reactotron.storybookSwitcher(StorybookUIRoot)(() => (
      <>{children}</>
    ));
    return <AppWithStorybook />;
  }

  // In production or if Reactotron is not available, just return the children
  return <>{children}</>;
};

export default StorybookWrapper; 