# Reactotron Tips and Tricks Guide

## Overview

This guide covers advanced tips, tricks, and best practices for using Reactotron effectively in your React Native development workflow. These techniques will help you debug more efficiently and get the most out of Reactotron's features.

## 🧹 Clearing Reactotron

### Automatic Clearing on App Start

Your Reactotron configuration automatically clears logs every time you start the app in development:

```javascript
// In ReactotronConfig.js
reactotron.clear();
```

### Manual Clearing

You can manually clear Reactotron anytime:

```javascript
// From anywhere in your app
console.tron.clear();

// Or directly
global.reactotron.clear();
```

## 🚫 Production Safety

### ⚠️ Never Run in Production

**Critical**: Always ensure Reactotron is disabled in production builds for security, privacy, and performance reasons.

### React Native Production Safety

```javascript
// ✅ Good: Wrapped in __DEV__ check
if (__DEV__) {
  import('../ReactotronConfig');
}

// ❌ Bad: Always imports Reactotron
import '../ReactotronConfig';
```

### Why Avoid Production?

1. **Battery Life**: WebSocket connections drain battery
2. **Privacy**: App state might contain sensitive user data
3. **Security**: Remote control capabilities pose security risks
4. **Performance**: Additional overhead in production

### Installation Best Practice

Install Reactotron packages as dev dependencies:

```bash
npm install --save-dev reactotron-react-native
npm install --save-dev reactotron-apisauce
npm install --save-dev reactotron-redux
```

## 🎯 Console Piggybacking

### Enhanced Console Access

Your configuration includes enhanced console access:

```javascript
// Basic logging
console.tron.log("Sweet Freedom!");

// Important messages with indicator
console.tron.logImportant("I am important");

// Advanced display with rich formatting
console.tron.display({
  name: "User Data",
  value: { id: 1, name: "John", preferences: { theme: "dark" } },
  preview: "User profile loaded",
  important: true,
});
```

### Custom Console Methods

Your setup includes custom console methods for common scenarios:

```javascript
// Error logging with stack trace
console.tron.error("API call failed", error);

// Success notifications
console.tron.success("User logged in", userData);

// Warnings
console.tron.warning("Deprecated method used", { method: "oldFunction" });

// API call tracking
console.tron.api("/api/users", "POST", requestData, responseData);

// State updates
console.tron.state("userProfile", newUserState);

// Navigation tracking
console.tron.navigation("ProfileScreen", { userId: 123 });

// Performance monitoring
console.tron.performance("Database Query", 250, { query: "SELECT * FROM users" });

// Component render debugging
console.tron.render("UserCard", props, state);

// Async operation tracking
const result = await console.tron.async("fetchUserData", fetchUserData());
```

## 🎨 Fancy Console Magic

### Display Method Features

The `display` method supports rich formatting:

```javascript
console.tron.display({
  name: "🎯 Feature Name",
  value: complexObject,
  preview: "Short description shown in list",
  important: true, // Adds indicator light
  image: "https://example.com/image.jpg", // Optional image
});
```

### Practical Examples

```javascript
// API Response Debugging
console.tron.display({
  name: "🌐 API Response",
  value: {
    endpoint: "/api/workouts",
    status: 200,
    data: responseData,
    headers: responseHeaders,
  },
  preview: `GET /api/workouts - ${responseData.length} items`,
  important: false,
});

// Component State Debugging
console.tron.display({
  name: "🎨 Component State",
  value: {
    component: "WorkoutTimer",
    props: componentProps,
    state: componentState,
    context: contextValues,
  },
  preview: `WorkoutTimer - ${state.isRunning ? 'Running' : 'Stopped'}`,
  important: state.hasError,
});

// Performance Monitoring
console.tron.display({
  name: "⚡ Performance Metrics",
  value: {
    operation: "Image Processing",
    startTime: startTime,
    endTime: endTime,
    duration: `${endTime - startTime}ms`,
    memoryUsage: process.memoryUsage?.(),
  },
  preview: `Image Processing completed in ${endTime - startTime}ms`,
  important: (endTime - startTime) > 1000,
});
```

## 🔄 Redux Integration Tips

### Immutable Data Handling

When using Redux with immutable libraries:

```javascript
.use(reactotronRedux({
  // Handle immutable state restoration
  onRestore: state => {
    // For fully immutable state
    return Immutable(state);
    
    // For partially immutable state (e.g., with react-navigation)
    return { 
      ...Immutable(state), 
      nav: state.nav // Keep navigation mutable
    };
  },
  
  // Filter sensitive data
  onBackup: (state) => {
    const { auth, ...safeState } = state;
    return {
      ...safeState,
      auth: {
        ...auth,
        token: '[REDACTED]',
        refreshToken: '[REDACTED]',
      },
    };
  },
}))
```

### Action Filtering

```javascript
.use(reactotronRedux({
  // Ignore noisy actions
  except: [
    'persist/PERSIST',
    'persist/REHYDRATE',
    'EFFECT_TRIGGERED',
    'NAVIGATION/NAVIGATE',
  ],
  
  // Highlight important actions
  isActionImportant: (action) => {
    return action.type.includes('ERROR') ||
           action.type.includes('SUCCESS') ||
           action.type.includes('WORKOUT') ||
           action.type.includes('USER');
  },
}))
```

## 🛠️ Advanced Debugging Techniques

### Component Lifecycle Debugging

```javascript
// In your React components
useEffect(() => {
  console.tron.render("WorkoutTimer", props, state);
}, [props, state]);

// Track component mounts/unmounts
useEffect(() => {
  console.tron.log(`🎨 ${componentName} mounted`);
  return () => {
    console.tron.log(`🎨 ${componentName} unmounted`);
  };
}, []);
```

