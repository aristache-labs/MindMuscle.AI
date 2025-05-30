# Reactotron Global Error Tracking Guide

## Overview

The `trackGlobalErrors` plugin ensures all JavaScript errors in your React Native app are captured and displayed in Reactotron for easy debugging. This includes both handled and unhandled errors, providing comprehensive error monitoring during development.

## Features

- **Automatic Error Capture**: All global errors are automatically sent to Reactotron
- **Clean Stack Traces**: Filters out React Native internal frames for cleaner debugging
- **Source Map Support**: Shows original source locations when available
- **Real-time Monitoring**: Errors appear in Reactotron immediately when they occur

## Configuration

The plugin is configured in `ReactotronConfig.js` with intelligent filtering:

```javascript
.use(
  trackGlobalErrors({
    // Filter out React Native internal frames for cleaner stack traces
    veto: (frame) => {
      // Filter out React Native internal files
      if (frame.fileName && frame.fileName.indexOf('/node_modules/react-native/') >= 0) {
        return true;
      }
      // Filter out Metro bundler files
      if (frame.fileName && frame.fileName.indexOf('/metro/') >= 0) {
        return true;
      }
      // Filter out Expo internal files
      if (frame.fileName && frame.fileName.indexOf('/expo/') >= 0) {
        return true;
      }
      // Filter out other common noise
      if (frame.fileName && (
        frame.fileName.includes('node_modules/@react-native') ||
        frame.fileName.includes('node_modules/expo') ||
        frame.fileName.includes('__prelude__') ||
        frame.fileName.includes('polyfills')
      )) {
        return true;
      }
      // Keep all other frames
      return false;
    },
  })
)
```

## How It Works

### React Native Implementation
- Hooks into `NativeModules.LogBox.addException` (React Native's internal error reporting)
- Maintains compatibility with React Native's Red Box error display
- Automatically captures both JavaScript and native errors

### Error Processing
1. **Error Capture**: Global errors are intercepted before being displayed
2. **Stack Trace Filtering**: Removes noise from React Native internals
3. **Source Mapping**: Attempts to resolve original source locations
4. **Reactotron Display**: Sends processed error information to Reactotron

## Error Information

Each error captured includes:

- **Error Message**: The actual error description
- **Stack Trace**: Filtered call stack showing your application code
- **File Information**: Source file, line number, and column number
- **Function Name**: The function where the error occurred
- **Timestamp**: When the error occurred

## Usage Examples

### Viewing Errors in Reactotron

1. **Open Reactotron**: Start the Reactotron desktop app
2. **Connect Your App**: Run your React Native app in development mode
3. **Monitor Errors**: Errors will appear in the "Errors" tab automatically

### Common Error Types Captured

- **Runtime Errors**: Undefined variables, null reference errors
- **Type Errors**: Incorrect data type usage
- **Network Errors**: Failed API calls and network issues
- **Component Errors**: React component lifecycle errors
- **Async Errors**: Promise rejections and async/await errors

### Example Error Display

```
Error: Cannot read property 'name' of undefined
  at WorkoutCard (app/components/WorkoutCard.tsx:45:12)
  at ExerciseList (app/screens/ExerciseList.tsx:23:8)
  at TabNavigator (app/(tabs)/exercises.tsx:15:4)
```

## Best Practices

### 1. Error Handling Strategy
```javascript
// Good: Proper error handling with Reactotron visibility
try {
  const result = await apiCall();
  return result;
} catch (error) {
  // Error will be automatically captured by trackGlobalErrors
  console.error('API call failed:', error);
  throw error; // Re-throw to maintain error flow
}
```

### 2. Component Error Boundaries
```javascript
// Use error boundaries for component-level error handling
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // This error will be captured by trackGlobalErrors
    console.error('Component error:', error, errorInfo);
  }
}
```

### 3. Async Error Handling
```javascript
// Ensure async errors are properly caught
const handleAsyncOperation = async () => {
  try {
    await someAsyncOperation();
  } catch (error) {
    // Will be captured by trackGlobalErrors
    console.error('Async operation failed:', error);
  }
};
```

## Debugging Workflow

### 1. Error Detection
- Errors appear immediately in Reactotron when they occur
- Check the "Errors" tab for new error entries

### 2. Error Analysis
- Review the error message and stack trace
- Identify the source file and line number
- Use the filtered stack trace to focus on your application code

### 3. Error Resolution
- Click on stack trace entries to open files in your editor (if configured)
- Fix the identified issue in your code
- Test to ensure the error is resolved

### 4. Error Prevention
- Use TypeScript for better type safety
- Implement proper error boundaries
- Add comprehensive error handling for async operations

## Troubleshooting

### Errors Not Appearing
1. **Check Reactotron Connection**: Ensure your app is connected to Reactotron
2. **Verify Development Mode**: Plugin only works in `__DEV__` mode
3. **Check Console**: Look for Reactotron connection messages

### Too Many Errors
1. **Review Filtering**: Adjust the `veto` function to filter more noise
2. **Check Error Sources**: Identify and fix recurring error patterns
3. **Use Error Boundaries**: Implement proper error containment

### Missing Stack Traces
1. **Source Maps**: Ensure source maps are enabled in your build configuration
2. **Metro Configuration**: Check that Metro is properly configured for source maps
3. **File Paths**: Verify that file paths are correctly resolved

## Integration with Other Tools

### Sentry Integration
```javascript
// Errors captured by trackGlobalErrors can also be sent to Sentry
import * as Sentry from '@sentry/react-native';

// Configure Sentry to work alongside Reactotron
Sentry.init({
  dsn: 'your-sentry-dsn',
});
```

### Custom Error Reporting
```javascript
// Add custom error reporting alongside trackGlobalErrors
const customErrorHandler = (error, isFatal) => {
  // Custom error processing
  console.log('Custom error handler:', error);
  
  // Send to analytics or other services
  analytics.track('Error Occurred', {
    error: error.message,
    isFatal,
  });
};
```

## Performance Considerations

- **Development Only**: Plugin is automatically disabled in production builds
- **Minimal Overhead**: Error tracking has negligible performance impact
- **Memory Usage**: Errors are not stored permanently, only displayed in Reactotron

## Security Notes

- **Development Only**: Error details are only visible during development
- **No Sensitive Data**: Avoid logging sensitive information in error messages
- **Stack Trace Filtering**: Internal React Native code is filtered out for security

## Related Documentation

- [Reactotron AsyncStorage Plugin Guide](./reactotron-asyncstorage-guide.md)
- [Reactotron API Monitoring Guide](./reactotron-api-monitoring-guide.md)
- [Reactotron Editor Integration Guide](./reactotron-editor-integration-guide.md)
- [React Native Error Handling Best Practices](https://reactnative.dev/docs/error-handling) 