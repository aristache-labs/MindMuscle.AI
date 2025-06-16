# Sentry Logging Configuration

## Overview

The Sentry configuration has been optimized to reduce console noise during development while maintaining comprehensive error tracking and performance monitoring.

## Changes Made

### 1. Reduced Debug Logging

- **Before**: `debug: isDevelopment` (verbose logging in development)
- **After**: `debug: false` by default, with option to enable via `SENTRY_DEBUG=true`

### 2. Optimized Sample Rates

- **Traces**: Reduced from 100% to 30% in development
- **Profiles**: Reduced from 100% to 20% in development
- **Session Replay**: Reduced from 100% to 20% in development
- **Breadcrumbs**: Reduced from 100 to 50 maximum

### 3. Navigation Transaction Filtering

- Only 20% of navigation transactions are sent in development
- Reduces console noise from frequent route changes
- Errors and important events are still captured at 100%

### 4. Reduced Timeouts

- **Idle Timeout**: 1000ms → 500ms
- **Final Timeout**: 60000ms → 30000ms
- **Route Change Timeout**: 1000ms → 500ms

## Enabling Verbose Logging

When you need detailed Sentry logging for debugging:

### Option 1: Environment Variable

```bash
SENTRY_DEBUG=true npx expo start
```

### Option 2: Temporary Code Change

In `app/services/sentry/core.ts`, temporarily change:

```typescript
debug: enableDebugLogging, // Change to: debug: isDevelopment
```

## What You'll Still See

### Normal Operation (Reduced Logging)

- Sentry initialization messages
- Error captures and exceptions
- Critical performance issues
- User authentication events
- Workout completion events

### What's Reduced

- Navigation transaction details
- Breadcrumb spam
- Frame measurement details
- Idle span notifications
- Routine performance spans

## Benefits

1. **Cleaner Console**: Easier to see your app's actual logs
2. **Better Performance**: Less overhead from excessive logging
3. **Focused Debugging**: Important events still captured
4. **Flexible**: Can enable verbose logging when needed

## Monitoring Coverage

Despite reduced logging, you still get:

- ✅ 100% error capture
- ✅ 100% crash reporting
- ✅ 30% performance monitoring
- ✅ 20% session replay
- ✅ Complete user journey tracking
- ✅ Workout and exercise tracking

## Production Impact

No changes to production behavior:

- All sample rates remain optimized for production
- Full error tracking maintained
- Performance monitoring continues
- Session replay on errors at 100%
