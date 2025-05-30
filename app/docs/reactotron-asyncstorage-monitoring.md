# Reactotron AsyncStorage Monitoring Guide

This guide explains how to use Reactotron's AsyncStorage plugin to monitor local storage operations in the MindMuscle.AI app.

## Setup

The AsyncStorage plugin is already configured in `ReactotronConfig.js` and will automatically monitor all AsyncStorage operations.

## Configuration

The plugin is configured with security in mind, ignoring sensitive data:

```javascript
.use(
  asyncStorage({
    ignore: [
      'secure_',           // All secure storage keys
      'auth_token',        // Authentication tokens
      'user_credentials',  // User credentials
      'api_keys',          // API keys
      'session_data',      // Session information
      'biometric_data',    // Biometric authentication data
      'encrypted_',        // Any encrypted data
    ],
  }),
)
```

## What You'll See in Reactotron

The AsyncStorage monitor will show:

1. **Storage Operations**: All `setItem`, `getItem`, `removeItem`, and `clear` operations
2. **Key-Value Pairs**: Current state of AsyncStorage
3. **Operation Timing**: When storage operations occur
4. **Data Changes**: Real-time updates as data is modified

## Common AsyncStorage Keys in MindMuscle.AI

### Workout Data
- `workoutHistory` - User's workout session history
- `activeWorkout` - Currently active workout session
- `workoutPreferences` - User workout preferences

### User Profile
- `userProfile` - User profile information
- `userMeasurements` - Body measurements history
- `userGoals` - Fitness goals and targets

### App Settings
- `appSettings` - Application configuration
- `themePreference` - Dark/light mode preference
- `notificationSettings` - Push notification preferences

### Coaching Data
- `coachingHistory` - AI coaching session history
- `coachingPreferences` - Coaching personalization settings

### Exercise Data
- `favoriteExercises` - User's favorite exercises
- `exerciseHistory` - Exercise performance history
- `customExercises` - User-created custom exercises

## Security Features

### Ignored Keys
The following patterns are automatically ignored for security:
- Any key starting with `secure_`
- Authentication tokens
- User credentials
- API keys
- Encrypted data

### Safe Monitoring
- Sensitive data is filtered out before being sent to Reactotron
- Only development builds show AsyncStorage data
- Production builds automatically disable monitoring

## Usage Examples

### Monitoring Workout Data Storage

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// This will be visible in Reactotron
const saveWorkoutHistory = async (workoutData: any) => {
  await AsyncStorage.setItem('workoutHistory', JSON.stringify(workoutData));
};

// This will also be monitored
const getWorkoutHistory = async () => {
  const data = await AsyncStorage.getItem('workoutHistory');
  return data ? JSON.parse(data) : [];
};
```

### Monitoring User Preferences

```typescript
// Visible in Reactotron
const saveUserPreferences = async (preferences: any) => {
  await AsyncStorage.setItem('userPreferences', JSON.stringify(preferences));
};

// This will be ignored (secure data)
const saveAuthToken = async (token: string) => {
  await AsyncStorage.setItem('secure_auth_token', token); // Ignored due to 'secure_' prefix
};
```

## Debugging with AsyncStorage Monitor

### Finding Storage Issues
1. **Data Persistence**: Verify data is being saved correctly
2. **Data Retrieval**: Check if data is being loaded properly
3. **Storage Cleanup**: Monitor when data is removed
4. **Storage Size**: Track storage usage

### Performance Monitoring
- **Operation Speed**: See how long storage operations take
- **Frequent Operations**: Identify frequently accessed keys
- **Storage Patterns**: Understand app storage behavior

## Best Practices

### Development
1. **Use Descriptive Keys**: Make storage keys self-explanatory
2. **Consistent Naming**: Follow naming conventions for storage keys
3. **Data Validation**: Validate data before storing
4. **Error Handling**: Handle storage errors gracefully

### Security
1. **Sensitive Data**: Never store sensitive data in plain AsyncStorage
2. **Use Secure Storage**: Use `expo-secure-store` for sensitive information
3. **Data Encryption**: Encrypt sensitive data before storage
4. **Key Patterns**: Use consistent patterns for secure keys

### Performance
1. **Batch Operations**: Group multiple storage operations when possible
2. **Data Size**: Keep stored data reasonably sized
3. **Cleanup**: Remove unused data regularly
4. **Caching Strategy**: Implement proper caching patterns

## Integration with Secure Storage

The app uses both AsyncStorage and SecureStore:

```typescript
// Regular data (monitored by Reactotron)
await AsyncStorage.setItem('userPreferences', JSON.stringify(prefs));

// Sensitive data (not monitored, uses SecureStore)
await secureStorage.setItemAsync('auth_token', token);
```

## Troubleshooting

### Not Seeing AsyncStorage Data
- Ensure you're in development mode (`__DEV__` is true)
- Check that Reactotron desktop app is connected
- Verify the AsyncStorage plugin is configured correctly

### Missing Storage Operations
- Check if the key is in the ignore list
- Ensure operations are happening after Reactotron connection
- Look for console errors in the app

### Performance Issues
- Monitor storage operation frequency
- Check for large data being stored
- Look for unnecessary storage operations

## Related Documentation

- [Reactotron API Monitoring](./reactotron-api-monitoring.md)
- [Secure Storage Implementation](../utils/secureStorage.ts) 