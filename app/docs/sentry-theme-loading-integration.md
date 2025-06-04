# Sentry Integration for Theme and Loading Messages

This document explains the Sentry integration added to the theme and loading message constants in MindMuscle.AI.

## Overview

Both `app/constants/theme.tsx` and `app/constants/loadingMessages.ts` have been enhanced with comprehensive Sentry integration for:

- **Error tracking** - Capture and monitor theme and loading-related errors
- **Performance monitoring** - Track loading phases and theme switching performance
- **Breadcrumbs** - Detailed logging of theme and loading state changes
- **Context setting** - Rich context data for debugging

## Theme Integration (`theme.tsx`)

### Features Added

1. **Theme Provider Error Handling**
   - Automatic error capture for theme initialization failures
   - Fallback to dark theme with proper logging
   - Context setting for current theme state

2. **Theme Context Tracking**
   - Color scheme detection and logging
   - Theme configuration context for debugging
   - Performance breadcrumbs for theme switches

### Usage Example

```typescript
import { ThemeProvider } from '../constants/theme';

// The ThemeProvider now automatically:
// - Logs theme initialization
// - Sets Sentry context with theme info
// - Handles errors with fallback
// - Tracks theme performance

function App() {
  return (
    <ThemeProvider>
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### Sentry Data Captured

- **Context**: Theme configuration, color scheme, primary colors
- **Breadcrumbs**: Theme initialization, switches, and errors
- **Errors**: Theme provider failures with fallback handling
- **Performance**: Theme switching timing

## Loading Messages Integration (`loadingMessages.ts`)

### Features Added

1. **LoadingStateTracker Class**
   - Singleton pattern for tracking loading phases
   - Performance monitoring with duration tracking
   - Automatic slow loading detection and warnings

2. **LoadingUtils Utilities**
   - Random message selection with tracking
   - Message usage analytics
   - Error handling for message operations

### Usage Examples

#### Basic Loading Phase Tracking

```typescript
import { LoadingStateTracker, LOADING_MESSAGES } from '../constants/loadingMessages';

const tracker = LoadingStateTracker.getInstance();

// Start a loading phase
tracker.startPhase('STATIC_ASSETS', LOADING_MESSAGES.STATIC_ASSETS);

// ... perform loading operations ...

// End the phase (automatically called when starting next phase)
tracker.endPhase();

// Complete all loading
tracker.completeLoading();
```

#### Using Loading Utils

```typescript
import { LoadingUtils, LOADING_MESSAGES } from '../constants/loadingMessages';

// Get a random rotation message with tracking
const randomMessage = LoadingUtils.getRandomRotationMessage();

// Track specific message usage
LoadingUtils.trackMessageUsage('USER_CONTENT', {
  userId: 'user123',
  contentType: 'workout_history',
});
```

#### Complete Loading Flow Example

```typescript
import { LoadingStateTracker, LoadingUtils } from '../constants/loadingMessages';

async function initializeApp() {
  const tracker = LoadingStateTracker.getInstance();
  
  try {
    // Phase 1: Static assets
    tracker.startPhase('STATIC_ASSETS');
    await loadStaticAssets();
    
    // Phase 2: Remote assets
    tracker.startPhase('REMOTE_ASSETS');
    await loadRemoteAssets();
    
    // Phase 3: User data
    tracker.startPhase('USER_CONTENT');
    await loadUserData();
    
    // Complete loading
    tracker.completeLoading();
    
  } catch (error) {
    // Errors are automatically captured by Sentry
    console.error('App initialization failed:', error);
  }
}
```

### Sentry Data Captured

#### Loading State Tracker

- **Context**: Current loading phase, total phases, timing data
- **Breadcrumbs**: Phase starts/ends, loading completion
- **Performance**: Phase durations, slow loading warnings
- **Errors**: Loading phase failures with context

#### Loading Utils

- **Breadcrumbs**: Message usage, random message selection
- **Analytics**: Message popularity, usage patterns
- **Errors**: Message retrieval failures

## Performance Monitoring

### Automatic Thresholds

- **Slow Loading Phase**: > 3 seconds (warning logged)
- **Slow Total Loading**: > 10 seconds (warning logged)
- **Theme Switch**: Tracked for performance analysis

### Performance Data Available

1. **Loading Summary**:
   ```typescript
   {
     totalDuration: 5420, // ms
     totalPhases: 4,
     phases: [
       { phase: 'STATIC_ASSETS', duration: 1200, timestamp: '...' },
       { phase: 'REMOTE_ASSETS', duration: 2100, timestamp: '...' },
       // ...
     ],
     averagePhaseTime: 1355
   }
   ```

2. **Theme Context**:
   ```typescript
   {
     colorScheme: 'dark',
     themeName: 'dark',
     primaryColor: '#6c47ff',
     backgroundColor: '#181A20',
     textColor: '#FFFFFF'
   }
   ```

## Error Handling

### Theme Errors

- **Automatic Fallback**: Falls back to dark theme on errors
- **Error Context**: Includes color scheme and error details
- **Recovery Logging**: Tracks successful fallback operations

### Loading Errors

- **Phase-Level Errors**: Captured with current phase context
- **Graceful Degradation**: Continues loading on non-critical errors
- **Error Recovery**: Tracks recovery attempts and success rates

## Best Practices

### Theme Integration

1. **Always use ThemeProvider**: The enhanced provider includes error handling
2. **Monitor theme context**: Check Sentry for theme-related issues
3. **Test fallback scenarios**: Ensure dark theme fallback works correctly

### Loading Integration

1. **Use LoadingStateTracker**: For any multi-phase loading operations
2. **Track message usage**: Use LoadingUtils for analytics
3. **Monitor performance**: Watch for slow loading warnings in Sentry
4. **Handle errors gracefully**: Let Sentry capture loading failures

### Debugging

1. **Check Sentry breadcrumbs**: Look for theme and loading events
2. **Review performance data**: Identify slow loading phases
3. **Monitor error patterns**: Track common theme/loading failures
4. **Use context data**: Rich context helps debug issues

## Integration with Existing Code

### SplashScreenManager Integration

```typescript
import { LoadingStateTracker } from '../constants/loadingMessages';

// In your splash screen component
const tracker = LoadingStateTracker.getInstance();

useEffect(() => {
  tracker.startPhase('START');
  // ... existing splash screen logic
}, []);
```

### InitialLoadingScreen Integration

```typescript
import { LoadingUtils } from '../constants/loadingMessages';

// In your loading screen component
const [message, setMessage] = useState(LoadingUtils.getRandomRotationMessage());

// Rotate messages with tracking
useEffect(() => {
  const interval = setInterval(() => {
    setMessage(LoadingUtils.getRandomRotationMessage());
  }, 2000);
  return () => clearInterval(interval);
}, []);
```

## Monitoring and Alerts

### Recommended Sentry Alerts

1. **Slow Loading**: Alert when total loading > 15 seconds
2. **Theme Errors**: Alert on theme provider failures
3. **Loading Failures**: Alert on repeated loading phase failures
4. **Performance Degradation**: Alert on increasing average load times

### Dashboard Metrics

- Loading phase completion rates
- Average loading times by phase
- Theme error frequency
- Message usage analytics
- Performance trends over time

This integration provides comprehensive monitoring and error tracking for the core theme and loading systems in MindMuscle.AI, enabling better user experience and faster debugging of issues. 