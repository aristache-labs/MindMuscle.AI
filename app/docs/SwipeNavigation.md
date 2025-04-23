# Swipe Navigation Guide for MindMuscle.AI

MindMuscle.AI now supports swipe-right gesture navigation throughout the app. The gesture is implemented globally, so you don't need to add code to every screen.

## How It Works

The swipe-right gesture for back navigation is automatically enabled on all screens via the `GlobalGestureHandler` component in the root layout. This means:

1. Every screen automatically has swipe-back gesture support
2. The hardware back button on Android also uses the same navigation logic 
3. You only need to customize screens that require special back behavior

## Default Behavior

By default, the back gesture will:

- Call `router.back()` on most screens to navigate to the previous screen
- Navigate from edit-profile to profile tab specifically
- Prevent navigation away from tab screens (to avoid exiting the app)

## Customizing Back Navigation

### Option 1: Use the useBackNavigation Hook (Recommended)

```tsx
import { useBackNavigation } from '../hooks/useBackNavigation';
import { useRouter } from 'expo-router';

export default function MyScreen() {
  const router = useRouter();
  
  // Custom back handler that navigates to a specific route
  const handleBack = () => {
    router.push('/(tabs)/profile');
    return true; // Return true to prevent default back behavior
  };
  
  // Register the custom back handler for this screen
  useBackNavigation(handleBack);
  
  return (
    <View>
      <Text>My Screen Content</Text>
    </View>
  );
}
```

### Option 2: Register Multiple Back Handlers

For more complex screens, you can register and unregister back handlers as needed:

```tsx
import { useBackNavigation } from '../components/GlobalGestureHandler';

export default function ComplexScreen() {
  const { registerBackHandler, unregisterBackHandler } = useBackNavigation();
  const pathname = usePathname();
  
  // Register a handler when a modal is open
  useEffect(() => {
    if (isModalOpen) {
      registerBackHandler(pathname + '/modal', () => {
        closeModal();
        return true;
      });
    }
    
    return () => {
      unregisterBackHandler(pathname + '/modal');
    };
  }, [isModalOpen]);
  
  return <View>...</View>;
}
```

## Example: Edit Profile Page

The Edit Profile page uses the hook to navigate back to the profile tab:

```tsx
// in edit-profile.tsx
const handleBackNavigation = () => {
  router.push('/(tabs)/profile');
  return true;
};

// Register global back handler for this screen
useBackNavigation(handleBackNavigation);
```

## Troubleshooting

- If a screen is not responding to back gestures, check if it has a custom back handler registered
- For screens with complex navigation needs, ensure your handler returns `true` to prevent default behavior
- If you have nested scrollable areas, the gesture may conflict - adjust the gesture handler in GlobalGestureHandler.tsx 
- For deep customization, modify the `handleBack` function in GlobalGestureHandler.tsx 