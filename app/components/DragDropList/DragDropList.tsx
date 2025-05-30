import React, { useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSharedValue, runOnJS, useDerivedValue } from 'react-native-reanimated';
import { DragDropListProps, ItemPositions, NullableString } from './types';
import { getInitialPositions, positionsToOrderedArray } from './utils';
import DragDropItem from './DragDropItem';
import { DEBUG_DRAG_DROP_LIST } from './debugConfig';

const debugLog = (message: string, data?: unknown) => {
  if (DEBUG_DRAG_DROP_LIST) {
    console.log(`[DragDropList] ${message}`, data || '');
  }
};

const DragDropList: React.FC<DragDropListProps> = ({
  data,
  onReorder,
  itemHeight,
  renderItem,
  keyExtractor,
}) => {
  // Enhanced validation with detailed error logging
  if (!Array.isArray(data)) {
    console.error('DragDropList: data prop must be an array, received:', typeof data, data);
    return null;
  }

  if (typeof itemHeight !== 'number' || itemHeight <= 0) {
    console.error('DragDropList: itemHeight must be a positive number, received:', itemHeight);
    return null;
  }

  if (typeof renderItem !== 'function') {
    console.error('DragDropList: renderItem must be a function, received:', typeof renderItem);
    return null;
  }

  if (typeof keyExtractor !== 'function') {
    console.error('DragDropList: keyExtractor must be a function, received:', typeof keyExtractor);
    return null;
  }

  // Add crash protection wrapper
  const safeRunOnJS = useCallback((fn: (...args: any[]) => any, ...args: any[]) => {
    try {
      runOnJS(fn)(...args);
    } catch (error) {
      console.error('DragDropList: Error in runOnJS wrapper:', error);
    }
  }, []);

  // Debug: Log initial setup
  React.useEffect(() => {
    debugLog('DragDropList initialized', {
      itemCount: data.length,
      itemHeight,
      items: data.map((item) => ({ id: keyExtractor(item), name: item.name })),
    });
  }, []);

  // Shared values for drag state
  const isDragging = useSharedValue<0 | 1>(0);
  const draggedItemId = useSharedValue<NullableString>(null);
  const currentItemPositions = useSharedValue<ItemPositions>({});

  // Track if we've already processed a reorder to prevent loops
  const lastReorderRef = useRef<string>('');
  const hasActiveReorderRef = useRef<boolean>(false);

  // Track the last data to prevent unnecessary updates
  const lastDataRef = useRef<string>('');

  // Initialize positions safely
  useEffect(() => {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        currentItemPositions.value = {};
        return;
      }

      const dataKey = data
        .map((item) => `${item?.id || 'unknown'}-${item?.name || 'unnamed'}`)
        .join('|');

      if (lastDataRef.current === dataKey) {
        // Data hasn't actually changed, skip update
        return;
      }

      debugLog('Data changed, updating positions', {
        newItemCount: data.length,
        newItems: data.map((item) => ({ id: item?.id, name: item?.name })),
      });

      // Reset reorder tracking when data changes externally
      hasActiveReorderRef.current = false;
      lastReorderRef.current = '';
      lastDataRef.current = dataKey;

      currentItemPositions.value = getInitialPositions(data, itemHeight);
    } catch (error) {
      console.error('DragDropList: Error updating positions:', error);
      currentItemPositions.value = {};
    }
  }, [data, itemHeight]);

  // Handle reorder callback with error handling
  const handleReorder = useCallback(
    (newPositions: ItemPositions) => {
      try {
        // Prevent reorder loops
        if (hasActiveReorderRef.current) {
          debugLog('Skipping reorder - already processing');
          return;
        }

        if (!newPositions || typeof newPositions !== 'object') {
          console.error('DragDropList: Invalid positions in handleReorder:', newPositions);
          return;
        }

        const positionsKey = JSON.stringify(newPositions);
        if (lastReorderRef.current === positionsKey) {
          debugLog('Skipping reorder - same positions as last reorder');
          return;
        }

        debugLog('handleReorder called', {
          positions: Object.keys(newPositions).reduce(
            (acc, key) => {
              acc[key] = newPositions[key]?.updatedIndex;
              return acc;
            },
            {} as Record<string, number>,
          ),
        });

        if (!Array.isArray(data) || data.length === 0) {
          console.warn('DragDropList: Cannot reorder - invalid data array');
          return;
        }

        const reorderedData = positionsToOrderedArray(data, newPositions);

        if (!Array.isArray(reorderedData)) {
          console.error('DragDropList: positionsToOrderedArray returned invalid data');
          return;
        }

        // Check if the order actually changed
        const originalOrder = data.map((item) => item?.name || 'unnamed').join(',');
        const newOrder = reorderedData.map((item) => item?.name || 'unnamed').join(',');

        if (originalOrder === newOrder) {
          debugLog('Skipping reorder - no actual change in order', {
            originalOrder: data.map((item) => item?.name),
            newOrder: reorderedData.map((item) => item?.name),
          });
          return;
        }

        debugLog('Calling onReorder with reordered data', {
          originalOrder: data.map((item) => item?.name),
          newOrder: reorderedData.map((item) => item?.name),
        });

        // Mark as processing and store the positions
        hasActiveReorderRef.current = true;
        lastReorderRef.current = positionsKey;

        if (typeof onReorder === 'function') {
          onReorder(reorderedData);
        } else {
          console.error('DragDropList: onReorder is not a function');
        }

        // Reset processing flag after a short delay
        setTimeout(() => {
          hasActiveReorderRef.current = false;
        }, 100);
      } catch (error) {
        console.error('DragDropList: Error in handleReorder:', error);
        hasActiveReorderRef.current = false;
      }
    },
    [data, onReorder],
  );

  // Monitor position changes and trigger reorder when dragging stops
  useDerivedValue(() => {
    try {
      const isDraggingValue = isDragging.value;
      const draggedId = draggedItemId.value;

      // Only trigger reorder when drag session actually ends (was dragging, now not)
      if (isDraggingValue === 0 && draggedId === null) {
        // Use runOnJS to safely access refs
        runOnJS((positions: ItemPositions) => {
          try {
            if (hasActiveReorderRef.current) {
              return;
            }

            if (!positions || typeof positions !== 'object') {
              return;
            }

            // Check if there was actually a drag session by looking at positions
            const hasPositionChanges = Object.keys(positions).some((key) => {
              const position = positions[key];
              if (!position || typeof position !== 'object') return false;

              const originalIndex = data.findIndex((item) => item?.id === key);
              return position.updatedIndex !== originalIndex;
            });

            if (hasPositionChanges) {
              debugLog('Drag session ended with changes, triggering reorder');
              handleReorder(positions);
            } else {
              debugLog('Drag session ended with no changes, skipping reorder');
            }
          } catch (error) {
            console.error('DragDropList: Error in drag end handler:', error);
          }
        })(currentItemPositions.value);
      }
    } catch (error) {
      console.error('DragDropList: Error in useDerivedValue:', error);
    }
  });

  // Debug: Monitor shared value changes (only when debug is enabled)
  if (DEBUG_DRAG_DROP_LIST) {
    const debugCounterRef = useRef(0);
    useDerivedValue(() => {
      try {
        debugCounterRef.current++;
        if (debugCounterRef.current % 50 === 0) {
          // Log every 50th change to reduce spam significantly
          const isDraggingValue = isDragging.value;
          const draggedId = draggedItemId.value;

          runOnJS(debugLog)('Shared values state', {
            isDragging: isDraggingValue,
            draggedItemId: draggedId,
            hasActiveReorder: hasActiveReorderRef.current,
          });
        }
      } catch (error) {
        console.error('DragDropList: Error in debug monitoring:', error);
      }
    });
  }

  // Safety check before rendering
  if (!Array.isArray(data) || data.length === 0) {
    return <View style={styles.container}>{/* Empty container */}</View>;
  }

  try {
    return (
      <View style={[styles.container, { height: data.length * itemHeight }]}>
        {data.map((item, index) => {
          // Safety checks for each item
          if (!item || typeof item !== 'object') {
            console.warn('DragDropList: Invalid item at index', index, item);
            return null;
          }

          const key = keyExtractor(item);
          if (!key || typeof key !== 'string') {
            console.warn('DragDropList: Invalid key for item at index', index, key);
            return null;
          }

          // Only log renders when debug is enabled and very rarely
          if (DEBUG_DRAG_DROP_LIST && Math.random() < 0.01) {
            // Log only 1% of renders
            debugLog(`Rendering item ${item.name} at index ${index}`);
          }

          try {
            return (
              <DragDropItem
                key={key}
                item={item}
                index={index}
                itemHeight={itemHeight}
                isDragging={isDragging}
                draggedItemId={draggedItemId}
                currentItemPositions={currentItemPositions}
                renderItem={renderItem}
              />
            );
          } catch (error) {
            console.error('DragDropList: Error rendering DragDropItem at index', index, error);
            return null;
          }
        })}
      </View>
    );
  } catch (error) {
    console.error('DragDropList: Error in main render:', error);
    return <View style={styles.container}>{/* Fallback empty container */}</View>;
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
});

export default DragDropList;
