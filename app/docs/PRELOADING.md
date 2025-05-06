# Data Preloading Architecture

## Overview

MindMuscle.AI uses a comprehensive preloading strategy that loads **all** application data and images during the initial splash screen. This approach eliminates loading delays during navigation and ensures a seamless user experience throughout the app.

## How It Works

1. **SplashScreenManager**: The main orchestrator for preloading all data and assets
2. **CacheManager**: Handles caching and retrieval of preloaded data and images
3. **ImagePreloader**: Optimizes image loading and caching

## Preloading Process

The preloading process follows these steps:

1. **Static Assets**: First, all bundled static assets are loaded (icons, local images, SVGs)
2. **Database Data**: All data tables from Supabase are fetched and cached:
   - Exercises (complete dataset)
   - Workout Plans (complete dataset)
   - Exercise Videos
   - Categories and Subcategories
   - User-specific data (if logged in)
3. **Remote Images**: All remote images from the cached data are then preloaded:
   - Exercise images
   - Workout plan images
   - Video thumbnails
   - Progress photos

## Implementation Details

### Cache Structure

- **Memory Cache**: Fast in-memory cache for frequently accessed data
- **Disk Cache**: Persistent cache for all data and images
- **Cache Prioritization**: Critical data is kept in memory longer

### Data Organization

Data is organized in the cache by key types:
- Raw tables: `'exercises'`, `'workout_plans'`, etc.
- Grouped data: `'exercises_Chest'`, `'workout_plans_beginner'`, etc.
- User-specific data: `'profile_${userId}'`, `'workouts_${userId}'`, etc.

## Using Preloaded Data in Components

Instead of using `useImagePreloader` or making direct Supabase queries in components, use the cached data:

```typescript
// Before
const { data: exercises, error } = await supabase.from('exercises').select('*');
const { loaded } = useImagePreloader(exerciseImages);

// After
const exercises = await cacheManager.getCachedData<Exercise[]>('all_exercises');
// All images are already preloaded
```

## Benefits

1. **Improved Performance**: No loading delays during navigation
2. **Reduced Server Load**: Fewer repeated requests to Supabase
3. **Offline Support**: All data available offline after initial load
4. **Battery Efficiency**: Reduced network activity during app usage

## Considerations

- The initial loading time is longer, but the app experience is much smoother afterward
- Memory usage is higher, but optimized with smart caching strategies
- Regular cache cleanup prevents excessive storage usage

## Debugging

To debug cache operations:
- Check console logs with `📊` prefix for data preloading
- Check console logs with `🖼️` prefix for image preloading
- Cache stats are logged periodically with `📈` prefix 