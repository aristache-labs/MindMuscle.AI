import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { COLORS } from '../../constants/theme';
import OptimizedImage from '../OptimizedImage';
import { styles } from './styles';
import { ExerciseImageProps } from './types';

// Exercise image component with animations
export function ExerciseImage({
  exercise,
  isCompleted,
  isCustomizeMode = false,
  customizeAnimation,
}: ExerciseImageProps) {
  const overlayStyle = useAnimatedStyle(() => {
    if (!customizeAnimation) return {};

    return {
      opacity: customizeAnimation.value,
      transform: [
        {
          scale: interpolate(customizeAnimation.value, [0, 1], [0.8, 1], Extrapolation.CLAMP),
        },
      ],
    };
  }, [customizeAnimation]);

  const iconStyle = useAnimatedStyle(() => {
    if (!customizeAnimation) return {};

    return {
      transform: [
        {
          rotate: `${interpolate(
            customizeAnimation.value,
            [0, 1],
            [180, 0],
            Extrapolation.CLAMP,
          )}deg`,
        },
        {
          scale: interpolate(customizeAnimation.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
        },
      ],
    };
  }, [customizeAnimation]);

  return (
    <View style={styles.exerciseImageContainer}>
      {exercise.image_url ? (
        <OptimizedImage
          source={{ uri: exercise.image_url }}
          style={styles.exerciseImage}
          fallback={require('../../../assets/exercises/placeholder.jpg')}
          resizeMode="cover"
          cachePolicy="immutable"
          showLoader={false}
          priority="normal"
          debugLabel={`ExerciseList-${exercise.name}`}
        />
      ) : (
        <View style={styles.exercisePlaceholder}>
          <Ionicons name="barbell-outline" size={24} color={COLORS.placeholder} />
        </View>
      )}
      {isCompleted && <View style={styles.imageOverlay} />}
      {isCustomizeMode && (
        <Animated.View style={[styles.customizeOverlay, overlayStyle]}>
          <Animated.View style={iconStyle}>
            <Ionicons name="reorder-three-outline" size={20} color="white" />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}
