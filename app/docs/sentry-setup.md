# Sentry Setup Documentation

## Overview

This document outlines the complete Sentry setup for the MindMuscle.AI React Native Expo app, including comprehensive data management, privacy compliance, and debug information handling.

## ✅ Completed Setup

### 1. Package Installation

- `@sentry/react-native` v6.14.0 is installed and configured

### 2. App Configuration (app.json)

```json
{
  "expo": {
    "plugins": [
      [
        "@sentry/react-native/expo",
        {
          "url": "https://sentry.io/",
          "note": "Use SENTRY_AUTH_TOKEN env to authenticate with Sentry.",
          "project": "mind-muscle-ai",
          "organization": "mindmuscleai"
        }
      ]
    ],
    "extra": {
      "sentryDsn": "https://95ca621b3a918874f6289b653a3e3f6a@o4509201331978240.ingest.de.sentry.io/4509201333092432"
    },
    "ios": {
      "privacyManifests": {
        // Apple Privacy Manifest for Sentry compliance
        // See: app/docs/sentry-data-management.md for full configuration
      }
    }
  }
}
```

### 3. Metro Configuration (metro.config.js)

```javascript
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const config = getSentryExpoConfig(__dirname);
module.exports = config;
```

### 4. App Initialization (app/\_layout.tsx)

```typescript
import * as Sentry from '@sentry/react-native';
import { initializeSentry } from './services/sentry';

// Initialize Sentry as early as possible
initializeSentry();

// Wrap root component
export default Sentry.wrap(RootLayout);
```

### 5. Enhanced Sentry Service (app/services/sentry.ts)

```typescript
Sentry.init({
  dsn: sentryDsn,
  sendDefaultPii: true, // Enables PII data collection

  // Data filtering and privacy controls
  beforeSend(event, _hint) {
    // Filter sensitive data before sending
    // See: app/docs/sentry-data-management.md
  },

  // Comprehensive integrations
  integrations: [
    Sentry.breadcrumbsIntegration(),
    Sentry.httpClientIntegration(),
    Sentry.httpContextIntegration(),
    Sentry.screenshotIntegration(),
    Sentry.viewHierarchyIntegration(),
  ],

  // Performance monitoring
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  profilesSampleRate: __DEV__ ? 1.0 : 0.1,

  // Enhanced configuration
  debug: __DEV__,
  environment: Constants.expoConfig?.extra?.environment || 'development',
  release: Constants.expoConfig?.version || '1.0.0',
  enableNativeCrashHandling: true,
  attachStacktrace: true,
});
```

## 🆕 Data Management Features

### Comprehensive Data Collection

Our Sentry implementation now includes advanced data management features:

- **PII Data Handling**: Controlled collection of personally identifiable information
- **Data Filtering**: Automatic removal of sensitive headers and query parameters
- **Privacy Controls**: Configurable data collection based on user preferences
- **Apple Privacy Manifest**: Full compliance with App Store requirements

**📖 See**: [`app/docs/sentry-data-management.md`](./sentry-data-management.md) for complete documentation.

### Debug Information Files

Enhanced debug capabilities with:

- **Source Maps**: Automatic upload for readable stack traces
- **Debug Symbols**: Native crash symbolication
- **Source Context**: View actual source code in Sentry
- **Release Tracking**: Automatic release creation and deployment

**⚙️ Configuration**: `sentry.properties` and `.sentryignore`

### Apple Privacy Manifest

Full compliance with Apple's privacy requirements:

- **Data Types**: Crash, performance, and diagnostic data declarations
- **API Usage**: UserDefaults, SystemBootTime, and FileTimestamp API declarations
- **Expo Integration**: Automatic manifest generation for CNG apps

## Production Considerations

### Environment Variables

For production builds, set the following environment variable:

```bash
export SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

### Sample Rate Optimization

Optimized for production performance:

```typescript
tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
profilesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
```

### Privacy and Compliance

- **GDPR Compliance**: Data deletion API support
- **Data Minimization**: Only necessary data collected
- **User Control**: Opt-out capabilities for error reporting
- **Sensitive Data Filtering**: Automatic removal of credentials and tokens

## Features Enabled

### Error Monitoring

- ✅ Automatic crash detection
- ✅ Unhandled promise rejections
- ✅ JavaScript errors
- ✅ Native crashes
- ✅ Enhanced stack traces with source maps

### Performance Monitoring

- ✅ App start time tracking
- ✅ Screen load performance
- ✅ Network request monitoring
- ✅ User interaction tracking
- ✅ CPU and memory profiling

### Privacy and Security

- ✅ PII data filtering
- ✅ Sensitive header removal
- ✅ Apple Privacy Manifest compliance
- ✅ GDPR compliance features
- ✅ User consent management

### Debug Information

- ✅ Source map upload
- ✅ Debug symbol upload
- ✅ Source context in errors
- ✅ Release tracking
- ✅ Automatic file exclusion

## Usage Examples

### Enhanced Data Collection

```typescript
import { SentryDataCollection } from '../services/sentry';

// Set user information (respects privacy settings)
SentryDataCollection.setUser({
  id: user.id,
  email: user.email, // Only if sendDefaultPii is true
  username: user.username,
});

// Add workout context
SentryDataCollection.setContext('workout', {
  exercise: 'bench-press',
  weight: 185,
  reps: 8,
});

// Capture exception with additional context
SentryDataCollection.captureException(error, {
  component: 'WorkoutSession',
  action: 'save-workout',
});
```

### Manual Error Reporting

```typescript
import { captureException, captureMessage } from '../services/sentry';

