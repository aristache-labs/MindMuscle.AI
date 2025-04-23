# Back Navigation System

This document explains how to implement consistent back navigation with swipe gestures in the app.

## Overview

The back navigation system provides:

1. **Hardware back button support** (Android)
2. **Right-to-left swipe gesture** (iOS & Android)
3. **Consistent navigation behavior** across screens
4. **Selective implementation** on screens that need back navigation

## Components and Hooks

The navigation system consists of:

1. **GlobalGestureHandler**: Root provider for back navigation context and hardware back button handling
2. **SwipeBackHandler**: Component that enables swipe-right gestures on specific screens
3. **useBackNavigation**: Hook to register custom back handlers for screens
4. **useSwipeNavigation**: Convenience hook that combines back handling and swipe gestures

## Basic Usage

### Option 1: Using the `useSwipeNavigation` Hook (Recommended)

```tsx
import { useSwipeNavigation } from '../hooks/useSwipeGesture';

export default function YourScreen() {
  // Provide the target route to navigate back to
  const { SwipeBackContainer, goBack } = useSwipeNavigation('/(tabs)/profile');
  
  return (
    <SwipeBackContainer>
      <View style={styles.container}>
        {/* Header with back button */}
        <IconButton 
          icon="arrow-left" 
          onPress={goBack} 
        />
        
        {/* Your screen content */}
      </View>
    </SwipeBackContainer>
  );
}
```

### Option 2: Using the `SwipeBackHandler` Component Directly

```tsx
import { useBackNavigation } from '../hooks/useBackNavigation';
import { SwipeBackHandler } from '../components/SwipeBackHandler';

export default function YourScreen() {
  const router = useRouter();
  
  // Define custom back handling logic
  const handleBackNavigation = useCallback(() => {
    router.push('/(tabs)/some-route');
    return true;
  }, [router]);
  
  // Register with global back handler
  useBackNavigation(handleBackNavigation);
  
  return (
    <SwipeBackHandler customHandler={handleBackNavigation}>
      <View style={styles.container}>
        {/* Your screen content */}
      </View>
    </SwipeBackHandler>
  );
}
```

## Advanced Usage

### Custom Back Logic

```tsx
const { SwipeBackContainer, goBack } = useSwipeNavigation(
  undefined, // No target route
  () => {
    // Custom logic before navigation
    if (hasUnsavedChanges) {
      // Show confirmation dialog
      showConfirmDialog();
      return true; // Prevent default navigation
    }
    
    // Otherwise, perform default back navigation
    router.back();
    return true;
  }
);
```

### Multiple Back Targets

For screens with conditional navigation targets:

```tsx
// Determine the back target based on navigation state
const backTarget = fromSearch ? '/(tabs)/search' : '/(tabs)/profile';

const { SwipeBackContainer, goBack } = useSwipeNavigation(backTarget);
```

## Important Notes

1. The swipe gesture is only enabled on screens wrapped with `SwipeBackContainer` or `SwipeBackHandler`
2. The gesture works by detecting:
   - Horizontal swipes of at least 50px
   - Swipes with horizontal movement greater than vertical movement
3. Register a back handler for every screen that needs custom back navigation

## Implementation Example

The Edit Profile screen demonstrates a complete implementation:

```tsx
// app/(auth)/edit-profile.tsx
import { useSwipeNavigation } from '../hooks/useSwipeGesture';

export default function EditProfileScreen() {
  // Setup swipe navigation with target route
  const { SwipeBackContainer, goBack } = useSwipeNavigation('/(tabs)/profile');
  
  return (
    <SwipeBackContainer>
      {/* Screen content with back button */}
      <Pressable onPress={goBack} style={styles.backButton}>
        <Ionicons name="arrow-back-circle-sharp" size={50} color="white" />
      </Pressable>
      
      {/* Rest of screen UI */}
    </SwipeBackContainer>
  );
}
``` 