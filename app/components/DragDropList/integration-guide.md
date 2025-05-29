# Integration Guide: Adding Drag & Drop to ExerciseListModal

This guide shows how to integrate the drag and drop functionality into the existing ExerciseListModal component.

## Step 1: Import the Components

Add these imports to the top of `ExerciseListModal.tsx`:

```tsx
import { ExerciseDragDropExample } from './DragDropList';
```

## Step 2: Update the Exercise Interface

The existing `Exercise` interface is already compatible with `DragDropItem`. No changes needed.

## Step 3: Replace the FlatList in Customize Mode

Find the section where `renderSimpleList` is rendered (around line 650) and replace it with:

```tsx
// Replace the existing renderSimpleList section with:
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
  <ErrorBoundary>
    {renderSimpleList}
  </ErrorBoundary>
)}
```

## Step 4: Update the Props Interface (Optional)

The `onReorderExercises` prop is already defined in the interface, so no changes needed.

## Step 5: Test the Integration

1. Open the ExerciseListModal
2. Tap "Customize" to enter customize mode
3. Long press and drag any exercise card to reorder
4. The list should smoothly animate and reorder

## Complete Integration Example

Here's the minimal code change needed in the `ExerciseListModal.tsx`:

```tsx
// Add import at the top
import { ExerciseDragDropExample } from './DragDropList';

// Replace the exercise list section (around line 650)
<View style={styles.exerciseListSection}>
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
    <ErrorBoundary>
      {renderSimpleList}
    </ErrorBoundary>
  )}
</View>
```

## Notes

- The drag and drop functionality only activates in customize mode
- In normal mode, the existing FlatList is used for optimal performance
- The drag handle appears on the right side of each exercise card
- Visual feedback includes scaling, shadows, and color changes during drag
- All animations run at 60 FPS on the UI thread

## Troubleshooting

If you encounter issues:

1. Make sure `react-native-gesture-handler` is properly set up
2. Ensure `GestureHandlerRootView` wraps your app
3. Check that the exercise data has stable `id` fields
4. Verify that `onReorderExercises` callback is properly connected 