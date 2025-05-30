# Drag & Drop List Implementation

This is a high-performance drag and drop list implementation built with React Native Reanimated v3 and React Native Gesture Handler, based on the tutorial series by Varun Kukade.

## Features

- **60 FPS Performance**: Runs entirely on the UI thread using Reanimated v3
- **Smooth Animations**: Spring-based animations with proper easing
- **Visual Feedback**: Items scale and change appearance during drag
- **Modular Design**: Clean separation of concerns with reusable components
- **TypeScript Support**: Fully typed for better development experience
- **Customizable**: Easy to customize appearance and behavior

## Components

### DragDropList
The main container component that manages the drag and drop state.

```tsx
import { DragDropList } from './components/DragDropList';

<DragDropList
  data={exercises}
  onReorder={(reorderedData) => setExercises(reorderedData)}
  itemHeight={84}
  renderItem={(item, index, isDragging) => (
    <YourCustomItem item={item} isDragging={isDragging} />
  )}
  keyExtractor={(item) => item.id}
/>
```

### DragDropItem
Individual draggable item component (used internally by DragDropList).

### ExerciseDragCard
Pre-built exercise card component designed for the MindMuscle.AI app.

### ExerciseDragDropExample
Complete example showing how to integrate with the exercise list.

## Props

### DragDropList Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `DragDropItem[]` | Array of items to display |
| `onReorder` | `(reorderedData: DragDropItem[]) => void` | Callback when items are reordered |
| `itemHeight` | `number` | Fixed height of each item |
| `renderItem` | `(item, index, isDragging) => ReactNode` | Function to render each item |
| `keyExtractor` | `(item) => string` | Function to extract unique key |

### ExerciseDragCard Props

| Prop | Type | Description |
|------|------|-------------|
| `exercise` | `DragDropItem` | Exercise data |
| `index` | `number` | Item index |
| `currentExerciseIndex` | `number` | Index of current exercise |
| `isCustomizeMode` | `boolean` | Whether in customize mode |
| `isDragging` | `boolean` | Whether this item is being dragged |
| `exerciseSets` | `Record<string, any[]>` | Exercise sets data |
| `onPress` | `() => void` | Press handler |
| `onRemove` | `() => void` | Remove handler |

## Usage Example

```tsx
import React, { useState } from 'react';
import { ExerciseDragDropExample } from './components/DragDropList';

const MyComponent = () => {
  const [exercises, setExercises] = useState(exerciseData);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);

  return (
    <ExerciseDragDropExample
      exercises={exercises}
      currentExerciseIndex={currentExerciseIndex}
      isCustomizeMode={isCustomizeMode}
      exerciseSets={exerciseSets}
      onReorder={setExercises}
      onExercisePress={(index) => setCurrentExerciseIndex(index)}
      onRemoveExercise={(index) => {
        const newExercises = exercises.filter((_, i) => i !== index);
        setExercises(newExercises);
      }}
    />
  );
};
```

## Integration with ExerciseListModal

To integrate with the existing ExerciseListModal, replace the FlatList section with:

```tsx
import { ExerciseDragDropExample } from './DragDropList';

// In your ExerciseListModal component
{isCustomizeMode ? (
  <ExerciseDragDropExample
    exercises={exList}
    currentExerciseIndex={currentExerciseIndex}
    isCustomizeMode={isCustomizeMode}
    exerciseSets={exerciseSets}
    onReorder={(reorderedExercises) => {
      setExList(reorderedExercises);
      if (onReorderExercises) {
        onReorderExercises(reorderedExercises);
      }
    }}
    onExercisePress={handleExercisePressStable}
    onRemoveExercise={handleRemoveExerciseStable}
  />
) : (
  // Your existing FlatList for non-customize mode
)}
```

## Performance Considerations

1. **Fixed Item Height**: The implementation assumes fixed item heights for optimal performance
2. **UI Thread**: All animations run on the UI thread for 60 FPS performance
3. **Memoization**: Components use React.memo and useMemo for optimal re-rendering
4. **Worklets**: Critical functions are marked with 'worklet' for UI thread execution

## Customization

### Custom Item Renderer

```tsx
const renderCustomItem = (item: DragDropItem, index: number, isDragging: boolean) => {
  return (
    <View style={[
      styles.customItem,
      isDragging && styles.draggingItem
    ]}>
      <Text>{item.name}</Text>
      {/* Your custom content */}
    </View>
  );
};
```

### Custom Animations

Modify the `animatedStyles` in `DragDropItem.tsx` to customize drag animations:

```tsx
const animatedStyles = useAnimatedStyle(() => {
  return {
    transform: [
      { translateY: translateY.value },
      { scale: isDraggingThis ? 1.1 : 1.0 }, // Custom scale
      { rotate: isDraggingThis ? '2deg' : '0deg' }, // Add rotation
    ],
    // Custom colors, shadows, etc.
  };
});
```

## Troubleshooting

### Common Issues

1. **Items not moving smoothly**: Ensure `itemHeight` matches actual item height
2. **Performance issues**: Check that items have stable keys and avoid complex renders
3. **Gesture conflicts**: Make sure GestureHandlerRootView wraps the component
4. **TypeScript errors**: Ensure your data matches the `DragDropItem` interface

### Debug Mode

Enable debug logging by adding console.log statements in the gesture handlers:

```tsx
.onChange((event) => {
  console.log('Dragging:', event.translationY);
  // ... rest of handler
})
```

### Reanimated Warnings

If you see warnings about "Reading from `value` during component render", this has been fixed by:

