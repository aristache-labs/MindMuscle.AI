import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { DragDropItem, ExerciseSet } from './types';

interface TestDragDropProps {
  exercises: DragDropItem[];
  currentExerciseIndex: number;
  isCustomizeMode: boolean;
  _exerciseSets: Record<string, ExerciseSet[]>;
  _onReorder: (exercises: DragDropItem[]) => void;
  _onExercisePress: (index: number) => void;
  _onRemoveExercise: (index: number) => void;
}

const TestDragDrop: React.FC<TestDragDropProps> = ({
  exercises,
  currentExerciseIndex,
  isCustomizeMode,
  _exerciseSets,
  _onReorder,
  _onExercisePress,
  _onRemoveExercise,
}) => {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  console.log('TestDragDrop: Initializing with', {
    exerciseCount: exercises.length,
    isCustomizeMode,
    currentExerciseIndex,
  });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      try {
        console.log('TestDragDrop: Drag begin');
        isDragging.value = true;
      } catch (error) {
        console.error('TestDragDrop: Error in onBegin:', error);
      }
    })
    .onUpdate((event) => {
      'worklet';
      try {
        translateY.value = event.translationY;
      } catch (error) {
        console.error('TestDragDrop: Error in onUpdate:', error);
      }
    })
    .onEnd(() => {
      'worklet';
      try {
        console.log('TestDragDrop: Drag end');
        translateY.value = withSpring(0);
        isDragging.value = false;

        // Test runOnJS call
        runOnJS(() => {
          console.log('TestDragDrop: runOnJS callback executed successfully');
        })();
      } catch (error) {
        console.error('TestDragDrop: Error in onEnd:', error);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    try {
      return {
        transform: [
          {
            translateY: translateY.value,
          },
          {
            scale: isDragging.value ? withSpring(1.05) : withSpring(1),
          },
        ],
        opacity: isDragging.value ? 0.8 : 1,
      };
    } catch (error) {
      console.error('TestDragDrop: Error in animatedStyle:', error);
      return {};
    }
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Test Drag & Drop ({exercises.length} exercises) -{' '}
        {isCustomizeMode ? 'CUSTOMIZE MODE' : 'VIEW MODE'}
      </Text>
      {exercises.map((exercise, index) => (
        <GestureDetector key={exercise.id} gesture={panGesture}>
          <Animated.View style={[styles.item, animatedStyle]}>
            <Text style={styles.itemText}>
              {index === currentExerciseIndex ? '→ ' : ''}
              {exercise.name}
            </Text>
            <Text style={styles.itemSubtext}>
              {exercise.sets} sets x {exercise.reps_range} reps
            </Text>
          </Animated.View>
        </GestureDetector>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  item: {
    backgroundColor: '#2A2D3A',
    padding: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  itemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  itemSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

export default TestDragDrop;