### API Call Debugging

```javascript
// Enhanced API debugging
const apiCall = async (endpoint, options) => {
  const startTime = Date.now();
  
  try {
    console.tron.log(`🌐 Starting API call: ${endpoint}`);
    
    const response = await fetch(endpoint, options);
    const data = await response.json();
    
    const duration = Date.now() - startTime;
    
    console.tron.api(endpoint, options.method, options.body, {
      status: response.status,
      data,
      duration: `${duration}ms`,
    });
    
    return data;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.tron.error(`API call failed: ${endpoint}`, {
      error: error.message,
      duration: `${duration}ms`,
      options,
    });
    throw error;
  }
};
```

### State Management Debugging

```javascript
// Context state debugging
const useDebugContext = (contextName, contextValue) => {
  useEffect(() => {
    console.tron.state(contextName, contextValue);
  }, [contextName, contextValue]);
};

// Usage in context providers
const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(initialState);
  
  useDebugContext('AuthContext', authState);
  
  return (
    <AuthContext.Provider value={{ authState, setAuthState }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Navigation Debugging

```javascript
// Track navigation events
import { useNavigation } from '@react-navigation/native';

const useNavigationDebugger = () => {
  const navigation = useNavigation();
  
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (e) => {
      console.tron.navigation('Navigation State Change', {
        routes: e.data.state.routes,
        index: e.data.state.index,
      });
    });
    
    return unsubscribe;
  }, [navigation]);
};
```

## 🔍 Performance Monitoring

### Render Performance

```javascript
// Track component render performance
const useRenderPerformance = (componentName) => {
  const renderStart = useRef(Date.now());
  
  useEffect(() => {
    const renderTime = Date.now() - renderStart.current;
    console.tron.performance(`${componentName} Render`, renderTime, {
      timestamp: new Date().toISOString(),
    });
    renderStart.current = Date.now();
  });
};
```

### Memory Usage Tracking

```javascript
// Monitor memory usage (React Native only)
const trackMemoryUsage = (operation) => {
  if (__DEV__ && global.performance) {
    const memoryInfo = global.performance.memory;
    console.tron.performance(`Memory Usage - ${operation}`, 0, {
      usedJSHeapSize: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      totalJSHeapSize: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      jsHeapSizeLimit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
    });
  }
};
```

## 🎯 Best Practices

### 1. Organize Your Logs

```javascript
// Use consistent naming conventions
console.tron.log("🔄 [AUTH] Starting login process");
console.tron.log("📱 [UI] Button pressed: Login");
console.tron.log("🌐 [API] Calling /auth/login");
console.tron.log("✅ [AUTH] Login successful");
```

### 2. Use Appropriate Log Levels

```javascript
// Regular information
console.tron.log("User navigated to profile");

// Important events
console.tron.logImportant("User authentication successful");

// Errors (automatically marked as important)
console.tron.error("Failed to load user data", error);

// Warnings
console.tron.warning("Using deprecated API endpoint", { endpoint });
```

### 3. Structured Data Logging

```javascript
// Good: Structured data
console.tron.display({
  name: "User Action",
  value: {
    action: "workout_completed",
    user: { id: user.id, name: user.name },
    workout: { id: workout.id, duration: workout.duration },
    timestamp: new Date().toISOString(),
  },
  preview: `${user.name} completed ${workout.name}`,
});

// Avoid: Unstructured strings
console.tron.log(`User ${user.name} completed workout ${workout.name} in ${workout.duration} minutes`);
```

### 4. Conditional Logging

```javascript
// Only log in specific conditions
const debugLevel = 'verbose'; // 'minimal', 'normal', 'verbose'

const conditionalLog = (level, message, data) => {
  const levels = { minimal: 1, normal: 2, verbose: 3 };
  if (levels[debugLevel] >= levels[level]) {
    console.tron.log(`[${level.toUpperCase()}] ${message}`, data);
  }
};

// Usage
conditionalLog('verbose', 'Component re-rendered', { props, state });
conditionalLog('normal', 'API call completed', { endpoint, duration });
conditionalLog('minimal', 'Critical error occurred', { error });
```

## 🚀 Quick Reference

### Essential Commands

```javascript
// Basic logging
console.tron.log(message)
console.tron.logImportant(message)

// Enhanced logging
console.tron.error(message, error)
console.tron.success(message, data)
console.tron.warning(message, data)

// Specialized logging
console.tron.api(endpoint, method, data, response)
console.tron.state(stateName, state)
console.tron.navigation(routeName, params)
console.tron.performance(operation, duration, details)
console.tron.render(componentName, props, state)

// Async tracking
console.tron.async(operationName, promise)

// Utilities
console.tron.clear()
global.reactotron.clear()
ErrorTester.runAll()
```

### Keyboard Shortcuts (Reactotron Desktop)

- `Cmd/Ctrl + K`: Clear timeline
- `Cmd/Ctrl + R`: Reload React Native app
- `Cmd/Ctrl + F`: Search timeline
- `Cmd/Ctrl + 1-9`: Switch between tabs

## 🔗 Related Documentation

- [Reactotron Global Error Tracking Guide](./reactotron-global-errors-guide.md)
- [Reactotron AsyncStorage Plugin Guide](./reactotron-asyncstorage-guide.md)
- [Reactotron API Monitoring Guide](./reactotron-api-monitoring-guide.md)
- [Reactotron Editor Integration Guide](./reactotron-editor-integration-guide.md)
- [Official Reactotron Documentation](https://github.com/infinitered/reactotron) 