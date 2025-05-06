# MindMuscle.AI Image System Debugging Guide

This document explains the enhanced debugging and logging system implemented for the image loading and processing components in the MindMuscle.AI app.

## Debug Flags

The following debug flags can be enabled/disabled to control the verbosity of logging:

| Flag | Location | Purpose |
|------|----------|---------|
| `DEBUG_IMAGE_PRELOADER` | utils/imagePreloader.ts | Core image preloading utilities |
| `DEBUG_OPTIMIZED_IMAGE` | components/OptimizedImage.tsx | OptimizedImage component logs |
| `DEBUG_PROGRESS_PHOTOS` | store/ProgressPhotosContext.tsx, services/progressPhotos.ts | Progress photos handling |
| `DEBUG_SPLASH_SCREEN` | components/SplashScreenManager.tsx | App initialization and loading screen |

## Emoji Code System

The logging system uses emoji prefixes for better visual scanning:

| Emoji | Meaning |
|-------|---------|
| 🚀 | Starting operations |
| ⏳ | Loading/in progress |
| ✅ | Success |
| ❌ | Errors |
| ⚠️ | Warnings |
| 📊 | Stats/metrics |
| ⏱️ | Timing information |
| 🏁 | Completion of operations |
| 🔍 | Checks/verifications |
| 🔄 | Refresh/reload operations |
| 🖼️ | Image-specific operations |
| 🔗 | URLs and links |
| 📋 | File paths and resources |
| 🗑️ | Deletion operations |

## Timing Metrics

Detailed timing metrics are now captured for all image operations:

- **Load duration**: Time taken to load an image from network or cache
- **Preload duration**: Time taken to preload an image
- **Upload duration**: Time taken to upload an image
- **Total operation duration**: Total time for complex operations
- **Component prepare/load times**: Time each component takes to prepare and load images

## Component-Specific Metrics

### useImagePreloader Hook

The hook now provides detailed metrics:

```typescript
interface PreloadingStatus {
  loaded: boolean;
  error: string | null;
  progress: number;
  completedCount: number;
  totalCount: number;
  timing?: {
    startTime: number;
    endTime: number | null;
    duration: number | null;
  };
}
```

### OptimizedImage Component

The component tracks detailed timing information:

```typescript
interface ImageTiming {
  prepareStart: number | null;
  prepareEnd: number | null;
  loadStart: number | null;
  loadEnd: number | null;
  totalDuration: number | null;
  prepareDuration: number | null;
  loadDuration: number | null;
}
```

### ProgressPhotosContext

The context now tracks:

- Last refresh time
- Upload times for before/after images
- Preloading status and duration

### SplashScreenManager

Captures comprehensive timing for app startup:

```typescript
interface TimingMetrics {
  start: number;
  staticAssets: number;
  remoteImages: number;
  userData: number;
  allData: number;
  total: number;
  staticAssetsDuration?: number;
  remoteImagesDuration?: number;
  userDataDuration?: number;
  totalDuration?: number;
}
```

## Debug Labels

Components and hooks accept debug labels to identify specific instances in logs:

```jsx
<OptimizedImage 
  source={imageUrl} 
  debugLabel="ProfileAvatar" 
  // ...other props
/>

// or

const { loaded, error, progress } = useImagePreloader(
  imageSources, 
  { priority: true, debugLabel: "ExerciseGallery" }
);
```

## Sample Log Output

```
🚀 [SplashScreenManager] Starting app preparation at 2023-10-15T12:34:56.789Z
📊 [SplashScreenManager] App config: batch size=15, timeouts={"STATIC_ASSETS":4000,"REMOTE_IMAGES":30000,"DATA":20000,"USER_SPECIFIC":10000,"CONTENT":15000}
⏱️ [SplashScreenManager] Static assets loaded in 1234ms
📊 [SplashScreenManager] Retrieved 83 image URLs to preload
📊 [SplashScreenManager] Remote images progress: 45/83 (54.2%)
✅ [ExerciseGallery] Image 12/20 loaded (534ms): https://example.com/images/exercise12.jpg
⏱️ [ProgressPhotoService] Upload completed in 342ms
🏁 [SplashScreenManager] App preparation completed in 4321ms
```

## How to Use These Logs

1. **Performance optimization**: Identify slow loading images or bottlenecks
2. **Error diagnosis**: Track failures in image loading or processing 
3. **User experience improvement**: Measure actual load times for different users
4. **Memory usage optimization**: Identify memory-intensive operations
5. **Connection issues**: Detect network-related problems affecting image loading

## Recommended Developer Tools

1. **React Native Debugger**: Filter logs by emoji prefixes
2. **Metro bundler console**: View real-time logs during development
3. **Sentry.io**: Configure to capture and analyze these logs in production 