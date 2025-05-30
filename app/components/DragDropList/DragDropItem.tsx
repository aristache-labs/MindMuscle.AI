import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withDelay,
  interpolate,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { DragDropItemProps } from './types';
import { getNewIndex, updateItemPositions } from './utils';
import { DEBUG_DRAG_DROP_ITEM } from './debugConfig';

const debugLog = (message: string, data?: unknown) => {
  if (DEBUG_DRAG_DROP_ITEM) {
    console.log(`[DragDropItem] ${message}`, data || '');
  }
};

const DragDropItem: React.FC<DragDropItemProps> = ({
  item,
  index,
  itemHeight,
  isDragging,
  draggedItemId,
  currentItemPositions,
  renderItem,
}) => {
  // Safety checks for props
  if (!item || typeof item !== 'object') {
    console.error('DragDropItem: Invalid item prop:', item);
    return null;
  }

  if (typeof index !== 'number' || index < 0) {
    console.error('DragDropItem: Invalid index prop:', index);
    return null;
  }

  if (typeof itemHeight !== 'number' || itemHeight <= 0) {
    console.error('DragDropItem: Invalid itemHeight prop:', itemHeight);
    return null;
  }

  if (typeof renderItem !== 'function') {
    console.error('DragDropItem: renderItem must be a function:', typeof renderItem);
    return null;
  }

  // Individual item position
  const top = useSharedValue(index * itemHeight);
  const translateY = useSharedValue(0);

  // State to track if this item is being dragged (for render purposes)
  const [isThisItemDragging, setIsThisItemDragging] = useState(false);

  // Debug: Log initial setup (only once)
  React.useEffect(() => {
    try {
      debugLog(`Item initialized: ${item?.name || 'Unknown'} (${item?.id || 'No ID'})`, {
        index,
        itemHeight,
        initialTop: index * itemHeight,
      });
    } catch (error) {
      console.error('DragDropItem: Error in initialization effect:', error);
    }
  }, []); // Empty dependency array to run only once

  // Derived values for performance with error handling
  const isDraggingDerived = useDerivedValue(() => {
    try {
      return isDragging?.value || 0;
    } catch (error) {
      console.error('DragDropItem: Error accessing isDragging value:', error);
      return 0;
    }
  });

  const draggedItemIdDerived = useDerivedValue(() => {
    try {
      return draggedItemId?.value || null;
    } catch (error) {
      console.error('DragDropItem: Error accessing draggedItemId value:', error);
      return null;
    }
  });

  const currentItemPositionsDerived = useDerivedValue(() => {
    try {
      return currentItemPositions?.value || {};
    } catch (error) {
      console.error('DragDropItem: Error accessing currentItemPositions value:', error);
      return {};
    }
  });

  // Check if this is the currently dragged item
  const isCurrentDraggingItem = useDerivedValue(() => {
    try {
      return isDraggingDerived.value === 1 && draggedItemIdDerived.value === item?.id;
    } catch (error) {
      console.error('DragDropItem: Error in isCurrentDraggingItem calculation:', error);
      return false;
    }
  });

  // Update state when dragging status changes
  useDerivedValue(() => {
    try {
      const isDraggingThis =
        isDraggingDerived.value === 1 && draggedItemIdDerived.value === item?.id;
      if (isDraggingThis !== isThisItemDragging) {
        runOnJS(debugLog)(`Dragging state change for ${item?.name || 'Unknown'}`, {
          isDraggingThis,
          draggedItemId: draggedItemIdDerived.value,
          isDraggingValue: isDraggingDerived.value,
        });
        runOnJS(setIsThisItemDragging)(isDraggingThis);
      }
    } catch (error) {
      console.error('DragDropItem: Error in dragging state update:', error);
    }
  });

  // Update position based on positions object
  useDerivedValue(() => {
    try {
      const positions = currentItemPositionsDerived.value;
      const itemPosition = positions[item?.id];

      if (itemPosition && !isCurrentDraggingItem.value && typeof itemPosition === 'object') {
        const newTop = itemPosition.updatedTop;
        if (typeof newTop === 'number' && Math.abs(top.value - newTop) > 5) {
          // Only log significant changes (>5px)
          runOnJS(debugLog)(`Position update for ${item?.name || 'Unknown'}`, {
            oldTop: top.value,
            newTop,
            updatedIndex: itemPosition.updatedIndex,
          });
        }
        if (typeof newTop === 'number') {
          top.value = withSpring(newTop, {
            damping: 20,
            stiffness: 300,
          });
        }
      }
    } catch (error) {
      console.error('DragDropItem: Error in position update:', error);
    }
  });

  // Pan gesture handler with debug logging and error handling
  const panGesture = Gesture.Pan()
    .minDistance(10) // Require minimum distance before starting drag
    .activateAfterLongPress(500) // Require long press to start dragging
    .onStart(() => {
      try {
        runOnJS(debugLog)(`Drag started for ${item?.name || 'Unknown'}`, {
          itemId: item?.id,
          currentTop: top.value,
          currentTranslateY: translateY.value,
        });

        // Start dragging
        if (isDragging?.value !== undefined) {
          isDragging.value = withSpring(1);
        }
        if (draggedItemId?.value !== undefined && item?.id) {
          draggedItemId.value = item.id;
        }
      } catch (error) {
        console.error('DragDropItem: Error in drag start:', error);
      }
    })
    .onChange((event) => {
      try {
        if (draggedItemIdDerived.value === item?.id) {
          // Update the dragged item's position
          translateY.value = event.translationY;

          // Calculate new position
          const currentY = top.value + translateY.value;
          const totalItems = Object.keys(currentItemPositionsDerived.value).length;
          const newIndex = getNewIndex(currentY, itemHeight, totalItems);

          // Get current index for comparison
          const currentIndex = currentItemPositionsDerived.value[item?.id]?.updatedIndex ?? index;

          // Debug: Log position calculations (reduced frequency)
          if (Math.abs(event.translationY) % 40 < 2) {
            // Log every ~40px to reduce spam
            runOnJS(debugLog)(`Drag onChange for ${item?.name || 'Unknown'}`, {
              translationY: event.translationY,
              currentY,
              newIndex,
              currentIndex,
              itemHeight,
              totalItems,
            });
          }

          // Update positions if index changed
          if (newIndex !== currentIndex && currentItemPositions?.value) {
            runOnJS(debugLog)(`Index change for ${item?.name || 'Unknown'}`, {
              oldIndex: currentIndex,
              newIndex,
              currentY,
              itemHeight,
            });

            currentItemPositions.value = updateItemPositions(
              currentItemPositionsDerived.value,
              item.id,
              newIndex,
              itemHeight,
            );
          }
        }
      } catch (error) {
        console.error('DragDropItem: Error in drag onChange:', error);
      }
    })
    .onEnd(() => {
      try {
        if (draggedItemIdDerived.value === item?.id) {
          const finalPosition = currentItemPositionsDerived.value[item?.id];

          runOnJS(debugLog)(`Drag ended for ${item?.name || 'Unknown'}`, {
            finalPosition,
            currentTop: top.value,
            currentTranslateY: translateY.value,
          });

          // Snap to final position
          if (finalPosition && typeof finalPosition.updatedTop === 'number') {
            top.value = withSpring(finalPosition.updatedTop, {
              damping: 20,
              stiffness: 300,
            });
          }

          // Reset translation
          translateY.value = withSpring(0);

          // Stop dragging with delay
          if (isDragging?.value !== undefined) {
            isDragging.value = withDelay(200, withSpring(0));
          }
          if (draggedItemId?.value !== undefined) {
            draggedItemId.value = null;
          }

          runOnJS(debugLog)(`Drag cleanup completed for ${item?.name || 'Unknown'}`);
        }
      } catch (error) {
        console.error('DragDropItem: Error in drag end:', error);
      }
    })
    .onFinalize(() => {
      try {
        // Only log finalize for the dragged item to reduce spam
        if (draggedItemIdDerived.value === item?.id) {
          runOnJS(debugLog)(`Gesture finalized for ${item?.name || 'Unknown'}`, {
            isDragging: isDraggingDerived.value,
            draggedItemId: draggedItemIdDerived.value,
          });
        }
      } catch (error) {
        console.error('DragDropItem: Error in gesture finalize:', error);
      }
    });

  // Animated styles with reduced debug logging and error handling
  const animatedStyles = useAnimatedStyle(() => {
    try {
      const isDraggingThis = isCurrentDraggingItem.value;
      const draggingValue = isDraggingDerived.value;

      const styles = {
        top: top.value,
        transform: [
          { translateY: translateY.value },
          {
            scale: isDraggingThis
              ? interpolate(draggingValue, [0, 1], [1, 1.05])
              : interpolate(draggingValue, [0, 1], [1, 0.95]),
          },
        ],
        backgroundColor: isDraggingThis
          ? interpolateColor(
              draggingValue,
              [0, 1],
              ['rgba(28, 29, 34, 1)', 'rgba(139, 92, 246, 0.1)'],
            )
          : 'rgba(28, 29, 34, 1)',
        shadowColor: isDraggingThis
          ? interpolateColor(draggingValue, [0, 1], ['rgba(0, 0, 0, 0)', 'rgba(139, 92, 246, 0.5)'])
          : 'rgba(0, 0, 0, 0)',
        shadowOffset: {
          width: 0,
          height: isDraggingThis ? interpolate(draggingValue, [0, 1], [0, 8]) : 0,
        },
        shadowOpacity: isDraggingThis ? interpolate(draggingValue, [0, 1], [0, 0.3]) : 0,
        shadowRadius: isDraggingThis ? interpolate(draggingValue, [0, 1], [0, 12]) : 0,
        elevation: isDraggingThis ? interpolate(draggingValue, [0, 1], [0, 8]) : 0,
        zIndex: isDraggingThis ? 1000 : 0,
      };

      // Debug: Log style changes for dragged item (reduced frequency)
      if (isDraggingThis && Math.abs(translateY.value) % 50 < 2) {
        // Log every ~50px
        runOnJS(debugLog)(`Style update for dragged ${item?.name || 'Unknown'}`, {
          top: styles.top,
          translateY: translateY.value,
          scale: styles.transform[1].scale,
          zIndex: styles.zIndex,
        });
      }

      return styles;
    } catch (error) {
      console.error('DragDropItem: Error in animated styles:', error);
      return {
        top: top.value,
        transform: [{ translateY: translateY.value }],
      };
    }
  });

  try {
    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.itemContainer, { height: itemHeight }, animatedStyles]}>
          {renderItem(item, index, isThisItemDragging)}
        </Animated.View>
      </GestureDetector>
    );
  } catch (error) {
    console.error('DragDropItem: Error in render:', error);
    return null;
  }
};

const styles = StyleSheet.create({
  itemContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

export default DragDropItem;
