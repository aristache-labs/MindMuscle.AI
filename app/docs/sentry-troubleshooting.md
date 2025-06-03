# Sentry Troubleshooting Guide

## Quick Diagnosis

### Step 1: Check Console Logs

When you start your app, you should see these logs in your console:

```
🔧 Sentry DSN found: https://e0ba77028738bd1dae789d1b11d04739...
🔧 Sentry Environment: { isDevelopment: true, isExpoGo: false, isIOS: true, ... }
🔧 Sentry Config: { environment: 'development', release: '1.0.2', ... }
✅ Sentry connection test sent successfully
🚀 Sentry Mobile Debugging initialized successfully
```

If you don't see these logs, Sentry is not initializing properly.

### Step 2: Use the Debug Screen

Navigate to the Sentry Debug screen (`app/(tabs)/sentry-debug.tsx`) and:

1. Press "Check Sentry Config" - verify all settings
2. Press "Run All Tests" - send test data to Sentry
3. Check console for success/error messages

### Step 3: Check Sentry Dashboard

- Go to https://sentry.io/organizations/mindmuscleai/projects/mind-muscle-ai/
- Look for events in the "Issues" tab
- Check "Performance" tab for transactions
- Look for "Session Replay" tab for replays

## Common Issues & Solutions

### 1. No Data Appearing in Sentry Dashboard

**Possible Causes:**

- Running in Expo Go (Session Replay disabled)
- Network connectivity issues
- Incorrect DSN configuration
- Events not being sent due to sampling

**Solutions:**

#### A. Verify DSN Configuration

```typescript
// In your console, you should see:
🔧 Sentry DSN found: https://e0ba77028738bd1dae789d1b11d04739...

// If not, check app.json:
"extra": {
  "sentryDsn": "https://e0ba77028738bd1dae789d1b11d04739@o4509415311278080.ingest.de.sentry.io/4509415314882640"
}
```

#### B. Force Send Test Data

```typescript
import { SentryTesting } from '@/services/sentry';

// Send immediate test
SentryTesting.testAll();
```

#### C. Check Network Connectivity

- Ensure your device/simulator has internet access
- Check if corporate firewall is blocking Sentry endpoints
- Try on different network (mobile data vs WiFi)

#### D. Verify Sampling Rates

In development, sampling should be 100%:

```typescript
// In sentry.ts config:
tracesSampleRate: isDevelopment ? 1.0 : 0.2,
replaysSessionSampleRate: isDevelopment ? 1.0 : 0.1,
```

### 2. Session Replay Not Working

**Possible Causes:**

- Running in Expo Go
- Session Replay not supported on platform
- Privacy settings blocking recording

**Solutions:**

#### A. Check Platform Support

```typescript
// Session Replay requires:
- iOS: 8.43.0+
- Android: 7.20.0+
- React Native: 6.5.0+
- NOT Expo Go
```

#### B. Verify Integration

```typescript
// Should see in console:
🎬 Session Replay: Enabled
// NOT:
🎬 Session Replay: Disabled (Expo Go)
```

#### C. Test Session Replay Manually

```typescript
import { SentryDebug } from '@/services/sentry';

SentryDebug.sessionReplay.trackUserInteraction('tap', 'test-button', 'test-screen');
```

### 3. Performance Data Missing

**Possible Causes:**

- Performance monitoring disabled
- Low sampling rates
- No transactions being created

**Solutions:**

#### A. Verify Performance Config

```typescript
// Should be enabled:
enableAutoPerformanceTracing: true,
tracesSampleRate: isDevelopment ? 1.0 : 0.2,
```

#### B. Create Manual Transactions

```typescript
import { SentryPerformance } from '@/services/sentry';

await SentryPerformance.measureIOSOperation('test_operation', async () => {
  // Your operation here
  await new Promise((resolve) => setTimeout(resolve, 1000));
});
```

### 4. Breadcrumbs Not Appearing

**Possible Causes:**

