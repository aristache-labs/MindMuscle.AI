# Redux Integration with Reactotron - MindMuscle.AI

This guide explains how to integrate Redux with Reactotron for enhanced debugging capabilities in the MindMuscle.AI React Native Expo app.

## Overview

Redux is a predictable state container for JavaScript apps. When combined with Reactotron, it provides powerful debugging capabilities including:

- Track when actions are dispatched with timing information
- Subscribe to changes within the state tree
- Pull values out on demand
- View list of keys
- Dispatch actions from Reactotron
- Replay actions
- Hot swap your app state on the fly

## Prerequisites

The `reactotron-redux` plugin is already installed in the project:

```json
{
  "devDependencies": {
    "reactotron-redux": "^3.2.0"
  }
}
```

## Setup Instructions

### 1. Enable Redux Plugin in ReactotronConfig.js

Uncomment the Redux plugin configuration in `ReactotronConfig.js`:

```javascript
// Uncomment these lines:
import { reactotronRedux } from 'reactotron-redux';

// And uncomment this plugin configuration:
.use(
  reactotronRedux({
    // Ignore noisy actions to keep logs clean
    except: [
      'persist/PERSIST',
      'persist/REHYDRATE',
      'persist/REGISTER',
      'persist/FLUSH',
      'persist/PAUSE',
      'persist/PURGE',
      'EFFECT_TRIGGERED',
      'EFFECT_RESOLVED',
      'EFFECT_REJECTED',
    ],
    // Highlight important actions
    isActionImportant: (action) => {
      return action.type.includes('ERROR') || 
             action.type.includes('SUCCESS') ||
             action.type.includes('WORKOUT') ||
             action.type.includes('USER');
    },
    // Filter sensitive data before sending to Reactotron
    onBackup: (state) => {
      const { auth, ...safeState } = state;
      return {
        ...safeState,
        auth: {
          ...auth,
          token: '[REDACTED]',
          refreshToken: '[REDACTED]',
          user: auth.user ? { ...auth.user, email: '[REDACTED]' } : null,
        },
      };
    },
    // Handle state restoration
    onRestore: (state) => {
      console.log('Redux state restored from Reactotron:', state);
      return state;
    },
  })
)
```

### 2. Install Redux Dependencies

```bash
npm install @reduxjs/toolkit react-redux
# or
yarn add @reduxjs/toolkit react-redux
```

### 3. Create Redux Store with Reactotron Integration

#### Option A: Using Redux Toolkit (Recommended)

Create `app/store/reduxStore.ts`:

```typescript
import { configureStore, GetDefaultEnhancers } from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { workoutSlice } from './slices/workoutSlice';
import { profileSlice } from './slices/profileSlice';

const createEnhancers = (getDefaultEnhancers: GetDefaultEnhancers<any>) => {
  if (__DEV__) {
    const reactotron = require('../../ReactotronConfig').default;
    return getDefaultEnhancers().concat(reactotron.createEnhancer());
  } else {
    return getDefaultEnhancers();
  }
};

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    workout: workoutSlice.reducer,
    profile: profileSlice.reducer,
  },
  enhancers: createEnhancers,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

#### Option B: Using Legacy Redux

Create `app/store/reduxStore.ts`:

```typescript
import { createStore, combineReducers, compose } from 'redux';
import { authReducer } from './reducers/authReducer';
import { workoutReducer } from './reducers/workoutReducer';
import { profileReducer } from './reducers/profileReducer';

const rootReducer = combineReducers({
  auth: authReducer,
  workout: workoutReducer,
  profile: profileReducer,
});

let store;

if (__DEV__) {
  const reactotron = require('../../ReactotronConfig').default;
  store = createStore(
    rootReducer,
    compose(reactotron.createEnhancer())
  );
} else {
  store = createStore(rootReducer);
}

export type RootState = ReturnType<typeof rootReducer>;
export { store };
```

### 4. Create Redux Slices/Reducers

#### Example Auth Slice (Redux Toolkit)

Create `app/store/slices/authSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.isLoading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions;
```

### 5. Setup Redux Provider

Update your main app component to include the Redux provider:

```typescript
// app/_layout.tsx
import { Provider } from 'react-redux';
import { store } from './store/reduxStore';

export default function RootLayout() {
  return (
    <Provider store={store}>
      {/* Your existing app structure */}
    </Provider>
  );
}
```

### 6. Create Typed Hooks

Create `app/hooks/reduxHooks.ts`:

```typescript
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '../store/reduxStore';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

### 7. Usage in Components

