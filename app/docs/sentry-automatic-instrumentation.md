# Sentry Automatic Instrumentation for MindMuscle.AI

This document provides comprehensive guidance on using Sentry's automatic instrumentation features in the MindMuscle.AI React Native Expo app.

## Overview

Sentry's automatic instrumentation provides out-of-the-box performance monitoring and error tracking without requiring manual span creation for common operations. This implementation is based on the [official Sentry documentation](https://docs.sentry.io/platforms/react-native/tracing/instrumentation/automatic-instrumentation/).

## Features Implemented

### 1. App Start Instrumentation

- **What it tracks**: Time from native process initialization to React Native root component mount
- **Measurements**: `app_start_cold` and `app_start_warm`
- **Configuration**: Automatically enabled when root component is wrapped with `Sentry.wrap()`

### 2. Slow and Frozen Frame Detection

- **Slow Frames**: Frames taking longer than 16.67ms (60 FPS threshold)
- **Frozen Frames**: Frames taking longer than 700ms
- **Platform**: Requires `androidx.core` library on Android
- **Automatic**: Enabled by default with performance monitoring

### 3. JavaScript Stall Tracking

- **What it tracks**: Event loop stalls during transactions
- **Metrics**:
  - Longest Stall Time (ms)
  - Total Stall Time (ms)
  - Stall Count
- **Threshold**: Configurable (default: 100ms)

### 4. Network Request Instrumentation

- **Automatic tracking**: All `fetch` and `XMLHttpRequest` calls
- **Trace propagation**: Distributed tracing across services
- **Configuration**: Customizable via `tracePropagationTargets`

### 5. Navigation Instrumentation

- **Router**: Expo Router integration
- **Measurements**: Time to Initial Display
- **Timeout**: Configurable route change timeout (default: 5000ms)

### 6. React Profiler Integration

- **Component tracking**: Lifecycle and render performance
- **HOC wrapper**: `SentryReactProfiler.withProfiler()`
- **Automatic**: Tracks component mount, update, and unmount

## Configuration

### Expo Router Integration Setup

The app is properly configured for Expo Router according to the [official Sentry documentation](https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/):

```typescript
// In app/_layout.tsx
import { useNavigationContainerRef } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import { createExpoRouterNavigationIntegration } from './services/sentry';

// Create navigation integration
const navigationIntegration = createExpoRouterNavigationIntegration(isRunningInExpoGo());

// Initialize Sentry with navigation integration
initializeSentry(navigationIntegration);

// In component
const ref = useNavigationContainerRef();
React.useEffect(() => {
  if (ref) {
    navigationIntegration.registerNavigationContainer(ref);
  }
}, [ref]);
```

### Core Integration Setup

```typescript
// In app/services/sentry.ts
const integrations = [
  // Core automatic instrumentation
  Sentry.reactNativeTracingIntegration({
    shouldCreateSpanForRequest: (url) => {
      // Filter out health checks
      return !url.match(/\/health\/?$/) && !url.match(/\/ping\/?$/);
    },
    beforeStartSpan: (context) => {
      return {
        ...context,
        attributes: {
          ...context.attributes,
          platform: isIOS ? 'ios' : 'android',
          app_version: Constants.expoConfig?.version || '1.0.0',
        },
      };
    },
    idleTimeoutMs: 1000,
    finalTimeoutMs: 60000,
  }),

  // Navigation instrumentation
  Sentry.reactNavigationIntegration({
    enableTimeToInitialDisplay: true,
    routeChangeTimeoutMs: 5000,
  }),

  // Network instrumentation
  Sentry.httpClientIntegration(),
];
```

### Trace Propagation Configuration

```typescript
// Configure which domains receive trace headers
tracePropagationTargets: [
  'localhost',
  /^https:\/\/[^/]*\.supabase\.co/,
  /^https:\/\/api\.openai\.com/,
  /^https:\/\/[^/]*\.firebase\.com/,
  /^https:\/\/[^/]*\.googleapis\.com/,
];
```

## Usage Examples

### 1. React Component Profiling

```typescript
import { SentryReactProfiler } from '../services/sentry';

// Wrap component with profiler
const MyComponent = SentryReactProfiler.withProfiler(
  ({ title }: { title: string }) => {
    return <Text>{title}</Text>;
  },
  'MyComponent'
);

// Manual lifecycle tracking
useEffect(() => {
  SentryReactProfiler.trackComponentLifecycle('MyComponent', 'mount');
  return () => {
    SentryReactProfiler.trackComponentLifecycle('MyComponent', 'unmount');
  };
}, []);
```

### 2. Performance Tracking

```typescript
import { SentryAutoInstrumentation } from '../services/sentry';

// Track frame performance
SentryAutoInstrumentation.trackFrameMetrics(
  5, // slow frames
  2, // frozen frames
  100, // total frames
);

// Track JavaScript stalls
SentryAutoInstrumentation.trackJSStall(
  150, // total stall time (ms)
  3, // stall count
  75, // longest stall (ms)
);

// Track user interactions
SentryAutoInstrumentation.trackUserInteraction('touch', 'submit-button', 'workout-screen');
```

### 3. Network Request Enhancement

```typescript
// Automatic instrumentation handles the span creation
// You can enhance with additional context
const response = await fetch('/api/workouts');
const duration = Date.now() - startTime;

SentryAutoInstrumentation.enhanceNetworkSpan('/api/workouts', 'GET', response.status, duration);
```

