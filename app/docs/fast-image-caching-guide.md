# MindMuscle.AI Image Caching Guide

This guide explains the image caching system implemented in MindMuscle.AI using react-native-fast-image for improved performance, reduced network usage, and optimized memory management.

## Overview

The app uses FastImage for native platforms and expo-image for web, providing:

- Prioritized image loading
- Configurable caching policies
- Improved performance with minimal memory usage
- Support for preloading important images
- Fallback images for failed loads
- Seamless web support

## Components and Utilities

### 1. OptimizedImage Component

The `OptimizedImage` component is a drop-in replacement for the standard React Native Image component with enhanced features:

```tsx
import { OptimizedImage } from '../components/OptimizedImage';

// Basic usage
<OptimizedImage 
  source={{ uri: 'https://example.com/image.jpg' }} 
  style={{ width: 200, height: 200 }}
/>

// With caching and priority options
<OptimizedImage 
  source={{ uri: 'https://example.com/image.jpg' }} 
  style={{ width: 200, height: 200 }}
  priority="high"
  cachePolicy="immutable"
  isImportant={true}
/>

// With loading indicator
<OptimizedImage 
  source={{ uri: 'https://example.com/image.jpg' }} 
  showLoader={true}
  loaderColor="#ff5500"
  loaderSize="large"
/>

// With fallback image
<OptimizedImage 
  source={{ uri: 'https://example.com/image.jpg' }} 
  fallback={require('../assets/placeholder.png')}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| source | string \| number \| { uri: string } | | Image source (URL or require) |
| style | StyleProp<ImageStyle> | | Image style |
| containerStyle | StyleProp<ViewStyle> | | Container style |
| fallback | string \| number | | Fallback image to display on error |
| resizeMode | 'contain' \| 'cover' \| 'stretch' \| 'center' | 'cover' | Image resize mode |
| priority | 'low' \| 'normal' \| 'high' | 'normal' | Loading priority |
| cachePolicy | 'immutable' \| 'web' \| 'cacheOnly' | 'immutable' | Cache policy |
| showLoader | boolean | true | Show loading indicator |
| loaderColor | string | '#007AFF' | Loader color |
| loaderSize | 'small' \| 'large' | 'small' | Loader size |
| isImportant | boolean | false | Keep image in memory |
| debugLabel | string | | Label for debugging |
| onLoadStart | () => void | | Called when loading starts |
| onLoadEnd | () => void | | Called when loading finishes |
| onError | (error: Error) => void | | Called on error |
| testID | string | | Test identifier |

### 2. Image Preloader Utilities

The app includes a set of utilities for managing image preloading and caching:

```tsx
import { 
  batchPreloadImages, 
  markAsImportantImage, 
  clearImageCache,
  ImagePriority,
  CachePolicy
} from '../utils/imagePreloader';

// Preload multiple images
batchPreloadImages(
  ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
  ImagePriority.HIGH,
  10, // batch size
  (progress, completed, total) => {
    console.log(`Preloaded ${completed}/${total} images (${progress * 100}%)`);
  }
);

// Mark image as important to keep in memory
markAsImportantImage('https://example.com/important-image.jpg');

// Clear cache when needed
await clearImageCache();
```

### 3. useImagePreloader Hook

For more advanced preloading with React hooks:

```tsx
import { useImagePreloader } from '../hooks/useImagePreloader';

function MyComponent() {
  const imagesToPreload = [
    'https://example.com/image1.jpg', 
    'https://example.com/image2.jpg'
  ];
  
  const { 
    loaded, 
    error, 
    progress, 
    completedCount, 
    totalCount, 
    timing 
  } = useImagePreloader(imagesToPreload, {
    priority: 'high',
    batchSize: 10,
    debugLabel: 'MyComponentImages'
  });
  
  return (
    <View>
      {!loaded && (
        <Text>Loading images: {completedCount}/{totalCount} ({(progress * 100).toFixed(0)}%)</Text>
      )}
      {error && <Text>Error: {error}</Text>}
      {loaded && <Text>All images loaded in {timing?.duration}ms</Text>}
    </View>
  );
}
```

## Caching Policies

Choose the right caching policy for different types of images:

1. **CachePolicy.IMMUTABLE** (default)
   - Use for static assets that won't change
   - Provides the longest cache lifetime
   - Best for exercise images, logos, icons

2. **CachePolicy.WEB**
   - Use for dynamic content that updates occasionally
   - Similar to browser caching, respects HTTP headers
   - Best for user profile photos, content that changes periodically

3. **CachePolicy.CACHE_ONLY**
   - Only loads from cache, won't hit network
   - Use for offline mode or when prioritizing speed over freshness
   - Best for already cached content when network is unavailable

## Loading Priorities

Set the right priority for different images:

1. **ImagePriority.HIGH**
   - Use for visible UI elements
   - Current screen content
   - Above-the-fold images

2. **ImagePriority.NORMAL** (default)
   - Use for content that will be visible soon
   - Below-the-fold content
   - Images in upcoming screens

3. **ImagePriority.LOW**
   - Use for prefetching
   - Content that might be viewed later
   - Background content

## Best Practices

1. **Preload Critical Images**
   - Use `SplashScreenManager` to preload essential images during app startup
   - Preload images for the current screen and upcoming screens

2. **Set Appropriate Priorities**
   - Use HIGH priority for visible content
   - Use NORMAL or LOW for background/upcoming content

3. **Choose the Right Cache Policy**
   - Use IMMUTABLE for static content
   - Use WEB for dynamic content
   - Use CACHE_ONLY for offline mode

4. **Memory Management**
   - Mark only truly important images with `isImportant`
   - Call `clearImageCache()` when experiencing memory pressure

5. **Error Handling**
   - Always provide fallback images for critical UI elements
   - Handle loading errors gracefully

6. **Cross-Platform Support**
   - The system works seamlessly on native and web platforms
   - Web uses `expo-image` as a fallback

## Debugging

Set debug flags to true to enable verbose logging:

```typescript
// In utils/imagePreloader.ts
export const DEBUG_IMAGE_PRELOADER = true;

// In components/OptimizedImage.tsx
export const DEBUG_OPTIMIZED_IMAGE = true;
```

When debugging, use the `debugLabel` prop to identify specific instances in logs:

```tsx
<OptimizedImage 
  source={{ uri: 'https://example.com/profile.jpg' }}
  debugLabel="ProfileAvatar"
/>
```

This will produce logs like:
```
⏳ [ProfileAvatar] Loading image started
✅ [ProfileAvatar] Image loaded in 230ms
``` 