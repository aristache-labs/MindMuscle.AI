# Sentry Setup Guide for MindMuscle.AI

## Overview
This guide documents the complete Sentry integration for error monitoring and performance tracking in the MindMuscle.AI React Native Expo app.

## Configuration

### 1. Sentry Service (`app/services/sentry.ts`)
The Sentry service initializes the SDK with the following configuration:
- **DSN**: `https://95ca621b3a918874f6289b653a3e3f6a@o4509201331978240.ingest.de.sentry.io/4509201333092432`
- **sendDefaultPii**: `true` - Adds more context data (IP address, cookies, user, etc.)
- **tracesSampleRate**: `1.0` - Captures 100% of transactions for tracing
- **debug**: Enabled in development mode
- **environment**: Automatically set based on `__DEV__`

### 2. App Configuration (`app.json`)
The Sentry Expo plugin is configured with:
```json
[
  "@sentry/react-native/expo",
  {
    "url": "https://sentry.io/",
    "note": "Use SENTRY_AUTH_TOKEN env to authenticate with Sentry.",
    "project": "mindmuscle-ai",
    "organization": "mindmuscleai"
  }
]
```

### 3. Metro Configuration (`metro.config.js`)
Uses `getSentryExpoConfig` to ensure unique Debug IDs are assigned to bundles and source maps.

### 4. Root Layout (`app/_layout.tsx`)
The root component is wrapped with `Sentry.wrap()` to capture unhandled errors and crashes.

## Environment Variables

### Required for Production Builds
Add the following environment variable for automatic source map uploads:

```bash
# DO NOT COMMIT YOUR AUTH TOKEN
# Create a .env file in your project root (make sure it's in .gitignore)
SENTRY_AUTH_TOKEN=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
```

### ⚠️ Security Warning
- **NEVER** use `EXPO_PUBLIC_SENTRY_AUTH_TOKEN` - this exposes the token in your client bundle
- **ALWAYS** use `SENTRY_AUTH_TOKEN` (without EXPO_PUBLIC_ prefix)
- **ENSURE** your `.env` file is in `.gitignore`
- Auth tokens are for build-time only, not runtime

### Setup Steps
1. Create a `.env` file in your project root
2. Add the `SENTRY_AUTH_TOKEN` variable (see above)
3. Verify `.env` is in your `.gitignore` file
4. For CI/CD, set the environment variable in your build environment

**To generate your auth token:**
1. Go to https://sentry.io/settings/account/api/auth-tokens/
2. Create a new token with the following scopes:
   - `project:read`
   - `project:releases`
   - `org:read`

## Testing Sentry Integration

### Development Testing
A test button is available in development mode on the home screen:
- Navigate to the main home screen
- Look for the "Development Tools" section (only visible in `__DEV__` mode)
- Tap "Test Sentry Error Reporting" to send test errors

### Manual Testing
You can also test Sentry manually by importing and using:

```typescript
import * as Sentry from '@sentry/react-native';

// Test exception
Sentry.captureException(new Error("Test error"));

// Test message
Sentry.captureMessage("Test message", "info");
```

### Test Component (`app/components/SentryTestButton.tsx`)
A reusable component that sends both test exceptions and messages to verify Sentry is working correctly.

## Verification

### 1. Check Sentry Dashboard
After sending test errors:
1. Go to https://sentry.io/organizations/mindmuscleai/projects/mindmuscle-ai/
2. Check the "Issues" tab for new errors
3. Verify error details, stack traces, and context data

### 2. Console Logs
In development, you should see:
```
Sentry initialized successfully
Test error sent to Sentry!
```

### 3. Release Builds
For production verification:
1. Build a release version of your app
2. Send test events
3. Verify they appear in the Sentry dashboard

## Features Enabled

### Error Monitoring
- Automatic capture of unhandled JavaScript errors
- Automatic capture of native crashes
- Manual error reporting via `captureException`

### Performance Monitoring
- Transaction tracing with 100% sample rate
- Automatic performance metrics collection

### Context Data
- User information (when available)
- Device information
- App version and build info
- Custom breadcrumbs and tags

## Best Practices

### 1. Error Handling
```typescript
try {
  // Risky operation
} catch (error) {
  Sentry.captureException(error);
  // Handle error gracefully
}
```

### 2. Custom Context
```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
});

Sentry.setTag("feature", "workout");
Sentry.addBreadcrumb({
  message: "User started workout",
  level: "info",
});
```

### 3. Performance Monitoring
```typescript
const transaction = Sentry.startTransaction({
  name: "Workout Session",
  op: "navigation",
});

// ... workout logic ...

transaction.finish();
```

## Troubleshooting

### Common Issues

1. **No events in Sentry dashboard**
   - Verify DSN is correct
   - Check network connectivity
   - Ensure app is not in debug mode for release testing

2. **Source maps not uploading**
   - Verify `SENTRY_AUTH_TOKEN` is set
   - Check token permissions
   - Ensure Metro config is using `getSentryExpoConfig`

3. **Performance issues**
   - Reduce `tracesSampleRate` in production
   - Filter out noisy breadcrumbs
   - Optimize error reporting frequency

### Debug Mode
In development, Sentry debug mode is enabled to help troubleshoot integration issues. Check console logs for Sentry-related messages.

## Production Considerations

### 1. Sample Rates
Consider reducing sample rates in production:
```typescript
tracesSampleRate: __DEV__ ? 1.0 : 0.1, // 10% in production
```

### 2. Data Privacy
Review what data is being sent:
- `sendDefaultPii: false` to disable automatic PII collection
- Filter sensitive data in `beforeSend` callback

### 3. Performance Impact
Monitor the performance impact of Sentry in production and adjust configuration as needed.

## Links
- [Sentry React Native Documentation](https://docs.sentry.io/platforms/react-native/)
- [Sentry Expo Plugin Documentation](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)
- [MindMuscle.AI Sentry Project](https://sentry.io/organizations/mindmuscleai/projects/mindmuscle-ai/) 