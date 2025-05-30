# Reactotron Complete Guide for MindMuscle.AI

This guide covers all Reactotron features and plugins configured for the MindMuscle.AI app.

## Overview

Reactotron is a powerful debugging tool that provides real-time insights into your React Native app. Our configuration includes:

- **AsyncStorage Monitoring** - Track storage operations
- **Networking Plugin** - Monitor all XMLHttpRequests
- **API Monitoring** - Enhanced API tracking with apisauce
- **Editor Integration** - Click to open code in your editor
- **Design Overlay** - Overlay design mockups for pixel-perfect development
- **Benchmarking** - Performance profiling for functions
- **MMKV Plugin** - Ready for high-performance storage (when Expo compatible)
- **MST Plugin** - Ready for MobX State Tree (when needed)
- **Error Tracking** - Monitor app errors and crashes

## Current Configuration

### AsyncStorage Plugin

Monitors all AsyncStorage operations while protecting sensitive data.

**Features:**
- Real-time storage operation tracking
- Automatic filtering of sensitive keys
- Clear visualization of storage state

**Protected Keys:**
- `secure_*` - All secure storage keys
- `auth_token` - Authentication tokens
- `user_credentials` - User credentials
- `api_keys` - API keys
- `session_data` - Session information
- `biometric_data` - Biometric authentication data
- `encrypted_*` - Any encrypted data

### Networking Plugin

Tracks all XMLHttpRequests made by your React Native app, providing comprehensive network monitoring.

**Features:**
- Complete XMLHttpRequest tracking
- Request/response headers and body inspection
- Network timing information
- Status code monitoring
- Automatic filtering of noisy requests

**Configuration:**
```javascript
networking({
  // Ignore image content types to keep logs clean
  ignoreContentTypes: /^(image)\/.*$/i,
  // Ignore noisy development requests
  ignoreUrls: /\/(logs|symbolicate|hot-reload|inspector)$/,
})
```

**What Gets Tracked:**
- All fetch() requests
- XMLHttpRequest calls
- Network libraries (axios, etc.)
- React Native's built-in networking

### API Monitoring Plugin (Apisauce)

Enhanced API tracking specifically for apisauce-based API clients, providing additional context and formatting.

**Features:**
- Request/response logging with enhanced formatting
- API client-specific insights
- Timing information
- Status code tracking
- Automatic filtering of image content types

**Usage:**
```javascript
// Automatically monitors all API calls made through apisauce clients
import { apiClient } from '../services/api';

// This will be automatically logged in Reactotron with enhanced formatting
const response = await apiClient.get('/exercises');
```

**Networking vs Apisauce Plugins:**
- **Networking Plugin**: Tracks ALL network requests (fetch, XMLHttpRequest, etc.)
- **Apisauce Plugin**: Provides enhanced tracking specifically for apisauce API clients
- Both work together to give you comprehensive network monitoring

### Editor Integration (Open In Editor)

Allows you to click on stack traces, file references, or code locations in Reactotron and have them open directly in your code editor.

**Features:**
- Click-to-open functionality for stack traces
- Direct navigation to error locations
- Support for most popular editors
- Automatic file path resolution

**How It Works:**
1. When errors occur, stack traces are displayed in Reactotron
2. Click on any line in the stack trace
3. Your editor opens automatically to that exact file and line
4. Works with error logs, console logs, and other code references

**Supported Editors:**
- Visual Studio Code
- WebStorm/IntelliJ
- Atom
- Sublime Text
- Vim/Neovim
- And many others

**Usage:**
```javascript
// When this error occurs:
console.error('Something went wrong in workout session');
throw new Error('Failed to save workout data');

// You can click on the stack trace in Reactotron to open the file
```

### Design Overlay

Allows you to upload design mockups to Reactotron and overlay them on top of your app for pixel-perfect development.

**Features:**
- Upload design images directly in Reactotron
- Overlay designs on top of your running app
- Adjust opacity and positioning
- Perfect for matching designs exactly
- Works with any image format