```typescript
import React from 'react';
import { View, Button } from 'react-native';
import { useAppDispatch, useAppSelector } from '../hooks/reduxHooks';
import { loginStart, loginSuccess } from '../store/slices/authSlice';

export function LoginComponent() {
  const dispatch = useAppDispatch();
  const { user, isLoading } = useAppSelector((state) => state.auth);

  const handleLogin = () => {
    dispatch(loginStart());
    // Simulate API call
    setTimeout(() => {
      dispatch(loginSuccess({
        user: { id: '1', email: 'user@example.com', name: 'John Doe' },
        token: 'jwt-token'
      }));
    }, 1000);
  };

  return (
    <View>
      <Button 
        title={isLoading ? 'Logging in...' : 'Login'} 
        onPress={handleLogin}
        disabled={isLoading}
      />
    </View>
  );
}
```

## Reactotron Redux Features

### 1. Action Tracking
- All dispatched actions appear in Reactotron with timing information
- Actions marked as "important" are highlighted
- Noisy actions (like persistence actions) are filtered out

### 2. State Inspection
- View the entire Redux state tree
- Drill down into specific state branches
- See state changes in real-time

### 3. Action Dispatching
- Dispatch actions directly from Reactotron
- Test different action payloads
- Useful for testing edge cases

### 4. State Backup/Restore
- Save current state as a snapshot
- Restore state from a previous snapshot
- Useful for testing different app states

### 5. Action Replay
- Replay a sequence of actions
- Useful for reproducing bugs
- Test state transitions

## Configuration Options

### `except` Array
Filter out noisy actions:

```javascript
except: [
  'persist/PERSIST',
  'persist/REHYDRATE',
  'EFFECT_TRIGGERED',
  'EFFECT_RESOLVED',
  'EFFECT_REJECTED',
]
```

### `isActionImportant` Function
Highlight important actions:

```javascript
isActionImportant: (action) => {
  return action.type.includes('ERROR') || 
         action.type.includes('SUCCESS') ||
         action.type.includes('WORKOUT') ||
         action.type.includes('USER');
}
```

### `onBackup` Function
Filter sensitive data before sending to Reactotron:

```javascript
onBackup: (state) => {
  const { auth, ...safeState } = state;
  return {
    ...safeState,
    auth: {
      ...auth,
      token: '[REDACTED]',
      refreshToken: '[REDACTED]',
      user: auth.user ? { ...auth.user, email: '[REDACTED]' } : null,
    },
  };
}
```

### `onRestore` Function
Handle state restoration:

```javascript
onRestore: (state) => {
  console.log('Redux state restored from Reactotron:', state);
  return state;
}
```

## Migration from Context API

If you're currently using React Context API and want to migrate to Redux:

1. **Identify State Domains**: Group related state (auth, workout, profile, etc.)
2. **Create Slices**: Convert each context to a Redux slice
3. **Replace Providers**: Replace Context providers with Redux provider
4. **Update Components**: Replace `useContext` with `useAppSelector` and `useAppDispatch`
5. **Test Thoroughly**: Ensure all functionality works as expected

## Best Practices

1. **Use Redux Toolkit**: It provides better developer experience and less boilerplate
2. **Keep State Normalized**: Avoid deeply nested state structures
3. **Use Typed Hooks**: Always use the typed versions of useSelector and useDispatch
4. **Filter Sensitive Data**: Use onBackup to prevent sensitive data from being logged
5. **Organize by Feature**: Group related actions, reducers, and selectors together
6. **Use Middleware**: Leverage middleware for async operations (Redux Thunk, Redux Saga)

## Troubleshooting

### Common Issues

1. **Reactotron not showing actions**: Ensure the plugin is properly configured and imported
2. **State not updating**: Check that reducers are pure functions and return new state objects
3. **Performance issues**: Use React.memo and useCallback to prevent unnecessary re-renders
4. **Type errors**: Ensure proper TypeScript configuration and typed hooks

### Debug Tips

1. Use Reactotron's state inspector to verify state changes
2. Check the action log to see if actions are being dispatched
3. Use the replay feature to reproduce issues
4. Leverage the backup/restore feature to test different states

## Conclusion

Redux with Reactotron provides powerful debugging capabilities for state management in React Native apps. The integration allows you to:

- Track all state changes in real-time
- Debug complex state interactions
- Test different app states easily
- Replay user interactions
- Monitor performance of state updates

This setup is particularly useful for the MindMuscle.AI app where you need to manage complex workout data, user authentication, and real-time coaching interactions. 