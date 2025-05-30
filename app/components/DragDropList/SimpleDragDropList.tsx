import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  PanGestureHandler,
  State,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { DragDropItem } from './types';

interface SimpleDragDropListProps {
  data: DragDropItem[];
  onReorder: (reorderedData: DragDropItem[]) => void;
  itemHeight: number;
  renderItem: (item: DragDropItem, index: number, isDragging: boolean) => React.ReactNode;
  keyExtractor: (item: DragDropItem) => string;
}

const SimpleDragDropList: React.FC<SimpleDragDropListProps> = ({
  data,
  onReorder,
  itemHeight,
  renderItem,
  keyExtractor,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [items, setItems] = useState(data);
  const dragY = useSharedValue(0);
  const draggedItemY = useSharedValue(0);

  // Update items when data changes
  React.useEffect(() => {
    setItems(data);
  }, [data]);

  const onGestureEvent = (event: PanGestureHandlerGestureEvent, index: number) => {
    'worklet';
    if (draggedIndex === index) {
      dragY.value = event.nativeEvent.translationY;
      draggedItemY.value = index * itemHeight + event.nativeEvent.translationY;
    }
  };

  const onHandlerStateChange = (event: PanGestureHandlerStateChangeEvent, index: number) => {
    'worklet';
    if (event.nativeEvent.state === State.BEGAN) {
      runOnJS(setDraggedIndex)(index);
      draggedItemY.value = index * itemHeight;
    } else if (event.nativeEvent.state === State.END) {
      const newIndex = Math.round(draggedItemY.value / itemHeight);
      const clampedIndex = Math.max(0, Math.min(newIndex, items.length - 1));

      if (clampedIndex !== index) {
        runOnJS(reorderItems)(index, clampedIndex);
      }

      dragY.value = withSpring(0);
      runOnJS(setDraggedIndex)(null);
    }
  };

  const reorderItems = (fromIndex: number, toIndex: number) => {
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    setItems(newItems);
    onReorder(newItems);
  };

  const getAnimatedStyle = (index: number) => {
    return useAnimatedStyle(() => {
      let translateY = 0;

      if (draggedIndex === index) {
        translateY = dragY.value;
      } else if (draggedIndex !== null) {
        const draggedY = draggedItemY.value;
        const currentY = index * itemHeight;

        if (draggedIndex < index && draggedY > currentY - itemHeight / 2) {
          translateY = -itemHeight;
        } else if (draggedIndex > index && draggedY < currentY + itemHeight / 2) {
          translateY = itemHeight;
        }
      }

      return {
        transform: [{ translateY: withSpring(translateY) }],
        zIndex: draggedIndex === index ? 1000 : 0,
        opacity: draggedIndex === index ? 0.9 : 1,
      };
    });
  };

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const animatedStyle = getAnimatedStyle(index);

        return (
          <PanGestureHandler
            key={keyExtractor(item)}
            onGestureEvent={(event) => onGestureEvent(event, index)}
            onHandlerStateChange={(event) => onHandlerStateChange(event, index)}
            minDist={10}
          >
            <Animated.View style={[styles.itemContainer, { height: itemHeight }, animatedStyle]}>
              {renderItem(item, index, draggedIndex === index)}
            </Animated.View>
          </PanGestureHandler>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    width: '100%',
  },
});

export default SimpleDragDropList;