1. **Avoiding synchronous access to shared values during render**: The `DragDropItem` component now uses React state (`isThisItemDragging`) instead of directly accessing `isCurrentDraggingItem.value` during render.

2. **Configuring Reanimated logger**: The app's root layout (`app/_layout.tsx`) includes configuration to disable strict mode warnings:
   ```tsx
   import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
   
   configureReanimatedLogger({
     level: ReanimatedLogLevel.warn,
     strict: false,
   });
   ```

3. **Using `runOnJS` for state updates**: The dragging state is updated using `runOnJS(setIsThisItemDragging)` within a `useDerivedValue` to ensure proper synchronization between the UI thread and JS thread.

### Performance Considerations

- All animations run on the UI thread for 60 FPS performance
- Shared values are only accessed within `useAnimatedStyle` and `useDerivedValue`
- State updates are properly synchronized using `runOnJS`
- The component uses React state for render-time decisions and shared values for animations

## Dependencies

- `react-native-reanimated`: ^3.17.4
- `react-native-gesture-handler`: ^2.24.0
- `@expo/vector-icons`: For icons
- `expo-linear-gradient`: For gradients (if using ExerciseDragCard)

## Architecture

The implementation follows a modular architecture:

```
DragDropList/
├── types.ts           # TypeScript interfaces
├── utils.ts           # Utility functions
├── DragDropList.tsx   # Main container
├── DragDropItem.tsx   # Individual item
├── ExerciseDragCard.tsx # Exercise-specific card
├── ExerciseDragDropExample.tsx # Complete example
├── index.ts           # Exports
└── README.md          # This file
```

This design allows for easy customization and reuse across different parts of the application.

## Debugging

### Debug Configuration

All debug logging is now centralized in `debugConfig.ts`. To enable debug logging:

1. **Open `app/components/DragDropList/debugConfig.ts`**
2. **Change `ENABLE_DRAG_DROP_DEBUG` to `true`**
3. **Restart your development server**

```typescript
// In debugConfig.ts
export const ENABLE_DRAG_DROP_DEBUG = true; // Change to true for debugging
```

### Debug Output

When debug logging is enabled, you'll see detailed console output including:

**DragDropList logs:**
- List initialization with item data
- Data changes and position updates
- Reorder callbacks with before/after states
- Shared value state changes

**DragDropItem logs:**
- Item initialization with position data
- Drag start/end events with coordinates
- Position updates and index changes
- Style updates during dragging
- Gesture state changes

**DragDropUtils logs:**
- Initial position calculations
- Index calculations during drag
- Item repositioning logic
- Final array ordering

### Debug Frequencies

The debug configuration includes customizable logging frequencies to prevent spam:

```typescript
export const DEBUG_FREQUENCIES = {
  SHARED_VALUE_LOG_FREQUENCY: 50,    // Every 50th shared value change
  RENDER_LOG_FREQUENCY: 0.01,        // 1% of render events
  POSITION_CHANGE_LOG_FREQUENCY: 100, // Every 100px position change
  DRAG_CHANGE_LOG_FREQUENCY: 40,     // Every 40px during drag
  STYLE_UPDATE_LOG_FREQUENCY: 50,    // Every 50px style update
};
```

### Production Mode

For production or when debugging is not needed:

```typescript
// In debugConfig.ts
export const ENABLE_DRAG_DROP_DEBUG = false; // Disabled for production
```

This completely disables all debug logging for optimal performance.

### Common Issues and Debug Patterns

**Uncontrollable dragging:**
- Enable debug logging and check for rapid position updates in `DragDropItem` logs
- Look for incorrect `currentY` calculations in `getNewIndex`
- Verify `itemHeight` is consistent across components

**Items jumping to wrong positions:**
- Monitor `updateItemPositions` logs for incorrect index calculations
- Check if `totalItems` count is accurate
- Verify initial positions are set correctly

**Performance issues:**
- Check for excessive logging (adjust frequencies in `debugConfig.ts`)
- Monitor for unnecessary re-renders in component logs
- Watch for gesture handler performance issues

**Infinite loops (now fixed):**
- Look for repeated "Data changed, updating positions" without actual changes
- Check for "Skipping reorder" messages indicating proper loop prevention
- Monitor reorder callback frequency

### Example Debug Session

```
[DragDropList] DragDropList initialized {itemCount: 5, itemHeight: 84, items: [...]}
[DragDropUtils] Creating initial positions {itemCount: 5, itemHeight: 84, items: [...]}
[DragDropItem] Item initialized: Push-ups (item-1) {index: 0, itemHeight: 84, initialTop: 0}
[DragDropItem] Drag started for Push-ups {itemId: "item-1", currentTop: 0, currentTranslateY: 0}
[DragDropItem] Index change for Push-ups {oldIndex: 0, newIndex: 1, currentY: 42, itemHeight: 84}
[DragDropUtils] updateItemPositions: item-1 moving from 0 to 1
[DragDropUtils] Items repositioned: ["item-2: 1 -> 0"]
[DragDropItem] Drag ended for Push-ups {finalPosition: {...}, currentTop: 84, currentTranslateY: 0}
[DragDropList] Drag session ended with changes, triggering reorder
[DragDropList] Calling onReorder with reordered data {originalOrder: [...], newOrder: [...]}
```

### Disabling Debug Logs

To completely disable debug logging:

1. Set `ENABLE_DRAG_DROP_DEBUG = false` in `debugConfig.ts`
2. Restart your development server
3. All drag and drop debug logs will be disabled for optimal performance 