- Breadcrumbs not being added
- Console logs not showing breadcrumbs
- Dashboard not displaying breadcrumbs

**Solutions:**

#### A. Add Manual Breadcrumbs

```typescript
import { addBreadcrumb } from '@/services/sentry';

addBreadcrumb({
  message: 'Test breadcrumb',
  category: 'debug',
  level: 'info',
  data: { test: true },
});
```

#### B. Check Breadcrumb Limits

```typescript
// Max breadcrumbs (configured in sentry.ts):
maxBreadcrumbs: 100,
```

### 5. User Context Not Set

**Possible Causes:**

- User context not being set after login
- Context being cleared

**Solutions:**

#### A. Set User Context

```typescript
import { SentryDebug } from '@/services/sentry';

SentryDebug.sessionReplay.setReplayUserContext('user_123', 'user@example.com', 'username');
```

#### B. Verify User Context

```typescript
// Should appear in Sentry event details under "User"
```

## Environment-Specific Issues

### Development Environment

**Expected Behavior:**

- 100% sampling rates
- Detailed console logging
- All features enabled (except in Expo Go)

**Common Issues:**

- Expo Go limitations
- Network proxy issues
- Development server conflicts

### Production Environment

**Expected Behavior:**

- Lower sampling rates (10% sessions, 100% errors)
- Minimal console logging
- Full feature set

**Common Issues:**

- Events not appearing due to low sampling
- Native features not working in development builds

## Debugging Commands

### Console Commands

```typescript
// Check configuration
import { SentryTesting } from '@/services/sentry';
SentryTesting.checkConfig();

// Test all features
SentryTesting.testAll();

// Test specific features
SentryTesting.testMessage();
SentryTesting.testError();
SentryTesting.testSessionReplay();
```

### Network Debugging

```bash
# Check if Sentry endpoints are reachable
curl -I https://o4509415311278080.ingest.de.sentry.io/api/4509415314882640/envelope/

# Should return: HTTP/2 200
```

## Verification Checklist

### ✅ Basic Setup

- [ ] DSN configured in app.json
- [ ] Sentry initialized in \_layout.tsx
- [ ] Console shows initialization logs
- [ ] No initialization errors

### ✅ Event Capture

- [ ] Test message appears in Sentry dashboard
- [ ] Test error appears in Issues tab
- [ ] Breadcrumbs visible in event details
- [ ] User context set correctly

### ✅ Session Replay

- [ ] Not running in Expo Go
- [ ] Session Replay enabled in console logs
- [ ] User interactions being tracked
- [ ] Replays appearing in dashboard

### ✅ Performance Monitoring

- [ ] Transactions appearing in Performance tab
- [ ] Spans being created
- [ ] Performance data visible

## Getting Help

### 1. Check Sentry Status

- Visit https://status.sentry.io/
- Verify Sentry services are operational

### 2. Enable Debug Mode

```typescript
// In sentry.ts, set:
debug: true,
```

### 3. Check Sentry Documentation

- [React Native Setup](https://docs.sentry.io/platforms/react-native/)
- [Session Replay](https://docs.sentry.io/product/explore/session-replay/mobile/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)

### 4. Common Sentry URLs

- Dashboard: https://sentry.io/organizations/mindmuscleai/projects/mind-muscle-ai/
- Issues: https://sentry.io/organizations/mindmuscleai/issues/
- Performance: https://sentry.io/organizations/mindmuscleai/performance/
- Session Replay: https://sentry.io/organizations/mindmuscleai/replays/

## Expected Timeline

**Immediate (< 1 minute):**

- Console logs during app startup
- Test events sent via debug screen

**Short term (1-5 minutes):**

- Events appearing in Sentry dashboard
- Basic error and message capture

**Medium term (5-15 minutes):**

- Session Replay data processing
- Performance transaction aggregation

**Note:** In development with 100% sampling, events should appear almost immediately. In production with lower sampling, some events may not be captured due to sampling rates.