**How It Works:**
1. Wrap your components with the overlay utility
2. Upload a design mockup in Reactotron
3. The design appears as an overlay on your app
4. Adjust your UI to match the design perfectly

**Basic Usage:**
```javascript
import { withOverlay } from '../utils/reactotronOverlay';

// Wrap your component
const MyScreen = () => {
  return (
    <View>
      <Text>My Screen Content</Text>
    </View>
  );
};

// Export with overlay functionality
export default withOverlay(MyScreen);
```

**Root App Usage:**
```javascript
import { wrapAppWithOverlay } from '../utils/reactotronOverlay';

const App = () => {
  return (
    <NavigationContainer>
      {/* Your app content */}
    </NavigationContainer>
  );
};

// Wrap the entire app for global overlay access
export default wrapAppWithOverlay(App);
```

**Conditional Usage:**
```javascript
import { useReactotronOverlay } from '../utils/reactotronOverlay';

const MyComponent = () => {
  return <View>{/* Component content */}</View>;
};

// Only apply overlay during design phase
const shouldUseOverlay = process.env.DESIGN_MODE === 'true';
export default useReactotronOverlay(MyComponent, shouldUseOverlay);
```

**Production Safety:**
The overlay utilities automatically disable in production builds, so you can safely leave them in your code.

### MMKV Plugin (Ready for Future Use)

High-performance storage monitoring for MMKV. Currently commented out as MMKV doesn't work with Expo managed workflow, but ready to enable when using bare React Native or when Expo compatibility is added.

**Features (When Available):**
- Real-time MMKV storage operation tracking
- Up to 30x faster than AsyncStorage monitoring
- Synchronous storage operations
- Built-in encryption support monitoring
- Automatic filtering of sensitive keys

**Performance Benefits:**
- Faster storage operations
- Better memory efficiency
- Crash recovery monitoring
- Smaller bundle size impact

**To Enable MMKV Plugin:**

1. **Install MMKV:**
```bash
npm install react-native-mmkv
npm install --save-dev reactotron-react-native-mmkv
```

2. **Create MMKV Storage Instance:**
```javascript
// app/utils/mmkvStorage.ts
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'mindmuscle-ai-storage',
  encryptionKey: 'your-encryption-key-here',
});
```

3. **Uncomment in ReactotronConfig.js:**
```javascript
import mmkvPlugin from 'reactotron-react-native-mmkv';
import { storage } from '../utils/mmkvStorage';

Reactotron.configure()
  .use(mmkvPlugin({
    storage,
    ignore: [
      'secure_',
      'auth_token',
      'user_credentials',
      // ... other sensitive keys
    ],
  }))
  .connect();
```

**Migration from AsyncStorage:**
```javascript
import { StorageMigration } from '../utils/mmkvStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// One-time migration when switching to MMKV
await StorageMigration.migrateFromAsyncStorage(AsyncStorage, mmkvStorage);
```

**Current Status:**
- ✅ Configuration ready in ReactotronConfig.js (commented out)
- ✅ Utility classes prepared in `app/utils/mmkvStorage.ts`
- ✅ Migration utilities ready
- 🟡 Waiting for Expo compatibility or bare React Native migration

### Benchmarking

Performance profiling for identifying bottlenecks in your code.

**Basic Usage:**
```javascript
import { benchmark } from '../utils/benchmarking';

function slowFunction() {
  const bench = benchmark.start("slow function benchmark");

  // Code that does thing A
  bench.step("Thing A");

  // Code that does thing B
  bench.step("Thing B");

  // Code that does thing C
  bench.stop("Thing C");
}
```

**Advanced Usage:**

1. **Sync Function Benchmarking:**
```javascript
import { benchmarkSync } from '../utils/benchmarking';

const result = benchmarkSync('Data Processing', () => {
  // Your synchronous code here
  return processData(data);
});
```

