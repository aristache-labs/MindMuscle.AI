# MindMuscle.AI Debugging System

## Overview

MindMuscle.AI includes a comprehensive debugging system that lets you control console output without removing logs from the codebase. This allows you to:

1. Enable/disable debugging for specific components
2. Keep all debug statements in code for future troubleshooting
3. Control debugging via a simple configuration file
4. View debug logs only when you need them

## Debug Controls

Debugging is controlled through a simple configuration file at `app/utils/debugConfig.ts`. To enable or disable debugging:

1. Open `app/utils/debugConfig.ts`
2. Set the appropriate flag to `true` to enable debugging or `false` to disable
3. Save the file and restart the app

Example configuration:

```typescript
export const DEBUG_CONFIG = {
  // Master switch - enables all debugging when true
  GLOBAL: false,

  // Component-specific debug flags
  SPLASH_SCREEN: false, // Set to true to enable splash screen debugging
  IMAGE_PRELOADER: false,
  NETWORK: false,
  AUTH: false,
  WORKOUT: false,
  DATA_SYNC: false,
  PERFORMANCE: false,
  API: false,
};
```

## Using the Logger in Code

### Basic Usage

```typescript
import logger from '../utils/logger';

// Only logs if GLOBAL or specific component debugging is enabled
logger.debugComponent('IMAGE_PRELOADER', 'Loading image: example.jpg');

// Always logs regardless of debug settings
logger.info('User logged in');
logger.warn('Network request failed');
logger.error('Critical error', error);
```

### Using Helper Functions

We provide helper functions to make debugging easier:

```typescript
import { debug, createComponentLogger } from '../utils/debugHelpers';

// One-off debugging
debug('SPLASH_SCREEN', 'Initialization complete');

// With lazy evaluation of expensive operations (only runs if debugging is enabled)
debug('PERFORMANCE', 'Memory usage', () => `${getMemoryUsage()} MB`);

// Create a component-specific logger
const log = createComponentLogger('AUTH');
log.debug('Login attempt', () => ({ username, timestamp }));
log.info('Login successful');
log.warn('Invalid credentials');
log.error('Authentication service error', error);

// Check if debugging is enabled
if (log.isDebugging()) {
  // Perform expensive debug operations
}
```

### Pre-created Loggers

For convenience, common loggers are pre-created:

```typescript
import { loggers } from '../utils/debugHelpers';

// Use pre-created loggers
loggers.imagePreloader.debug('Preloading images', () => ({ count: images.length }));
loggers.network.warn('Request timeout', error);
loggers.performance.debug('Render time', () => `${Date.now() - startTime}ms`);
```

## Best Practices

1. **Use the right log level:**

   - `debug`: For detailed information useful during development
   - `info`: For general information about app operation
   - `warn`: For potential issues that don't break functionality
   - `error`: For critical errors that need immediate attention

2. **Use component-specific logging:**

   - Always specify which component is generating the log
   - This makes it easier to filter logs when troubleshooting

3. **Include context with errors:**

   - Provide relevant data when logging errors
   - This helps with troubleshooting production issues via Sentry

4. **Use lazy evaluation for expensive computations:**

   - Wrap complex log data in callback functions
   - This prevents performance impact when debugging is disabled

5. **Don't remove log statements:**
   - Instead of deleting logs, keep them in the code
   - Control visibility through the debug settings in `debugConfig.ts`

## Production Behavior

In production builds:

- All debug logs are disabled automatically
- Warning and error logs are sent to Sentry
- Console output is suppressed

## Implementation Details

The debugging system is implemented in:

- `app/utils/logger.ts` - The core logging functionality
- `app/utils/debugHelpers.ts` - Convenience functions
- `app/components/DebugControls.tsx` - UI for toggling debug settings

Debug settings are persisted in AsyncStorage and survive app restarts.