try {
  // risky operation
} catch (error) {
  captureException(error);
}

// Log custom messages with levels
captureMessage('Custom event occurred', 'info');
```

### Privacy-Aware Context

```typescript
import * as Sentry from '@sentry/react-native';

// Only set PII if user consented
if (userConsentedToPII) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
} else {
  Sentry.setUser({
    id: user.id, // Non-PII identifier only
  });
}

Sentry.setTag('feature', 'workout-tracking');
```

### Custom Breadcrumbs

```typescript
import { SentryDataCollection } from '../services/sentry';

SentryDataCollection.addBreadcrumb({
  message: 'User started workout',
  category: 'user-action',
  level: 'info',
  data: {
    workoutType: 'strength',
    exerciseCount: 8,
  },
});
```

## Troubleshooting

### Common Issues

1. **Source maps not uploading**: Ensure `SENTRY_AUTH_TOKEN` is set during build
2. **Missing debug symbols**: Verify Metro config uses `getSentryExpoConfig`
3. **Performance overhead**: Reduce sample rates in production
4. **Privacy compliance**: Ensure privacy manifest is included in iOS builds
5. **Apple App Store rejection**: Verify privacy manifest covers all Sentry APIs

### Debug Mode

Enable debug mode in development to see Sentry logs:

```typescript
Sentry.init({
  debug: __DEV__, // Shows Sentry logs in development
  // ... other config
});
```

### Privacy Manifest Verification

To verify Apple Privacy Manifest compliance:

1. Build and submit to TestFlight
2. Check for Apple email about missing privacy declarations
3. Review `app.json` iOS privacy manifest configuration

## File Structure

```
app/
├── services/
│   └── sentry.ts                    # Enhanced Sentry configuration
├── docs/
│   ├── sentry-setup.md             # This file
│   └── sentry-data-management.md   # Comprehensive data management docs
├── app.json                        # Expo config with privacy manifest
├── sentry.properties               # Debug information upload config
└── .sentryignore                   # File exclusion for uploads
```

## Resources

- [📖 Comprehensive Data Management Documentation](./sentry-data-management.md)
- [Sentry React Native Documentation](https://docs.sentry.io/platforms/react-native/)
- [Sentry Data Collection Guide](https://docs.sentry.io/platforms/react-native/data-management/data-collected/)
- [Apple Privacy Manifest Guide](https://docs.sentry.io/platforms/react-native/data-management/apple-privacy-manifest/)
- [Debug Information Files](https://docs.sentry.io/platforms/react-native/data-management/debug-files/)
- [Expo Sentry Plugin](https://docs.expo.dev/guides/using-sentry/)
- [Expo Privacy Manifests](https://docs.expo.dev/guides/privacy-manifests/)

## Profiling Setup and Verification

### Profiling Configuration

Profiling is automatically enabled in the current Sentry setup with the following configuration:

```typescript
Sentry.init({
  // Profiling sample rates
  profilesSampleRate: __DEV__ ? 1.0 : 0.2, // 100% in dev, 20% in production

  // Experimental profiling (for older versions)
  _experiments: {
    profilesSampleRate: __DEV__ ? 1.0 : 0.2,
  },

  // Auto performance tracing (required for profiling)
  enableAutoPerformanceTracing: true,
});
```

### Verifying Profiling is Working

#### Method 1: Use the Test Button (Development Only)

1. Open the app in development mode
2. Go to Profile tab
3. Tap "🔬 Test Sentry Insights & Profiling"
4. Check the alert message - it will tell you if profiling is working
5. Look for "✅ PROFILING IS WORKING!" in the success message

#### Method 2: Check Sentry Dashboard

1. Go to your Sentry project dashboard
2. Navigate to **Performance** > **Profiles**
3. Look for profile data from your app
4. You should see CPU usage profiles and function call stacks

#### Method 3: Manual Verification

Run this code in your app to generate profile data:

```typescript
import { SentryTestUtils } from '../services/sentry';

// Test profiling functionality
const profilingWorking = SentryTestUtils.testProfiling();
console.log('Profiling test result:', profilingWorking);
```

### Troubleshooting Profiling Issues

#### Common Issues:

1. **No profiles in dashboard**:

   - Check that `profilesSampleRate` > 0
   - Ensure `enableAutoPerformanceTracing` is true
   - Verify you're running CPU-intensive operations

2. **Profiling not supported**:

   - Update to latest Sentry React Native SDK
   - Ensure you're using Hermes JavaScript engine
   - Check React Native version compatibility

3. **Low profile data**:
   - Increase `profilesSampleRate` in development
   - Run more CPU-intensive operations
   - Check network connectivity to Sentry

#### Debug Commands:

```typescript
// Check profiling configuration
console.log('Profiling enabled:', __DEV__ ? 1.0 : 0.2);

// Test CPU-intensive operation for profiling
SentryTestUtils.testProfiling();

// Check Sentry configuration
console.log('Sentry config:', {
  profilesSampleRate: __DEV__ ? 1.0 : 0.2,
  enableAutoPerformanceTracing: true,
});
```

### What Profiling Data Shows

- **CPU Usage**: How much CPU time functions consume
- **Call Stacks**: Which functions call which other functions
- **Performance Bottlenecks**: Slow functions and operations
- **Memory Allocation**: Memory usage patterns (if supported)

### Best Practices

1. **Sample Rates**: Use 100% in development, 10-20% in production
2. **Privacy**: Profiling data may contain sensitive function names
3. **Performance**: Profiling adds minimal overhead but monitor in production
4. **Analysis**: Use profiles to identify performance bottlenecks in your app

---