2. **Async Function Benchmarking:**
```javascript
import { benchmarkAsync } from '../utils/benchmarking';

const result = await benchmarkAsync('API Call', async () => {
  return await fetchUserData();
});
```

3. **Multi-Step Benchmarking:**
```javascript
import { benchmark } from '../utils/benchmarking';

const results = await benchmark.steps('Complex Operation', [
  {
    label: 'Load Data',
    fn: () => loadDataFromStorage()
  },
  {
    label: 'Process Data',
    fn: () => processLoadedData()
  },
  {
    label: 'Save Results',
    fn: () => saveProcessedData()
  }
]);
```

4. **Function Wrapping:**
```javascript
import { withBenchmark } from '../utils/benchmarking';

// Wrap any function to automatically benchmark it
const benchmarkedFunction = withBenchmark('My Function', originalFunction);
```

5. **Class Method Decorators (Experimental):**
```javascript
import { benchmarkMethod, benchmarkAsyncMethod } from '../utils/benchmarking';

class MyService {
  @benchmarkMethod('processData')
  processData(data) {
    // This method will be automatically benchmarked
    return processedData;
  }

  @benchmarkAsyncMethod('fetchData')
  async fetchData() {
    // This async method will be automatically benchmarked
    return await fetch('/api/data');
  }
}
```

### MobX State Tree Plugin (Ready for Future Use)

Currently commented out since the app uses React Context API, but ready to enable if you migrate to MST.

**To Enable MST Plugin:**

1. Uncomment the import and plugin configuration in `ReactotronConfig.js`
2. Create your MST models
3. Track your root store

**Example MST Setup:**
```javascript
// 1. Uncomment in ReactotronConfig.js
import { mst } from 'reactotron-mst';

// 2. Add to plugin chain
.use(mst({
  filter: (event) => !/postProcessSnapshot/.test(event.name),
  queryMode: 'live'
}))

// 3. In your app, track your root store
import Reactotron from 'reactotron-react-native';
import { RootStore } from './stores/RootStore';

const rootStore = RootStore.create();
Reactotron.trackMstNode(rootStore);
```

## Best Practices

### MMKV Guidelines (For Future Use)

1. **When to Use MMKV:**
   - High-frequency storage operations
   - Performance-critical applications
   - When you need synchronous storage
   - Large amounts of data storage

2. **Migration Strategy:**
   - Plan migration during a major version update
   - Test thoroughly with production data
   - Use the provided migration utilities
   - Keep AsyncStorage as fallback initially

3. **Security Considerations:**
   - Use encryption for sensitive data
   - Separate storage instances for different data types
   - Apply same filtering rules as AsyncStorage

4. **Performance Monitoring:**
   - Use Reactotron to monitor MMKV operations
   - Compare performance before and after migration
   - Monitor memory usage and app startup time

### Design Overlay Guidelines

1. **Use for Pixel-Perfect Development:**
   - Upload high-quality design mockups
   - Wrap components that need precise alignment
   - Use during active development, remove when complete

2. **Overlay Workflow:**
   - Start with the root component for global overlays
   - Use specific component wrapping for detailed work
   - Adjust opacity in Reactotron for better visibility

3. **Performance Considerations:**
   - Only use overlays during development
   - Remove overlay wrapping from production builds
   - Use conditional wrapping for design phases

4. **Common Use Cases:**
   - Matching exercise card layouts
   - Aligning workout session interfaces
   - Perfecting profile screen designs
   - Ensuring consistent spacing and typography

### Editor Integration Guidelines

1. **Set Up Your Editor:**
   - Ensure your editor supports URL schemes (most modern editors do)
   - Configure your editor as the default for code files
   - Test the integration by clicking on stack traces

2. **Debugging Workflow:**
   - Use console.log() with meaningful messages
   - Let errors bubble up to see full stack traces
   - Click on stack traces to navigate directly to problematic code

