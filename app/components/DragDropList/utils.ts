import { ItemPositions, DragDropItem } from './types';
import { DEBUG_DRAG_DROP_UTILS } from './debugConfig';

const debugLog = (message: string, data?: unknown) => {
  if (DEBUG_DRAG_DROP_UTILS) {
    console.log(`[DragDropUtils] ${message}`, data || '');
  }
};

/**
 * Creates initial positions object for drag and drop items
 */
export const getInitialPositions = (data: DragDropItem[], itemHeight: number): ItemPositions => {
  debugLog('Creating initial positions', {
    itemCount: data.length,
    itemHeight,
    items: data.map((item) => ({ id: item.id, name: item.name })),
  });

  const itemPositions: ItemPositions = {};
  for (let i = 0; i < data.length; i++) {
    itemPositions[data[i].id] = {
      updatedIndex: i,
      updatedTop: i * itemHeight,
    };
  }

  debugLog('Initial positions created', itemPositions);
  return itemPositions;
};

/**
 * Calculates the new index based on the current Y position
 */
export const getNewIndex = (currentY: number, itemHeight: number, totalItems: number): number => {
  'worklet';
  const newIndex = Math.round(currentY / itemHeight);
  const clampedIndex = Math.max(0, Math.min(newIndex, totalItems - 1));

  // Only log if there's a significant calculation (reduced frequency)
  if (Math.abs(currentY) % 100 < 2) {
    // Log every ~100px instead of 50px
    console.log(
      `[DragDropUtils] getNewIndex: currentY=${currentY}, itemHeight=${itemHeight}, totalItems=${totalItems}, rawIndex=${newIndex}, clampedIndex=${clampedIndex}`,
    );
  }

  return clampedIndex;
};

/**
 * Updates positions of all items when an item is moved
 */
export const updateItemPositions = (
  positions: ItemPositions,
  draggedItemId: string,
  newIndex: number,
  itemHeight: number,
): ItemPositions => {
  'worklet';

  const updatedPositions = { ...positions };
  const draggedItem = updatedPositions[draggedItemId];

  if (!draggedItem) {
    console.log(`[DragDropUtils] ERROR: Dragged item ${draggedItemId} not found in positions`);
    return positions;
  }

  const oldIndex = draggedItem.updatedIndex;

  // Only log if there's an actual index change
  if (oldIndex !== newIndex) {
    console.log(
      `[DragDropUtils] updateItemPositions: ${draggedItemId} moving from ${oldIndex} to ${newIndex}`,
    );
  }

  // Update the dragged item's position
  draggedItem.updatedIndex = newIndex;
  draggedItem.updatedTop = newIndex * itemHeight;

  // Track which items are being moved
  const movedItems: string[] = [];

  // Update positions of other items
  Object.keys(updatedPositions).forEach((itemId) => {
    if (itemId !== draggedItemId) {
      const item = updatedPositions[itemId];
      const currentIndex = item.updatedIndex;
      let newItemIndex = currentIndex;

      if (oldIndex < newIndex) {
        // Moving down: shift items up
        if (currentIndex > oldIndex && currentIndex <= newIndex) {
          newItemIndex = currentIndex - 1;
          movedItems.push(`${itemId}: ${currentIndex} -> ${newItemIndex}`);
        }
      } else if (oldIndex > newIndex) {
        // Moving up: shift items down
        if (currentIndex >= newIndex && currentIndex < oldIndex) {
          newItemIndex = currentIndex + 1;
          movedItems.push(`${itemId}: ${currentIndex} -> ${newItemIndex}`);
        }
      }

      if (newItemIndex !== currentIndex) {
        item.updatedIndex = newItemIndex;
        item.updatedTop = newItemIndex * itemHeight;
      }
    }
  });

  // Only log if there were actual movements
  if (movedItems.length > 0) {
    console.log(`[DragDropUtils] Items repositioned:`, movedItems);
  }

  return updatedPositions;
};

/**
 * Converts positions back to ordered array
 */
export const positionsToOrderedArray = (
  data: DragDropItem[],
  positions: ItemPositions,
): DragDropItem[] => {
  'worklet';

  console.log(`[DragDropUtils] Converting positions to ordered array`, {
    originalOrder: data.map((item) => item.name),
    positions: Object.keys(positions).reduce(
      (acc, key) => {
        acc[key] = positions[key].updatedIndex;
        return acc;
      },
      {} as Record<string, number>,
    ),
  });

  const orderedArray = new Array(data.length);

  data.forEach((item) => {
    const position = positions[item.id];
    if (position) {
      orderedArray[position.updatedIndex] = item;
    } else {
      console.log(`[DragDropUtils] WARNING: No position found for item ${item.id} (${item.name})`);
    }
  });

  const filteredArray = orderedArray.filter(Boolean); // Remove any undefined items

  console.log(
    `[DragDropUtils] Final ordered array:`,
    filteredArray.map((item) => item.name),
  );

  return filteredArray;
};