### 4. Navigation Tracking

```typescript
// Automatic navigation tracking via Expo Router
// Enhance with additional context
SentryAutoInstrumentation.enhanceNavigationSpan('home', 'workout-session', navigationDuration);
```

## Performance Thresholds

The automatic instrumentation uses the following performance thresholds:

```typescript
const thresholds = {
  slowFrameThreshold: 16.67, // 60 FPS = 16.67ms per frame
  frozenFrameThreshold: 700, // 700ms for frozen frames
  stallThreshold: 100, // 100ms for JS stalls
  networkTimeoutThreshold: 5000, // 5 seconds for network requests
  navigationTimeoutThreshold: 3000, // 3 seconds for navigation
};
```

## Sampling Configuration

```typescript
// Performance sampling rates
tracesSampleRate: isDevelopment ? 1.0 : 0.2,  // 20% in production
profilesSampleRate: isDevelopment ? 1.0 : 0.1, // 10% in production

// Session replay sampling
replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1, // 10% in production
replaysOnErrorSampleRate: 1.0, // 100% of error sessions
```

## Testing

### Manual Testing Functions

```typescript
import { SentryTesting } from '../services/sentry';

// Test automatic instrumentation
SentryTesting.testAutoInstrumentation();

// Test React Profiler
SentryTesting.testReactProfiler();

// Test all features
await SentryTesting.testAll();
```

### Example Component

Use the `SentryInstrumentationExample` component to test all automatic instrumentation features:

```typescript
import SentryInstrumentationExample from '../components/SentryInstrumentationExample';

// Add to your app for testing
<SentryInstrumentationExample />
```

## Mobile Vitals

The automatic instrumentation tracks Mobile Vitals including:

- **App Start Time**: Cold and warm start measurements
- **Slow Frames**: Frames exceeding 16.67ms
- **Frozen Frames**: Frames exceeding 700ms
- **Stall Count**: JavaScript event loop stalls

## Platform Considerations

### iOS

- Full automatic instrumentation support
- Hermes profiling available in production builds
- Native crash reporting enabled

### Android

- Requires `androidx.core` for frame detection
- Full automatic instrumentation support
- Native crash reporting enabled

### Expo Go

- Limited automatic instrumentation
- Session replay disabled
- Profiling disabled
- Network and navigation tracking available

## Best Practices

### 1. Component Profiling

- Wrap performance-critical components with `withProfiler`
- Use descriptive component names for easier debugging
- Track lifecycle events for complex components

### 2. Performance Monitoring

- Set appropriate performance thresholds for your app
- Monitor frame rates during animations
- Track stalls during heavy computations

### 3. Network Optimization

- Configure trace propagation for your backend services
- Filter out health check endpoints
- Monitor API response times

### 4. Error Handling

- Combine automatic instrumentation with manual error tracking
- Use breadcrumbs to provide context for errors
- Set up proper error boundaries

## Troubleshooting

### Common Issues

1. **Missing spans**: Ensure `enableAutoPerformanceTracing` is true
2. **No frame data**: Check `androidx.core` dependency on Android
3. **Network spans not created**: Verify `tracePropagationTargets` configuration
4. **Navigation not tracked**: Ensure proper router integration

### Debug Configuration

```typescript
// Enable debug mode for development
debug: isDevelopment,
enableTracing: true,
enableAutoInstrumentation: true,
```

### Verification

Check the console output during app initialization:

```
🚀 Sentry Automatic Instrumentation initialized successfully
🔧 Automatic Instrumentation Features:
  • App Start Instrumentation: Enabled
  • Slow & Frozen Frame Detection: Enabled
  • JavaScript Stall Tracking: Enabled
  • Fetch/XMLHttpRequest Instrumentation: Enabled
  • React Navigation Instrumentation: Enabled
  • React Profiler Integration: Available
  • User Interaction Tracking: Available
```

## Integration with MindMuscle.AI Features

### Workout Session Tracking

```typescript
// Track workout performance automatically
const workoutSession = SentryReactProfiler.withProfiler(WorkoutSession, 'WorkoutSession');

// Enhanced workout navigation
SentryAutoInstrumentation.enhanceNavigationSpan('workout-list', 'workout-session', navigationTime);
```

### Exercise Performance

```typescript
// Track exercise component performance
const ExerciseCard = SentryReactProfiler.withProfiler(ExerciseCardComponent, 'ExerciseCard');

// Track user interactions with exercises
SentryAutoInstrumentation.trackUserInteraction('touch', 'exercise-start-button', 'workout-session');
```

### API Integration

```typescript
// Automatic tracking of Supabase calls
// Network spans created automatically for:
// - Exercise data fetching
// - Workout plan updates
// - Progress tracking
// - AI coaching requests
```

## Monitoring Dashboard

In your Sentry dashboard, you'll see:

1. **Performance**: Transaction traces with automatic spans
2. **Mobile Vitals**: App start times, frame rates, stalls
3. **User Interactions**: Touch, scroll, navigation events
4. **Network Requests**: API calls with timing and status
5. **Component Performance**: React component render times

This automatic instrumentation provides comprehensive performance monitoring for the MindMuscle.AI app without requiring extensive manual instrumentation.