3. **Common Use Cases:**
   - Debugging runtime errors
   - Navigating to specific functions from logs
   - Quick access to files mentioned in network requests

### Network Monitoring Guidelines

1. **Filter Noisy Requests:**
```javascript
// Current configuration filters out:
ignoreUrls: /\/(logs|symbolicate|hot-reload|inspector)$/
```

2. **Monitor Critical API Calls:**
- User authentication
- Data synchronization
- Exercise loading
- Workout session saves

3. **Use Both Plugins:**
- Networking plugin for comprehensive coverage
- Apisauce plugin for enhanced API client insights

### Benchmarking Guidelines

1. **Use Descriptive Names:**
```javascript
// Good
benchmark.start('Exercise List Rendering');

// Bad
benchmark.start('function1');
```

2. **Benchmark Critical Paths:**
- Database operations
- Image processing
- Complex calculations
- API calls
- UI rendering

3. **Use Steps for Complex Operations:**
```javascript
const bench = benchmark.start('Workout Session Save');
bench.step('Validate Data');
bench.step('Process Exercises');
bench.step('Save to Database');
bench.step('Update UI');
bench.stop('Complete');
```

4. **Remove Benchmarks in Production:**
The utility automatically becomes no-op in production builds.

### Performance Monitoring

**Common Use Cases:**

1. **Database Operations:**
```javascript
const exercises = await benchmarkAsync('Load Exercises', async () => {
  return await exerciseService.getAllExercises();
});
```

2. **Image Processing:**
```javascript
const processedImage = benchmarkSync('Image Resize', () => {
  return resizeImage(originalImage, { width: 300, height: 300 });
});
```

3. **Complex Calculations:**
```javascript
const workoutPlan = await benchmark.steps('Generate Workout Plan', [
  { label: 'Analyze User Profile', fn: () => analyzeProfile(user) },
  { label: 'Select Exercises', fn: () => selectExercises(profile) },
  { label: 'Calculate Sets/Reps', fn: () => calculateVolume(exercises) },
  { label: 'Generate Schedule', fn: () => createSchedule(plan) }
]);
```

## Troubleshooting

### Common Issues

1. **Reactotron Not Connecting:**
   - Check if Reactotron desktop app is running
   - Verify the host IP address in configuration
   - Ensure port 9090 is not blocked

2. **MMKV Plugin Issues (Future):**
   - Verify MMKV is properly installed
   - Check if storage instance is correctly imported
   - Ensure you're not using Expo managed workflow
   - Confirm native modules are linked properly

3. **Overlay Not Showing:**
   - Verify the component is properly wrapped
   - Check if an image is uploaded in Reactotron
   - Ensure overlay is enabled in configuration
   - Confirm you're in development mode

4. **Editor Not Opening:**
   - Verify your editor supports URL schemes
   - Check if your editor is set as the default for code files
   - Try manually opening a file to test editor functionality
   - Ensure file paths are correct and accessible

5. **Network Requests Not Showing:**
   - Check if the URL is in the ignore list
   - Verify the request is actually being made
   - Ensure both networking plugins are enabled

6. **Benchmarks Not Showing:**
   - Ensure you're calling `stop()` instead of `step()` for the final measurement
   - Check that Reactotron is connected
   - Verify you're in development mode

7. **AsyncStorage Data Not Visible:**
   - Check if the key is in the ignore list
   - Verify AsyncStorage operations are actually happening

### Debug Mode

Enable additional logging:
```javascript
// In ReactotronConfig.js, add:
.configure({
  name: 'MindMuscle.AI',
  host: 'localhost',
  port: 9090,
  logLevel: 'debug' // Add this for more verbose logging
})
```

## Integration Examples

### MMKV Integration (Future)

