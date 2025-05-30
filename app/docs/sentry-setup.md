# Sentry Setup Documentation

## Overview
This document outlines the complete Sentry setup for the MindMuscle.AI React Native Expo app.

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
    }
  }
}
```

### 3. Metro Configuration (metro.config.js)
```javascript
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const config = getSentryExpoConfig(__dirname);
module.exports = config;
```

### 4. App Initialization (app/_layout.tsx)
```typescript
import * as Sentry from '@sentry/react-native';
import { initializeSentry } from './services/sentry';

// Initialize Sentry as early as possible
initializeSentry();

// Wrap root component
export default Sentry.wrap(RootLayout);
```

### 5. Sentry Service (app/services/sentry.ts)
```typescript
Sentry.init({
  dsn: sentryDsn,
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  debug: __DEV__,
  environment: Constants.expoConfig?.extra?.environment || 'development',
});
```

## Production Considerations

### Environment Variables
For production builds, set the following environment variable:
```bash
export SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

### Sample Rate Optimization
Consider reducing sample rates in production to manage quota:
```typescript
tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
profilesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
```

### Privacy Manifest (iOS)
When building for iOS App Store, ensure your app includes the required privacy manifest entries for Sentry SDK APIs. The Expo build process will handle this automatically for managed workflow apps.

Required privacy manifest entries for Sentry:
- NSPrivacyAccessedAPITypes for system information access
- NSPrivacyCollectedDataTypes for crash and performance data
- NSPrivacyTrackingDomains if applicable

## Features Enabled

### Error Monitoring
- ✅ Automatic crash detection
- ✅ Unhandled promise rejections
- ✅ JavaScript errors
- ✅ Native crashes

### Performance Monitoring
- ✅ App start time tracking
- ✅ Screen load performance
- ✅ Network request monitoring
- ✅ User interaction tracking

### Profiling
- ✅ CPU profiling
- ✅ Memory usage tracking
- ✅ Performance bottleneck detection

### Context Data
- ✅ User information
- ✅ Device information
- ✅ App version and build info
- ✅ Custom breadcrumbs

## Usage Examples

### Manual Error Reporting
```typescript
import { captureException, captureMessage } from '../services/sentry';

try {
  // risky operation
} catch (error) {
  captureException(error);
}

// Log custom messages
captureMessage('Custom event occurred', 'info');
```

### Adding Context
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});

Sentry.setTag('feature', 'workout-tracking');
Sentry.setContext('workout', {
  exerciseCount: 5,
  duration: '45 minutes',
});
```

### Custom Breadcrumbs
```typescript
import { addBreadcrumb } from '../services/sentry';

addBreadcrumb({
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

### Debug Mode
Enable debug mode in development to see Sentry logs:
```typescript
Sentry.init({
  debug: __DEV__, // Shows Sentry logs in development
  // ... other config
});
```

## Resources
- [Sentry React Native Documentation](https://docs.sentry.io/platforms/react-native/)
- [Expo Sentry Plugin](https://docs.expo.dev/guides/using-sentry/)
- [Apple Privacy Manifest Guide](https://docs.sentry.io/platforms/apple/guides/ios/data-management/apple-privacy-manifest/) 