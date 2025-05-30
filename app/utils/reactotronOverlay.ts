import React from 'react';

// Type-safe Reactotron overlay utility
declare const Reactotron: {
  overlay: <T extends React.ComponentType<any>>(component: T) => T;
};

/**
 * Utility to wrap components with Reactotron overlay for design comparison
 * Only works in development mode when Reactotron is connected
 */

/**
 * Wraps a React component with Reactotron overlay functionality
 * This allows you to upload design mockups in Reactotron and overlay them on your app
 * for pixel-perfect design comparison
 *
 * @param Component - The React component to wrap
 * @returns The wrapped component with overlay functionality (in dev) or original component (in prod)
 */
export function withReactotronOverlay<T extends React.ComponentType<any>>(Component: T): T {
  if (__DEV__ && typeof Reactotron !== 'undefined' && Reactotron.overlay) {
    return Reactotron.overlay(Component);
  }
  return Component;
}

/**
 * Higher-order component for adding Reactotron overlay
 * Usage: export default withOverlay(MyComponent)
 */
export const withOverlay = withReactotronOverlay;

/**
 * Hook-style utility for conditional overlay wrapping
 * Useful when you want to conditionally apply overlay based on certain conditions
 *
 * @param Component - The component to potentially wrap
 * @param shouldWrap - Whether to apply the overlay (defaults to true in dev)
 * @returns The wrapped or original component
 */
export function useReactotronOverlay<T extends React.ComponentType<any>>(
  Component: T,
  shouldWrap: boolean = true,
): T {
  if (__DEV__ && shouldWrap && typeof Reactotron !== 'undefined' && Reactotron.overlay) {
    return Reactotron.overlay(Component);
  }
  return Component;
}

/**
 * Utility for wrapping the root app component
 * This is the most common use case for overlay functionality
 *
 * @param AppComponent - Your root app component
 * @returns The wrapped app component
 */
export function wrapAppWithOverlay<T extends React.ComponentType<any>>(AppComponent: T): T {
  return withReactotronOverlay(AppComponent);
}

export default withReactotronOverlay;