```javascript
// 1. Create MMKV storage instance
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({
  id: 'mindmuscle-ai-storage',
  encryptionKey: 'your-encryption-key',
});

// 2. Use in your app
storage.set('user-preferences', JSON.stringify(preferences));
const preferences = JSON.parse(storage.getString('user-preferences') ?? '{}');

// 3. Migration from AsyncStorage
import { StorageMigration } from '../utils/mmkvStorage';
await StorageMigration.migrateFromAsyncStorage(AsyncStorage, mmkvStorage);
```

### Design Overlay Workflow

```javascript
// 1. Wrap your screen component
import { withOverlay } from '../utils/reactotronOverlay';

const WorkoutSessionScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Workout Session</Text>
      {/* Your screen content */}
    </View>
  );
};

// Export with overlay for design comparison
export default withOverlay(WorkoutSessionScreen);

// 2. In Reactotron desktop app:
// - Go to the Overlay tab
// - Upload your design mockup
// - Adjust opacity and position
// - Develop your UI to match the design
```

### Root App Overlay Setup

```javascript
// In your main App component
import { wrapAppWithOverlay } from '../utils/reactotronOverlay';

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* Your navigation setup */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Wrap the entire app for global overlay access
export default wrapAppWithOverlay(App);
```

### Editor Integration Workflow

```javascript
// 1. Add meaningful console logs
console.log('Starting workout session for user:', userId);

// 2. Use try-catch for better error tracking
try {
  const workout = await loadWorkoutData();
  console.log('Workout loaded successfully:', workout.id);
} catch (error) {
  // This error will show in Reactotron with clickable stack trace
  console.error('Failed to load workout:', error);
  throw error;
}

// 3. Use descriptive error messages
if (!exerciseData) {
  throw new Error('Exercise data is required for workout session');
}
```

### Network Request Monitoring

```javascript
// All these will be automatically tracked:

// 1. Fetch requests
const response = await fetch('/api/exercises');

// 2. Axios requests
const data = await axios.get('/api/workouts');

// 3. Supabase requests
const { data, error } = await supabase.from('exercises').select('*');

// 4. Custom API clients
const result = await apiClient.post('/workouts', workoutData);
```

### Workout Session Benchmarking

```javascript
// In workout session component
import { benchmark } from '../utils/benchmarking';

const startWorkout = async () => {
  const bench = benchmark.start('Workout Session Start');
  
  bench.step('Load Exercises');
  const exercises = await loadWorkoutExercises();
  
  bench.step('Initialize Timer');
  initializeWorkoutTimer();
  
  bench.step('Setup UI');
  setupWorkoutInterface();
  
  bench.stop('Ready to Start');
};
```

### Exercise Loading Performance

```javascript
// In exercise service
import { withBenchmark } from '../utils/benchmarking';

class ExerciseService {
  // Automatically benchmark this method
  getAllExercises = withBenchmark('Get All Exercises', async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*');
    
    if (error) throw error;
    return data;
  });
}
```

## Configuration Reference

Current Reactotron configuration location: `ReactotronConfig.js`

**Key Settings:**
- **Host:** `localhost` (change for physical devices)
- **Port:** `9090`
- **AsyncStorage:** Enabled with sensitive data filtering
- **Networking:** Enabled with comprehensive XMLHttpRequest tracking
- **API Monitoring:** Enhanced apisauce tracking
- **Editor Integration:** Enabled for click-to-open functionality
- **Design Overlay:** Enabled for pixel-perfect development
- **MMKV:** Ready but commented out (Expo incompatible)
- **Benchmarking:** Available through utility functions
- **MST:** Ready but commented out
- **Error Tracking:** Enabled

**Plugin Order:**
1. AsyncStorage Plugin
2. Networking Plugin
3. Apisauce Plugin
4. Open In Editor Plugin
5. MMKV Plugin (commented out)
6. Design Overlay (built-in)
7. MST Plugin (commented out)

## Future Enhancements

Potential additions:
- MMKV plugin activation (when Expo compatible)
- Redux plugin (if migrating from Context API)
- Flipper integration
- Custom command plugins
- State snapshots and time travel
- Performance metrics dashboard 